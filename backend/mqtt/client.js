const mqtt = require('mqtt');

let client = null;

function getClient() {
  if (client) return client;

  // Use the internal/loopback address for the server-side command publisher
  // so commands don't travel out over the public NIC unnecessarily.
  const MQTT_HOST = process.env.MQTT_INTERNAL_HOST || process.env.MQTT_HOST || 'localhost';
  const MQTT_PORT = process.env.MQTT_TCP_PORT || 1883;
  const url = `mqtt://${MQTT_HOST}:${MQTT_PORT}`;


  client = mqtt.connect(url, {
    clean: true,
    connectTimeout: 5000,
    clientId: `cmd-center-${Date.now()}`
  });

  client.on('connect', () => console.log(`[CMD-MQTT] Connected to ${url}`));
  client.on('error', (err) => console.error('[CMD-MQTT] Error:', err.message));
  // Keep the singleton on 'close': mqtt.js auto-reconnects this same client
  // (default reconnectPeriod 1s). Nulling the reference here would leak a
  // still-reconnecting zombie client and create a duplicate on the next
  // publish.
  client.on('close', () => console.warn('[CMD-MQTT] Connection closed, awaiting reconnect'));

  return client;
}

const PUBLISH_TIMEOUT_MS = 5000;

function publishCommand(deviceId, command, params) {
  return new Promise((resolve, reject) => {
    const c = getClient();

    const topic = `enthutech/${deviceId}/cmd`;
    let payload;

    if (params && params.trim()) {
      payload = `${command} ${params.trim()}`;
    } else {
      payload = command;
    }

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('Timed out waiting for MQTT broker to acknowledge command'));
    }, PUBLISH_TIMEOUT_MS);

    c.publish(topic, payload, { qos: 1 }, (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) reject(err);
      else resolve({ topic, payload });
    });
  });
}

module.exports = { getClient, publishCommand };
