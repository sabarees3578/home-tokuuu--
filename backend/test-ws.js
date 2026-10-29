const mqtt = require('mqtt');
const client = mqtt.connect('ws://127.0.0.1:5000/mqtt', { clean: true, connectTimeout: 10000 });
client.on('connect', () => {
  console.log('WS Connected!');
  client.subscribe('enthutech/#');
  console.log('Subscribed to enthutech/#');
});
client.on('message', (topic, msg) => {
  console.log('WS Received:', topic, msg.toString());
});
client.on('error', err => console.error('WS Error:', err.message));
client.on('close', () => console.log('WS Closed'));
