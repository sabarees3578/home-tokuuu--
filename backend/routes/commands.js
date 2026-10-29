const express = require('express');
const router = express.Router();
const { publishCommand } = require('../mqtt/client');
const { getCustomCodes } = require('../utils/commandStore');

// Server-side allowlist — must stay in sync with the HS01 firmware command
// set (mirrored in frontend/src/pages/CommandCenter.jsx). Never trust the
// UI's list: this route is the real enforcement point.
const ALLOWED_COMMANDS = new Set([
  'PRO01', 'PRO00',           // protection on/off
  'TES01', 'TES00',           // test mode on/off
  'NAME', 'CLRNAME',          // device name
  'ADMIN', 'CLRADMIN',        // admin phone
  'ADD1', 'ADD2', 'ADD3', 'ADD4', 'ADD5',
  'DEL1', 'DEL2', 'DEL3', 'DEL4', 'DEL5',
  'RESETALL', 'LIST',
]);

// POST /api/command
// Body: { device_id, command, params? }
router.post('/', async (req, res) => {
  const device_id = req.body.device_id || req.body.deviceId;
  const { command, params } = req.body;
  const prisma = req.prisma;

  if (!device_id || !command) {
    return res.status(400).json({ success: false, error: 'device_id and command are required' });
  }

  // If user is a customer, they can only control their own device and only toggle protection.
  if (req.jwtUser.role === 'customer') {
    if (req.jwtUser.device_id !== device_id && req.jwtUser.deviceId !== device_id) {
      return res.status(403).json({ success: false, error: 'Unauthorized to command this device.' });
    }
    if (command !== 'PRO01' && command !== 'PRO00') {
      return res.status(403).json({ success: false, error: 'Customers can only toggle protection.' });
    }
  }
  if (typeof command !== 'string' || !(ALLOWED_COMMANDS.has(command) || getCustomCodes().has(command))) {
    return res.status(400).json({ success: false, error: `Unknown command: ${command}` });
  }
  if (params !== undefined && typeof params !== 'string') {
    return res.status(400).json({ success: false, error: 'params must be a string' });
  }

  try {
    const device = await prisma.deviceRegistry.findUnique({ where: { deviceId: device_id } });
    if (!device) {
      return res.status(404).json({ success: false, error: `Unknown device: ${device_id}` });
    }

    const result = await publishCommand(device_id, command, params || '');
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
