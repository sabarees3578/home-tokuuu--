const { PrismaClient } = require('@prisma/client');
const startMqttBroker = require('./mqtt/broker');
const mqtt = require('mqtt');

async function runTest() {
  console.log('--- Starting MQTT and Database Connection Test ---');
  
  const prisma = new PrismaClient();
  
  // 1. Start the MQTT broker
  console.log('1. Initializing MQTT Broker...');
  startMqttBroker(prisma);
  
  // Wait a moment for broker to bind to port 1883
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 2. Connect client to broker
  console.log('2. Connecting MQTT Client to mqtt://localhost:1883...');
  const client = mqtt.connect('mqtt://localhost:1883', {
    clientId: 'test_client_script'
  });
  
  client.on('connect', () => {
    console.log('   MQTT Client connected successfully!');
    
    // 3. Publish mock telemetry data
    const topic = 'devices/SEC-001/telemetry';
    const payload = JSON.stringify({
      battery: 88,
      signal: 72,
      motion_count: 14,
      alert_active: true
    });
    
    console.log(`3. Publishing message to topic "${topic}": ${payload}`);
    client.publish(topic, payload, { qos: 1 }, (err) => {
      if (err) {
        console.error('   Failed to publish message:', err);
        cleanup(1);
      } else {
        console.log('   Message published successfully!');
      }
    });
  });

  client.on('error', (err) => {
    console.error('   MQTT Client Error:', err);
    cleanup(1);
  });

  // 4. Wait for database entry to be written
  console.log('4. Waiting for broker to store telemetry in database...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // 5. Query database
  console.log('5. Querying database for telemetry logs of device "SEC-001"...');
  try {
    const logs = await prisma.telemetryLog.findMany({
      where: { deviceId: 'SEC-001' },
      orderBy: { timestamp: 'desc' },
      take: 5
    });
    
    console.log(`   Found ${logs.length} telemetry logs in database.`);
    console.log('   Latest 3 logs:');
    logs.slice(0, 3).forEach((log, index) => {
      console.log(`   [Log ${index + 1}] ID: ${log.id}, Time: ${log.timestamp.toISOString()}, Battery: ${log.battery}%, Signal: ${log.signal}%, Motion Count: ${log.motion_count}, Alert Active: ${log.alert_active}`);
    });

    // Check if our test log is there
    const testLog = logs.find(log => log.battery === 88 && log.signal === 72 && log.motion_count === 14 && log.alert_active === true);
    if (testLog) {
      console.log('\n✅ SUCCESS: The MQTT broker successfully received the message and saved it into the SQLite database via Prisma!');
      cleanup(0);
    } else {
      console.log('\n❌ FAILURE: Could not find the published test telemetry log in the database.');
      cleanup(1);
    }
  } catch (error) {
    console.error('   Error querying database:', error);
    cleanup(1);
  }

  async function cleanup(exitCode) {
    console.log('\nCleaning up connections...');
    if (client) {
      client.end(true);
    }
    await prisma.$disconnect();
    console.log('Test completed.');
    process.exit(exitCode);
  }
}

runTest().catch(err => {
  console.error('Test script crashed:', err);
  process.exit(1);
});
