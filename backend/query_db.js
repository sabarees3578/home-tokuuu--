const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const adminCount = await prisma.admin.count()
  const admins = await prisma.admin.findMany()
  
  const deviceCount = await prisma.device.count()
  const devices = await prisma.device.findMany({ take: 5 })
  
  const customerCount = await prisma.customer.count()
  const customers = await prisma.customer.findMany({ take: 5 })
  
  const telemetryCount = await prisma.telemetryLog.count()
  const telemetry = await prisma.telemetryLog.findMany({ take: 5 })
  
  console.log(JSON.stringify({
    admins: { count: adminCount, sample: admins },
    devices: { count: deviceCount, sample: devices },
    customers: { count: customerCount, sample: customers },
    telemetry: { count: telemetryCount, sample: telemetry }
  }, null, 2))
}

main().catch(e => {
  console.error(e)
  process.exit(1)
}).finally(async () => {
  await prisma.$disconnect()
})
