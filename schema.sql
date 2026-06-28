-- Boonducks Farm PLF Engine - TimescaleDB Schema
-- V.E.R.S. Protocol Compatible

-- Enable the TimescaleDB extension if not already enabled
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- ============================================================================
-- 1. METADATA TABLES (Relational)
-- ============================================================================

-- Coops Registry
CREATE TABLE IF NOT EXISTS coops (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('cage', 'deep_litter')),
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. HYPERTABLES (Time-Series)
-- ============================================================================

-- Environmental Telemetry (XY-MD02 + NH3 Probes)
CREATE TABLE IF NOT EXISTS telemetry (
    time TIMESTAMPTZ NOT NULL,
    coop_id INTEGER NOT NULL REFERENCES coops(id) ON DELETE CASCADE,
    temperature NUMERIC(4, 2),
    humidity NUMERIC(5, 2),
    nh3_level NUMERIC(5, 2) -- Ammonia in ppm
);

-- Acoustic Stress Inferences (XGBoost Audio Model)
CREATE TABLE IF NOT EXISTS acoustic_stress (
    time TIMESTAMPTZ NOT NULL,
    coop_id INTEGER NOT NULL REFERENCES coops(id) ON DELETE CASCADE,
    stress_level NUMERIC(3, 2) NOT NULL CHECK (stress_level >= 0.00 AND stress_level <= 1.00),
    peak_frequency NUMERIC(6, 2), -- Hz
    vocalization_count INTEGER CHECK (vocalization_count >= 0)
);

-- Vision Inferences (YOLOv8-nano Spatial Model)
CREATE TABLE IF NOT EXISTS vision_inference (
    time TIMESTAMPTZ NOT NULL,
    coop_id INTEGER NOT NULL REFERENCES coops(id) ON DELETE CASCADE,
    huddling_index NUMERIC(3, 2) NOT NULL CHECK (huddling_index >= 0.00 AND huddling_index <= 1.00),
    bird_count INTEGER CHECK (bird_count >= 0),
    active_birds INTEGER CHECK (active_birds >= 0)
);

-- Egg Yield Production Records
CREATE TABLE IF NOT EXISTS egg_yield (
    time TIMESTAMPTZ NOT NULL,
    coop_id INTEGER NOT NULL REFERENCES coops(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    cracked INTEGER DEFAULT 0 CHECK (cracked >= 0),
    dirty INTEGER DEFAULT 0 CHECK (dirty >= 0)
);

-- ============================================================================
-- 3. TIMESCALEDB HYPERTABLE INITIALIZATION
-- ============================================================================

-- Convert tables into hypertables partitioned by 1-day intervals
SELECT create_hypertable('telemetry', 'time', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
SELECT create_hypertable('acoustic_stress', 'time', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
SELECT create_hypertable('vision_inference', 'time', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
SELECT create_hypertable('egg_yield', 'time', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);

-- ============================================================================
-- 4. INDEXING
-- ============================================================================

-- Optimizing queries filtering by coop and sorting by time (common for dashboard widgets)
CREATE INDEX IF NOT EXISTS idx_telemetry_coop_time ON telemetry (coop_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_acoustic_coop_time ON acoustic_stress (coop_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_vision_coop_time ON vision_inference (coop_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_egg_yield_coop_time ON egg_yield (coop_id, time DESC);

-- ============================================================================
-- 5. DATA COMPRESSION (7-Day Policy)
-- ============================================================================

-- Enable compression on hypertables
ALTER TABLE telemetry SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'coop_id',
    timescaledb.compress_orderby = 'time DESC'
);

ALTER TABLE acoustic_stress SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'coop_id',
    timescaledb.compress_orderby = 'time DESC'
);

ALTER TABLE vision_inference SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'coop_id',
    timescaledb.compress_orderby = 'time DESC'
);

-- Add compression policies to run automatically after 7 days
SELECT add_compression_policy('telemetry', INTERVAL '7 days', if_not_exists => TRUE);
SELECT add_compression_policy('acoustic_stress', INTERVAL '7 days', if_not_exists => TRUE);
SELECT add_compression_policy('vision_inference', INTERVAL '7 days', if_not_exists => TRUE);

-- ============================================================================
-- 6. CONTINUOUS AGGREGATES (Hourly and Daily Views)
-- ============================================================================

-- --- TELEMETRY ---
CREATE MATERIALIZED VIEW IF NOT EXISTS telemetry_hourly
WITH (timescaledb.continuous) AS
SELECT time_bucket('1 hour', time) AS bucket,
       coop_id,
       avg(temperature) AS avg_temp,
       avg(humidity) AS avg_humidity,
       avg(nh3_level) AS avg_nh3
FROM telemetry
GROUP BY bucket, coop_id;

CREATE MATERIALIZED VIEW IF NOT EXISTS telemetry_daily
WITH (timescaledb.continuous) AS
SELECT time_bucket('1 day', time) AS bucket,
       coop_id,
       avg(temperature) AS avg_temp,
       avg(humidity) AS avg_humidity,
       avg(nh3_level) AS avg_nh3
FROM telemetry
GROUP BY bucket, coop_id;

-- --- ACOUSTIC STRESS ---
CREATE MATERIALIZED VIEW IF NOT EXISTS acoustic_hourly
WITH (timescaledb.continuous) AS
SELECT time_bucket('1 hour', time) AS bucket,
       coop_id,
       avg(stress_level) AS avg_stress,
       avg(peak_frequency) AS avg_peak_freq,
       sum(vocalization_count) AS total_vocalizations
FROM acoustic_stress
GROUP BY bucket, coop_id;

CREATE MATERIALIZED VIEW IF NOT EXISTS acoustic_daily
WITH (timescaledb.continuous) AS
SELECT time_bucket('1 day', time) AS bucket,
       coop_id,
       avg(stress_level) AS avg_stress,
       avg(peak_frequency) AS avg_peak_freq,
       sum(vocalization_count) AS total_vocalizations
FROM acoustic_stress
GROUP BY bucket, coop_id;

-- --- VISION INFERENCE ---
CREATE MATERIALIZED VIEW IF NOT EXISTS vision_hourly
WITH (timescaledb.continuous) AS
SELECT time_bucket('1 hour', time) AS bucket,
       coop_id,
       avg(huddling_index) AS avg_huddling,
       avg(bird_count) AS avg_bird_count,
       avg(active_birds) AS avg_active_birds
FROM vision_inference
GROUP BY bucket, coop_id;

CREATE MATERIALIZED VIEW IF NOT EXISTS vision_daily
WITH (timescaledb.continuous) AS
SELECT time_bucket('1 day', time) AS bucket,
       coop_id,
       avg(huddling_index) AS avg_huddling,
       avg(bird_count) AS avg_bird_count,
       avg(active_birds) AS avg_active_birds
FROM vision_inference
GROUP BY bucket, coop_id;

-- ============================================================================
-- 7. CONTINUOUS AGGREGATE POLICIES
-- ============================================================================

-- Refresh policies to automatically update continuous aggregates
SELECT add_continuous_aggregate_policy('telemetry_hourly',
    start_offset => INTERVAL '3 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE);

SELECT add_continuous_aggregate_policy('telemetry_daily',
    start_offset => INTERVAL '3 days',
    end_offset => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day',
    if_not_exists => TRUE);

SELECT add_continuous_aggregate_policy('acoustic_hourly',
    start_offset => INTERVAL '3 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE);

SELECT add_continuous_aggregate_policy('acoustic_daily',
    start_offset => INTERVAL '3 days',
    end_offset => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day',
    if_not_exists => TRUE);

SELECT add_continuous_aggregate_policy('vision_hourly',
    start_offset => INTERVAL '3 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE);

SELECT add_continuous_aggregate_policy('vision_daily',
    start_offset => INTERVAL '3 days',
    end_offset => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day',
    if_not_exists => TRUE);
