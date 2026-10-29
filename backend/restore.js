const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const ds = await prisma.deviceStatus.findFirst({ where: { deviceId: 'ET-048308BCDCCC' } });
  if (ds) {
    await prisma.deviceStatus.update({
      where: { id: ds.id },
      data: { deviceStatus: 'Registered' }
    });
  }

  console.log("Restoring Customer...");
  await prisma.deviceOwnership.create({
    data: {
      deviceId: 'ET-048308BCDCCC',
      customerName: 'Admin',
      customerNumber: '6382350242',
      deviceSimNumber: '9999999999',
      customerAddress: 'Recovered Account'
    }
  });
  console.log("Done");
}
main().catch(console.error).finally(() => prisma.$disconnect());
