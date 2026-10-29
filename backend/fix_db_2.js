const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  await prisma.deviceRegistry.update({
    where: { deviceId: 'ET-048308BE42D4' },
    data: { imei: '865203088709849' }
  });
  console.log('Fixed IMEI');
}
run();
