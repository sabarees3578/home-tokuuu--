const { Aedes } = require('aedes');
const WebSocket = require('ws');
const websocketStream = require('websocket-stream');

// Real HS01 firmware reports battery as raw cell voltage, not a percentage.
// Estimate a percentage from a typical Li-ion/LiPo single-cell discharge range.
const BATTERY_MIN_V = 3.3; // ~0%
const BATTERY_MAX_V = 4.2; // ~100%

function voltageToPercent(v) {
  if (typeof v !== 'number' || Number.isNaN(v)) return undefined;
  const pct = ((v - BATTERY_MIN_V) / (BATTERY_MAX_V - BATTERY_MIN_V)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

// Real HS01 firmware reports signal as raw RSSI in dBm (negative, often
// fractional). The TelemetryLog.signal column is an integer 0-100 percentage,
// so map the usable Wi-Fi range (-100 dBm = 0%, -50 dBm = 100%).
const RSSI_MIN_DBM = -100; // ~0%
const RSSI_MAX_DBM = -50;  // ~100%

function rssiToPercent(dbm) {
  if (typeof dbm !== 'number' || Number.isNaN(dbm)) return undefined;
  const pct = ((dbm - RSSI_MIN_DBM) / (RSSI_MAX_DBM - RSSI_MIN_DBM)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

const startMqttBroker = async (prisma, httpServer = null) => {
  const aedes = new Aedes();
  await aedes.listen();

  // TCP MQTT (for device/sensor connections)
  const tcpServer = require('net').createServer((socket) => aedes.handle(socket));
  const MQTT_TCP_PORT = process.env.MQTT_TCP_PORT || 1883;

  tcpServer.listen(MQTT_TCP_PORT, function () {
    console.log(`MQTT TCP Broker running on port ${MQTT_TCP_PORT}`);
  });

  // WebSocket MQTT (for browser connections - shares the main HTTP server)
  if (httpServer) {
    const wss = new WebSocket.Server({ server: httpServer, path: '/mqtt' });

    wss.on('connection', (ws) => {
      const stream = websocketStream(ws);
      aedes.handle(stream);
    });

    console.log('MQTT WebSocket attached to main HTTP server at /mqtt');
  } else {
    // Fallback: standalone WebSocket on MQTT_WS_PORT
    const MQTT_WS_PORT = process.env.MQTT_WS_PORT || 8888;
    const wss = new WebSocket.Server({ port: MQTT_WS_PORT }, () => {
      console.log(`MQTT WebSocket Broker running on port ${MQTT_WS_PORT}`);
    });

    wss.on('connection', (ws) => {
      const stream = websocketStream(ws);
      aedes.handle(stream);
    });
  }

  // Handle client connections
  aedes.on('client', (client) => {
    console.log(`MQTT Client Connected: ${client ? client.id : client}`);
  });

  // Handle client disconnections
  aedes.on('clientDisconnect', (client) => {
    console.log(`MQTT Client Disconnected: ${client ? client.id : client}`);
  });

  async function ensureDeviceRegistered(deviceId) {
    try {
      const device = await prisma.deviceRegistry.findUnique({ where: { deviceId } });
      if (!device) {
        console.log(`[MQTT] Device not found, auto-registering: ${deviceId}`);
        await prisma.deviceRegistry.create({
          data: {
            deviceId,
            deviceName: 'HS01',
          }
        });
        await prisma.deviceStatus.create({
          data: {
            deviceId,
            deviceStatus: 'Available',
            lastSeenAt: new Date()
          }
        });
        console.log(`[MQTT] Auto-registered device: ${deviceId}`);
      }
    } catch (e) {
      // Ignore if already created or race condition
    }
  }

  // Update last_seen without requiring a full telemetry reading (used for
  // lightweight "online" heartbeat messages that carry no sensor data).
  async function touchLastSeen(deviceId) {
    try {
      const statusRecord = await prisma.deviceStatus.findFirst({ where: { deviceId } });
      if (statusRecord) {
        await prisma.deviceStatus.update({ where: { id: statusRecord.id }, data: { lastSeenAt: new Date() } });
      } else {
        await ensureDeviceRegistered(deviceId);
      }
    } catch {
      console.warn(`[MQTT] Ignored heartbeat for unknown device ${deviceId}`);
    }
  }

  // Persist one telemetry reading and bump the device's last_seen.
  async function ingestTelemetry(deviceId, topic, payloadStr) {
    let device = await prisma.deviceRegistry.findUnique({ where: { deviceId } });
    if (!device) {
      await ensureDeviceRegistered(deviceId);
      device = await prisma.deviceRegistry.findUnique({ where: { deviceId } });
    }
    if (!device) {
      console.warn(`[MQTT] Ignored telemetry for unknown device ${deviceId}`);
      return;
    }
    
    const statusRecord = await prisma.deviceStatus.findFirst({ where: { deviceId } });
    if (statusRecord) {
      await prisma.deviceStatus.update({ where: { id: statusRecord.id }, data: { lastSeenAt: new Date() } });
    } else {
      await prisma.deviceStatus.create({ data: { deviceId, deviceStatus: 'Available', lastSeenAt: new Date() } });
    }

    await prisma.deviceEventLog.create({
      data: { deviceId, topic, log: payloadStr }
    });
    console.log(`[MQTT] Saved telemetry for ${deviceId}`);
  }

  // ── OTA status reporting from device firmware (esp_ota_ops flow) ──
  // Expected payload:
  //   { "Device-ID": "...", "ota_status": "pushing|downloading|flashing|success|failed",
  //     "progress": 0-100, "version": "1.2.3", "message": "..." }
  async function ingestOtaStatus(deviceId, data) {
    try {
      const status = String(data.ota_status || data.status || '').toLowerCase();
      const progress = Math.max(0, Math.min(100, Number(data.progress) || 0));
      const version = data.version || data.firmware_version || null;

      // Update the latest OTA job for this device
      const job = await prisma.otaUpdate.findFirst({
        where: { deviceId, status: { notIn: ['success', 'failed'] } },
        orderBy: { createdAt: 'desc' }
      });

      if (job) {
        const nextStatus = status || job.status;
        await prisma.otaUpdate.update({
          where: { id: job.id },
          data: {
            status: nextStatus,
            progress,
            message: String(data.message || data.reason || '').trim() || null,
          }
        });
      }

      // On success / explicit version report → persist as device firmware version
      if (status === 'success' || version) {
        const fwVersion = version || (job ? null : null);
        if (fwVersion) {
          await prisma.deviceRegistry.update({
            where: { deviceId },
            data: { firmware_version: String(fwVersion) }
          });
        }
      }

      await touchLastSeen(deviceId);
      console.log(`[MQTT] OTA ${deviceId}: ${status} ${progress}% ${version || ''}`);
    } catch (e) {
      console.error(`[MQTT] Failed to process OTA status for ${deviceId}:`, e.message);
    }
  }

  // Intercept published messages
  aedes.on('publish', async (packet, client) => {
    if (!client) return;

    const topic = packet.topic;
    const payload = packet.payload.toString();
    console.log(`[MQTT] Published message on ${topic}: ${payload}`);

  const topicParts = topic.split('/');
  const isIngestible =
    (topicParts[0] === 'devices' && topicParts[2] === 'telemetry') ||
    (topicParts[0] === 'enthutech' && (topicParts[2] === 'data' || topicParts[2] === 'status')) ||
    // Device reports OTA progress on enthutech/<id>/ota  OR  enthutech/<id>/ota/status
    (topicParts[0] === 'enthutech' && topicParts[2] === 'ota' && topicParts.length >= 4) ||
    (topicParts[0] === 'enthutech' && topicParts[2] === 'ota' && topicParts.length === 3 && client);
  if (!isIngestible) return;

  let data;
  try {
    data = JSON.parse(payload);
  } catch {
    console.warn(`[MQTT] Ignored non-JSON payload on ${topic}`);
    return;
  }

  try {
    if (topicParts[0] === 'devices' && topicParts[2] === 'telemetry') {
      await ingestTelemetry(topicParts[1], topic, payload);
    } else if (topicParts[0] === 'enthutech' && (topicParts[2] === 'data' || topicParts[2] === 'status' || topicParts[2] === 'ota')) {
      const deviceId = data['Device-ID'];
      if (!deviceId) {
        console.warn(`[MQTT] Ignored message on ${topic}: payload has no Device-ID`);
        return;
      }

      // ── OTA progress / result reporting ──
      // Device reports on  enthutech/<id>/ota   OR  enthutech/<id>/ota/status
      // Server pushes to   enthutech/<id>/ota   (those are cmd-center publishes, client = our server client)
      // We only ingest OTA status when the payload contains ota_status (device→server)
      const isOtaTopic = topicParts[2] === 'ota';
      const isDeviceOtaReport = isOtaTopic && (data.ota_status || data.status);
      if (isDeviceOtaReport) {
        await ingestOtaStatus(deviceId, data);
        return;
      }

      if (topicParts[2] === 'status') {
        // Device may report its running firmware version on (re)boot
        const fw = data['firmware_version'] || data['firmware'] || data['fw_version'];
        if (fw) {
          try {
            await prisma.deviceRegistry.update({
              where: { deviceId },
              data: { firmware_version: String(fw) }
            });
          } catch {}
        }
        await touchLastSeen(deviceId);
      } else {
        // Add normalized values back into the payload string to preserve them
        // for the frontend dashboard
        const enrichedData = {
          ...data,
          battery: voltageToPercent(data.battery) ?? 100,
          signal: rssiToPercent(data.rssi_dbm) ?? 100,
          motion_count: data.pir ? 1 : 0,
          alert_active: !!data.protect,
        };
        const fw = data['firmware_version'] || data['firmware'] || data['fw_version'];
        if (fw) {
          try {
            await prisma.deviceRegistry.update({
              where: { deviceId },
              data: { firmware_version: String(fw) }
            });
          } catch {}
        }
        await ingestTelemetry(deviceId, topic, JSON.stringify(enrichedData));
      }
    }
    } catch (error) {
      console.error(`[MQTT] Failed to process message on ${topic}:`, error);
    }
  });

  return { aedes };
};

module.exports = startMqttBroker;
