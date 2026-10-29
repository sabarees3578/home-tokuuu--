const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.deviceOwnership.findMany();
  console.log('Total users:', users.length);
  console.log(users);
}
main().catch(console.error).finally(() => prisma.$disconnect());
