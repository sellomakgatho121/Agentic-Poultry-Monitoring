# Boonducks Farm PLF Engine — Complete Setup Guide

> **From Out-of-Box to Fully Running and Functional**
>
> Farm: Boonducks Farm, Bojanala District, North West, South Africa
> Flock: 1,242 laying hens (2 Cage Coops + 6 Deep Litter Coops)
> System Architect: V.E.R.S. Protocol

---

## Table of Contents

1. [Project Overview & Inspiration](#1-project-overview--inspiration)
2. [System Architecture & Topology](#2-system-architecture--topology)
3. [Hardware Bill of Materials](#3-hardware-bill-of-materials)
4. [Cable Connections & Wiring Schematics](#4-cable-connections--wiring-schematics)
5. [Central Compute Node Setup](#5-central-compute-node-setup)
6. [Database Schema (TimescaleDB)](#6-database-schema-timescaledb)
7. [Backend API Server](#7-backend-api-server)
8. [Edge Data Ingestion Services](#8-edge-data-ingestion-services)
9. [Frontend Dashboard](#9-frontend-dashboard)
10. [Systemd Service Automation](#10-systemd-service-automation)
11. [Physical Installation Sequence](#11-physical-installation-sequence)
12. [Budget Breakdown (ZAR)](#12-budget-breakdown-zar)
13. [Verification & Testing](#13-verification--testing)
14. [Maintenance & Operations](#14-maintenance--operations)

---

## 1. Project Overview & Inspiration

### The Inspiration

This project is inspired by **"The Interspecies Singularity: AI is Talking Back"** by Technomics (May 2026), which documents how self-supervised AI models are decoding animal communication — from Project CETI's sperm whale phonetic alphabet to Google DeepMind's DolphinGemma predicting dolphin whistles in real time.

The key technical insight from that video that this project implements directly:

> *"Tech companies are currently developing advanced audio and visual sensors that continuously monitor the hidden meanings behind animal vocalizations. These systems detect the earliest micro signs of stress, pain, or thermal discomfort. The AI systems will autonomously alter facility temperatures, modify personalized feed, and even emit specific synthesized acoustic frequencies designed specifically to comfort the animals."*

**Your project applies the same paradigm** — using XGBoost acoustic classifiers (inspired by the video's coverage of lightweight ML classifiers) and YOLOv8-nano computer vision (multi-modal tracking frameworks) to monitor 1,242 laying hens at Boonducks Farm, detecting stress and health anomalies **before** they cause production crashes.

### What This System Does

The Boonducks Farm PLF (Precision Livestock Farming) Engine is a three-layer intelligence platform:

| Layer | Location | Function |
|-------|----------|----------|
| **Edge** | Inside each coop cluster | Real-time inference (YOLOv8-nano, XGBoost) on sensor/camera/mic data |
| **Fog** | Farm office server room | Data aggregation, TimescaleDB hypertables, historical analytics, API server |
| **Cloud** | (Future) | Cross-farm analytics, remote dashboard, model retraining |

The system continuously monitors:
- **Acoustic stress** — MFCC feature extraction + XGBoost classifier detecting thermal distress (panting), panic spikes, and baseline harmonics
- **Spatial huddling** — YOLOv8-nano bird detection + Huddling Index calculation from overhead cameras
- **Environmental telemetry** — Temperature, humidity, ammonia (NH3) via Modbus RTU sensors
- **Production yield** — Manual or automated daily egg count correlation against environmental variables

---

## 2. System Architecture & Topology

### Full Network Topology

```
========================================================================================
                          BOONDOCKS FARM NETWORK MATRIX
========================================================================================

 [ CAGE CLUSTER: 2 COOPS ]                 [ DEEP LITTER CLUSTER: 6 COOPS ]
 ├── 4x Hikvision DS-2CD2143G2-IS          ├── 6x Wide-Angle Ceiling Cameras
 │   (4MP PoE Dome, aisle view)            │   (top-down spatial view)
 ├── 4x Dahua DH-PFM140 Mics               ├── 6x XY-MD02 Modbus Temp/Hum Sensors
 │   (into camera Audio-In)                │   (dust-filtered housings)
 └── 4x XY-MD02 Modbus Temp/Hum Sensors    └── 6x Electrochemical NH3 Probes
     (top/bottom tier pairs)                    (Modbus RTU, RS485)

                 │                                           │
                 ▼                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────┐
│                  LOCAL IP65 FIELD ENCLOSURE (COOP-SIDE)                           │
│                                                                                    │
│  ┌────────────────────────────┐       ┌───────────────────────────────────┐       │
│  │ Netgear GS308PP PoE Switch │       │ RS485 Daisy-Chain Sensor Bus      │       │
│  │ (8-Port Gigabit PoE+, 83W) │       │ (2-core shielded twisted pair)    │       │
│  └────────────┬───────────────┘       └────────────────┬──────────────────┘       │
│               │                                        │                            │
│               └──────────┬─────────────────────────────┘                            │
│                          │                                                           │
│                          ▼                                                           │
│           ┌─────────────────────────────────┐                                       │
│           │   NVIDIA Jetson Orin Nano Super  │  ← Edge AI Accelerator (Phase 4)     │
│           │  (67 TOPS, 7-15W, TensorRT)      │                                       │
│           │  • XGBoost acoustic classifier    │                                       │
│           │  • YOLOv8-nano vision inference   │                                       │
│           │  • Only sends anomaly JSON to DB  │                                       │
│           └────────────────┬────────────────┘                                       │
└────────────────────────────┼─────────────────────────────────────────────────────────┘
                             │
                    Micro-Metrics (JSON packets)
                             │
                             ▼
┌────────────────────────────────────────────────────────────────────────────────────┐
│                          MAIN SERVER OFFICE / CENTRAL NODE                          │
│                                                                                     │
│  ┌──────────┐    ┌────────────────────────────────────────────────────────────┐    │
│  │  UPS     │    │                   CENTRAL PC                               │    │
│  │ RCT Pro  │    │  • 32GB RAM, NVIDIA GPU, 4-10TB storage                   │    │
│  │ 2000VA   │    │  • Ubuntu LTS / Debian                                    │    │
│  └──────────┘    │  • Docker → TimescaleDB (timescale/timescaledb:latest-pg15)│    │
│                  │  • Node.js API server (Express, port 5000)                 │    │
│                  │  • Vite/React Frontend Dashboard (port 5173)               │    │
│                  │  • Python ingestion daemons (systemd)                      │    │
│                  │  • FFmpeg stream recorder (RTSP→H.265→file)                │    │
│                  └────────────────────────────────┬───────────────────────────┘    │
│                                                   │                                │
│                   ┌───────────────────────────────┴──────────────────────┐        │
│                   │             TIMESCALEDB HYPERTABLES                   │        │
│                   │  • cage_telemetry (temp/hum 10s intervals)           │        │
│                   │  • media_catalog (video/audio file paths)            │        │
│                   │  • vision_inference (huddling index per cycle)       │        │
│                   │  • acoustic_inference (stress scores per cycle)      │        │
│                   │  • production_yield (daily egg counts)               │        │
│                   └──────────────────────────────────────────────────────┘        │
└────────────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
[FIELD SENSORS]
    │
    ├── Cameras + Mics → RTSP streams → Jetson Orin (edge inference)
    │                                      │
    │                 ┌────────────────────┴────┐
    │                 │  Is anomaly detected?    │
    │                 └──────┬──────────┬───────┘
    │                      YES         NO
    │                       │           │
    │                       ▼           ▼
    │              Save full chunk   Drop raw media
    │              + Alert JSON      + Health JSON
    └──────────────────────┼──────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │ TimescaleDB Hypertable │
              └───────────┬────────────┘
                          │
                          ▼
              ┌────────────────────────┐
              │  API Server (Express)  │
              └───────────┬────────────┘
                          │
                          ▼
              ┌────────────────────────┐
              │ React Dashboard (Vite) │ → User
              └────────────────────────┘
```

---

## 3. Hardware Bill of Materials

### Cage Coops Cluster (x2 adjacent coops)

| Component | Make & Model | Qty | Unit (ZAR) | Total (ZAR) | Justification |
|-----------|-------------|-----|-----------|-------------|---------------|
| **IP Dome Camera** | Hikvision DS-2CD2143G2-IS (4MP PoE, Audio I/O, IP67, IK10) | 4 | R1,599 | R6,396 | 4MP baseline, HW audio line-in, H.265+ compression, RTSP native, dust/weather resistant |
| **Microphone** | Dahua DH-PFM140 (High-fidelity Omnidirectional Pickup) | 4 | R450 | R1,800 | Advanced preamp captures low-frequency respiratory rales, filters fan hum |
| **Temp/Humidity Sensor** | XY-MD02 Industrial Modbus RTU RS485 (SHT30 Probe) | 4 | R300 | R1,200 | RS485 differential bus immune to motor EMI, handles long cable runs |
| **PoE Switch** | Netgear GS308PP (8-Port Gigabit PoE+, 83W Budget) | 1 | R3,700 | R3,700 | Powers 4 cameras on single cable each, 83W budget covers ~28W camera draw |
| **Serial Bus Interface** | D-Tech USB to RS485 Converter (FTDI Chipset) | 1 | R350 | R350 | FTDI chipset = native Linux driver support, no dropped frames |
| **UPS** | RCT Pro 2000VA Line-Interactive UPS | 1 | R1,750 | R1,750 | 1200W capacity, absorbs Eskom switchover transients, keeps edge online |
| **Cat6 STP Cable** | Linkbasic Cat6 STP UV-Resistant Solid Copper (305m drum) | 1 | R4,250 | R4,250 | Shielded foil + drain wire grounds EMI from ventilation fans |
| **Shielded RJ45 Connectors** | Platinum Tools Shielded Cat6 Pass-Through + Weather Boots | 20pk | R350 | R350 | Metal wrap crimps to drain wire for continuous grounding |
| **Sensor Cable** | 2-Core Twisted Pair Shielded Instrument Wire (100m) | 1 | R600 | R600 | Low-capacitance for RS485 Modbus daisy-chain |
| **Field Enclosure** | IP65 Rated Polycarbonate Weatherproof Box (300x250x150mm) | 1 | R850 | R850 | Seals PoE switch from ammonia, dust, moisture |
| **Sundries** | PVC Conduit, Insulation Tape, Cable Ties | 1 lot | R500 | R500 | Rodent protection along coop structural beams |
| | | | **Subtotal** | **R21,746** | |

### Deep Litter Coops (x6 coops) — Phase 3

| Component | Make & Model | Qty | Unit (ZAR) | Total (ZAR) |
|-----------|-------------|-----|-----------|-------------|
| **Overhead Wide-Angle Camera** | Ceiling-mount fixed lens (e.g., Hikvision DS-2CD2346G2-I) | 6 | R1,500 | R9,000 |
| **XY-MD02 Temp/Hum Sensor** | Same as cage cluster, with dust-filtered housing | 6 | R350 | R2,100 |
| **NH3 Electrochemical Probe** | Industrial dust-filtered ammonia sensor (Modbus RTU) | 6 | R1,500 | R9,000 |
| **Edge Compute Accelerator** | NVIDIA Jetson Orin Nano Super (67 TOPS, 7-15W) | 1 | R12,000 | R12,000 |
| **RS485-to-USB Hub** | D-Tech industrial converter hub | 1 | R800 | R800 |
| **Cabling & Enclosures** | Same spec as cage cluster, additional runs | 1 lot | R5,200 | R5,200 |
| | | | **Subtotal** | **R38,100** |

### Central Compute Node

| Component | Specification | Justification |
|-----------|-------------|---------------|
| **Desktop PC** | Minimum 32GB RAM, modern NVIDIA GPU (RTX 3060 or better), 4-10TB storage | GPU for YOLOv8 training, RAM for TimescaleDB hot chunks, storage for media archive |
| **OS** | Ubuntu 22.04 LTS or Debian 12 | Docker + NVIDIA driver + systemd support |
| **Docker** | Latest CE | Containerized TimescaleDB + PGAdmin |

---

## 4. Cable Connections & Wiring Schematics

### 4.1 Connection Types

There are three distinct physical networks:

1. **PoE Network** — Power + data for cameras (Cat6 STP)
2. **Audio Line-In** — Microphone to camera body (short shielded audio cable)
3. **RS485 Serial Bus** — Environmental sensors daisy-chain (2-core shielded twisted pair)

### 4.2 Cage Coop Wiring Diagram

```
                        ┌──────────────────────────────────────┐
                        │         CAGE COOP 1                   │
                        │                                       │
  ┌─────────────────────┤   ┌──────────┐   ┌──────────┐        │
  │ Cat6 STP (PoE)      │   │ Cam 01   │   │ Cam 02   │        │
  │ to Cam 01 + Audio   │   │ (Aisle L)│   │(Aisle R) │        │
  │ from Mic 01         │   └────┬─────┘   └────┬─────┘        │
  │                     │        │              │              │
  │  Mic 01 ─────audio──┘        │              │              │
  │  (ceiling-suspended)         │              │              │
  │                              │              │              │
  │  ┌─────┐   ┌─────┐          │              │              │
  │  │Sens01│  │Sens02│         │              │              │
  │  │(Top) │  │(Bot) │         │              │              │
  │  └──┬──┘  └──┬───┘         │              │              │
  │     │RS485   │              │              │              │
  └─────┼────────┼──────────────┼──────────────┼──────────────┘
        │        │              │              │
        │        │         ┌────┘              │
        │        │         │  Cat6 STP (PoE)   │
        │        │         │  to Cam 01        │  Cat6 STP (PoE)
        │        │         │                   │  to Cam 02
        │        │         │                   │
        ▼        ▼         ▼                   ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │              IP65 FIELD ENCLOSURE (mounted externally)           │
   │                                                                  │
   │   ┌────────────────────────────────────────────┐                 │
   │   │        Netgear GS308PP PoE Switch          │                 │
   │   │  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐   │                 │
   │   │  │Port 1│  │Port 2│  │Port 3│  │Port 4│   │                 │
   │   │  └──┬───┘  └──┬───┘  └──┬───┘  └──┬───┘   │                 │
   │   └─────┼─────────┼─────────┼─────────┼───────┘                 │
   │         │         │         │         │                          │
   │  Cam01 ◄┘  Cam02 ◄┘  Cam03 ◄┘  Cam04 ◄┘                          │
   │                                                                  │
   └──────────────────────────────────────────────────────────────────┘
                               │
                               │  Cat6 STP Trunk (up to 100m)
                               ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │                      SERVER ROOM                                  │
   │                                                                   │
   │   ┌────────────────────────────────────────────┐                  │
   │   │   Main Server / Central Compute Node        │                  │
   │   │                                            │                  │
   │   │   ┌──────────┐       ┌──────────────────┐  │                  │
   │   │   │ Trunk    │──────►│ LAN Port          │  │                  │
   │   │   │ (PoE)    │       │ (10/100/1000)     │  │                  │
   │   │   └──────────┘       └──────────────────┘  │                  │
   │   │                                            │                  │
   │   │   ┌──────────┐       ┌──────────────────┐  │                  │
   │   │   │ RS485    │──────►│ D-Tech USB-to-    │  │                  │
   │   │   │ Trunk    │       │ RS485 Converter   │  │                  │
   │   │   └──────────┘       └───────┬──────────┘  │                  │
   │   │                               │             │                  │
   │   │                               ▼             │                  │
   │   │                        USB Port (Linux)     │                  │
   │   └────────────────────────────────────────────┘                  │
   │                 │                                                  │
   │                 ▼                                                  │
   │   ┌────────────────────────┐                                       │
   │   │  RCT Pro 2000VA UPS    │◄──── Wall Power                       │
   │   └────────────────────────┘                                       │
   └──────────────────────────────────────────────────────────────────┘
```

### 4.3 Detailed Connection Mechanics

**Audio-to-Video Integration:**
1. The Dahua DH-PFM140 microphone is ceiling-suspended directly over the cage tiers
2. A short shielded audio cable runs from the mic to the **Audio In** terminal block on the Hikvision dome camera
3. The camera digitizes the analog audio and embeds it into the H.265+ RTSP video stream at the hardware level
4. This guarantees zero audio-video sync drift — the stream contains both in perfect alignment

**The PoE Data Highway:**
1. Each Hikvision camera is connected to the Netgear GS308PP via a single Cat6 STP cable
2. That single cable carries 48V DC power (from the PoE switch to the camera) AND the RTSP video/audio stream (back from the camera to the switch)
3. Maximum cable length per run: 100m
4. The trunk line from the field enclosure to the server room is also a single Cat6 STP cable

**The RS485 Sensor Bus:**
1. XY-MD02 sensors do NOT connect to the network switch
2. They are wired in a **daisy-chain** configuration: Sensor 01 → Sensor 02 → Sensor 03 → Sensor 04
3. A single 2-core shielded instrument cable carries the Modbus RTU telemetry back to the server room
4. In the server room, the RS485 trunk plugs into the D-Tech USB-to-RS485 converter (appears as `/dev/ttyUSB0` on Linux)
5. Each sensor must have a unique Modbus Slave ID (1-4 for cage cluster)

**Modbus Slave ID Mapping (Cage Coops):**

| Slave ID | Coop | Position |
|----------|------|----------|
| 1 | Coop 1 | Top Tier |
| 2 | Coop 1 | Bottom Tier |
| 3 | Coop 2 | Top Tier |
| 4 | Coop 2 | Bottom Tier |

**Critical:** Before mounting, connect each XY-MD02 sensor individually to a PC via the RS485 converter and use a Modbus utility (e.g., `mbpoll`, QModMaster) to set unique Slave IDs. Factory default is typically `1`.

### 4.4 Connector Specifications

| Connection | Cable | Connector | Notes |
|-----------|-------|-----------|-------|
| Camera → PoE Switch | Cat6 STP solid copper | Shielded RJ45 + weather boot | Crimp metal wrap to drain wire |
| Audio (Mic → Cam) | Shielded 2-conductor audio cable | Screw terminal block | Camera has Audio In terminal |
| Sensor → Sensor | 2-core twisted pair shielded | Screw terminals | A+, B- terminals on XY-MD02 |
| RS485 Trunk → Converter | 2-core twisted pair shielded | Screw terminals | A(+), B(-) to D-Tech converter |
| Converter → PC | USB A to USB mini | USB cable | /dev/ttyUSB0 on Linux |

### 4.5 RS485 Bus Wiring Rules

```
        ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
        │Sensor 01 │    │Sensor 02 │    │Sensor 03 │    │Sensor 04 │
        │ Slave 1  │    │ Slave 2  │    │ Slave 3  │    │ Slave 4  │
        └─┬───┬───┘    └─┬───┬───┘    └─┬───┬───┘    └─┬───┬───┘
          │   │          │   │          │   │          │   │
          A+  B-         A+  B-         A+  B-         A+  B-
          │   │          │   │          │   │          │   │
          └───┼──────────┴───┼──────────┴───┼──────────┴───┼──  ← Daisy chain
              │              │              │              │
              └──────────────┴──────────────┴──────────────┘
                              │
                      Shielded twisted pair trunk
                              │
                              ▼
                     ┌────────────────┐
                     │ D-Tech USB-to- │
                     │ RS485 FTDI     │
                     └───────┬────────┘
                             │ USB
                             ▼
                     ┌────────────────┐
                     │  Central PC    │
                     │  /dev/ttyUSB0  │
                     └────────────────┘

Rules:
- Use twisted pair cable (not parallel wire) — cancel out EMI from fan motors
- Keep total bus length under 1200m
- Install a 120Ω termination resistor at the LAST sensor on the bus
- Keep the shield drain wire connected at the converter end only (one-point grounding)
- DO NOT star-wire sensors — each sensor must daisy-chain through the previous one
```

---

## 5. Central Compute Node Setup

### 5.1 OS Installation

Install Ubuntu 22.04 LTS on the central compute PC:

```
- Download Ubuntu 22.04.4 LTS from ubuntu.com
- Write to USB with Rufus (Windows) or dd (Linux)
- Boot from USB, select "Erase disk and install Ubuntu"
- Recommended partitioning:
  - /boot/efi: 1GB
  - /: 50GB (ext4)
  - /var/lib/docker: Remaining space (for TimescaleDB data + media storage)
- Set hostname: boonducks-plf
- Install OpenSSH server during setup
```

### 5.2 Initial System Configuration

```bash
# System updates
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y \
    curl wget git htop iotop ncdu \
    build-essential dkms \
    net-tools ethtool \
    ffmpeg \
    postgresql-client \
    python3-pip python3-venv \
    nginx

# Docker installation
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker

# Docker Compose plugin
sudo apt install -y docker-compose-plugin

# Verify
docker --version && docker compose version
```

### 5.3 NVIDIA Driver & CUDA (for GPU acceleration)

```bash
# Install NVIDIA driver
sudo apt install -y nvidia-driver-535
sudo reboot

# After reboot, verify
nvidia-smi

# Install NVIDIA Container Toolkit (for GPU access in Docker)
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | \
    sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
    sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
    sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

sudo apt update
sudo apt install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```

### 5.4 Project Directory Structure

```bash
# Create the project directory tree
sudo mkdir -p /opt/poultry-intel/{database/init.db,data/{cage_coop_{1,2}/{video,audio},deep_litter_{1,2,3,4,5,6}/{video,audio}},scripts}

# Set ownership
sudo chown -R $USER:$USER /opt/poultry-intel
```

Expected structure:
```
/opt/poultry-intel/
├── docker-compose.yml
├── .env
├── database/
│   ├── init.db/
│   │   └── schema.sql
│   └── data/            (TimescaleDB persistence, auto-created by Docker)
├── data/
│   ├── cage_coop_1/
│   │   ├── video/       (5-min H.265 chunks from FFmpeg)
│   │   └── audio/       (16kHz mono WAV from FFmpeg)
│   ├── cage_coop_2/
│   │   ├── video/
│   │   └── audio/
│   └── deep_litter_1-6/ (same structure, added in Phase 3)
├── scripts/
│   ├── telemetry_worker.py
│   ├── acoustic_analyzer.py
│   ├── vision_analyzer.py
│   ├── stream_worker.sh
│   ├── audio_processor.py    (Phase 2 - Antigravity generated)
│   └── acoustic_classifier.py (Phase 2 - XGBoost pipeline)
├── server.js
├── package.json
└── client/               (Vite/React frontend)
```

### 5.5 Docker Compose — TimescaleDB + PGAdmin

Create `/opt/poultry-intel/docker-compose.yml`:

```yaml
version: '3.8'

services:
  timescaledb:
    image: timescale/timescaledb:latest-pg15
    container_name: poultry_timescaledb
    restart: always
    environment:
      POSTGRES_USER: vers_admin
      POSTGRES_PASSWORD: IntelFlock2026!
      POSTGRES_DB: poultry_intelligence
    volumes:
      - ./database/data:/var/lib/postgresql/data
      - ./database/init.db:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    # GPU resources for accelerated queries (optional)
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: poultry_pgadmin
    restart: always
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@blacklight.web
      PGADMIN_DEFAULT_PASSWORD: ServerLock2026!
    ports:
      - "5050:80"
    depends_on:
      - timescaledb

volumes:
  timescaledb_data:
```

**Change the passwords before deployment.**

### 5.6 Launch Database

```bash
cd /opt/poultry-intel
docker compose up -d

# Verify
docker ps
docker logs poultry_timescaledb
```

---

## 6. Database Schema (TimescaleDB)

Place this at `/opt/poultry-intel/database/init.db/schema.sql`. It auto-executes on first container boot.

```sql
-- ============================================================================
-- Boonducks Farm PLF Engine — TimescaleDB Schema
-- V.E.R.S. Protocol Compatible
-- ============================================================================

-- 1. CORE TELEMETRY: Temperature & Humidity from XY-MD02 sensors
CREATE TABLE cage_telemetry (
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    coop_id INT NOT NULL,
    sensor_id INT NOT NULL,
    temperature NUMERIC(4,1),
    humidity NUMERIC(4,1)
);

-- Convert to hypertable for time-series slicing
SELECT create_hypertable('cage_telemetry', 'timestamp');

-- Index for fast coop/sensor lookups
CREATE INDEX idx_cage_telemetry_lookup
    ON cage_telemetry (coop_id, sensor_id, timestamp DESC);

-- 2. DEEP LITTER TELEMETRY: Temp/Hum + NH3
CREATE TABLE deep_litter_telemetry (
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    coop_id INT NOT NULL,
    sensor_id INT NOT NULL,
    temperature NUMERIC(4,1),
    humidity NUMERIC(4,1),
    nh3_level NUMERIC(5,1)   -- Ammonia in ppm
);

SELECT create_hypertable('deep_litter_telemetry', 'timestamp');

CREATE INDEX idx_dl_telemetry_lookup
    ON deep_litter_telemetry (coop_id, sensor_id, timestamp DESC);

-- 3. MEDIA CATALOG: Raw video/audio file tracking
CREATE TABLE media_catalog (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    coop_id INT NOT NULL,
    camera_id INT NOT NULL,
    video_path TEXT NOT NULL,
    audio_path TEXT NOT NULL,
    file_size_bytes BIGINT DEFAULT 0,
    processed BOOLEAN DEFAULT FALSE,
    inference_score INT DEFAULT NULL
);

SELECT create_hypertable('media_catalog', 'timestamp');

CREATE INDEX idx_media_lookup
    ON media_catalog (coop_id, camera_id, timestamp DESC);

-- 4. VISION INFERENCE: Huddling index per cycle
CREATE TABLE vision_inference (
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    coop_id INT NOT NULL,
    huddling_index NUMERIC(4,2),
    bird_count INT,
    active_birds INT,
    classification TEXT   -- CLUSTERED / PARTIAL / DISPERSED
);

SELECT create_hypertable('vision_inference', 'timestamp');

CREATE INDEX idx_vision_lookup
    ON vision_inference (coop_id, timestamp DESC);

-- 5. ACOUSTIC INFERENCE: Stress scores per cycle
CREATE TABLE acoustic_inference (
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    coop_id INT NOT NULL,
    stress_score NUMERIC(4,2),
    peak_frequency NUMERIC(7,1),
    classification TEXT    -- NORMAL / STRESS / PANIC
);

SELECT create_hypertable('acoustic_inference', 'timestamp');

CREATE INDEX idx_acoustic_lookup
    ON acoustic_inference (coop_id, timestamp DESC);

-- 6. PRODUCTION YIELD: Daily egg counts
CREATE TABLE production_yield (
    date DATE NOT NULL,
    coop_id INT NOT NULL,
    eggs_collected INT NOT NULL,
    trays_30_count NUMERIC(5,1),
    feed_consumed_kg NUMERIC(6,1),
    water_consumed_l NUMERIC(6,1),
    mortality INT DEFAULT 0,
    notes TEXT,
    PRIMARY KEY (date, coop_id)
);

-- 7. CONTINUOUS AGGREGATES (automatic rollups)
-- Hourly average telemetry
CREATE MATERIALIZED VIEW hourly_telemetry
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', timestamp) AS bucket,
    coop_id,
    AVG(temperature) AS avg_temp,
    MAX(temperature) AS max_temp,
    MIN(temperature) AS min_temp,
    AVG(humidity) AS avg_humidity,
    AVG(nh3_level) AS avg_nh3
FROM deep_litter_telemetry
GROUP BY bucket, coop_id;

SELECT add_continuous_aggregate_policy('hourly_telemetry',
    start_offset => INTERVAL '3 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');

-- Daily vision summary
CREATE MATERIALIZED VIEW daily_vision_summary
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', timestamp) AS bucket,
    coop_id,
    AVG(huddling_index) AS avg_huddling,
    MAX(huddling_index) AS peak_huddling,
    AVG(bird_count)::INT AS avg_birds,
    AVG(active_birds)::INT AS avg_active
FROM vision_inference
GROUP BY bucket, coop_id;

SELECT add_continuous_aggregate_policy('daily_vision_summary',
    start_offset => INTERVAL '7 days',
    end_offset => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day');
```

### Initialize the Database

```bash
# The schema.sql file auto-executes on first docker-compose up.
# To manually verify:
docker exec -it poultry_timescaledb psql -U vers_admin -d poultry_intelligence -c "\dt"
```

---

## 7. Backend API Server

The Node.js/Express server (`server.js`) provides the REST API and dashboard data. It supports dual mode:
- `MODE=sim` (default) — No database required, generates realistic synthetic data
- `MODE=live` — Connects to TimescaleDB for real sensor data

### 7.1 Setup

```bash
cd /opt/poultry-intel

# Install Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs

# Install API dependencies
npm install
```

### 7.2 Environment Configuration

Create `/opt/poultry-intel/.env`:

```bash
# Operation mode: "sim" or "live"
MODE=sim

# Server
PORT=5000

# Database (only needed for MODE=live)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=poultry_intelligence
DB_USER=vers_admin
DB_PASSWORD=IntelFlock2026!

# CORS
FRONTEND_URL=http://localhost:5173
```

### 7.3 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/coops` | List all 8 coops with current live stats |
| GET | `/api/coops/:id` | Single coop detail |
| GET | `/api/telemetry?hours=24&coop_id=1` | Historical telemetry data |
| GET | `/api/vision` | Latest vision inference data |
| GET | `/api/acoustic` | Latest acoustic inference data |
| GET | `/api/production` | Production yield records |
| GET | `/api/health` | System health check |
| GET | `/api/history/:coopId` | 24h history for single coop |

### 7.4 Test the API

```bash
cd /opt/poultry-intel

# Start in simulation mode (no DB needed)
MODE=sim node server.js &

# Test
curl http://localhost:5000/api/health
curl http://localhost:5000/api/coops | python3 -m json.tool
curl http://localhost:5000/api/telemetry?hours=2 | python3 -m json.tool
```

---

## 8. Edge Data Ingestion Services

### 8.1 Telemetry Worker (`telemetry_worker.py`)

This Python daemon polls the XY-MD02 sensors via the RS485 serial bus and writes to TimescaleDB.

**Prerequisites:**
```bash
pip3 install minimalmodbus psycopg2-binary
```

**Configuration** (edit directly in the script or via environment variables):
- `SERIAL_PORT` = `/dev/ttyUSB0`
- `BAUDRATE` = 9600
- `POLL_INTERVAL` = 10 (seconds)
- Sensor mapping per the Modbus Slave ID table above

**Operation:**
```bash
# Manual test
python3 /opt/poultry-intel/scripts/telemetry_worker.py

# Expected output:
# Starting Boonducks Farm PLF Telemetry Ingestion Daemon...
# Coop 1 -> Temp: 25.4°C, Hum: 55.3%, NH3: None ppm
# Coop 2 -> Temp: 24.8°C, Hum: 57.1%, NH3: None ppm
```

### 8.2 Stream Worker (`stream_worker.sh`)

Records 5-minute H.265 video + 16kHz mono audio chunks from each camera RTSP stream. Uses FFmpeg hardware encoding for near-zero CPU cost.

**Configuration** (edit directly in the script):
```bash
# Camera RTSP URLs (set static IPs on each camera's admin panel)
declare -A CAMERAS
CAMERAS=(
  ["c1_l"]="rtsp://admin:Password123@192.168.1.101:554/Streaming/Channels/101"
  ["c1_r"]="rtsp://admin:Password123@192.168.1.102:554/Streaming/Channels/101"
  ["c2_l"]="rtsp://admin:Password123@192.168.1.103:554/Streaming/Channels/101"
  ["c2_r"]="rtsp://admin:Password123@192.168.1.104:554/Streaming/Channels/101"
)
```

**FFmpeg recording command:**
```bash
ffmpeg -y -rtsp_transport tcp -i "$URL" \
  -t 300 \
  -c:v copy -an "$VIDEO_PATH" \
  -vn -c:a pcm_s16le -ar 16000 -ac 1 "$AUDIO_PATH"
```

This:
- Copies the H.265 video stream directly (0% CPU cost — no re-encode)
- Extracts PCM audio at 16kHz mono (standard for ML acoustic models)
- Records in 5-minute chunks to prevent data loss during power failure
- Uses TCP transport for reliable RTSP streaming

### 8.3 Acoustic Analyzer (`acoustic_analyzer.py`)

Processes audio chunks through the XGBoost stress classifier.

**Pipeline:**
1. Loads 5-minute WAV file
2. Extracts 13 Mel-Frequency Cepstral Coefficients (MFCCs) via librosa
3. Feeds MFCC feature vector into pre-trained XGBoost model
4. Outputs `stress_score` (0.0–1.0) + classification: NORMAL / STRESS / PANIC
5. Writes result to `acoustic_inference` hypertable

**Hardware mode:** Listens to I2S MEMS microphone or USB microphone directly
**Simulation mode:** Generates synthetic acoustic profiles per coop

```bash
# Test
python3 /opt/poultry-intel/scripts/acoustic_analyzer.py --duration 60
```

### 8.4 Vision Analyzer (`vision_analyzer.py`)

Calculates spatial huddling index from camera frames.

**Pipeline:**
1. Captures frame from RTSP camera (or generates synthetic bird coordinates)
2. Calculates Huddling Index via Clark-Evans nearest-neighbor statistic
3. Classifies: DISPERSED (<0.35), PARTIAL (0.35–0.6), CLUSTERED (>0.6)
4. Writes to `vision_inference` hypertable

**Hardware mode:** Uses OpenCV to capture frames, YOLOv8-nano for bird detection
**Simulation mode:** Generates synthetic 2D bird coordinate maps

```bash
# Test in simulation mode
python3 /opt/poultry-intel/scripts/vision_analyzer.py --duration 60
```

### 8.5 XGBoost Acoustic Classifier (Phase 2)

Generated by Google Antigravity workspace. The classifier:
- Uses`librosa` for MFCC extraction (13 coefficients per frame)
- Runs XGBoost inference on edge hardware
- Classifies into 3 states: Harmonic Baseline / Thermal Distress / Panic Spike
- Outputs `stress_score` and timestamp to TimescaleDB

---

## 9. Frontend Dashboard

### 9.1 Setup

```bash
cd /opt/poultry-intel/client

# Install dependencies
npm install
```

### 9.2 Build for Production

```bash
npm run build
```

This produces a static site in `client/dist/`.

### 9.3 Development Mode

```bash
npm run dev
# Starts on http://localhost:5173
```

### 9.4 Production Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name boonducks-plf.local;

    location / {
        root /opt/poultry-intel/client/dist;
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 9.5 Dashboard Features

The React dashboard (Vite + Recharts + Framer Motion + Tailwind v4) displays:

1. **Live Coop Overview** — All 8 coops with real-time temperature, humidity, stress score, huddling index
2. **Telemetry Charts** — 24-hour history for temperature, humidity, NH3 per coop
3. **Acoustic Stress Timeline** — Stress score over time with anomaly markers
4. **Vision Huddling Heatmap** — Spatial distribution visualization per deep litter coop
5. **Production Yield** — Daily egg count chart, feed/water consumption
6. **System Health** — Database status, stream worker uptime, disk usage

---

## 10. Systemd Service Automation

Configure these services to ensure the ingestion pipeline starts automatically on server boot and survives restarts.

### 10.1 Telemetry Daemon

Create `/etc/systemd/system/poultry-telemetry.service`:

```ini
[Unit]
Description=Boonducks PLF - Telemetry Scraper
After=docker.service
Requires=docker.service

[Service]
Type=simple
User=root
Environment=MODE=live
ExecStart=/usr/bin/python3 /opt/poultry-intel/scripts/telemetry_worker.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### 10.2 Media Stream Daemon

Create `/etc/systemd/system/poultry-streams.service`:

```ini
[Unit]
Description=Boonducks PLF - Video/Audio Stream Processor
After=docker.service
Requires=docker.service

[Service]
Type=simple
User=root
ExecStart=/bin/bash /opt/poultry-intel/scripts/stream_worker.sh
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### 10.3 API Server

Create `/etc/systemd/system/poultry-api.service`:

```ini
[Unit]
Description=Boonducks PLF - API Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/poultry-intel
Environment=MODE=sim
ExecStart=/usr/bin/node /opt/poultry-intel/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### 10.4 Enable All Services

```bash
# Make scripts executable
sudo chmod +x /opt/poultry-intel/scripts/*.py
sudo chmod +x /opt/poultry-intel/scripts/*.sh

# Start infrastructure
cd /opt/poultry-intel && sudo docker compose up -d

# Reload and enable services
sudo systemctl daemon-reload
sudo systemctl enable poultry-telemetry.service
sudo systemctl enable poultry-streams.service
sudo systemctl enable poultry-api.service

# Start services
sudo systemctl start poultry-telemetry.service
sudo systemctl start poultry-streams.service
sudo systemctl start poultry-api.service

# Verify
systemctl status poultry-telemetry.service
systemctl status poultry-streams.service
systemctl status poultry-api.service
```

---

## 11. Physical Installation Sequence

### Phase 1: Cage Coops Foundation (Weeks 1-2)

**Day 1: Prep**
1. Configure each XY-MD02 sensor's Modbus Slave ID individually via USB-RS485 converter
2. Cut Cat6 STP cables to measured lengths (leave 2m service loops at each end)
3. Crimp shielded RJ45 connectors — ensure drain wire contacts the metal shroud
4. Label both ends of every cable with the destination (e.g., "Cam 01 → Port 1")

**Day 2: Camera & Mic Mounting**
1. Mount Hikvision dome cameras at each aisle position (2 per cage coop)
   - Height: 2.5-3m above floor, angled down the aisle
   - Cable entry: via waterproof gland on the camera base
2. Suspend Dahua microphones from ceiling directly over cage tiers
3. Connect microphone audio cable to camera Audio-In screw terminals
4. Run Cat6 STP from camera to the field enclosure location

**Day 3: Sensor Mounting**
1. Mount XY-MD02 sensors at two heights per cage coop:
   - Top tier: Attach to cage frame at the highest cage row
   - Bottom tier: Attach at the lowest cage row (catches floor-level microclimate)
2. Daisy-chain RS485 wiring: sensor A(+)/B(-) terminals to next sensor's A(+)/B(-)
3. Connect RS485 trunk line back to the field enclosure location

**Day 4: Field Enclosure**
1. Mount IP65 polycarbonate box on the exterior wall between the two cage coops
2. Install Netgear GS308PP PoE switch inside the enclosure
3. Route all 4 camera Cat6 cables into the box, connect to switch ports 1-4
4. Route the RS485 trunk line through a separate cable gland
5. Route the Cat6 STP trunk line (from switch port 5) toward the server room
6. Seal all unused cable glands
7. Close and lock enclosure

**Day 5: Server Room**
1. Position central PC and RCT Pro UPS
2. Connect the trunk Cat6 cable from the field enclosure to the PC's LAN port
3. Connect the RS485 trunk cable to the D-Tech USB-RS485 converter
4. Plug D-Tech converter into PC USB port
5. Plug all equipment into the UPS (PC, monitor, switch trunk injector if used)

**Day 6: Power & Network**
1. Configure static IPs via Hikvision camera web interface:
   - Cam 01: 192.168.1.101
   - Cam 02: 192.168.1.102
   - Cam 03: 192.168.1.103
   - Cam 04: 192.168.1.104
2. Set same admin password across all cameras
3. Verify each RTSP stream:
   ```bash
   ffprobe rtsp://admin:Password123@192.168.1.101:554/Streaming/Channels/101
   ```
4. Verify RS485 bus detection:
   ```bash
   ls -la /dev/ttyUSB0
   mbpoll -a 1 -b 9600 -m rtu -P none -t 3 -r 1 -c 2 /dev/ttyUSB0
   ```

**Day 7: Software Go-Live**
1. Deploy docker-compose (TimescaleDB + PGAdmin)
2. Initialize schema
3. Start telemetry worker — verify data flowing into cage_telemetry table
4. Start stream worker — verify 5-minute chunks appearing in data directories
5. Run 72-hour soak test

### Phase 2: Deep Litter Deployment (Weeks 5-7)

1. Ceiling-mount wide-angle cameras dead-center over each deep litter coop
2. Deploy XY-MD02 sensors + NH3 probes on RS485 bus
   - Slave IDs 13-18 for NH3 probes
   - Slave IDs 3-8 for XY-MD02 sensors
3. Add dust-filtered housings to all sensors in litter coops
4. Install Jetson Orin Nano Super in field enclosure
5. Deploy YOLOv8-nano model for spatial tracking
6. Cross-compile Python daemons to ARM64 Docker containers

### Phase 3: Edge AI & Yield Correlation (Weeks 8-10)

1. Quantize XGBoost model to INT8 for Jetson
2. Deploy TensorRT-optimized YOLOv8-nano
3. Enable anomaly-only upload mode (no raw video streaming)
4. Start daily egg count entry → TimescaleDB
5. Train correlation model linking environmental stress to yield drops

---

## 12. Budget Breakdown (ZAR)

### Capital Expenditure (CapEx)

**Cage Coops Cluster:**
| Item | Cost |
|------|------|
| 4x Hikvision DS-2CD2143G2-IS Cameras | R6,396 |
| 4x Dahua DH-PFM140 Microphones | R1,800 |
| 4x XY-MD02 Temp/Hum Sensors | R1,200 |
| 1x Netgear GS308PP PoE Switch | R3,700 |
| 1x D-Tech USB-RS485 FTDI Converter | R350 |
| 1x RCT Pro 2000VA UPS | R1,750 |
| 1x 305m Cat6 STP Drum | R4,250 |
| 1x 20pk Shielded RJ45 + Boots | R350 |
| 1x 100m 2-Core Shielded Instrument Cable | R600 |
| 1x IP65 Polycarbonate Enclosure | R850 |
| 1x Sundries (conduit, tape, ties) | R500 |
| **Cage Subtotal** | **R21,746** |

**Deep Litter Coops (planned):**
| Item | Cost |
|------|------|
| 6x Ceiling Wide-Angle Cameras | R9,000 |
| 6x XY-MD02 Sensors (dust-filtered) | R2,100 |
| 6x Electrochemical NH3 Probes | R9,000 |
| 1x NVIDIA Jetson Orin Nano Super | R12,000 |
| 1x RS485-to-USB Hub | R800 |
| 1x Lot Cabling & Enclosures | R5,200 |
| **Deep Litter Subtotal** | **R38,100** |

**Total CapEx: R44,300** (cage cluster + shared infrastructure)

### Operational Expenditure (OpEx)

| Item | Frequency | Cost | Annual |
|------|-----------|------|--------|
| Edge hardware electricity (~15W) | Monthly | R80 | R960 |
| Sensor cleaning & calibration | Bi-monthly | R150 | R900 |
| Backup storage & maintenance | Annual | R2,500 | R2,500 |
| **Total Annual OpEx** | | | **R4,360** |

### Return on Investment

**Revenue Baseline:**
- Flock: 1,242 laying hens
- Target lay rate: 87% = ~1,080 eggs/day
- Daily throughput: 36 trays of 30 eggs
- Farm gate price: ~R95/tray
- Daily revenue: R3,420
- Monthly revenue: R102,600
- Annual revenue: R1,231,200

**Risk Mitigation:**
1. **10% yield drag prevention** — catches thermal stress before it drops lay rate
   - Savings: R10,260/month
2. **Catastrophic crash intervention** — early detection of disease/toxicity events
   - Potential loss avoided: R50,000-R70,000 per 3-week incident

**ROI Timeline:**
- CapEx break-even: **8.6 months** (standard operation)
- Or: **Single catastrophic event prevention** recovers full investment in 14 days

---

## 13. Verification & Testing

### 13.1 Simulation Mode (No Hardware Required)

The entire system can run without any physical hardware. This is the default mode.

```bash
cd /opt/poultry-intel

# 1. Start API server in sim mode
MODE=sim node server.js &

# 2. Verify API is serving data
curl http://localhost:5000/api/health
# Expected: {"status":"ok","mode":"sim","coops":8,"uptime":"..."}

curl http://localhost:5000/api/coops
# Expected: Array of 8 coop objects with live simulated data

# 3. Start vision analyzer in sim mode
python3 scripts/vision_analyzer.py --duration 60
# Expected: 6 inference cycles across 8 coops with synthetic bird coordinates

# 4. Start acoustic analyzer in sim mode
python3 scripts/acoustic_analyzer.py --duration 60
# Expected: Audio stress analysis cycles for each coop

# 5. Start frontend
cd client && npm run dev
# Open http://localhost:5173 in browser
```

### 13.2 Database Connectivity Test

```bash
# Test TimescaleDB is running
docker exec -it poultry_timescaledb psql -U vers_admin -d poultry_intelligence -c "SELECT * FROM cage_telemetry LIMIT 5;"

# Verify hypertables
docker exec -it poultry_timescaledb psql -U vers_admin -d poultry_intelligence -c "\dt"

# Test PGAdmin
# Open http://localhost:5050 in browser
# Login: admin@blacklight.web / ServerLock2026!
# Add server: host=poultry_timescaledb, port=5432, user=vers_admin
```

### 13.3 Network Verification

```bash
# Test camera RTSP streams
ffprobe rtsp://admin:Password123@192.168.1.101:554/Streaming/Channels/101

# Test Modbus sensor bus
mbpoll -a 1 -b 9600 -m rtu -P none -t 3:hex -r 1 -c 2 /dev/ttyUSB0

# Test RS485 addresses
for addr in 1 2 3 4; do
    echo "Testing Slave ID $addr..."
    mbpoll -a $addr -b 9600 -m rtu -P none -t 3 -r 1 -c 2 /dev/ttyUSB0
done
```

### 13.4 End-to-End Data Flow Test (Live Mode)

```bash
# 1. Verify telemetry flowing into DB
watch -n 5 'docker exec -it poultry_timescaledb psql -U vers_admin -d poultry_intelligence -c "SELECT COUNT(*), MAX(timestamp) FROM cage_telemetry;"'

# 2. Verify media chunks being created
watch -n 30 'ls -la /opt/poultry-intel/data/cage_coop_1/video/ | tail -5'

# 3. Verify API serving live data
curl http://localhost:5000/api/coops/1
```

### 13.5 72-Hour Soak Test Checklist

| Check | Pass Criteria | Status |
|-------|---------------|--------|
| All 4 camera streams recording | 5-min chunks present in all 4 directories | ☐ |
| RS485 bus stable | No dropped sensor readings in 72h | ☐ |
| TimescaleDB ingestion continuous | Telemetry rows incrementing every 10s | ☐ |
| No memory leaks | Process RSS stable (±5% over 72h) | ☐ |
| UPS handles load-shed simulation | System stays running through power cut test | ☐ |
| Systemd auto-restart verified | `sudo killall python3` → service respawns | ☐ |
| Dashboard rendering | coop overview, charts, health all loading | ☐ |

---

## 14. Maintenance & Operations

### Daily Operations
- Check dashboard for anomaly alerts
- Enter daily egg count per coop (manual form on dashboard)
- Verify all 8 coops reporting via API

### Weekly
- Clean camera lenses and microphone windscreens (compressed air)
- Verify RS485 bus integrity
- Check disk usage on central server
- Review anomaly logs from the past 7 days

### Monthly
- Clean sensor probe housings
- Calibrate NH3 sensors per manufacturer spec
- Rotate backup storage drives
- Review production yield correlation report

### Quarterly
- Update XGBoost model with new training data
- Retrain acoustic classifier with accumulated labeled data
- Verify all firmware on cameras and sensors
- Test UPS battery health (load bank test)

### Annual
- Full system audit and performance review
- Replace sensor batteries (if applicable)
- Deep clean all field enclosure components
- Update deployment documentation
- Review ROI against actual production data

---

## Appendix A: Startup Sequence (Quick Reference)

```bash
# 1. Power on UPS → server boots automatically
# 2. Startup order:
#    a. Docker daemon starts
#    b. Systemd services start (poultry-telemetry, poultry-streams, poultry-api)
#    c. TimescaleDB container initialized with schema
#    d. Telemetry worker connects to RS485 bus
#    e. Stream worker starts FFmpeg on all 4 RTSP streams
#    f. API server starts, serving data from DB

# To restart everything cleanly:
sudo systemctl stop poultry-telemetry poultry-streams poultry-api
cd /opt/poultry-intel && docker compose restart
sudo systemctl restart poultry-telemetry poultry-streams poultry-api
```

## Appendix B: RS485 Bus Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| No sensors found on bus | Wrong serial port | `ls /dev/ttyUSB*` — may be ttyUSB1 |
| Some sensors not responding | Duplicate Slave IDs | Connect each sensor individually and set unique address |
| Sporadic readings | Missing termination resistor | Install 120Ω resistor across A+/B- of last sensor |
| Electrical noise | Shield not grounded | Connect drain wire at converter end only |
| "MinimalModbusException: No response" | Cable too long or wrong baud rate | Verify 9600 baud, keep under 1200m |

## Appendix C: Camera RTSP Stream Testing

```bash
# List available streams from a Hikvision camera
curl http://192.168.1.101/ISAPI/Streaming/channels

# Test stream with ffplay (visual)
ffplay rtsp://admin:Password123@192.168.1.101:554/Streaming/Channels/101

# Record a test 30-second clip
ffmpeg -rtsp_transport tcp -i "rtsp://admin:Password123@192.168.1.101:554/Streaming/Channels/101" \
  -t 30 -c copy test_capture.mp4

# Note: Default admin credentials must be changed on first login.
```

---

> **End of Setup Guide**
>
> Built for Boonducks Farm, Bojanala District, North West, South Africa
> Flock: 1,242 laying hens | 2 Cage Coops + 6 Deep Litter Coops
> CapEx: R44,300 | OpEx: R4,360/yr | ROI: 8.6 months
> System: V.E.R.S. Protocol — Precision Livestock Farming Engine
> Inspiration: "The Interspecies Singularity: AI is Talking Back" — Technomics (2026)
