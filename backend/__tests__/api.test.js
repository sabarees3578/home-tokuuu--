const request = require('supertest');
const express = require('express');
const http = require('http');

const mockPrisma = {
  device: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  telemetryLog: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  customer: { findMany: jest.fn() },
};

let app, server;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.prisma = mockPrisma; next(); });
  app.use('/api/config', require('../routes/config'));
  app.use('/api/command', require('../routes/commands'));
  app.use('/api/telemetry', require('../routes/telemetry'));
  server = http.createServer(app);
});

afterAll(() => { server?.close(); });
beforeEach(() => { jest.clearAllMocks(); });

describe('GET /api/config', () => {
  it('returns MQTT connection info', async () => {
    const res = await request(app).get('/api/config');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('mqttWsUrl');
    expect(res.body).toHaveProperty('mqttHost');
    expect(res.body).toHaveProperty('mqttPort', 1883);
  });
});

describe('POST /api/command', () => {
  it('rejects missing device_id', async () => {
    const res = await request(app).post('/api/command').send({ command: 'TES01' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects missing command', async () => {
    const res = await request(app).post('/api/command').send({ device_id: 'test' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects commands not on the allowlist', async () => {
    const res = await request(app).post('/api/command').send({ device_id: 'test', command: 'FORMAT_C' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects commands for unknown devices', async () => {
    mockPrisma.device.findUnique.mockResolvedValue(null);
    const res = await request(app).post('/api/command').send({ device_id: 'ghost', command: 'LIST' });
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/telemetry', () => {
  it('returns recent telemetry logs (not the :deviceId handler)', async () => {
    mockPrisma.telemetryLog.findMany.mockResolvedValue([]);
    const res = await request(app).get('/api/telemetry/recent');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Prove /recent hit its own handler and was not shadowed by /:deviceId
    // (which would query where:{deviceId:'recent'} with no include).
    expect(mockPrisma.telemetryLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { device: { select: { device_id: true } } }
      })
    );
  });

  it('returns telemetry for a device', async () => {
    mockPrisma.telemetryLog.findMany.mockResolvedValue([{ id: 1, battery: 95 }]);
    const res = await request(app).get('/api/telemetry/test-device');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns summary stats', async () => {
    mockPrisma.device.findMany.mockResolvedValue([]);
    const res = await request(app).get('/api/telemetry/summary/all');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('online');
    expect(res.body).toHaveProperty('offline');
  });
});
