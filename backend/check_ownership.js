const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const ownership = await prisma.deviceOwnership.findUnique({
    where: { deviceId: 'ET-58BF25EEF370' }
  });
  console.log(ownership);
}

main().catch(console.error).finally(() => prisma.$disconnect());
