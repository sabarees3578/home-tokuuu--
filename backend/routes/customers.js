const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');

// Get all customers (Admin only)
router.get('/', requireAdmin, async (req, res) => {
  const prisma = req.prisma;
  const customers = await prisma.deviceOwnership.findMany({
    include: { device: true }
  });
  // Map the new fields back to what the frontend might expect, or send as is
    const mapped = customers.map(c => ({
    id: c.id,
    customer_name: c.customerName,
    customer_number: c.customerNumber,
    device_name: c.deviceName,
    device_sim_number: c.deviceSimNumber,
    user2_phone: c.user1,
    user3_phone: c.user2,
    user4_phone: c.user3,
    address: c.customerAddress,
    deviceId: c.deviceId,
    device_id: c.deviceId,
    simPlan: c.simPlan,
    simPlanStartDate: c.simPlanStartDate,
    simPlanEndDate: c.simPlanEndDate,
    device: c.device ? {
      device_id: c.device.deviceId,
      model: c.device.deviceName,
      imei: c.device.imei,
      mac_address: c.device.mac
    } : null
  }));
  res.json(mapped);
});

// Register new customer
router.post('/register', async (req, res) => {
  const prisma = req.prisma;
  const { 
    device_id, customer_name, device_name, customer_number, 
    device_sim_number, user2_phone, user3_phone, user4_phone, photo 
  } = req.body;

  try {
    const newCustomer = await prisma.deviceOwnership.create({
      data: {
        deviceId: device_id,
        customerName: customer_name,
        customerNumber: customer_number,
        deviceSimNumber: device_sim_number,
        user1: user2_phone,
        user2: user3_phone,
        user3: user4_phone,
        // no photo column in new schema
      }
    });

    // Mark device as registered in DeviceStatus if possible
    const statusRecord = await prisma.deviceStatus.findFirst({ where: { deviceId: device_id }});
    if (statusRecord) {
      await prisma.deviceStatus.update({
        where: { id: statusRecord.id },
        data: { deviceStatus: 'Registered' }
      });
    }

    if (device_name) {
      await prisma.deviceRegistry.update({
        where: { deviceId: device_id },
        data: { deviceName: device_name }
      });
    }

    const mappedCustomer = {
      id: newCustomer.id,
      deviceId: newCustomer.deviceId,
      device_id: newCustomer.deviceId,
      customer_name: newCustomer.customerName,
      customer_number: newCustomer.customerNumber,
      device_name: newCustomer.deviceName,
      device_sim_number: newCustomer.deviceSimNumber,
      user2_phone: newCustomer.user1,
      user3_phone: newCustomer.user2,
      user4_phone: newCustomer.user3,
      address: newCustomer.customerAddress,
      registeredAt: newCustomer.registeredAt
    };
    res.json({ success: true, customer: mappedCustomer });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Delete customer (Admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const prisma = req.prisma;

  try {
    const customer = await prisma.deviceOwnership.findUnique({ where: { id: Number(id) } });
    if (!customer) throw new Error('Customer not found');

    await prisma.deviceOwnership.delete({ where: { id: Number(id) } });
    
    // Also change the device status back to 'Verified' if it was 'Registered'
    const statusRecord = await prisma.deviceStatus.findFirst({ where: { deviceId: customer.deviceId } });
    if (statusRecord && statusRecord.deviceStatus === 'Registered') {
      await prisma.deviceStatus.update({
        where: { id: statusRecord.id },
        data: { deviceStatus: 'Verified' }
      });
    }

    res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, error: 'Failed to delete customer: ' + error.message });
  }
});

module.exports = router;
