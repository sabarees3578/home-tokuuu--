const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('/home/ubuntu/backend/prisma/dev.db');

db.all("SELECT * FROM Device", [], (err, rows) => {
  if (err) {
    throw err;
  }
  rows.forEach((row) => {
    console.log(`device_id: ${row.device_id}, imei: ${row.imei}, mac: ${row.mac_address}`);
  });
});
db.close();
