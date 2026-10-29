const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const devices = await prisma.deviceRegistry.findMany();
  for (const d of devices) {
    if (d.deviceName && d.deviceName !== 'HS01') {
      console.log(`Fixing ${d.deviceId}: ${d.deviceName} -> HS01`);
      await prisma.deviceRegistry.update({
        where: { deviceId: d.deviceId },
        data: { deviceName: 'HS01' }
      });
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
