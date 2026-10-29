const { Aedes } = require('aedes');
const aedes = new Aedes();
const server = require('net').createServer((socket) => {
  console.log(`TCP Connection established from ${socket.remoteAddress}:${socket.remotePort}`);
  try {
    console.log('Calling aedes.handle(socket)...');
    const res = aedes.handle(socket);
    console.log('aedes.handle(socket) returned successfully.');
  } catch (err) {
    console.error('CRASH inside aedes.handle(socket):', err);
  }
});
const mqtt = require('mqtt');

server.listen(1883, () => {
  console.log('Broker listening on 1883');
});

aedes.on('client', (client) => {
  console.log('Aedes event: client connected', client.id);
});

aedes.on('clientError', (client, err) => {
  console.log('Aedes event: client error', client ? client.id : 'unknown', err);
});

setTimeout(() => {
  console.log('Connecting client...');
  const client = mqtt.connect('mqtt://127.0.0.1:1883', {
    clientId: 'test_client',
    connectTimeout: 4000
  });

  client.on('connect', () => {
    console.log('Client connected successfully!');
    client.publish('test/topic', 'hello', () => {
      console.log('Published!');
      client.end();
      server.close();
      process.exit(0);
    });
  });

  client.on('error', (err) => {
    console.log('Client error event:', err);
    client.end();
    server.close();
    process.exit(1);
  });
}, 1000);
