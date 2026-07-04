/**
 * Boonducks Farm PLF Engine - Backend Integration Tests
 * Tests all Express.js API endpoints.
 * Server operates in sim mode by default (no DB needed).
 */

const request = require('supertest');
const { app, server } = require('./server');

afterAll((done) => {
  if (server) server.close(done);
  else done();
});

// ============================================================================
// GET /api/coops
// ============================================================================
describe('GET /api/coops', () => {
  it('returns 200 with an array of coops', async () => {
    const res = await request(app).get('/api/coops');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(res.body[0]).toHaveProperty('name');
    expect(res.body[0]).toHaveProperty('type');
    expect(res.body[0]).toHaveProperty('capacity');
  });
  it('returns correct coop names', async () => {
    const res = await request(app).get('/api/coops');
    expect(res.body[0].name).toBe('Cage Coop A');
    expect(res.body[3].name).toBe('Litter Coop 2');
  });
});

// ============================================================================
// GET /api/telemetry/live
// ============================================================================
describe('GET /api/telemetry/live', () => {
  it('returns 200 with live telemetry', async () => {
    const res = await request(app).get('/api/telemetry/live');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(8); // one per coop
    expect(res.body[0]).toHaveProperty('temperature');
    expect(res.body[0]).toHaveProperty('humidity');
    expect(res.body[0]).toHaveProperty('nh3_level');
  });
});

// ============================================================================
// GET /api/telemetry/history
// ============================================================================
describe('GET /api/telemetry/history', () => {
  it('returns 200 with default 24h range', async () => {
    const res = await request(app).get('/api/telemetry/history');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty('avg_temp');
    expect(res.body[0]).toHaveProperty('avg_humidity');
  });

  it('accepts coop_id filter', async () => {
    const res = await request(app).get('/api/telemetry/history?coop_id=1&range=7d');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    res.body.forEach(entry => expect(entry.coop_id).toBe(1));
  });

  it('returns more data for 7d than 24h', async () => {
    const res24 = await request(app).get('/api/telemetry/history?range=24h');
    const res7d = await request(app).get('/api/telemetry/history?range=7d');
    expect(res24.body.length).toBeLessThan(res7d.body.length);
  });
});

// ============================================================================
// GET /api/stress/live
// ============================================================================
describe('GET /api/stress/live', () => {
  it('returns 200 with stress inferences', async () => {
    const res = await request(app).get('/api/stress/live');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(8);
    expect(res.body[0]).toHaveProperty('acoustic_stress');
    expect(res.body[0]).toHaveProperty('huddling_index');
    expect(res.body[0]).toHaveProperty('bird_count');
  });
});

// ============================================================================
// GET /api/stress/history
// ============================================================================
describe('GET /api/stress/history', () => {
  it('returns 200 with stress trends', async () => {
    const res = await request(app).get('/api/stress/history');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('acoustic_stress');
    expect(res.body[0]).toHaveProperty('huddling_index');
  });
});

// ============================================================================
// GET /api/yield
// ============================================================================
describe('GET /api/yield', () => {
  it('returns 200 with history and forecast', async () => {
    const res = await request(app).get('/api/yield');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('history');
    expect(res.body).toHaveProperty('forecast');
    expect(res.body.history.length).toBeGreaterThan(0);
    expect(res.body.history[0]).toHaveProperty('quantity');
    expect(res.body.forecast[0]).toHaveProperty('forecasted_yield');
  });
});

// ============================================================================
// GET /api/financials
// ============================================================================
describe('GET /api/financials', () => {
  it('returns 200 with all financial metrics', async () => {
    const res = await request(app).get('/api/financials');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('capEx', 44300);
    expect(res.body).toHaveProperty('monthlyTarget', 59400);
    expect(res.body).toHaveProperty('eggPrice', 1.83);
    expect(res.body.last30Days).toHaveProperty('eggsProduced');
    expect(res.body.last30Days).toHaveProperty('revenue');
    expect(res.body.last30Days).toHaveProperty('mitigationEvents');
    expect(res.body.amortization).toHaveProperty('standardMonths', 7.4);
  });

  it('maintains revenue/eggs ratio', async () => {
    const res = await request(app).get('/api/financials');
    const r = res.body.last30Days;
    expect(r.revenue / r.eggsProduced).toBeCloseTo(1.83, 2);
  });
});

// ============================================================================
// GET /api/health
// ============================================================================
describe('GET /api/health', () => {
  it('returns 200 with status and mode', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('coops', 8);
  });
});

// ============================================================================
// Unknown routes
// ============================================================================
describe('Unknown Routes', () => {
  it('returns 404 for non-existent paths', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
  });
});
