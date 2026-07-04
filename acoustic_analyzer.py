#!/usr/bin/env python3
"""
Boonducks Farm PLF Engine - Acoustic Stress Analyzer
V.E.R.S. Protocol Compatible

Analyzes hen vocalizations to detect stress using frequency spectrum analysis.
When no physical microphone is available, generates synthetic audio signals
that simulate hen clucking (normal) and screaming (stress) vocalizations.

Hardware Mode: Reads from USB/I2S microphone on the Jetson Orin.
Simulation Mode: Generates synthetic audio with configurable stress levels.

Outputs stress classifications to the `acoustic_stress` TimescaleDB table.
"""

import os
import sys
import time
import logging
import argparse
import numpy as np
from datetime import datetime

# Conditionally import hardware-dependent libraries
try:
    import psycopg2
    from psycopg2.extras import execute_values
    HAS_DB = True
except ImportError:
    HAS_DB = False

try:
    import scipy
    HAS_SCIPY = True  # scipy itself is available; sub-imports may still fail at runtime
except ImportError:
    HAS_SCIPY = False

try:
    import sounddevice as sd
    HAS_AUDIO = True
except (ImportError, OSError):
    HAS_AUDIO = False

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("AcousticAnalyzer")

# ============================================================================
# CONFIGURATION
# ============================================================================

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "boonducks_plf")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")

SAMPLE_RATE = 16000       # 16 kHz audio sample rate
FRAME_DURATION = 2.0      # Seconds per analysis frame
POLL_INTERVAL = 10        # Seconds between inference cycles

# Hen vocalization frequency bands (Hz)
CLUCK_BAND = (200, 600)        # Normal clucking
ALARM_BAND = (1500, 4000)      # Distress/screaming
PURR_BAND = (50, 200)          # Contentment purring

# Stress classification thresholds
STRESS_LOW = 0.25
STRESS_MODERATE = 0.50
STRESS_HIGH = 0.75

# Coop IDs to monitor (all 8 coops)
COOP_IDS = list(range(1, 9))

# ============================================================================
# SYNTHETIC AUDIO GENERATION (Hardware-Free Fallback)
# ============================================================================

def generate_synthetic_signal(stress_factor=0.2, duration=2.0, sample_rate=16000):
    """
    Generate a synthetic audio signal simulating hen vocalizations.
    
    Args:
        stress_factor: 0.0 (calm) to 1.0 (extreme stress)
        duration: Signal length in seconds
        sample_rate: Audio sample rate in Hz
    
    Returns:
        numpy array of audio samples
    """
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
    signal = np.zeros_like(t)
    
    # Normal clucking: Short bursts at 300-500 Hz
    cluck_freq = 350 + np.random.uniform(-50, 50)
    cluck_amplitude = max(0.1, 1.0 - stress_factor)
    num_clucks = int(3 + np.random.poisson(2))
    for i in range(num_clucks):
        onset = np.random.uniform(0, duration - 0.15)
        cluck_duration = np.random.uniform(0.05, 0.15)
        mask = (t >= onset) & (t < onset + cluck_duration)
        envelope = np.exp(-((t[mask] - onset) / 0.03) ** 2)
        signal[mask] += cluck_amplitude * envelope * np.sin(2 * np.pi * cluck_freq * t[mask])
    
    # Stress screaming: Sustained high-frequency tones at 2000-3500 Hz
    if stress_factor > 0.3:
        scream_freq = 2200 + stress_factor * 1000 + np.random.uniform(-100, 100)
        scream_amplitude = stress_factor * 0.8
        num_screams = max(1, int(stress_factor * 3))
        for i in range(num_screams):
            onset = np.random.uniform(0, duration - 0.4)
            scream_len = np.random.uniform(0.2, 0.5) * stress_factor
            mask = (t >= onset) & (t < onset + scream_len)
            envelope = np.sin(np.pi * (t[mask] - onset) / scream_len)
            signal[mask] += scream_amplitude * envelope * np.sin(2 * np.pi * scream_freq * t[mask])
    
    # Contentment purring: Low-frequency hum
    if stress_factor < 0.4:
        purr_freq = 80 + np.random.uniform(-20, 20)
        purr_amplitude = (1.0 - stress_factor) * 0.15
        signal += purr_amplitude * np.sin(2 * np.pi * purr_freq * t)
    
    # Background noise
    noise_level = 0.02 + stress_factor * 0.03
    signal += noise_level * np.random.randn(len(t))
    
    # Normalize
    peak = np.max(np.abs(signal))
    if peak > 0:
        signal = signal / peak
    
    return signal

# ============================================================================
# FREQUENCY ANALYSIS ENGINE
# ============================================================================

def analyze_frequency_spectrum(signal, sample_rate=16000):
    """
    Analyze the frequency spectrum of an audio signal to extract stress indicators.

    Returns:
        dict with stress_level, peak_frequency, vocalization_count, and band energies
    """
    # Use numpy FFT (works on all platforms; scipy.signal.welch may hang on some ARM builds)
    fft_vals = np.abs(np.fft.rfft(signal))
    freqs = np.fft.rfftfreq(len(signal), d=1.0 / sample_rate)
    psd = fft_vals ** 2
    peak_idx = np.argmax(psd[1:]) + 1  # Skip DC component
    peak_freq = float(freqs[peak_idx])
    peaks = np.where(psd > np.max(psd) * 0.1)[0]
    
    # Calculate energy in each vocalization band
    def band_energy(f_low, f_high):
        mask = (freqs >= f_low) & (freqs <= f_high)
        return float(np.sum(psd[mask])) if np.any(mask) else 0.0
    
    cluck_energy = band_energy(*CLUCK_BAND)
    alarm_energy = band_energy(*ALARM_BAND)
    purr_energy = band_energy(*PURR_BAND)
    total_energy = cluck_energy + alarm_energy + purr_energy + 1e-10  # Avoid division by zero
    
    # Stress level: Ratio of alarm-band energy to total energy
    alarm_ratio = alarm_energy / total_energy
    stress_level = min(1.0, alarm_ratio * 2.5)  # Scale up for sensitivity
    
    # Vocalization count: Number of significant spectral peaks
    vocalization_count = len(peaks)
    
    return {
        "stress_level": round(stress_level, 2),
        "peak_frequency": round(peak_freq, 1),
        "vocalization_count": vocalization_count,
        "cluck_energy": round(cluck_energy, 4),
        "alarm_energy": round(alarm_energy, 4),
        "purr_energy": round(purr_energy, 4),
    }

# ============================================================================
# DATABASE WRITER
# ============================================================================

def write_to_db(records):
    """Write acoustic stress records to TimescaleDB."""
    if not HAS_DB:
        logger.warning("psycopg2 not available. Skipping database write.")
        return False
    
    try:
        conn = psycopg2.connect(
            host=DB_HOST, port=DB_PORT, database=DB_NAME,
            user=DB_USER, password=DB_PASSWORD
        )
        with conn.cursor() as cur:
            query = """
                INSERT INTO acoustic_stress (time, coop_id, stress_level, peak_frequency, vocalization_count)
                VALUES %s
            """
            execute_values(cur, query, records)
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        logger.error(f"Database write failed: {e}")
        return False

# ============================================================================
# MAIN INFERENCE LOOP
# ============================================================================

def run_inference_cycle(coop_ids, use_hardware=False):
    """Run a single inference cycle for all coops."""
    timestamp = datetime.utcnow()
    records = []
    results = []
    
    for coop_id in coop_ids:
        # Generate or capture audio
        if use_hardware and HAS_AUDIO:
            try:
                signal = sd.rec(int(FRAME_DURATION * SAMPLE_RATE), samplerate=SAMPLE_RATE, channels=1, dtype='float32')
                sd.wait()
                signal = signal.flatten()
            except Exception as e:
                logger.warning(f"Coop {coop_id}: Mic capture failed ({e}). Using synthetic signal.")
                stress_sim = 0.15 + np.random.uniform(-0.05, 0.1)
                signal = generate_synthetic_signal(stress_factor=stress_sim)
        else:
            # Simulation: Each coop gets a slightly different baseline stress
            base_stress = 0.10 + (coop_id * 0.02) + np.random.uniform(-0.05, 0.08)
            # Occasionally simulate a stress spike (5% chance)
            if np.random.random() < 0.05:
                base_stress = min(1.0, base_stress + np.random.uniform(0.3, 0.6))
                logger.warning(f"⚠️  Coop {coop_id}: SIMULATED STRESS SPIKE (stress_factor={base_stress:.2f})")
            signal = generate_synthetic_signal(stress_factor=base_stress)
        
        # Analyze audio
        analysis = analyze_frequency_spectrum(signal, SAMPLE_RATE)
        
        # Classify stress level
        stress = analysis["stress_level"]
        if stress >= STRESS_HIGH:
            classification = "🔴 HIGH"
        elif stress >= STRESS_MODERATE:
            classification = "🟡 MODERATE"
        elif stress >= STRESS_LOW:
            classification = "🟢 LOW"
        else:
            classification = "⚪ CALM"
        
        logger.info(
            f"Coop {coop_id:>2d} | Stress: {stress:.2f} [{classification}] | "
            f"Peak: {analysis['peak_frequency']:>7.1f} Hz | "
            f"Vocalizations: {analysis['vocalization_count']}"
        )
        
        records.append((
            timestamp,
            coop_id,
            analysis["stress_level"],
            analysis["peak_frequency"],
            analysis["vocalization_count"]
        ))
        results.append(analysis)
    
    # Write to database
    if records:
        success = write_to_db(records)
        if success:
            logger.info(f"✅ Wrote {len(records)} acoustic records to TimescaleDB.")
        else:
            logger.info(f"📊 Generated {len(records)} records (DB offline, simulation only).")
    
    return results

def main():
    parser = argparse.ArgumentParser(description="Boonducks Farm Acoustic Stress Analyzer")
    parser.add_argument("--duration", type=int, default=0, help="Run for N seconds then exit (0 = continuous)")
    parser.add_argument("--hardware", action="store_true", help="Use physical microphone input")
    parser.add_argument("--interval", type=int, default=POLL_INTERVAL, help="Seconds between inference cycles")
    args = parser.parse_args()
    
    mode = "HARDWARE" if (args.hardware and HAS_AUDIO) else "SIMULATION"
    logger.info(f"🎙️  Boonducks Farm Acoustic Stress Analyzer")
    logger.info(f"   Mode: {mode} | Interval: {args.interval}s | Coops: {len(COOP_IDS)}")
    logger.info(f"   scipy: {'✅' if HAS_SCIPY else '❌ (using numpy FFT)'} | "
                f"sounddevice: {'✅' if HAS_AUDIO else '❌ (synthetic signals)'} | "
                f"psycopg2: {'✅' if HAS_DB else '❌ (no DB writes)'}")
    logger.info("─" * 60)
    
    start_time = time.time()
    cycle = 0
    
    while True:
        cycle += 1
        logger.info(f"\n── Inference Cycle {cycle} ──")
        run_inference_cycle(COOP_IDS, use_hardware=args.hardware)
        
        # Check duration limit
        if args.duration > 0 and (time.time() - start_time) >= args.duration:
            logger.info(f"\n✅ Duration limit reached ({args.duration}s). Exiting.")
            break
        
        time.sleep(args.interval)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("\n🛑 Acoustic Analyzer stopped by user.")
        sys.exit(0)
