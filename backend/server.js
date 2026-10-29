require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');
const startMqttBroker = require('./mqtt/broker');
const { requireAuth, requireAdmin } = require('./middleware/auth');

const prisma = new PrismaClient();
const app = express();

app.use(helmet({
  contentSecurityPolicy: false, // Disabling CSP temporarily to allow frontend static files without strict config
}));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.set('trust proxy', 1); // Trust first proxy (e.g. Nginx, Cloudflare) to get real client IP

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // Increased to allow frontend's 10-second polling interval
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// Pass prisma to all requests
app.use((req, res, next) => {
  req.prisma = prisma;
  next();
});

// ── Public routes (no auth required) ────────────────────────────────────────
const authRoutes = require('./routes/auth');
const configRoutes = require('./routes/config');

app.use('/api/auth', authRoutes);
app.use('/api/config', configRoutes); // device setup — must be public

app.get('/api/public/device/:deviceId', async (req, res) => {
  const { deviceId } = req.params;
  const prisma = req.prisma;
  try {
    const d = await prisma.deviceRegistry.findUnique({
      where: { deviceId },
      include: {
        ownership: true,
        statuses: { orderBy: { timestamp: 'desc' }, take: 1 }
      }
    });
    if (!d) return res.status(404).json({ success: false, error: 'Device not found' });
    
    const latestStatus = d.statuses[0] || {};
    const hasCustomer = !!d.ownership;
    
    let status = latestStatus.deviceStatus || 'Available';
    if (hasCustomer) status = 'Registered';
    else if (status === 'Registered') status = 'Verified';
    
    const responseData = { success: true, status: status, device_id: d.deviceId };
    
    if (hasCustomer) {
      responseData.customer = {
        customer_name: d.ownership.customerName,
        customer_number: d.ownership.customerNumber,
        device_name: d.ownership.deviceName
      };
    }
    
    return res.json(responseData);
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

const { publishCommand } = require('./mqtt/client');

app.post('/api/public/command', async (req, res) => {
  const { device_id, command, params } = req.body;
  const prisma = req.prisma;
  try {
    const d = await prisma.deviceRegistry.findUnique({
      where: { deviceId: device_id },
      include: { ownership: true }
    });
    if (!d) return res.status(404).json({ success: false, error: 'Device not found' });
    if (d.ownership) return res.status(403).json({ success: false, error: 'Device already registered' });
    
    // Allow limited commands during registration
    const ALLOWED = ['ADMIN', 'ADD1', 'ADD2', 'ADD3', 'ADD4', 'ADD5'];
    if (!ALLOWED.includes(command)) return res.status(403).json({ success: false, error: 'Command not allowed in setup mode' });

    const result = await publishCommand(device_id, command, params || '');
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/public/logs/:deviceId', async (req, res) => {
  const { deviceId } = req.params;
  const prisma = req.prisma;
  try {
    const d = await prisma.deviceRegistry.findUnique({
      where: { deviceId },
      include: { ownership: true }
    });
    if (!d) return res.status(404).json({ success: false, error: 'Device not found' });
    if (d.ownership) return res.status(403).json({ success: false, error: 'Device already registered' });
    
    const logs = await prisma.deviceEventLog.findMany({
      where: { deviceId },
      orderBy: { timestamp: 'desc' },
      take: 20
    });
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Public OTA firmware download (device pulls firmware from here) ──────────
const fs = require('fs');
app.get('/api/public/ota/download/:id', async (req, res) => {
  const { id } = req.params;
  const prisma = req.prisma;
  try {
    const version = await prisma.firmwareVersion.findUnique({ where: { id: Number(id) } });
    if (!version) return res.status(404).json({ success: false, error: 'Firmware not found' });
    if (!fs.existsSync(version.filePath)) return res.status(404).json({ success: false, error: 'Firmware file missing' });

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${version.fileName}"`);
    if (version.md5) res.setHeader('Content-MD5', version.md5);
    res.sendFile(version.filePath);
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ── Public device source code download (admin downloads main.c) ─────────────
const DEVICE_CODE_PATH = path.join(__dirname, 'esp32_a7670c_ota', 'main.c');
app.get('/api/public/ota/device-code', (req, res) => {
  if (!fs.existsSync(DEVICE_CODE_PATH)) {
    return res.status(404).json({ success: false, error: 'Device code not found' });
  }
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="main.c"');
  res.sendFile(DEVICE_CODE_PATH);
});

// ── Full device documentation PDF ────────────────────────────────────────────
const { generateDevicePdf } = require('./utils/generateDevicePdf');
app.get('/api/public/device-docs', (req, res) => {
  try {
    generateDevicePdf(res);
  } catch (err) {
    console.error('[PDF] Error generating device docs:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'PDF generation failed' });
  }
});

const otpStore = new Map();
const OTP_TTL_MS = 5 * 60 * 1000;

const sendSms = require('./utils/sendSms');

app.post('/api/public/registration/send-otp', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ success: false, error: 'Phone is required' });
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  otpStore.set(phone, { code: otp, expiresAt: Date.now() + OTP_TTL_MS });
  console.log(`[Registration OTP] ${phone}: ${otp}`);
  
  // Send the actual SMS
  const smsResult = await sendSms(phone, `Your device registration OTP is ${otp}. Valid for 5 minutes.`);
  
  res.json({ success: true, otp, smsSent: smsResult.success, smsError: smsResult.error }); 
});

app.post('/api/public/registration/verify', async (req, res) => {
  const { deviceId, formData, otp } = req.body;
  const prisma = req.prisma;
  
  if (!deviceId || !formData || !formData.customerNumber || !otp) {
    return res.status(400).json({ success: false, error: 'Missing fields' });
  }

  const stored = otpStore.get(formData.customerNumber);
  if (!stored) return res.status(400).json({ success: false, error: 'No OTP requested' });
  if (Date.now() > stored.expiresAt) return res.status(400).json({ success: false, error: 'OTP expired' });
  if (stored.code !== otp) return res.status(400).json({ success: false, error: 'Invalid OTP' });
  
  otpStore.delete(formData.customerNumber);

  try {
    const d = await prisma.deviceRegistry.findUnique({ where: { deviceId } });
    if (!d) return res.status(404).json({ success: false, error: 'Device not found' });
    
    // Register ownership
    await prisma.deviceOwnership.create({
      data: {
        deviceId,
        customerName: formData.customerName,
        customerAddress: formData.customerAddress,
        customerNumber: formData.customerNumber,
        deviceSimNumber: formData.deviceSimNumber,
        deviceName: formData.deviceName,
        user1: formData.user1,
        user2: formData.user2,
        user3: formData.user3,
        user4: formData.user4,
        user5: formData.user5,
      }
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Protected routes (valid JWT required) ───────────────────────────────────
const devicesRoutes = require('./routes/devices');
const customersRoutes = require('./routes/customers');
const telemetryRoutes = require('./routes/telemetry');
const commandsRoutes = require('./routes/commands');
const commandTemplatesRoutes = require('./routes/commandTemplates');
const ownershipRoutes = require('./routes/ownership');
const otaRoutes = require('./routes/ota');

app.use('/api/devices',   requireAuth, devicesRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/telemetry', requireAuth, telemetryRoutes);
app.use('/api/command',   requireAuth, commandsRoutes);
app.use('/api/command-templates', requireAuth, commandTemplatesRoutes);
app.use('/api/ownership', requireAuth, ownershipRoutes);
app.use('/api/ota',       requireAuth, otaRoutes);

// Unknown API routes → 404 JSON (never fall through to SPA)
app.use('/api', (req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` });
});

// ── Static frontend build ────────────────────────────────────────────────────
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendDist));

// SPA fallback
app.get('{*path}', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
    if (err) res.status(404).send('Frontend build not found — run `npm run build` in frontend/');
  });
});

// ── Global error handler ─────────────────────────────────────────────────────
// Catches URIError from bots/scanners sending malformed percent-encoded paths,
// preventing them from flooding the error log with stack traces.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof URIError) {
    return res.status(400).send('Bad Request');
  }
  console.error('[server] Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error.' });
});

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

server.listen(PORT, async () => {
  console.log(`HTTP Server running on port ${PORT}`);
  await startMqttBroker(prisma, server);
  console.log(`MQTT WebSocket available at ws://localhost:${PORT}/mqtt`);
});
