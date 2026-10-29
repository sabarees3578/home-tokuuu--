const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateData() {
  console.log('Starting data migration...');

  // 1. Migrate Devices -> DeviceRegistry & DeviceStatus
  const oldDevices = await prisma.device.findMany();
  for (const device of oldDevices) {
    // Create DeviceRegistry
    await prisma.deviceRegistry.upsert({
      where: { deviceId: device.device_id },
      update: {},
      create: {
        deviceId: device.device_id,
        deviceName: device.model || 'HS01', // Fallback
        imei: device.imei,
        mac: device.mac_address,
        createdAt: device.createdAt,
      }
    });

    // Create DeviceStatus
    await prisma.deviceStatus.create({
      data: {
        deviceId: device.device_id,
        timestamp: device.last_seen,
        deviceStatus: device.status,
        deviceBattery: null,
        lastSeenAt: device.last_seen,
      }
    });
  }
  console.log(`Migrated ${oldDevices.length} devices.`);

  // 2. Migrate Customers -> DeviceOwnership
  const oldCustomers = await prisma.customer.findMany();
  for (const customer of oldCustomers) {
    await prisma.deviceOwnership.upsert({
      where: { deviceId: customer.deviceId },
      update: {},
      create: {
        deviceId: customer.deviceId,
        customerName: customer.customer_name,
        customerAddress: customer.address || customer.location,
        registeredAt: customer.createdAt,
        customerNumber: customer.customer_number,
        deviceSimNumber: customer.device_sim_number,
        user1: customer.user2_phone,
        user2: customer.user3_phone,
        user3: customer.user4_phone,
      }
    });
  }
  console.log(`Migrated ${oldCustomers.length} customers.`);

  // 3. Migrate TelemetryLog -> DeviceEventLog
  const oldLogs = await prisma.telemetryLog.findMany();
  let logCount = 0;
  for (const log of oldLogs) {
    const deviceExists = oldDevices.find(d => d.device_id === log.deviceId);
    if (!deviceExists) continue;

    const payload = JSON.stringify({
      battery: log.battery,
      signal: log.signal,
      motion_count: log.motion_count,
      alert_active: log.alert_active
    });

    await prisma.deviceEventLog.create({
      data: {
        deviceId: log.deviceId,
        topic: `legacy/telemetry/${log.deviceId}`,
        log: payload,
        timestamp: log.timestamp
      }
    });
    logCount++;
  }
  console.log(`Migrated ${logCount} telemetry logs.`);

  console.log('Data migration complete.');
}

migrateData()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
