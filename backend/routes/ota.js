const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { formidable } = require('formidable');
const { publishCommand, getClient } = require('../mqtt/client');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'ota');
// HTTPS public domain — device downloads firmware from here via HTTPS (A7670C AT+HTTPACTION)
const PUBLIC_BASE = process.env.OTA_PUBLIC_BASE ||
  `https://${process.env.PUBLIC_DOMAIN || process.env.MQTT_HOST || 'localhost'}`;

function computeMd5(filePath) {
  try {
    const data = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(data).digest('hex');
  } catch {
    return null;
  }
}

// ── Devices (for OTA targeting) ──────────────────────────────────────────────
router.get('/devices', async (req, res) => {
  const prisma = req.prisma;
  try {
    const devices = await prisma.deviceRegistry.findMany({
      include: { statuses: { orderBy: { timestamp: 'desc' }, take: 1 } }
    });
    const mapped = devices.map(d => {
      const latestStatus = d.statuses[0] || {};
      return {
        device_id: d.deviceId,
        model: d.deviceName,
        firmware_version: d.firmware_version,
        auto_update: d.autoUpdate,
        status: latestStatus.deviceStatus || 'Available',
        last_seen: latestStatus.lastSeenAt || d.createdAt,
        has_customer: !!d.ownership
      };
    });
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Toggle auto-update for a device ──────────────────────────────────────────
router.put('/devices/:deviceId/auto-update', async (req, res) => {
  const { deviceId } = req.params;
  const { enabled } = req.body;
  const prisma = req.prisma;
  try {
    await prisma.deviceRegistry.update({
      where: { deviceId },
      data: { autoUpdate: !!enabled }
    });
    res.json({ success: true, device_id: deviceId, auto_update: !!enabled });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── Firmware version list ────────────────────────────────────────────────────
router.get('/versions', async (req, res) => {
  const prisma = req.prisma;
  try {
    const versions = await prisma.firmwareVersion.findMany({ orderBy: { createdAt: 'desc' } });
    const mapped = versions.map(v => ({
      id: v.id,
      version: v.version,
      description: v.description,
      file_name: v.fileName,
      file_size: v.fileSize,
      window: v.window,
      md5: v.md5,
      download_url: `${PUBLIC_BASE}/api/public/ota/download/${v.id}`,
      created_at: v.createdAt
    }));
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Upload firmware file (multipart: file, version, description, window) ────
router.post('/versions', async (req, res) => {
  const prisma = req.prisma;
  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const form = formidable({
      uploadDir: UPLOAD_DIR,
      keepExtensions: true,
      maxFileSize: 100 * 1024 * 1024, // 100 MB
    });

    const [fields, files] = await form.parse(req);

    const version = String(fields.version?.[0] || '').trim();
    if (!version) {
      return res.status(400).json({ success: false, error: 'Version is required. e.g. 1.2.3' });
    }

    const uploaded = files.file?.[0];
    if (!uploaded) {
      return res.status(400).json({ success: false, error: 'Firmware file is required.' });
    }

    // Rename the stored file to something deterministic
    const ext = path.extname(uploaded.originalFilename || uploaded.newFilename) || '.bin';
    let safeVersion = version.replace(/[^a-zA-Z0-9._-]/g, '_');
    const finalName = `fw_${safeVersion}_${Date.now()}${ext}`;
    const finalPath = path.join(UPLOAD_DIR, finalName);
    fs.renameSync(uploaded.filepath, finalPath);

    const size = fs.statSync(finalPath).size;
    const md5 = computeMd5(finalPath);

    const record = await prisma.firmwareVersion.create({
      data: {
        version,
        description: String(fields.description?.[0] || '').trim() || null,
        fileName: uploaded.originalFilename || finalName,
        filePath: finalPath,
        fileSize: size,
        window: String(fields.window?.[0] || 'Auto').trim() || 'Auto',
        md5,
      }
    });

    res.json({
      success: true,
      version: {
        id: record.id,
        version: record.version,
        description: record.description,
        file_name: record.fileName,
        file_size: record.fileSize,
        window: record.window,
        md5: record.md5,
        download_url: `${PUBLIC_BASE}/api/public/ota/download/${record.id}`,
        created_at: record.createdAt,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Delete firmware version ──────────────────────────────────────────────────
router.delete('/versions/:id', async (req, res) => {
  const { id } = req.params;
  const prisma = req.prisma;
  try {
    const record = await prisma.firmwareVersion.findUnique({ where: { id: Number(id) } });
    if (!record) return res.status(404).json({ success: false, error: 'Version not found' });

    await prisma.firmwareVersion.delete({ where: { id: Number(id) } });
    fs.unlink(record.filePath, () => {}); // best-effort file cleanup
    res.json({ success: true, message: 'Version deleted' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── Push OTA update to selected devices ─────────────────────────────────────
// Architecture: MQTT → OTA trigger JSON, HTTPS → device downloads firmware.bin
// Server publishes to:  enthutech/<deviceId>/ota
//   { "version": "1.0.3", "url": "https://tasecurities.godem.in/api/public/ota/download/1",
//     "method": "auto", "md5": "abc123" }
// Device (A7670C) receives via MQTT, then uses AT+HTTPPARA/AT+HTTPACTION to download
router.post('/push', async (req, res) => {
  const { deviceIds, versionId, method } = req.body;
  const prisma = req.prisma;
  const m = method === 'auto' ? 'auto' : 'section';

  if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
    return res.status(400).json({ success: false, error: 'Select at least one device.' });
  }
  if (!versionId) {
    return res.status(400).json({ success: false, error: 'Select a firmware version.' });
  }

  try {
    const version = await prisma.firmwareVersion.findUnique({ where: { id: Number(versionId) } });
    if (!version) return res.status(404).json({ success: false, error: 'Firmware version not found.' });

    // HTTPS download URL — device uses A7670C AT+HTTPACTION to fetch this
    const downloadUrl = `${PUBLIC_BASE}/api/public/ota/download/${version.id}`;

    // JSON payload following the document spec:
    //   { "version": "1.0.3", "url": "https://...", "method": "auto", "md5": "..." }
    const mqttClient = getClient();

    const results = [];
    for (const deviceId of deviceIds) {
      try {
        const otaTopic = `enthutech/${deviceId}/ota`;
        const otaPayload = JSON.stringify({
          version: version.version,
          url: downloadUrl,
          method: m,
          md5: version.md5 || null,
          file_size: version.fileSize || null,
        });

        await new Promise((resolve, reject) => {
          mqttClient.publish(otaTopic, otaPayload, { qos: 1 }, (err) => {
            if (err) reject(err); else resolve();
          });
        });

        const job = await prisma.otaUpdate.create({
          data: { deviceId, versionId: version.id, method: m, status: 'pushing', progress: 0 }
        });
        results.push({ device_id: deviceId, success: true, job_id: job.id });
      } catch (err) {
        results.push({ device_id: deviceId, success: false, error: err.message });
      }
    }

    res.json({ success: true, method: m, version: version.version, results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── OTA update jobs ──────────────────────────────────────────────────────────
router.get('/updates', async (req, res) => {
  const prisma = req.prisma;
  try {
    const jobs = await prisma.otaUpdate.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { version: true }
    });
    const mapped = jobs.map(j => ({
      id: j.id,
      device_id: j.deviceId,
      method: j.method,
      status: j.status,
      progress: j.progress,
      message: j.message,
      version: j.version?.version || null,
      created_at: j.createdAt,
      updated_at: j.updatedAt,
    }));
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;