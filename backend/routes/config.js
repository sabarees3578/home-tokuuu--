const express = require('express');
const router = express.Router();

if (!process.env.MQTT_HOST) {
  console.warn(
    '[config] MQTT_HOST is not set — falling back to the requesting browser\'s hostname ' +
    'for the device MQTT broker address. This will send an unreachable address (e.g. ' +
    '"localhost") to physical devices during setup and they will fail to connect (rc=-2). ' +
    'Set MQTT_HOST in backend/.env to this server\'s public IP/domain.'
  );
}

router.get('/', (req, res) => {
  const tcpPort = process.env.MQTT_TCP_PORT || 1883;
  const tcpHost = process.env.MQTT_HOST || req.hostname || 'localhost';
  const wsProto = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'wss' : 'ws';
  const publicHost = req.get('host') || `${req.hostname || 'localhost'}:${process.env.PORT || 5000}`;
  res.json({
    mqttWsUrl: `${wsProto}://${publicHost}/mqtt`,
    mqttWsPath: '/mqtt',
    mqttHost: tcpHost,
    mqttPort: Number(tcpPort)
  });
});

// GET /api/config/next-serial
// Returns the next serial number in format: YYYYWWNNNN
// e.g. 2026300001 (year=2026, week=30, counter=0001)
// The counter increments per week — resets each new week.
router.get('/next-serial', async (req, res) => {
  const prisma = req.prisma;
  const now = new Date();
  const year = now.getFullYear();

  // ISO week number
  const jan1 = new Date(year, 0, 1);
  const week = Math.ceil(((now - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  const prefix = `${year}${String(week).padStart(2, '0')}`; // e.g. "202630"

  try {
    // Find highest counter for this year+week
    const existing = await prisma.deviceRegistry.findMany({
      where: { serial_number: { startsWith: prefix } },
      select: { serial_number: true }
    });

    let maxCounter = 0;
    for (const { serial_number } of existing) {
      const counterStr = serial_number?.slice(prefix.length); // last 4 chars
      const n = parseInt(counterStr, 10);
      if (!isNaN(n) && n > maxCounter) maxCounter = n;
    }

    const next = maxCounter + 1;
    const serial = `${prefix}${String(next).padStart(4, '0')}`; // e.g. 2026300001

    res.json({ success: true, serial, year, week, counter: next });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

