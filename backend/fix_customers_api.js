const fs = require('fs');
const file = '/home/ubuntu/backend/routes/customers.js';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/customer_number: c.customerNumber,/g, "customer_number: c.customerNumber,\n    device_name: c.deviceName,");
content = content.replace(/customer_number: newCustomer.customerNumber,/g, "customer_number: newCustomer.customerNumber,\n      device_name: newCustomer.deviceName,");
fs.writeFileSync(file, content);
