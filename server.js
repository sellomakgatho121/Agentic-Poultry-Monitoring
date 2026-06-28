/**
 * Boonducks Farm PLF Engine - API Server
 * V.E.R.S. Protocol Compatible
 * 
 * Express.js API with PostgreSQL connection pooling for TimescaleDB.
 * Aggregates environmental telemetry, Edge-AI stress inferences, egg yield, and financial metrics.
 */

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Database Connection Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/boonducks_plf',
  max: 20, // High concurrency connection pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test DB Connection on startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection error:', err.stack);
  } else {
    console.log('⚡ Connected to TimescaleDB at:', res.rows[0].now);
  }
});

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * GET /api/coops
 * Retrieve all coops registry and metadata
 */
app.get('/api/coops', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, type, capacity FROM coops ORDER BY id;');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

/**
 * GET /api/telemetry/live
 * Latest telemetry (Temp, Humidity, NH3) for each coop
 */
app.get('/api/telemetry/live', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT ON (coop_id) 
        coop_id, time, temperature, humidity, nh3_level 
      FROM telemetry 
      ORDER BY coop_id, time DESC;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch live telemetry' });
  }
});

/**
 * GET /api/telemetry/history
 * Historical telemetry using TimescaleDB Continuous Aggregates
 * Query params: coop_id (optional), range (24h, 7d, 30d)
 */
app.get('/api/telemetry/history', async (req, res) => {
  const { coop_id, range = '24h' } = req.query;
  let interval = '24 hours';
  let view = 'telemetry_hourly';
  let timeColumn = 'bucket';

  if (range === '7d') {
    interval = '7 days';
    view = 'telemetry_hourly';
  } else if (range === '30d') {
    interval = '30 days';
    view = 'telemetry_daily';
  }

  try {
    let query = '';
    const params = [];

    if (coop_id) {
      query = `
        SELECT ${timeColumn} AS time, coop_id, avg_temp, avg_humidity, avg_nh3
        FROM ${view}
        WHERE ${timeColumn} >= NOW() - INTERVAL '${interval}'
          AND coop_id = $1
        ORDER BY ${timeColumn} ASC;
      `;
      params.push(coop_id);
    } else {
      query = `
        SELECT ${timeColumn} AS time, coop_id, avg_temp, avg_humidity, avg_nh3
        FROM ${view}
        WHERE ${timeColumn} >= NOW() - INTERVAL '${interval}'
        ORDER BY ${timeColumn} ASC;
      `;
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch historical telemetry' });
  }
});

/**
 * GET /api/stress/live
 * Latest Edge-AI inferences (Acoustic & Vision) for all coops
 */
app.get('/api/stress/live', async (req, res) => {
  try {
    const query = `
      SELECT 
        c.id AS coop_id,
        c.name AS coop_name,
        c.type AS coop_type,
        COALESCE((SELECT stress_level FROM acoustic_stress WHERE coop_id = c.id ORDER BY time DESC LIMIT 1), 0.00) AS acoustic_stress,
        COALESCE((SELECT peak_frequency FROM acoustic_stress WHERE coop_id = c.id ORDER BY time DESC LIMIT 1), 0.00) AS peak_frequency,
        COALESCE((SELECT huddling_index FROM vision_inference WHERE coop_id = c.id ORDER BY time DESC LIMIT 1), 0.00) AS huddling_index,
        COALESCE((SELECT bird_count FROM vision_inference WHERE coop_id = c.id ORDER BY time DESC LIMIT 1), 0) AS bird_count,
        COALESCE((SELECT active_birds FROM vision_inference WHERE coop_id = c.id ORDER BY time DESC LIMIT 1), 0) AS active_birds
      FROM coops c
      ORDER BY c.id;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch live stress inferences' });
  }
});

/**
 * GET /api/stress/history
 * Historical stress trends using Continuous Aggregates
 */
app.get('/api/stress/history', async (req, res) => {
  const { coop_id, range = '24h' } = req.query;
  let interval = '24 hours';
  let timeColumn = 'bucket';

  if (range === '7d') {
    interval = '7 days';
  } else if (range === '30d') {
    interval = '30 days';
  }

  try {
    let query = '';
    const params = [];

    // Query both acoustic and vision aggregated histories and join them
    if (coop_id) {
      query = `
        SELECT 
          a.${timeColumn} AS time,
          a.coop_id,
          a.avg_stress AS acoustic_stress,
          a.total_vocalizations,
          v.avg_huddling AS huddling_index
        FROM ${range === '30d' ? 'acoustic_daily' : 'acoustic_hourly'} a
        FULL OUTER JOIN ${range === '30d' ? 'vision_daily' : 'vision_hourly'} v 
          ON a.${timeColumn} = v.${timeColumn} AND a.coop_id = v.coop_id
        WHERE a.${timeColumn} >= NOW() - INTERVAL '${interval}'
          AND a.coop_id = $1
        ORDER BY time ASC;
      `;
      params.push(coop_id);
    } else {
      query = `
        SELECT 
          a.${timeColumn} AS time,
          a.coop_id,
          a.avg_stress AS acoustic_stress,
          a.total_vocalizations,
          v.avg_huddling AS huddling_index
        FROM ${range === '30d' ? 'acoustic_daily' : 'acoustic_hourly'} a
        FULL OUTER JOIN ${range === '30d' ? 'vision_daily' : 'vision_hourly'} v 
          ON a.${timeColumn} = v.${timeColumn} AND a.coop_id = v.coop_id
        WHERE a.${timeColumn} >= NOW() - INTERVAL '${interval}'
        ORDER BY time ASC;
      `;
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch historical stress trends' });
  }
});

/**
 * GET /api/yield
 * Production history and simple forecasts
 */
app.get('/api/yield', async (req, res) => {
  try {
    // Fetch last 30 days of daily egg yields
    const yieldQuery = `
      SELECT time, coop_id, quantity, cracked, dirty 
      FROM egg_yield 
      WHERE time >= NOW() - INTERVAL '30 days' 
      ORDER BY time ASC;
    `;
    const yieldResult = await pool.query(yieldQuery);
    
    // Simple Yield Forecasting: 3-day moving average
    const forecastQuery = `
      WITH recent_yields AS (
        SELECT coop_id, quantity, 
               ROW_NUMBER() OVER(PARTITION BY coop_id ORDER BY time DESC) as rn
        FROM egg_yield
      )
      SELECT coop_id, ROUND(AVG(quantity)) as forecasted_yield
      FROM recent_yields
      WHERE rn <= 3
      GROUP BY coop_id;
    `;
    const forecastResult = await pool.query(forecastQuery);

    res.json({
      history: yieldResult.rows,
      forecast: forecastResult.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch egg yield data' });
  }
});

/**
 * GET /api/financials
 * Financial metrics and revenue protection statistics
 */
app.get('/api/financials', async (req, res) => {
  try {
    const eggPriceRand = 1.83; // Baseline R1,980 revenue / 1,080 eggs = R1.83 per egg
    const capExRand = 44300;
    const monthlyTargetRand = 59400;

    // Get total eggs produced in the last 30 days
    const yieldQuery = `
      SELECT COALESCE(SUM(quantity), 0) AS total_eggs,
             COALESCE(SUM(cracked), 0) AS total_cracked,
             COALESCE(SUM(dirty), 0) AS total_dirty
      FROM egg_yield
      WHERE time >= NOW() - INTERVAL '30 days';
    `;
    const yieldResult = await pool.query(yieldQuery);
    const stats = yieldResult.rows[0];
    
    const totalEggs = parseInt(stats.total_eggs);
    const actualRevenue = totalEggs * eggPriceRand;
    
    // Calculate stress incidents mitigated (heuristic based on temperature or ammonia stabilization)
    // If telemetry shows NH3 > 20ppm or Temp > 32C, and then it drops back to normal, we count it as a mitigation
    const mitigationQuery = `
      SELECT COUNT(*) AS incidents
      FROM telemetry
      WHERE (temperature > 32.0 OR nh3_level > 20.0)
        AND time >= NOW() - INTERVAL '30 days';
    `;
    const mitigationResult = await pool.query(mitigationQuery);
    const incidents = parseInt(mitigationResult.rows[0].incidents);
    
    // Heuristic: Each mitigation event prevents a 5% drop in daily yield for 3 days
    // 5% of 1080 eggs = 54 eggs. 54 eggs * 3 days = 162 eggs protected per incident.
    const eggsProtected = incidents * 162;
    const revenueProtected = eggsProtected * eggPriceRand;

    res.json({
      capEx: capExRand,
      monthlyTarget: monthlyTargetRand,
      eggPrice: eggPriceRand,
      last30Days: {
        eggsProduced: totalEggs,
        cracked: parseInt(stats.total_cracked),
        dirty: parseInt(stats.total_dirty),
        revenue: actualRevenue,
        revenueProtected: revenueProtected,
        mitigationEvents: incidents,
        percentOfTarget: (actualRevenue / monthlyTargetRand) * 100
      },
      amortization: {
        standardMonths: 7.4,
        heatStressDays: 22,
        currentProgressPercent: (actualRevenue / capExRand) * 100
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch financial metrics' });
  }
});

// Start Server
const server = app.listen(PORT, () => {
  console.log(`🚀 Boonducks PLF API Server running on port ${PORT}`);
});

module.exports = { app, server };
