const express = require('express');
const router = express.Router();

// PUT /api/ownership/sim-plan
// Body: { device_id, simPlan, simPlanStartDate, simPlanEndDate }
router.put('/sim-plan', async (req, res) => {
  const device_id = req.body.device_id || req.body.deviceId;
  const { simPlan, simPlanStartDate, simPlanEndDate } = req.body;
  const prisma = req.prisma;

  if (!device_id) {
    return res.status(400).json({ success: false, error: 'device_id is required' });
  }

  try {
    const device = await prisma.deviceRegistry.findUnique({ where: { deviceId: device_id } });
    if (!device) {
      return res.status(404).json({ success: false, error: `Unknown device: ${device_id}` });
    }

    const data = {};
    if (simPlan !== undefined) data.simPlan = simPlan;
    if (simPlanStartDate !== undefined) data.simPlanStartDate = new Date(simPlanStartDate);
    if (simPlanEndDate !== undefined) data.simPlanEndDate = new Date(simPlanEndDate);

    const ownership = await prisma.deviceOwnership.upsert({
      where: { deviceId: device_id },
      update: data,
      create: {
        deviceId: device_id,
        ...data,
      },
    });

    res.json({ success: true, ownership });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/ownership/:deviceId
router.get('/:deviceId', async (req, res) => {
  const prisma = req.prisma;
  const { deviceId } = req.params;

  try {
    const ownership = await prisma.deviceOwnership.findUnique({
      where: { deviceId },
    });
    if (!ownership) {
      return res.status(404).json({ success: false, error: 'No ownership record found' });
    }
    res.json({ success: true, ownership });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
