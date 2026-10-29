const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  await prisma.deviceRegistry.update({
    where: { deviceId: 'ET-048308BE42D4' },
    data: { mac: '04:83:08:BE:42:D4', imei: '865203088709658' } // Keeping the IMEI since I don't know the real one, or they can update it
  });
  console.log('Fixed DB');
}
run();
