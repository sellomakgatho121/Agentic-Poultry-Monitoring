#!/usr/bin/env python3
"""
Boonducks Farm PLF Engine - Telemetry Ingestion Daemon
V.E.R.S. Protocol Compatible

Polls XY-MD02 Temperature/Humidity sensors and Electrochemical NH3 sensors
over RS485 Modbus RTU at 10-second intervals and inserts the data into TimescaleDB.
"""

import os
import sys
import time
import logging

# Conditionally import hardware-dependent libraries
try:
    import psycopg2
    from psycopg2.extras import execute_values
    HAS_DB = True
except ImportError:
    HAS_DB = False

try:
    import minimalmodbus
    import serial
    HAS_SERIAL = True
except ImportError:
    HAS_SERIAL = False

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("telemetry_worker.log", mode="a")
    ]
)
logger = logging.getLogger("TelemetryWorker")

# ============================================================================
# CONFIGURATION
# ============================================================================

# Database connection details
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "boonducks_plf")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")

# Serial Modbus settings
SERIAL_PORT = os.getenv("SERIAL_PORT", "/dev/ttyUSB0")
BAUDRATE = int(os.getenv("BAUDRATE", "9600"))
TIMEOUT = float(os.getenv("TIMEOUT", "0.5"))

# Polling Interval (seconds)
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "10"))

# Coop Modbus Address Mapping
# For each coop:
# - temp_hum_addr: Modbus Slave ID for the XY-MD02 sensor (Temp/Humidity)
# - nh3_addr: Modbus Slave ID for the Electrochemical NH3 sensor (Ammonia)
# (NH3 is typically installed only in Deep Litter coops due to litter emissions)
COOP_SENSORS = {
    1: {"temp_hum_addr": 1, "nh3_addr": None},  # Cage Coop 1
    2: {"temp_hum_addr": 2, "nh3_addr": None},  # Cage Coop 2
    3: {"temp_hum_addr": 3, "nh3_addr": 13},   # Deep Litter Coop 1
    4: {"temp_hum_addr": 4, "nh3_addr": 14},   # Deep Litter Coop 2
    5: {"temp_hum_addr": 5, "nh3_addr": 15},   # Deep Litter Coop 3
    6: {"temp_hum_addr": 6, "nh3_addr": 16},   # Deep Litter Coop 4
    7: {"temp_hum_addr": 7, "nh3_addr": 17},   # Deep Litter Coop 5
    8: {"temp_hum_addr": 8, "nh3_addr": 18},   # Deep Litter Coop 6
}

# ============================================================================
# MODBUS READING UTILITIES
# ============================================================================

def get_instrument(port, slave_addr):
    """Create and configure a minimalmodbus Instrument instance."""
    if not HAS_SERIAL:
        logger.warning("Serial libraries not available. Skipping Modbus read.")
        return None
    try:
        instrument = minimalmodbus.Instrument(port, slave_addr)
        instrument.serial.baudrate = BAUDRATE
        instrument.serial.bytesize = 8
        instrument.serial.parity = serial.PARITY_NONE
        instrument.serial.stopbits = 1
        instrument.serial.timeout = TIMEOUT
        instrument.mode = minimalmodbus.MODE_RTU
        instrument.clear_buffers_before_each_transaction = True
        return instrument
    except Exception as e:
        logger.error(f"Failed to initialize Modbus instrument on port {port}, address {slave_addr}: {e}")
        return None

def read_xy_md02(port, slave_addr):
    """
    Read Temperature and Humidity from XY-MD02 sensor.
    Register 1 (0x0001): Temperature (signed, value / 10)
    Register 2 (0x0002): Humidity (unsigned, value / 10)
    Uses Function Code 0x04 (Read Input Registers).
    """
    instrument = get_instrument(port, slave_addr)
    if not instrument:
        return None, None
    
    try:
        # Read temperature (signed 16-bit, register 1)
        temp_raw = instrument.read_register(1, number_of_decimals=1, functioncode=4, signed=True)
        # Read humidity (unsigned 16-bit, register 2)
        hum_raw = instrument.read_register(2, number_of_decimals=1, functioncode=4, signed=False)
        return temp_raw, hum_raw
    except Exception as e:
        logger.warning(f"Error reading XY-MD02 (Address {slave_addr}): {e}")
        return None, None

def read_nh3(port, slave_addr):
    """
    Read Ammonia (NH3) concentration from electrochemical sensor.
    Typically, industrial NH3 sensors store concentration in ppm at register 0 or 1.
    We assume register 0, Function Code 0x03 (Read Holding Registers), value in ppm (or value / 10).
    """
    if slave_addr is None:
        return None
        
    instrument = get_instrument(port, slave_addr)
    if not instrument:
        return None
        
    try:
        # Read NH3 concentration (typically register 0 or 1, unsigned 16-bit)
        # We will attempt register 0, dividing by 10 if needed. Let's read directly first.
        nh3_raw = instrument.read_register(0, number_of_decimals=0, functioncode=3, signed=False)
        # If the sensor scale is 0.1 ppm, we can adjust it here. We assume direct ppm reading.
        return float(nh3_raw)
    except Exception as e:
        logger.warning(f"Error reading NH3 sensor (Address {slave_addr}): {e}")
        return None

# ============================================================================
# DATABASE UTILITIES
# ============================================================================

def get_db_connection():
    """Establish a connection to the TimescaleDB database."""
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD
        )
        return conn
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        return None

# ============================================================================
# MAIN INGESTION LOOP
# ============================================================================

def main():
    logger.info("Starting Boonducks Farm PLF Telemetry Ingestion Daemon...")
    logger.info(f"Configured serial port: {SERIAL_PORT} @ {BAUDRATE} baud")
    logger.info(f"Polling interval: {POLL_INTERVAL} seconds")
    logger.info(f"psycopg2: {'✅' if HAS_DB else '❌ (no DB writes)'} | "
                f"Serial: {'✅' if HAS_SERIAL else '❌ (simulation mode)'}")

    from datetime import datetime as dt_mod
    db_conn = None

    while True:
        # Ensure database connection is active (only if psycopg2 is available)
        if HAS_DB and (db_conn is None or db_conn.closed):
            logger.info("Connecting to database...")
            db_conn = get_db_connection()
            if db_conn is None:
                logger.error("Could not connect to database. Retrying in 5 seconds...")
                time.sleep(5)
                continue
            logger.info("Database connection established.")

        start_time = time.time()
        readings = []
        try:
            timestamp = psycopg2.TimestampFromTicks(start_time) if HAS_DB else dt_mod.utcnow()
        except:
            timestamp = dt_mod.utcnow()

        # Poll all configured sensors
        for coop_id, addrs in COOP_SENSORS.items():
            temp_addr = addrs["temp_hum_addr"]
            nh3_addr = addrs["nh3_addr"]
            
            temp, hum = None, None
            nh3 = None
            
            # Read Temp/Humidity
            if temp_addr is not None:
                temp, hum = read_xy_md02(SERIAL_PORT, temp_addr)
                
            # Read NH3
            if nh3_addr is not None:
                nh3 = read_nh3(SERIAL_PORT, nh3_addr)
                
            # Only record if we got at least one valid reading
            if temp is not None or hum is not None or nh3 is not None:
                readings.append((timestamp, coop_id, temp, hum, nh3))
                logger.info(f"Coop {coop_id} -> Temp: {temp}°C, Hum: {hum}%, NH3: {nh3} ppm")
            else:
                logger.warning(f"Coop {coop_id} -> Failed to retrieve any sensor telemetry.")

        # Batch insert readings into TimescaleDB
        if readings:
            if db_conn is not None:
                try:
                    with db_conn.cursor() as cur:
                        query = """
                            INSERT INTO telemetry (time, coop_id, temperature, humidity, nh3_level)
                            VALUES %s
                        """
                        execute_values(cur, query, readings)
                    db_conn.commit()
                    logger.info(f"Successfully ingested {len(readings)} telemetry records into TimescaleDB.")
                except Exception as e:
                    logger.error(f"Failed to insert telemetry data into database: {e}")
                    db_conn.rollback()
                    # If database error occurs, close connection to trigger reconnect on next loop
                    db_conn.close()
                    db_conn = None
            else:
                logger.info(f"📊 Generated {len(readings)} records (DB offline, simulation only).")
        else:
            logger.warning("No telemetry data collected in this cycle.")

        # Calculate sleep time to maintain precise 10s interval
        elapsed = time.time() - start_time
        sleep_time = max(0.1, POLL_INTERVAL - elapsed)
        time.sleep(sleep_time)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("Daemon stopped by user.")
        sys.exit(0)
    except Exception as e:
        logger.critical(f"Unhandled daemon exception: {e}")
        sys.exit(1)
