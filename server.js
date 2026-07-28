/**
 * Boonducks Farm PLF Engine - API Server
 * V.E.R.S. Protocol Compatible
 * 
 * Express.js API with dual-mode data layer:
 *   MODE=live  → PostgreSQL/TimescaleDB connection
 *   MODE=sim   → In-memory synthetic data generator (default, no DB required)
 */

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ============================================================================
// MODE SELECTION
// ============================================================================
const MODE = (process.env.MODE || 'sim').toLowerCase();

// ============================================================================
// SIMULATION DATA ENGINE  (MODE=sim)
// ============================================================================

const COOPS = [
  { id: 1, name: 'Cage Coop A',     type: 'cage',       capacity: 312 },
  { id: 2, name: 'Cage Coop B',     type: 'cage',       capacity: 310 },
  { id: 3, name: 'Litter Coop 1',   type: 'deep_litter', capacity: 104 },
  { id: 4, name: 'Litter Coop 2',   type: 'deep_litter', capacity: 104 },
  { id: 5, name: 'Litter Coop 3',   type: 'deep_litter', capacity: 104 },
  { id: 6, name: 'Litter Coop 4',   type: 'deep_litter', capacity: 104 },
  { id: 7, name: 'Litter Coop 5',   type: 'deep_litter', capacity: 104 },
  { id: 8, name: 'Litter Coop 6',   type: 'deep_litter', capacity: 104 },
];

// Camera feed config per coop
const CAMERA_FEEDS = [
  { coop_id: 1, rtsp: 'rtsp://192.168.1.101:554/stream1', protocol: 'poe', status: 'online',  resolution: '2688×1520' },
  { coop_id: 2, rtsp: 'rtsp://192.168.1.102:554/stream1', protocol: 'poe', status: 'online',  resolution: '2688×1520' },
  { coop_id: 3, rtsp: 'rtsp://192.168.1.103:554/stream1', protocol: 'poe', status: 'online',  resolution: '2688×1520' },
  { coop_id: 4, rtsp: 'rtsp://192.168.1.104:554/stream1', protocol: 'poe', status: 'online',  resolution: '2688×1520' },
  { coop_id: 5, rtsp: 'rtsp://192.168.1.105:554/stream1', protocol: 'poe', status: 'online',  resolution: '2688×1520' },
  { coop_id: 6, rtsp: 'rtsp://192.168.1.106:554/stream1', protocol: 'poe', status: 'online',  resolution: '2688×1520' },
  { coop_id: 7, rtsp: 'rtsp://192.168.1.107:554/stream1', protocol: 'poe', status: 'online',  resolution: '2688×1520' },
  { coop_id: 8, rtsp: 'rtsp://192.168.1.108:554/stream1', protocol: 'poe', status: 'online',  resolution: '2688×1520' },
];

// Fixed seed for deterministic-but-varying output
let tick = 0;

function randomBetween(min, max, coopId) {
  const seeded = Math.sin((tick + 1) * 12.9898 + (coopId || 1) * 4.1415) * 43758.5453;
  const r = seeded - Math.floor(seeded);
  return min + r * (max - min);
}

function advanceTick() {
  tick++;
}

function getCurrentStats(coop) {
  const isCage = coop.type === 'cage';
  const baseTemp = isCage ? 24.5 : 22.0;
  const baseHum  = isCage ? 55 : 60;
  const wave = Math.sin(tick / 6 + coop.id * 0.5) * 1.5;
  return {
    temperature: parseFloat((baseTemp + wave + randomBetween(-0.3, 0.3, coop.id)).toFixed(1)),
    humidity:    parseFloat((baseHum - wave * 1.5 + randomBetween(-1, 1, coop.id)).toFixed(1)),
    nh3_level:   isCage ? 0.0 : parseFloat((12.0 + randomBetween(-1, 1, coop.id) + Math.max(0, wave * 0.5)).toFixed(1)),
    acoustic_stress:   parseFloat((0.20 + randomBetween(-0.08, 0.10, coop.id)).toFixed(2)),
    peak_frequency:    parseFloat((900 + randomBetween(-100, 100, coop.id)).toFixed(1)),
    huddling_index:    parseFloat((0.25 + randomBetween(-0.08, 0.10, coop.id)).toFixed(2)),
    bird_count:        isCage ? 312 : 104,
    active_birds:      isCage ? Math.floor(260 + randomBetween(-15, 10, coop.id)) : Math.floor(88 + randomBetween(-8, 6, coop.id)),
  };
}

function buildTelemetryHistory(rangeHours = 24, coopId = null) {
  const rows = [];
  const coops = coopId ? COOPS.filter(c => c.id === Number(coopId)) : COOPS;
  for (let h = rangeHours; h >= 0; h--) {
    const time = new Date(Date.now() - h * 3600000).toISOString();
    coops.forEach(coop => {
      const isLitter = coop.type === 'deep_litter';
      const coopOffset = coop.id * 0.7;
      const wave = Math.sin((tick - h) / 6 + coop.id * 0.3) * 1.5;
      const baseTemp = isLitter ? 22.0 : 24.5;
      const baseHum  = isLitter ? 60 : 55;
      rows.push({
        time,
        coop_id: coop.id,
        avg_temp:     parseFloat((baseTemp + wave + Math.sin(h * 0.5 + coopOffset) * 0.5).toFixed(1)),
        avg_humidity: parseFloat((baseHum - wave * 1.5 + Math.cos(h * 0.3 + coopOffset) * 1.5).toFixed(1)),
        avg_nh3:      isLitter ? parseFloat((12.0 + Math.sin(h * 0.7 + coopOffset) * 2).toFixed(1)) : 0.0,
      });
    });
  }
  return rows;
}

// ============================================================================
// TIMESCALEDB CONNECTION (MODE=live)
// ============================================================================

let pool = null;
if (MODE === 'live') {
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:***@localhost:5432/boonducks_plf',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
  pool.query('SELECT NOW()', (err, res) => {
    if (err) console.error('\u274c Database connection error:', err.stack);
    else console.log('\u26a1 Connected to TimescaleDB at:', res.rows[0].now);
  });
}

console.log(`\ud83d\ude80 Boonducks PLF API — MODE=${MODE} on port ${PORT}`);

// ============================================================================
// MIDDLEWARE: Advance simulation tick on each request
// ============================================================================
app.use((req, res, next) => {
  if (MODE === 'sim') {
    advanceTick();
    if (tick % 20 === 0) {
      // Refresh old tick to keep history growing
    }
  }
  next();
});

// ============================================================================
// API ENDPOINTS
// ============================================================================

// GET /api/coops
app.get('/api/coops', async (req, res) => {
  try {
    if (MODE === 'sim') {
      return res.json(COOPS);
    }
    const result = await pool.query('SELECT id, name, type, capacity FROM coops ORDER BY id;');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// GET /api/telemetry/live
app.get('/api/telemetry/live', async (req, res) => {
  try {
    if (MODE === 'sim') {
      const data = COOPS.map(c => {
        const s = getCurrentStats(c);
        return {
          coop_id: c.id,
          time: new Date().toISOString(),
          temperature: s.temperature,
          humidity: s.humidity,
          nh3_level: s.nh3_level,
        };
      });
      return res.json(data);
    }
    const result = await pool.query(
      'SELECT DISTINCT ON (coop_id) coop_id, time, temperature, humidity, nh3_level FROM telemetry ORDER BY coop_id, time DESC;'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch live telemetry' });
  }
});

// GET /api/telemetry/history
app.get('/api/telemetry/history', async (req, res) => {
  const { coop_id, range = '24h' } = req.query;
  try {
    if (MODE === 'sim') {
      const hours = range === '7d' ? 168 : range === '30d' ? 720 : 24;
      const rows = buildTelemetryHistory(hours, coop_id);
      return res.json(rows);
    }
    let interval = '24 hours';
    let view = 'telemetry_hourly';
    let timeColumn = 'bucket';
    if (range === '7d') { interval = '7 days'; view = 'telemetry_hourly'; }
    else if (range === '30d') { interval = '30 days'; view = 'telemetry_daily'; }
    const query = coop_id
      ? `SELECT ${timeColumn} AS time, coop_id, avg_temp, avg_humidity, avg_nh3 FROM ${view} WHERE ${timeColumn} >= NOW() - INTERVAL '${interval}' AND coop_id = $1 ORDER BY ${timeColumn} ASC;`
      : `SELECT ${timeColumn} AS time, coop_id, avg_temp, avg_humidity, avg_nh3 FROM ${view} WHERE ${timeColumn} >= NOW() - INTERVAL '${interval}' ORDER BY ${timeColumn} ASC;`;
    const params = coop_id ? [coop_id] : [];
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch historical telemetry' });
  }
});

// GET /api/stress/live
app.get('/api/stress/live', async (req, res) => {
  try {
    if (MODE === 'sim') {
      const data = COOPS.map(c => {
        const s = getCurrentStats(c);
        return {
          coop_id: c.id,
          coop_name: c.name,
          coop_type: c.type,
          acoustic_stress: s.acoustic_stress,
          peak_frequency: s.peak_frequency,
          huddling_index: s.huddling_index,
          bird_count: s.bird_count,
          active_birds: s.active_birds,
        };
      });
      return res.json(data);
    }
    const result = await pool.query(`
      SELECT c.id AS coop_id, c.name AS coop_name, c.type AS coop_type,
        COALESCE((SELECT stress_level FROM acoustic_stress WHERE coop_id = c.id ORDER BY time DESC LIMIT 1), 0.00) AS acoustic_stress,
        COALESCE((SELECT peak_frequency FROM acoustic_stress WHERE coop_id = c.id ORDER BY time DESC LIMIT 1), 0.00) AS peak_frequency,
        COALESCE((SELECT huddling_index FROM vision_inference WHERE coop_id = c.id ORDER BY time DESC LIMIT 1), 0.00) AS huddling_index,
        COALESCE((SELECT bird_count FROM vision_inference WHERE coop_id = c.id ORDER BY time DESC LIMIT 1), 0) AS bird_count,
        COALESCE((SELECT active_birds FROM vision_inference WHERE coop_id = c.id ORDER BY time DESC LIMIT 1), 0) AS active_birds
      FROM coops c ORDER BY c.id;
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch live stress inferences' });
  }
});

// GET /api/stress/history
app.get('/api/stress/history', async (req, res) => {
  const { coop_id, range = '24h' } = req.query;
  try {
    if (MODE === 'sim') {
      const hours = range === '7d' ? 168 : range === '30d' ? 720 : 24;
      const rows = [];
      const coops = coop_id ? COOPS.filter(c => c.id === Number(coop_id)) : COOPS;
      for (let h = hours; h >= 0; h -= 2) {
        coops.forEach(c => {
          const coopOffset = c.id * 0.7;
          rows.push({
            time: new Date(Date.now() - h * 3600000).toISOString(),
            coop_id: c.id,
            acoustic_stress: parseFloat((0.20 + Math.sin(h * 0.1 + coopOffset) * 0.08 + Math.sin(h * 0.03) * 0.04).toFixed(2)),
            total_vocalizations: Math.floor(30 + Math.sin(h * 0.15 + coopOffset) * 15),
            huddling_index: parseFloat((0.25 + Math.sin(h * 0.08 + coopOffset) * 0.08).toFixed(2)),
          });
        });
      }
      return res.json(rows);
    }
    let interval = '24 hours';
    let timeColumn = 'bucket';
    if (range === '7d') interval = '7 days';
    else if (range === '30d') interval = '30 days';
    const viewA = range === '30d' ? 'acoustic_daily' : 'acoustic_hourly';
    const viewV = range === '30d' ? 'vision_daily' : 'vision_hourly';
    const query = coop_id
      ? `SELECT a.${timeColumn} AS time, a.coop_id, a.avg_stress AS acoustic_stress, a.total_vocalizations, v.avg_huddling AS huddling_index FROM ${viewA} a FULL OUTER JOIN ${viewV} v ON a.${timeColumn}=v.${timeColumn} AND a.coop_id=v.coop_id WHERE a.${timeColumn}>=NOW()-INTERVAL '${interval}' AND a.coop_id=$1 ORDER BY time ASC;`
      : `SELECT a.${timeColumn} AS time, a.coop_id, a.avg_stress AS acoustic_stress, a.total_vocalizations, v.avg_huddling AS huddling_index FROM ${viewA} a FULL OUTER JOIN ${viewV} v ON a.${timeColumn}=v.${timeColumn} AND a.coop_id=v.coop_id WHERE a.${timeColumn}>=NOW()-INTERVAL '${interval}' ORDER BY time ASC;`;
    const params = coop_id ? [coop_id] : [];
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch historical stress trends' });
  }
});

// GET /api/yield
app.get('/api/yield', async (req, res) => {
  try {
    if (MODE === 'sim') {
      const history = [];
      const forecast = [];
      for (let d = 30; d >= 0; d--) {
        const day = new Date(Date.now() - d * 86400000).toISOString().split('T')[0];
        COOPS.forEach(c => {
          const coopOffset = c.id * 0.3;
          const baseQty = c.type === 'cage' ? 270 : 90;
          const qty = Math.max(0, Math.floor(baseQty + Math.sin(d * 0.4 + coopOffset) * 15 + Math.sin(d * 0.1) * 8));
          history.push({ time: day, coop_id: c.id, quantity: qty, cracked: Math.floor(qty * 0.01), dirty: Math.floor(qty * 0.015) });
        });
      }
      COOPS.forEach(c => {
        forecast.push({ coop_id: c.id, forecasted_yield: c.type === 'cage' ? 270 : 90 });
      });
      return res.json({ history, forecast });
    }
    const yieldResult = await pool.query('SELECT time, coop_id, quantity, cracked, dirty FROM egg_yield WHERE time >= NOW() - INTERVAL \'30 days\' ORDER BY time ASC;');
    const forecastResult = await pool.query(
      'WITH recent_yields AS (SELECT coop_id, quantity, ROW_NUMBER() OVER(PARTITION BY coop_id ORDER BY time DESC) as rn FROM egg_yield) SELECT coop_id, ROUND(AVG(quantity)) as forecasted_yield FROM recent_yields WHERE rn <= 3 GROUP BY coop_id;'
    );
    res.json({ history: yieldResult.rows, forecast: forecastResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch egg yield data' });
  }
});

// GET /api/financials
app.get('/api/financials', async (req, res) => {
  try {
    if (MODE === 'sim') {
      const eggPriceRand = 1.83;
      const capExRand = 44300;
      const monthlyTargetRand = 59400;
      // Build simulated stats
      let totalEggs = 0, totalCracked = 0, totalDirty = 0;
      for (let d = 30; d >= 0; d--) {
        COOPS.forEach(c => {
          const baseQty = c.type === 'cage' ? 270 : 90;
          const qty = Math.max(0, Math.floor(baseQty + Math.sin(d * 0.4) * 15));
          totalEggs += qty;
          totalCracked += Math.floor(qty * 0.01);
          totalDirty += Math.floor(qty * 0.015);
        });
      }
      // Simulate some random stress events
      const incidents = 3 + Math.floor(Math.sin(tick * 0.5) * 2);
      const actualRevenue = totalEggs * eggPriceRand;
      const eggsProtected = incidents * 162;
      const revenueProtected = eggsProtected * eggPriceRand;
      return res.json({
        capEx: capExRand,
        monthlyTarget: monthlyTargetRand,
        eggPrice: eggPriceRand,
        last30Days: {
          eggsProduced: totalEggs,
          cracked: totalCracked,
          dirty: totalDirty,
          revenue: actualRevenue,
          revenueProtected,
          mitigationEvents: incidents,
          percentOfTarget: (actualRevenue / monthlyTargetRand) * 100,
        },
        amortization: {
          standardMonths: 7.4,
          heatStressDays: 22,
          currentProgressPercent: (actualRevenue / capExRand) * 100,
        },
      });
    }
    const eggPriceRand = 1.83;
    const capExRand = 44300;
    const monthlyTargetRand = 59400;
    const yieldResult = await pool.query(
      'SELECT COALESCE(SUM(quantity), 0) AS total_eggs, COALESCE(SUM(cracked), 0) AS total_cracked, COALESCE(SUM(dirty), 0) AS total_dirty FROM egg_yield WHERE time >= NOW() - INTERVAL \'30 days\';'
    );
    const stats = yieldResult.rows[0];
    const totalEggs = parseInt(stats.total_eggs);
    const actualRevenue = totalEggs * eggPriceRand;
    const mitigationResult = await pool.query(
      'SELECT COUNT(*) AS incidents FROM telemetry WHERE (temperature > 32.0 OR nh3_level > 20.0) AND time >= NOW() - INTERVAL \'30 days\';'
    );
    const incidents = parseInt(mitigationResult.rows[0].incidents);
    const eggsProtected = incidents * 162;
    const revenueProtected = eggsProtected * eggPriceRand;
    res.json({
      capEx: capExRand, monthlyTarget: monthlyTargetRand, eggPrice: eggPriceRand,
      last30Days: {
        eggsProduced: totalEggs, cracked: parseInt(stats.total_cracked), dirty: parseInt(stats.total_dirty),
        revenue: actualRevenue, revenueProtected, mitigationEvents: incidents,
        percentOfTarget: (actualRevenue / monthlyTargetRand) * 100,
      },
      amortization: { standardMonths: 7.4, heatStressDays: 22, currentProgressPercent: (actualRevenue / capExRand) * 100 },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch financial metrics' });
  }
});

// GET /api/cameras — per-coop camera feed config
app.get('/api/cameras', async (req, res) => {
  try {
    if (MODE === 'sim') {
      // Attach per-coop sim data to each camera feed
      const feeds = CAMERA_FEEDS.map(f => {
        const coop = COOPS.find(c => c.id === f.coop_id);
        const stats = coop ? getCurrentStats(coop) : {};
        return { ...f, current_temp: stats.temperature, current_stress: stats.acoustic_stress };
      });
      return res.json(feeds);
    }
    const result = await pool.query('SELECT * FROM cameras ORDER BY coop_id;');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch camera feeds' });
  }
});

// GET /api/alerts — active/recent alerts
app.get('/api/alerts', async (req, res) => {
  try {
    if (MODE === 'sim') {
      const alerts = [];
      COOPS.forEach(c => {
        const s = getCurrentStats(c);
        if (s.temperature > 32) {
          alerts.push({
            id: Date.now() + c.id,
            type: 'heat_stress',
            severity: 'critical',
            coop_id: c.id,
            coop_name: c.name,
            target_tab: 'overview',
            message: `Temperature ${s.temperature}°C — acoustic stress ${s.acoustic_stress.toFixed(2)}. Automating misting systems.`,
            timestamp: new Date().toISOString(),
            mitigated: true,
          });
        }
        if (s.nh3_level > 20) {
          alerts.push({
            id: Date.now() + c.id + 100,
            type: 'ammonia',
            severity: 'warning',
            coop_id: c.id,
            coop_name: c.name,
            target_tab: 'telemetry',
            message: `NH3 level at ${s.nh3_level} ppm — activate auxiliary ventilation.`,
            timestamp: new Date().toISOString(),
            mitigated: true,
          });
        }
      });
      return res.json(alerts);
    }
    const result = await pool.query("SELECT * FROM alerts WHERE resolved=false ORDER BY timestamp DESC LIMIT 10;");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// GET /api/health — simple health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mode: MODE, uptime: process.uptime(), coops: COOPS.length });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start Server — only when run directly, not when required as a module (for testing)
let server;
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`🚀 Boonducks PLF API Server running on port ${PORT} (MODE=${MODE})`);
  });
}

module.exports = { app, server };
