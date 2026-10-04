# 🌾 BrickFarm System  
**Smart Farming. Simplified. Powered by BrickServers NG Limited.**  
Website: [https://app.brickfarm.ng](https://app.brickfarm.ng)  
Corporate page: [https://brickservers.ng](https://brickservers.ng)

---

## 🧭 Overview

**BrickFarm** is a complete **Farm Management, Monitoring, and Investment Platform** built by **BrickServers NG Limited** to empower everyone — from smallholder farmers to large agribusinesses and government agencies — with data-driven, AI-assisted, and transparent farming tools.

It combines:
- 🌍 **A web platform** for managing farms, crops, tasks, finances, and sensors.  
- 📱 **An upcoming Android app** (for field workers and offline monitoring).  
- ☁️ **A backend engine** powered by **FastAPI**, **PostGIS**, and **AI analytics**.  

BrickFarm helps users **plan, track, and predict farm performance** — from planting to harvest — while keeping operations transparent for investors and compliant with global environmental standards.

---

## 🌟 Key Features

### 🧩 Farm Management
- Map multiple farm locations with real GPS boundaries using OpenLayers maps.  
- Register plots, attach crop types, and record detailed field activities.  
- Upload field reports and observations with photos and coordinates.

### 📊 Data & Insights
- Track sensor data (moisture, temperature, humidity, rainfall, etc.).  
- Real-time analytics and growth predictions using AI models.  
- Generate yield forecasts, carbon footprint reports, and compliance insights.

### 💰 Finance & Investment
- Record all expenses, incomes, and donations.  
- Transparent investment tracking with ROI dashboards.  
- Payout and financial reports for investors and stakeholders.

### 🧑‍🌾 Role-Based Access
- **Farm Owner / Admin** – Full control.  
- **Agronomist / Field Worker** – Record field data and monitor tasks.  
- **Investor / Accountant / Auditor / Government Viewer** – Read-only access to their permitted data.  

### 🛰️ Sensor Integration (IoT)
- Supports **MQTT**, **CoAP**, and **HTTP** protocols.  
- Connects weather stations, soil sensors, and smart devices.  
- Built for scalability and research-grade data precision.

### 🌐 Map & GIS Tools
- Uses **OpenLayers** for high-performance mapping.  
- Vector-tile caching for fast farm visualization.  
- Role-based map filters (tasks, sensors, plots, finance).  

### 💼 SaaS-Ready
- Offered at [**brickfarm.ng**](https://brickfarm.ng) as a subscription service.  
- Multi-tenant architecture supporting individuals, enterprises, and governments.  
- Secure, scalable, and continuously updated.

---

## 📱 Mobile App (Coming Soon)

- **BrickFarm Android App**  
  Simplified field reporting and data collection for farm workers.  
  Offline-first with **WatermelonDB** for background sync.  

  �� Download link (when released):  
  [**brickfarm.ng/android**](https://brickfarm.ng/android)

- **Progressive Web App (PWA)**  
  Use BrickFarm on any Android device directly from the browser:  
  [**android.brickfarm.ng**](https://android.brickfarm.ng)

---

## 🧰 Technology Stack

| Layer | Tools / Frameworks |
|-------|---------------------|
| **Frontend (Web)** | React + TypeScript + Vite + OpenLayers |
| **Mobile** | React Native (Expo) + WatermelonDB (offline sync) |
| **Backend** | FastAPI (Python), SQLAlchemy (async), Alembic |
| **Database** | PostgreSQL + PostGIS |
| **Caching & Queues** | Redis + Celery |
| **Auth** | JWT + Role-Based Access Control (RBAC) |
| **Deployment** | Ubuntu / Debian + Nginx + Docker (optional) |
| **CI/CD** | GitHub Actions (auto deploys to production) |

---

## ⚙️ Setup & Deployment Guide

### 🪜 Prerequisites
- Ubuntu or Debian system (recommended)
- Python 3.11+
- Node.js 18+
- PostgreSQL with PostGIS enabled
- Redis server (for Celery tasks)

### 🧩 Backend Setup
```bash
# Clone repository
git clone https://github.com/brickservers/brick-farms-system.git
cd brickfarm/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/brickfarm_db
export REDIS_URL=redis://localhost:6379/0
export SECRET_KEY=your-secret-key

# Run migrations
alembic upgrade head

# Start backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

