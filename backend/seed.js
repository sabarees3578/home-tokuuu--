const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const admin = await prisma.admin.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: 'admin', // in real life, hash this!
      name: 'System Administrator',
      role: 'admin'
    }
  });
  console.log('Upserted Admin:', admin);

  // Create a verified device (ready to be registered)
  const device1 = await prisma.device.upsert({
    where: { device_id: 'SEC-002' },
    update: {},
    create: {
      device_id: 'SEC-002',
      model: 'AT-IND-PRO-V2',
      status: 'Verified'
    }
  });
  console.log('Upserted Device:', device1);

  // Create a registered device and customer
  const device2 = await prisma.device.upsert({
    where: { device_id: 'SEC-001' },
    update: {},
    create: {
      device_id: 'SEC-001',
      model: 'AT-IND-LITE',
      status: 'Registered'
    }
  });
  
  const customer1 = await prisma.customer.upsert({
    where: { customer_number: '9876543210' },
    update: {},
    create: {
      deviceId: 'SEC-001',
      customer_name: 'Ravi Kumar',
      device_name: 'OMR Penthouse Guard',
      customer_number: '9876543210',
      device_sim_number: '9123456789',
      photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150&h=150',
    }
  });
  console.log('Upserted Customer:', customer1);

  // Create some initial telemetry for SEC-001
  await prisma.telemetryLog.create({
    data: {
      deviceId: 'SEC-001',
      battery: 95,
      signal: 82,
      motion_count: 5,
      alert_active: false
    }
  });
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
