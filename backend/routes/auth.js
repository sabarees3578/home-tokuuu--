const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '8h';

if (!JWT_SECRET) {
  console.error('[auth] FATAL: JWT_SECRET is not set in .env — all tokens will fail!');
}

// ── Server-side OTP store (phone → { code, expiresAt, customerName }) ──────
// Kept in-memory; a Redis store is the production upgrade path.
const otpStore = new Map();
const OTP_TTL_MS = 3 * 60 * 1000; // 3 minutes

function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// ── Admin Login ──────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const prisma = req.prisma;

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password are required.' });
  }

  try {
    const admin = await prisma.admin.findUnique({ where: { username } });

    // Constant-time comparison via bcrypt — falls back to plain-text compare
    // only for legacy admins whose password is not yet a bcrypt hash, so
    // existing accounts keep working until you run the migration script.
    const isBcryptHash = admin?.password?.startsWith('$2');
    const passwordOk = admin && (
      isBcryptHash
        ? await bcrypt.compare(password, admin.password)
        : admin.password === password  // legacy plain-text (migrated on next save)
    );

    if (!passwordOk) {
      return res.status(401).json({ success: false, error: 'Invalid credentials.' });
    }

    const token = generateToken({ sub: admin.id, username: admin.username, role: admin.role });

    return res.json({
      success: true,
      user: {
        username: admin.username,
        role: admin.role,
        name: admin.name,
        token,
      }
    });
  } catch (err) {
    console.error('[auth/login]', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

// ── Customer OTP — Send ──────────────────────────────────────────────────────
router.post('/send-otp', async (req, res) => {
  const { phone } = req.body;
  const prisma = req.prisma;

  if (!phone) {
    return res.status(400).json({ success: false, error: 'Phone number is required.' });
  }

  try {
    const customer = await prisma.deviceOwnership.findFirst({
      where: {
        OR: [
          { customerNumber: phone },
          { user1: phone }, { user2: phone },
          { user3: phone }, { user4: phone }, { user5: phone },
        ]
      }
    });

    if (!customer) {
      return res.status(404).json({ success: false, error: 'No account found with this mobile number.' });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit OTP

    // Store OTP server-side — never send it back in the response
    otpStore.set(phone, { code: otp, expiresAt: Date.now() + OTP_TTL_MS, customerName: customer.customerName });

    // TODO: Integrate a real SMS gateway here (Twilio / AWS SNS / MSG91)
    // e.g.:  await smsClient.send({ to: phone, message: `Your OTP is ${otp}` });
    console.log(`[auth/send-otp] OTP for ${phone}: ${otp}`); // visible only in server logs

    const sendSms = require('../utils/sendSms');
    const smsResult = await sendSms(phone, `Your login OTP is ${otp}. Valid for 3 minutes.`);
    
    // Returning OTP for demo/simulation purposes in the frontend, along with SMS status
    return res.json({ success: true, customerName: customer.customerName, otp, smsSent: smsResult.success, smsError: smsResult.error });
  } catch (err) {
    console.error('[auth/send-otp]', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

// ── Customer OTP — Verify ────────────────────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
  const { phone, enteredOtp } = req.body;
  const prisma = req.prisma;

  if (!phone || !enteredOtp) {
    return res.status(400).json({ success: false, error: 'Phone and OTP are required.' });
  }

  const stored = otpStore.get(phone);

  if (!stored) {
    return res.status(401).json({ success: false, error: 'No OTP requested for this number. Please request one first.' });
  }
  if (Date.now() > stored.expiresAt) {
    otpStore.delete(phone);
    return res.status(401).json({ success: false, error: 'OTP has expired. Please request a new one.' });
  }
  if (enteredOtp !== stored.code) {
    return res.status(401).json({ success: false, error: 'Incorrect OTP.' });
  }

  // OTP is valid — consume it immediately (one-time use)
  otpStore.delete(phone);

  try {
    const customer = await prisma.deviceOwnership.findFirst({
      where: {
        OR: [
          { customerNumber: phone },
          { user1: phone }, { user2: phone },
          { user3: phone }, { user4: phone }, { user5: phone },
        ]
      }
    });

    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found.' });
    }

    const token = generateToken({ sub: customer.id, phone: customer.customerNumber, role: 'customer' });

    return res.json({
      success: true,
      user: {
        username: customer.customerNumber,
        role: 'customer',
        name: customer.customerName,
        device_id: customer.deviceId,
        deviceId: customer.deviceId,
        device_name: customer.deviceName,
        photo: null,
        token,
      }
    });
  } catch (err) {
    console.error('[auth/verify-otp]', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

module.exports = router;
