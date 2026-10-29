const express = require('express');
const router = express.Router();

/* ── Shared payload parser ──────────────────────────────────────────────────
   The physical device sends raw MQTT data:
     battery  → voltage float (e.g. 4.059 V). Convert to 0-100 %.
     csq      → GSM signal quality 0-31 (99 = unknown). Convert to dBm.
     rssi_dbm → already in dBm, use directly.
     pir      → boolean/int motion trigger.
     protect  → boolean/int protection mode flag.
   Legacy logs that already stored a percent/dBm value are handled gracefully.
*/
function parsePayload(raw) {
  let payload = {};
  try { payload = JSON.parse(raw); } catch (e) {}

  // ── Battery ───────────────────────────────────────────────────────────────
  let battery = payload.battery ?? payload.voltage ?? 100;
  if (battery <= 5) {
    // Raw voltage (3.0 V = 0 %, 4.2 V = 100 %)
    battery = Math.max(0, Math.min(100, Math.round(((battery - 3.0) / 1.2) * 100)));
  } else {
    battery = Math.min(100, Math.round(battery));
  }

  // ── Signal ────────────────────────────────────────────────────────────────
  let signal = 0;
  if (payload.rssi_dbm !== undefined) {
    signal = Math.round(payload.rssi_dbm);
  } else if (payload.csq !== undefined) {
    signal = payload.csq === 99 ? -113 : Math.round(-113 + 2 * payload.csq);
  } else if (payload.signal !== undefined) {
    signal = Math.round(payload.signal);
  }

  // ── Motion / Alert ────────────────────────────────────────────────────────
  const motion_count = payload.motion_count ?? (payload.pir ? 1 : 0);
  const alert_active = payload.alert_active ?? (payload.protect === 1);

  return { battery, signal, motion_count, alert_active };
}

// ── GET /api/telemetry/all  — last 24 h, used by admin dashboard ─────────────
router.get('/all', async (req, res) => {
  const prisma = req.prisma;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const logs = await prisma.deviceEventLog.findMany({
    where: { timestamp: { gte: since } },
    orderBy: { timestamp: 'desc' },
    take: 5000
  });

  const parsedLogs = logs.reverse().map(l => ({
    id: l.id,
    timestamp: l.timestamp,
    deviceId: l.deviceId,
    device_id: l.deviceId,
    ...parsePayload(l.log),
  }));
  res.json(parsedLogs);
});

// ── GET /api/telemetry/recent — latest N rows (for live feeds) ───────────────
router.get('/recent', async (req, res) => {
  const prisma = req.prisma;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);

  const logs = await prisma.deviceEventLog.findMany({
    orderBy: { timestamp: 'desc' },
    take: limit,
    include: { device: { select: { deviceId: true } } }
  });

  const parsedLogs = logs.map(l => ({
    id: l.id,
    timestamp: l.timestamp,
    deviceId: l.deviceId,
    device_id: l.deviceId,
    ...parsePayload(l.log),
    device: l.device
  }));
  res.json(parsedLogs);
});

// ── GET /api/telemetry/summary/all  — KPI summary for admin ─────────────────
router.get('/summary/all', async (req, res) => {
  const prisma = req.prisma;

  const [devices, allStatuses, ownerships] = await Promise.all([
    prisma.deviceRegistry.findMany(),
    prisma.deviceStatus.findMany({ orderBy: { timestamp: 'desc' } }),
    prisma.deviceOwnership.findMany(),
  ]);

  const latestStatusMap = new Map();
  for (const s of allStatuses) {
    if (!latestStatusMap.has(s.deviceId)) latestStatusMap.set(s.deviceId, s);
  }

  const ownershipSet = new Set(ownerships.map(o => o.deviceId));

  const deviceIds = devices.map(d => d.deviceId);
  const recentLogs = await prisma.deviceEventLog.findMany({
    where: { deviceId: { in: deviceIds } },
    orderBy: { timestamp: 'desc' },
    take: deviceIds.length * 5,
  });
  const latestLogMap = new Map();
  for (const log of recentLogs) {
    if (!latestLogMap.has(log.deviceId)) latestLogMap.set(log.deviceId, log);
  }

  const now = new Date();
  const activeThreshold = 30 * 60 * 1000;

  const stats = {
    total: devices.length,
    online: 0, offline: 0, protectionMode: 0,
    registeredCustomers: 0, motionAlerts: 0,
    avgBattery: 0, avgSignal: 0,
  };

  let totalBattery = 0, totalSignal = 0, logCount = 0;

  for (const device of devices) {
    if (ownershipSet.has(device.deviceId)) stats.registeredCustomers++;

    const latestStatus = latestStatusMap.get(device.deviceId);
    const lastSeen = latestStatus ? new Date(latestStatus.lastSeenAt) : new Date(0);
    if ((now - lastSeen) < activeThreshold) stats.online++;
    else stats.offline++;

    const latestLog = latestLogMap.get(device.deviceId);
    if (latestLog) {
      const p = parsePayload(latestLog.log);
      if (p.alert_active) stats.protectionMode++;
      stats.motionAlerts += p.motion_count;
      totalBattery += p.battery;
      totalSignal += p.signal;
      logCount++;
    }
  }

  if (logCount > 0) {
    stats.avgBattery = Math.round(totalBattery / logCount);
    stats.avgSignal = Math.round(totalSignal / logCount);
  }

  res.json(stats);
});

// ── GET /api/telemetry/:deviceId  — history for one device ───────────────────
router.get('/:deviceId', async (req, res) => {
  const prisma = req.prisma;
  const { deviceId } = req.params;

  const logs = await prisma.deviceEventLog.findMany({
    where: { deviceId },
    orderBy: { timestamp: 'desc' },
    take: 5000
  });

  const parsedLogs = logs.reverse().map(l => ({
    id: l.id,
    timestamp: l.timestamp,
    deviceId: l.deviceId,
    device_id: l.deviceId,
    ...parsePayload(l.log),
  }));
  res.json(parsedLogs);
});

module.exports = router;
