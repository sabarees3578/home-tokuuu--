const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const devices = await prisma.deviceRegistry.findMany();
  console.log("Devices:", devices.map(d => ({ id: d.deviceId, imei: d.imei, mac: d.mac })));
  
  const telemetry = await prisma.telemetryLog.findMany({ take: 5, orderBy: { timestamp: 'desc' } });
  console.log("Recent Telemetry:", telemetry);
}
run();
