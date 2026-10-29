const { PrismaClient } = require('@prisma/client');
const mqtt = require('mqtt');

async function runTest() {
  console.log('--- Starting Running MQTT Broker Client Test ---');
  
  const prisma = new PrismaClient();
  
  // 1. Connect client to the running broker
  console.log('1. Connecting MQTT Client to mqtt://127.0.0.1:1883...');
  const client = mqtt.connect('mqtt://127.0.0.1:1883', {
    clientId: 'external_test_client',
    protocolVersion: 4, // Force MQTT 3.1.1 (Aedes default)
    connectTimeout: 5000,
    debug: true
  });
  
  client.on('connect', () => {
    console.log('   MQTT Client connected successfully!');
    
    // 2. Publish mock telemetry data
    const topic = 'devices/SEC-001/telemetry';
    const payload = JSON.stringify({
      battery: 89,
      signal: 77,
      motion_count: 15,
      alert_active: true
    });
    
    console.log(`2. Publishing message to topic "${topic}": ${payload}`);
    client.publish(topic, payload, { qos: 1 }, (err) => {
      if (err) {
        console.error('   Failed to publish message:', err);
        cleanup(1);
      } else {
        console.log('   Message published successfully!');
      }
    });
  });

  client.on('reconnect', () => {
    console.log('   MQTT Client reconnecting...');
  });

  client.on('close', () => {
    console.log('   MQTT Client connection closed.');
  });

  client.on('offline', () => {
    console.log('   MQTT Client went offline.');
  });

  client.on('error', (err) => {
    console.error('   MQTT Client Error:', err);
    cleanup(1);
  });

  // 3. Wait for database entry to be written by the running server
  console.log('3. Waiting for running server to store telemetry in database...');
  await new Promise(resolve => setTimeout(resolve, 6000));
  
  // 4. Query database
  console.log('4. Querying database for telemetry logs of device "SEC-001"...');
  try {
    const logs = await prisma.telemetryLog.findMany({
      where: { deviceId: 'SEC-001' },
      orderBy: { timestamp: 'desc' },
      take: 5
    });
    
    console.log(`   Found ${logs.length} telemetry logs in database.`);
    console.log('   Latest logs:');
    logs.forEach((log, index) => {
      console.log(`   [Log ${index + 1}] ID: ${log.id}, Time: ${log.timestamp.toISOString()}, Battery: ${log.battery}%, Signal: ${log.signal}%, Motion Count: ${log.motion_count}, Alert Active: ${log.alert_active}`);
    });

    // Check if our test log is there (battery: 89, signal: 77, motion_count: 15)
    const testLog = logs.find(log => log.battery === 89 && log.signal === 77 && log.motion_count === 15 && log.alert_active === true);
    if (testLog) {
      console.log('\n✅ SUCCESS: The running PM2 MQTT broker successfully received the message and saved it into the SQLite database!');
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
