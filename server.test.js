/**
 * Boonducks Farm PLF Engine - Backend Integration Tests
 * Tests all Express.js API endpoints with mocked PostgreSQL.
 */

const request = require('supertest');

// Mock the pg module before importing server
jest.mock('pg', () => {
  const mockQuery = jest.fn();
  const mockPool = {
    query: mockQuery,
    connect: jest.fn(),
    end: jest.fn(),
    on: jest.fn(),
  };
  return { Pool: jest.fn(() => mockPool) };
});

const { Pool } = require('pg');
const mockPool = new Pool();

// Require server after mocking pg
let app, server;
beforeAll(() => {
  const mod = require('./server');
  app = mod.app;
  server = mod.server;
});

afterAll((done) => {
  if (server) server.close(done);
  else done();
});

beforeEach(() => {
  mockPool.query.mockReset();
});

// ============================================================================
// GET /api/coops
// ============================================================================
describe('GET /api/coops', () => {
  it('returns 200 with an array of coops', async () => {
    const mockCoops = [
      { id: 1, name: 'Cage Coop A', type: 'cage', capacity: 312 },
      { id: 2, name: 'Cage Coop B', type: 'cage', capacity: 310 },
    ];
    mockPool.query.mockResolvedValueOnce({ rows: mockCoops });

    const res = await request(app).get('/api/coops');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toHaveProperty('name', 'Cage Coop A');
  });

  it('returns 500 when database query fails', async () => {
    mockPool.query.mockRejectedValueOnce(new Error('Connection refused'));

    const res = await request(app).get('/api/coops');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });
});

// ============================================================================
// GET /api/telemetry/live
// ============================================================================
describe('GET /api/telemetry/live', () => {
  it('returns 200 with latest telemetry readings', async () => {
    const mockTelemetry = [
      { coop_id: 1, time: '2025-01-01T00:00:00Z', temperature: 24.5, humidity: 55.2, nh3_level: 0 },
      { coop_id: 3, time: '2025-01-01T00:00:00Z', temperature: 22.1, humidity: 61.8, nh3_level: 12.4 },
    ];
    mockPool.query.mockResolvedValueOnce({ rows: mockTelemetry });

    const res = await request(app).get('/api/telemetry/live');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty('temperature');
    expect(res.body[0]).toHaveProperty('humidity');
  });
});

// ============================================================================
// GET /api/telemetry/history
// ============================================================================
describe('GET /api/telemetry/history', () => {
  it('returns 200 with default 24h range', async () => {
    const mockHistory = [
      { time: '2025-01-01T00:00:00Z', coop_id: 1, avg_temp: 23.5, avg_humidity: 56.0, avg_nh3: 0 },
    ];
    mockPool.query.mockResolvedValueOnce({ rows: mockHistory });

    const res = await request(app).get('/api/telemetry/history');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty('avg_temp');
  });

  it('accepts coop_id filter parameter', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/telemetry/history?coop_id=1&range=7d');

    expect(res.status).toBe(200);
    // Verify the query was called with parameterized coop_id
    const queryCall = mockPool.query.mock.calls[0];
    expect(queryCall[1]).toEqual(['1']);
  });

  it('uses daily aggregates for 30d range', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/telemetry/history?range=30d');

    expect(res.status).toBe(200);
    // Verify that the query references the daily view
    const queryStr = mockPool.query.mock.calls[0][0];
    expect(queryStr).toContain('telemetry_daily');
  });
});

// ============================================================================
// GET /api/stress/live
// ============================================================================
describe('GET /api/stress/live', () => {
  it('returns 200 with Edge-AI inferences per coop', async () => {
    const mockStress = [
      {
        coop_id: 1, coop_name: 'Cage Coop A', coop_type: 'cage',
        acoustic_stress: 0.15, peak_frequency: 850.0,
        huddling_index: 0.22, bird_count: 312, active_birds: 260,
      },
    ];
    mockPool.query.mockResolvedValueOnce({ rows: mockStress });

    const res = await request(app).get('/api/stress/live');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty('acoustic_stress');
    expect(res.body[0]).toHaveProperty('huddling_index');
  });
});

// ============================================================================
// GET /api/stress/history
// ============================================================================
describe('GET /api/stress/history', () => {
  it('returns 200 with joined acoustic and vision history', async () => {
    const mockHistory = [
      { time: '2025-01-01T00:00:00Z', coop_id: 1, acoustic_stress: 0.12, total_vocalizations: 42, huddling_index: 0.18 },
    ];
    mockPool.query.mockResolvedValueOnce({ rows: mockHistory });

    const res = await request(app).get('/api/stress/history');

    expect(res.status).toBe(200);
    expect(res.body[0]).toHaveProperty('acoustic_stress');
    expect(res.body[0]).toHaveProperty('huddling_index');
  });
});

// ============================================================================
// GET /api/yield
// ============================================================================
describe('GET /api/yield', () => {
  it('returns 200 with history and forecast arrays', async () => {
    // First query: yield history
    mockPool.query.mockResolvedValueOnce({
      rows: [
        { time: '2025-01-01', coop_id: 1, quantity: 270, cracked: 2, dirty: 3 },
      ],
    });
    // Second query: forecast
    mockPool.query.mockResolvedValueOnce({
      rows: [
        { coop_id: 1, forecasted_yield: 268 },
      ],
    });

    const res = await request(app).get('/api/yield');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('history');
    expect(res.body).toHaveProperty('forecast');
    expect(Array.isArray(res.body.history)).toBe(true);
    expect(Array.isArray(res.body.forecast)).toBe(true);
  });
});

// ============================================================================
// GET /api/financials
// ============================================================================
describe('GET /api/financials', () => {
  it('returns 200 with financial metrics and amortization data', async () => {
    // First query: egg yield stats
    mockPool.query.mockResolvedValueOnce({
      rows: [{ total_eggs: '32680', total_cracked: '114', total_dirty: '182' }],
    });
    // Second query: mitigation incidents
    mockPool.query.mockResolvedValueOnce({
      rows: [{ incidents: '3' }],
    });

    const res = await request(app).get('/api/financials');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('capEx', 44300);
    expect(res.body).toHaveProperty('monthlyTarget', 59400);
    expect(res.body).toHaveProperty('eggPrice', 1.83);
    expect(res.body.last30Days).toHaveProperty('eggsProduced', 32680);
    expect(res.body.last30Days).toHaveProperty('revenue');
    expect(res.body.amortization).toHaveProperty('standardMonths', 7.4);
    expect(res.body.amortization).toHaveProperty('heatStressDays', 22);
  });

  it('calculates revenue correctly from egg count', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ total_eggs: '1000', total_cracked: '10', total_dirty: '20' }],
    });
    mockPool.query.mockResolvedValueOnce({
      rows: [{ incidents: '0' }],
    });

    const res = await request(app).get('/api/financials');

    expect(res.body.last30Days.revenue).toBeCloseTo(1000 * 1.83, 2);
    expect(res.body.last30Days.revenueProtected).toBe(0);
  });
});

// ============================================================================
// Unknown routes
// ============================================================================
describe('Unknown Routes', () => {
  it('returns 404 for non-existent API paths', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
  });
});
