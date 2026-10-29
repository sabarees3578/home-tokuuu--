# Home Security System

A full-stack IoT Home Security System with:
- **Backend**: Node.js + Express + Prisma + MQTT (Aedes)
- **Frontend**: React + Vite + Tailwind CSS
- **Database**: PostgreSQL (production) / SQLite (dev.db bundled)
- **OTA**: Firmware updates for ESP32 devices

## 🐳 Run with Docker (Easiest)

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/sabarees3578/home-tokuuu--.git
cd home-tokuuu--

# 2. Start everything (builds automatically)
docker-compose up --build

# 3. Open in browser
http://localhost:5000
```

That's it! The app runs with the **bundled SQLite database** (all data included).

## 🔌 Ports

| Port | Service |
|------|---------|
| `5000` | Web App + REST API |
| `1883` | MQTT TCP (ESP32 devices) |
| `9001` | MQTT WebSocket (browser) |

## ⚙️ Environment Variables

Edit `docker-compose.yml` to change:

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Auth token secret |
| `DATABASE_URL` | Switch to PostgreSQL if needed |
| `MQTT_HOST` | Public IP for ESP32 to connect |
| `OTA_PUBLIC_BASE` | Base URL for OTA firmware downloads |

## 📁 Project Structure

```
home/
├── Dockerfile            # Multi-stage Docker build
├── docker-compose.yml    # One-command startup
├── backend/
│   ├── server.js         # Express + MQTT server
│   ├── routes/           # API routes
│   ├── middleware/        # Auth middleware
│   ├── mqtt/             # MQTT broker & client
│   ├── prisma/
│   │   ├── schema.prisma # DB schema
│   │   └── dev.db        # SQLite database (all data)
│   └── uploads/ota/      # OTA firmware files
└── frontend/
    └── src/              # React source code
```

## 🛠️ Local Development (Without Docker)

```bash
# Backend
cd backend
npm install
node server.js

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```
