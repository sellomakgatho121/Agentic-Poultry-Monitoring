#!/usr/bin/env python3
"""
Boonducks Farm PLF Engine - Vision Inference Analyzer
V.E.R.S. Protocol Compatible

Calculates the spatial Huddling Index and bird activity from camera feeds.
When no physical camera is available, generates simulated 2D coordinate spaces
representing hen spatial distributions.

Hardware Mode: Reads RTSP camera streams via OpenCV.
Simulation Mode: Generates synthetic bird coordinate maps for analysis.

Outputs huddling classifications to the `vision_inference` TimescaleDB table.
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
    import cv2
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("VisionAnalyzer")

# ============================================================================
# CONFIGURATION
# ============================================================================

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "boonducks_plf")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")

POLL_INTERVAL = 10  # Seconds between inference cycles

# Camera RTSP URLs (per coop, placeholder until hardware is deployed)
CAMERA_FEEDS = {
    1: os.getenv("CAMERA_COOP_1", "rtsp://admin:pass@192.168.1.101:554/stream1"),
    2: os.getenv("CAMERA_COOP_2", "rtsp://admin:pass@192.168.1.102:554/stream1"),
    3: os.getenv("CAMERA_COOP_3", "rtsp://admin:pass@192.168.1.103:554/stream1"),
    4: os.getenv("CAMERA_COOP_4", "rtsp://admin:pass@192.168.1.104:554/stream1"),
    5: os.getenv("CAMERA_COOP_5", "rtsp://admin:pass@192.168.1.105:554/stream1"),
    6: os.getenv("CAMERA_COOP_6", "rtsp://admin:pass@192.168.1.106:554/stream1"),
    7: os.getenv("CAMERA_COOP_7", "rtsp://admin:pass@192.168.1.107:554/stream1"),
    8: os.getenv("CAMERA_COOP_8", "rtsp://admin:pass@192.168.1.108:554/stream1"),
}

# Coop capacities (bird counts)
COOP_CAPACITIES = {
    1: 312, 2: 310,
    3: 104, 4: 104, 5: 104, 6: 104, 7: 104, 8: 104
}

COOP_IDS = list(range(1, 9))

# ============================================================================
# SYNTHETIC BIRD COORDINATE GENERATION (Hardware-Free Fallback)
# ============================================================================

def generate_bird_coordinates(num_birds, huddling_factor=0.3, area_size=(640, 480)):
    """
    Generate 2D coordinates for simulated birds.
    
    Args:
        num_birds: Number of birds in the coop
        huddling_factor: 0.0 (evenly spread) to 1.0 (tightly clustered)
        area_size: (width, height) of the coop floor space in pixels
    
    Returns:
        numpy array of shape (num_birds, 2) with (x, y) coordinates
    """
    w, h = area_size
    
    if huddling_factor < 0.3:
        # Evenly distributed: birds spread across the space
        coords = np.random.uniform(
            low=[w * 0.05, h * 0.05],
            high=[w * 0.95, h * 0.95],
            size=(num_birds, 2)
        )
    else:
        # Clustered: birds gather around 1-3 cluster centers
        num_clusters = max(1, int(3 * (1.0 - huddling_factor)))
        cluster_centers = np.random.uniform(
            low=[w * 0.2, h * 0.2],
            high=[w * 0.8, h * 0.8],
            size=(num_clusters, 2)
        )
        
        coords = []
        birds_per_cluster = num_birds // num_clusters
        remainder = num_birds % num_clusters
        
        for i, center in enumerate(cluster_centers):
            n = birds_per_cluster + (1 if i < remainder else 0)
            spread = max(20, (1.0 - huddling_factor) * 150)
            cluster_coords = np.random.normal(
                loc=center,
                scale=spread,
                size=(n, 2)
            )
            coords.append(cluster_coords)
        
        coords = np.vstack(coords)
        # Clamp to area boundaries
        coords[:, 0] = np.clip(coords[:, 0], 0, w)
        coords[:, 1] = np.clip(coords[:, 1], 0, h)
    
    return coords

# ============================================================================
# HUDDLING INDEX CALCULATION
# ============================================================================

def calculate_huddling_index(coordinates, area_size=(640, 480)):
    """
    Calculate the Huddling Index from bird coordinates using pairwise distance analysis.
    
    A huddling index of 0.0 means birds are evenly dispersed.
    A huddling index of 1.0 means birds are tightly clustered together.
    
    Method: Compare the mean nearest-neighbor distance against the expected distance
    for a uniform random distribution. Tighter clustering = higher index.
    
    Args:
        coordinates: numpy array of shape (N, 2) with bird positions
        area_size: (width, height) of the space
    
    Returns:
        float: huddling_index between 0.0 and 1.0
    """
    n = len(coordinates)
    if n < 2:
        return 0.0
    
    # For large flocks, subsample to keep computation fast
    max_sample = min(n, 200)
    if n > max_sample:
        indices = np.random.choice(n, max_sample, replace=False)
        sample = coordinates[indices]
    else:
        sample = coordinates
    
    # Calculate pairwise distances using broadcasting
    diffs = sample[:, np.newaxis, :] - sample[np.newaxis, :, :]
    distances = np.sqrt(np.sum(diffs ** 2, axis=2))
    
    # Set self-distance to infinity to exclude
    np.fill_diagonal(distances, np.inf)
    
    # Mean nearest-neighbor distance
    nearest_distances = np.min(distances, axis=1)
    mean_nn_distance = float(np.mean(nearest_distances))
    
    # Expected mean nearest-neighbor distance for uniform random distribution
    # Clark-Evans statistic: E(r) = 0.5 * sqrt(A / N)
    area = area_size[0] * area_size[1]
    expected_nn = 0.5 * np.sqrt(area / len(sample))
    
    # Huddling index: 1 - (observed / expected), clamped to [0, 1]
    if expected_nn > 0:
        ratio = mean_nn_distance / expected_nn
        huddling_index = max(0.0, min(1.0, 1.0 - ratio))
    else:
        huddling_index = 0.0
    
    return round(huddling_index, 2)

def estimate_active_birds(coordinates, area_size=(640, 480), activity_threshold=0.6):
    """
    Estimate the number of 'active' birds based on spatial spread.
    Birds near cluster edges are considered more active (moving/foraging).
    Birds deep inside clusters are considered resting.
    
    This is a heuristic until real motion tracking is available.
    """
    n = len(coordinates)
    if n < 2:
        return n
    
    # Use distance from centroid as a proxy for activity
    centroid = np.mean(coordinates, axis=0)
    distances_from_center = np.sqrt(np.sum((coordinates - centroid) ** 2, axis=1))
    median_dist = np.median(distances_from_center)
    
    # Birds further than median distance are considered "active"
    active = np.sum(distances_from_center > median_dist * activity_threshold)
    return int(active)

# ============================================================================
# CAMERA FRAME CAPTURE (Hardware Mode)
# ============================================================================

def capture_frame(rtsp_url):
    """Capture a single frame from an RTSP camera feed."""
    if not HAS_CV2:
        return None
    
    try:
        cap = cv2.VideoCapture(rtsp_url)
        if not cap.isOpened():
            return None
        ret, frame = cap.read()
        cap.release()
        return frame if ret else None
    except Exception as e:
        logger.warning(f"Frame capture failed: {e}")
        return None

# ============================================================================
# DATABASE WRITER
# ============================================================================

def write_to_db(records):
    """Write vision inference records to TimescaleDB."""
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
                INSERT INTO vision_inference (time, coop_id, huddling_index, bird_count, active_birds)
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
    """Run a single vision inference cycle for all coops."""
    timestamp = datetime.utcnow()
    records = []
    results = []
    
    for coop_id in coop_ids:
        capacity = COOP_CAPACITIES.get(coop_id, 104)
        
        if use_hardware and HAS_CV2:
            # Hardware mode: capture frame and run detection
            rtsp_url = CAMERA_FEEDS.get(coop_id, "")
            frame = capture_frame(rtsp_url)
            
            if frame is not None:
                # Placeholder for YOLOv8-nano inference
                # In production: model = YOLO('yolov8n-custom.pt')
                #                results = model(frame)
                #                coordinates = extract_bird_centers(results)
                logger.info(f"Coop {coop_id}: Frame captured ({frame.shape}). YOLOv8 model not loaded yet.")
                # Fallback to simulation for now
                huddling_sim = 0.2 + np.random.uniform(-0.05, 0.1)
                coordinates = generate_bird_coordinates(capacity, huddling_factor=huddling_sim)
            else:
                logger.warning(f"Coop {coop_id}: Camera offline. Using synthetic coordinates.")
                huddling_sim = 0.2 + np.random.uniform(-0.05, 0.1)
                coordinates = generate_bird_coordinates(capacity, huddling_factor=huddling_sim)
        else:
            # Simulation mode: generate synthetic bird positions
            base_huddling = 0.15 + (coop_id * 0.015) + np.random.uniform(-0.05, 0.08)
            
            # Occasionally simulate a huddling event (5% chance per coop)
            if np.random.random() < 0.05:
                base_huddling = min(1.0, base_huddling + np.random.uniform(0.3, 0.5))
                logger.warning(f"⚠️  Coop {coop_id}: SIMULATED HUDDLING EVENT (factor={base_huddling:.2f})")
            
            coordinates = generate_bird_coordinates(capacity, huddling_factor=base_huddling)
        
        # Calculate metrics
        huddling_index = calculate_huddling_index(coordinates)
        bird_count = len(coordinates)
        active_birds = estimate_active_birds(coordinates)
        
        # Classify huddling level
        if huddling_index >= 0.6:
            classification = "🔴 CLUSTERED"
        elif huddling_index >= 0.35:
            classification = "🟡 PARTIAL"
        else:
            classification = "🟢 DISPERSED"
        
        logger.info(
            f"Coop {coop_id:>2d} | Huddle: {huddling_index:.2f} [{classification}] | "
            f"Birds: {bird_count:>3d} | Active: {active_birds:>3d} "
            f"({(active_birds/bird_count*100):.0f}%)"
        )
        
        records.append((
            timestamp,
            coop_id,
            huddling_index,
            bird_count,
            active_birds
        ))
        results.append({
            "coop_id": coop_id,
            "huddling_index": huddling_index,
            "bird_count": bird_count,
            "active_birds": active_birds
        })
    
    # Write to database
    if records:
        success = write_to_db(records)
        if success:
            logger.info(f"✅ Wrote {len(records)} vision records to TimescaleDB.")
        else:
            logger.info(f"📊 Generated {len(records)} records (DB offline, simulation only).")
    
    return results

def main():
    parser = argparse.ArgumentParser(description="Boonducks Farm Vision Huddling Analyzer")
    parser.add_argument("--duration", type=int, default=0, help="Run for N seconds then exit (0 = continuous)")
    parser.add_argument("--hardware", action="store_true", help="Use physical camera feeds via RTSP")
    parser.add_argument("--interval", type=int, default=POLL_INTERVAL, help="Seconds between inference cycles")
    args = parser.parse_args()
    
    mode = "HARDWARE" if (args.hardware and HAS_CV2) else "SIMULATION"
    logger.info(f"📷 Boonducks Farm Vision Huddling Analyzer")
    logger.info(f"   Mode: {mode} | Interval: {args.interval}s | Coops: {len(COOP_IDS)}")
    logger.info(f"   OpenCV: {'✅' if HAS_CV2 else '❌ (synthetic coordinates)'} | "
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
        logger.info("\n🛑 Vision Analyzer stopped by user.")
        sys.exit(0)
