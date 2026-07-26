# Agentic Poultry Monitoring — Boonducks Farm PLF Engine

[![License: MIT](https://img.shields.io/badge/License-MIT-teal.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.10+-blue)](https://python.org)
[![Node](https://img.shields.io/badge/Node-20+-green)](https://nodejs.org)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](https://docker.com)

**A three-layer Precision Livestock Farming (PLF) engine deployed at Boonducks Farm, South Africa.** Monitors 1,242 laying hens across 8 coops using edge AI computer vision, acoustic stress detection, and environmental IoT telemetry.

| Coop Type | Count | Capacity |
|-----------|-------|----------|
| 🏭 Cage Coops | 2 (C1, C2) | 312 + 310 hens |
| 🌿 Deep Litter Coops | 6 (L3–L8) | 104 hens each |
| **Total** | **8 coops** | **1,242 hens** |

---

## Architecture

### Layer 1 — Edge (In-Coop Inference)
- **NVIDIA Jetson Orin Nano Super** (67 TOPS, TensorRT-optimized)
- **YOLOv8-nano** bird detection + Huddling Index from overhead cameras
- **XGBoost** acoustic stress classification from USB/I2S microphones
- Only anomaly JSON forwarded to fog layer — preserves bandwidth

### Layer 2 — Fog (Farm Office Server)
- **TimescaleDB** hypertables for environmental telemetry
- **Express.js** API serving continuous aggregates to dashboard
- **Modbus RTU RS485** daisy-chain for XY-MD02 temp/humidity and NH3 probes
- **Hikvision 4MP PoE** cameras for vision feed

### Layer 3 — Cloud (Future)
- Federated learning across farms
- Remote dashboard access
- Automated model retraining from cross-farm outbreak patterns

---

## Repository Structure

```
├── vision_analyzer.py      # YOLOv8-nano bird detection + Huddling Index
├── acoustic_analyzer.py    # XGBoost stress classification (MFCC features)
├── telemetry_worker.py     # Modbus RTU sensor polling + TimescaleDB ingestion
├── server.js               # Express.js API server (sim/live modes)
├── schema.sql              # TimescaleDB hypertable definitions
├── client/                 # Dashboard frontend (React + Vite)
├── scripts/                # Deployment and utility scripts
├── Dockerfile              # Containerized deployment
├── docker-compose.yml      # Multi-service orchestration
├── SETUP_GUIDE.md          # Complete hardware + software installation guide
└── proposal/               # Business proposal and pitch materials
```

---

## Getting Started

```bash
git clone https://github.com/sellomakgatho121/Agentic-Poultry-Monitoring.git
cd Agentic-Poultry-Monitoring

# Copy environment config
cp .env.example .env

# Start with Docker (recommended)
docker compose up -d

# Or run workers individually
python3 telemetry_worker.py   # starts sensor polling
python3 vision_analyzer.py    # starts camera inference
python3 acoustic_analyzer.py  # starts audio analysis
node server.js                # starts API server
```

> See [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed hardware BOM, wiring diagrams, and calibration steps.

---

## Sensors & Hardware

| Component | Model | Interface |
|-----------|-------|-----------|
| Edge compute | NVIDIA Jetson Orin Nano Super | — |
| Cameras | Hikvision 4MP PoE | RTSP |
| Microphones | Dahua USB/I2S | USB / I2S |
| Temp/Humidity | XY-MD02 | Modbus RTU RS485 |
| NH3 sensor | Electrochemical probe | Modbus RTU RS485 |
| Network switch | Netgear PoE | Ethernet |
| Power | UPS-backed 220V | AC |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/coops` | List all coops with current status |
| `GET` | `/api/coops/:id/metrics` | Latest metrics for a coop |
| `GET` | `/api/coops/:id/history?range=24h` | Time-series data |
| `GET` | `/api/alerts` | Active alerts across all coops |
| `GET` | `/api/summary` | Farm-wide aggregate metrics |
| `GET` | `/api/health` | System health check |
| `POST` | `/api/sim/start` | Start simulation mode (dev/testing) |
| `POST` | `/api/sim/stop` | Stop simulation mode |

---

## License

MIT — see [LICENSE](LICENSE).

## Author

**Sello Makgatho** — Systems Architect & ML Engineer  
[GitHub](https://github.com/sellomakgatho121)

## Acknowledgements

- Boonducks Farm, Bojanala District, North West, South Africa
- Inspired by "The Interspecies Singularity: AI is Talking Back" — Technomics (May 2026)
