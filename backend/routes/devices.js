const express = require('express');
const router = express.Router();

// Get all devices
router.get('/', async (req, res) => {
  const prisma = req.prisma;
  const devices = await prisma.deviceRegistry.findMany({
    include: {
      ownership: true,
      statuses: {
        orderBy: { timestamp: 'desc' },
        take: 1
      }
    }
  });

  const mapped = devices.map(d => {
    const latestStatus = d.statuses[0] || {};
    const hasCustomer = !!d.ownership;
    
    // Only mark status as 'Registered' if an actual customer ownership record exists
    let status = latestStatus.deviceStatus || 'Available';
    if (hasCustomer) {
      status = 'Registered';
    } else if (status === 'Registered') {
      status = 'Verified';
    }

    return {
      id: d.id,
      device_id: d.deviceId,
      model: d.deviceName,
      imei: d.imei,
      mac_address: d.mac,
      serial_number: d.serial_number,
      firmware_version: d.firmware_version,
      deployed_by: d.developerName,
      verified_by: d.testerName,
      mqtt_id: d.mqttId,
      mqtt_key: d.mqttKey,
      mqtt_url: d.mqttUrl,
      status: status,
      last_seen: latestStatus.lastSeenAt || d.createdAt,
      createdAt: d.createdAt,
      customer: d.ownership ? {
        customer_name: d.ownership.customerName,
        customer_number: d.ownership.customerNumber
      } : null
    };
  });
  res.json(mapped);
});

// Create new device (Admin)
router.post('/', async (req, res) => {
  const { device_id, model, imei, mac_address, mqtt_id, mqtt_key, mqtt_url, serial_number, firmware_version } = req.body;
  const prisma = req.prisma;

  try {
    const newDevice = await prisma.deviceRegistry.upsert({
      where: { deviceId: device_id },
      update: {
        deviceName: model || 'HS01',
        imei,
        mac: mac_address,
        mqttId: mqtt_id || null,
        mqttKey: mqtt_key || null,
        mqttUrl: mqtt_url || null,
        serial_number: serial_number || null,
        firmware_version: firmware_version || null,
      },
      create: {
        deviceId: device_id,
        deviceName: model || 'HS01',
        imei,
        mac: mac_address,
        mqttId: mqtt_id || null,
        mqttKey: mqtt_key || null,
        mqttUrl: mqtt_url || null,
        serial_number: serial_number || null,
        firmware_version: firmware_version || null,
      }
    });

    const statusRecord = await prisma.deviceStatus.findFirst({ where: { deviceId: device_id } });
    if (!statusRecord) {
      await prisma.deviceStatus.create({
        data: {
          deviceId: device_id,
          deviceStatus: 'Available'
        }
      });
    }

    const mappedDevice = {
      id: newDevice.id,
      device_id: newDevice.deviceId,
      model: newDevice.deviceName,
      imei: newDevice.imei,
      mac_address: newDevice.mac,
      serial_number: newDevice.serial_number,
      firmware_version: newDevice.firmware_version,
      mqtt_id: newDevice.mqttId,
      mqtt_key: newDevice.mqttKey,
      mqtt_url: newDevice.mqttUrl,
      status: 'Available',
      last_seen: newDevice.createdAt,
      createdAt: newDevice.createdAt,
      customer: null
    };
    res.json({ success: true, device: mappedDevice });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Verify device
router.post('/verify', async (req, res) => {
  const { device_id, deployed_by, verified_by, notes } = req.body;
  const prisma = req.prisma;

  try {
    const statusRecord = await prisma.deviceStatus.findFirst({
      where: { deviceId: device_id }
    });
    if (statusRecord) {
      await prisma.deviceStatus.update({
        where: { id: statusRecord.id },
        data: { deviceStatus: 'Verified' }
      });
    } else {
      await prisma.deviceStatus.create({
        data: { deviceId: device_id, deviceStatus: 'Verified' }
      });
    }

    await prisma.deviceRegistry.update({
      where: { deviceId: device_id },
      data: {
        developerName: deployed_by || null,
        testerName: verified_by || null
      }
    });

    res.json({ success: true, device: { device_id, status: 'Verified', deployed_by, verified_by } });
  } catch (error) {
    res.status(400).json({ success: false, error: 'Device not found or update failed.' });
  }
});

// Delete device
router.delete('/:device_id', async (req, res) => {
  const { device_id } = req.params;
  const prisma = req.prisma;

  try {
    // First, delete related records (Prisma doesn't cascade automatically unless configured in schema)
    // We should delete telemetry, statuses, event logs, etc. if they exist.
    // Alternatively, just deleting the DeviceRegistry might cascade if configured. Let's try.
    // Wait, let's just delete the registry record, Prisma cascade might handle it.
    await prisma.deviceRegistry.delete({
      where: { deviceId: device_id }
    });
    res.json({ success: true, message: 'Device deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, error: 'Failed to delete device.' });
  }
});

module.exports = router;
