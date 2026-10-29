const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const logs = await prisma.deviceEventLog.findMany({ take: 5, orderBy: { timestamp: 'desc' } });
  console.log(logs.map(l => l.log).join('\n'));
}
main().catch(console.error).finally(() => prisma.$disconnect());
