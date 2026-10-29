# Home Security System — Project Info

Location: `/home/ubuntu/home`
- `backend/`  — Node.js (Express 5) API + MQTT broker + Prisma ORM
- `frontend/` — React (Vite) admin/customer dashboard, SPA served by backend

---

## 1. How it all connects

```
HS01 Device (IoT) ──MQTT TCP :1883──▶ backend MQTT Broker (aedes)
Browser (Admin/Customer) ──HTTP :5000──▶ backend Express API
Browser                     ──MQTT WS /mqtt (ws://localhost:5000/mqtt)──▶ live events
backend ──Prisma──▶ PostgreSQL (security_db @ 16.112.243.96:5432)
frontend (dev) ──Vite proxy /api → localhost:5000 (vite.config.js)
frontend (prod) ──built to dist/, statically served by backend at /
```

## 2. Infrastructure

| Component | Detail |
|---|---|
| Server | EC2 `16.112.243.96` (this machine), PM2 app `home-security-system` |
| Backend | `node server.js` — port 5000, Express + Helmet + rate-limit, serves frontend `dist/` |
| MQTT TCP | port 1883 (`mqtt/broker.js`, aedes) — devices connect here |
| MQTT WS | same HTTP server path `/mqtt` — browser dashboards subscribe here |
| Database | PostgreSQL `security_db` @ `16.112.243.96:5432` user `security_user` |
| Frontend | React/Vite; API base is relative `/api` (proxied in dev, same-origin in prod) |

PM2 management:
```
pm2 start /home/ubuntu/home/backend/server.js --name home-security-system
pm2 restart home-security-system / pm2 logs home-security-system
```

## 3. Backend API surface (routes)

| Path | Auth | Purpose |
|---|---|---|
| `/api/auth/login` | public | Admin login → JWT (8h) |
| `/api/auth/send-otp`, `/verify-otp` | public | Customer OTP login (phone → JWT, role=user) |
| `/api/config` | public | Returns MQTT host/ws URL (used by devices + frontend) |
| `/api/public/device/:deviceId` | public | Device status lookup (Available/Verified/Registered) |
| `/api/public/command` | public | Setup-mode commands (ADMIN, ADD1..ADD5) pre-registration |
| `/api/public/logs/:deviceId` | public | Last 20 event logs, pre-registration only |
| `/api/public/registration/send-otp`, `verify` | public | OTP-verified customer registration (writes DeviceOwnership) |
| `/api/devices` | JWT | CRUD device registry (list/verify/delete) |
| `/api/customers` | JWT+admin | Customer list/register/delete (maps DB to legacy field names) |
| `/api/telemetry` | JWT | Telemetry logs, recent/summary by device |
| `/api/command` | JWT | Send MQTT commands to device (`mqtt/client.js`) |
| `/api/ownership` | JWT | Ownership details, SIM plan read/update |

`backend/server.js:196-200` — protected mounts; `middleware/auth.js` parses JWT.

## 4. Database (PostgreSQL `security_db`)

5 tables (Prisma schema in `backend/prisma/schema.prisma`):

| Table | Purpose | Key fields |
|---|---|---|
| `Admin` | Admin accounts | username (unique), bcrypt/plain password, role |
| `DeviceRegistry` | Registered devices | deviceId (unique), imei, mac, mqttUrl/Id/Key, serial, firmware, developer/tester names |
| `DeviceOwnership` | Customer↔device binding | deviceId (unique FK), customerName/Address/Number, deviceSimNumber, user1..user5, simPlan + dates |
| `DeviceStatus` | Live status rows | deviceStatus (Verified/Registered/Available), battery, powerCut, productionMode, lastSeenAt |
| `DeviceEventLog` | MQTT ingest log | topic + payload JSON + timestamp |

Current data: 1 admin (`admin`/`admin`), 3 devices (`ET-78421C7A4BB8`, `ET-048308BE42D4`, `ET-58BF25EEF370`, all Verified), 886 telemetry logs, 0 customers.

Connect:
```
PGPASSWORD=password psql -h 16.112.243.96 -U security_user -d security_db
```
`.env` at `backend/.env` — DATABASE_URL, MQTT_HOST=16.112.243.96, MQTT_INTERNAL_HOST, JWT_SECRET.

## 5. MQTT topic ingest (mqtt/broker.js)

- `devices/<deviceId>/telemetry` — telemetry payload stored as event log
- `enthutech/<something>/data` — HS01 firmware format; reads `Device-ID`, normalizes battery (voltage→%) and rssi_dbm→%, stores enriched JSON
- `enthutech/<something>/status` — heartbeat, updates lastSeenAt only
- Unknown devices auto-registered as `HS01` status `Available`
- Outbound commands published via `mqtt/client.js` (publishCommand)

## 6. Frontend pages & their API usage

| Page | Data source |
|---|---|
| Login (admin + customer OTP) | `AuthContext.jsx` → `/api/auth/*` |
| AdminDashboard | `DbContext.jsx` → `/api/devices`, `/api/telemetry/all`, `/api/customers` |
| CustomerDashboard | `/api/command`, `/api/ownership/:id`, MQTT WS live |
| CommandCenter | `/api/telemetry`, `/api/command`, MQTT WS |
| DeviceRegistration / DeviceAddPage | `/api/config`, `/api/devices`, `/api/config/next-serial` |
| DeviceVerification | `/api/devices/verify` |
| CustomerRegistration | `/api/public/*` (command, logs, OTP, device status) |
| CustomerPortal | `/api/ownership`, `/api/telemetry` |

Dev (hot reload): `cd /home/ubuntu/home/frontend && npm run dev` → http://localhost:5173
Prod (current): `npm run build` then backend serves `frontend/dist/` itself.

## 7. Notes / gotchas

- OTPs are stored in-memory (Map) — lost on restart; Twilio wired in `utils/sendSms.js`, returns `otp` in response for demo.
- `/api/customers` route has no requireAuth on `POST /register` (intentional for public registration flow).
- `prisma.config.ts` is a stub; schema uses `prisma/schema.prisma` with `prisma db push` style workflow.
- Frontend OTP login flow: `send-otp` returns otp + customerName → `verify-otp` returns token; customers found by phone across customerNumber + user1..user5.

---

# OTA Manager (Over-The-Air updates)

Frontend page at `/admin/ota` (sidebar → **OTA Manager**, admin only). Built for device firmware that uses ESP-IDF `esp_ota_ops.h`.

## Flow

```
1. Admin uploads firmware  →  POST /api/ota/versions (multipart, saves to backend/uploads/ota/)
2. Admin selects method (Auto Update | Section Update) + devices
3. POST /api/ota/push      →  publishes MQTT command on `enthutech/<deviceId>/cmd`:
                               "OTA AUTO <download_url> <version>"     (auto)
                               "OTA SECTION <download_url> <version>"  (section)
4. Device downloads       →  GET http://16.112.243.96:5000/api/public/ota/download/<id> (public, no auth)
5. Device flashes         →  esp_ota_begin / esp_ota_write / esp_ota_end / esp_ota_set_boot_partition, reboot
6. Device reports back    →  MQTT `enthutech/<deviceId>/ota` JSON:
   { "Device-ID": "...", "ota_status": "downloading|flashing|success|failed",
     "progress": 0-100, "version": "1.2.3", "message": "..." }
7. Backend broker        →  updates OtaUpdate job row (status/progress) and sets
                             DeviceRegistry.firmware_version on success
```

## API (all under `/api/ota`, JWT required)

| Route | Purpose |
|---|---|
| `GET /devices` | Devices with firmware_version, auto_update, status, last_seen |
| `PUT /devices/:deviceId/auto-update` | Toggle Auto Update flag |
| `GET /versions` | Firmware versions list (incl. download_url, md5, window) |
| `POST /versions` | Upload firmware (multipart: file, version, description, window) — max 100 MB |
| `DELETE /versions/:id` | Remove version + stored file |
| `POST /push` | `{deviceIds, versionId, method: auto\|section}` — sends MQTT OTA command, creates OtaUpdate jobs |
| `GET /updates` | Recent OTA job list (status/progress, live-polled by frontend every 4s) |
| `GET /api/public/ota/download/:id` | Public firmware download (device pulls from here) |

## DB additions

- `FirmwareVersion` — id, version, description, fileName, filePath, fileSize, window (Auto/OTA0/OTA1), md5, createdAt
- `OtaUpdate` — id, deviceId (FK→DeviceRegistry, cascade), versionId (FK→FirmwareVersion, SetNull), method (auto/section), status (pending/pushing/downloading/flashing/success/failed), progress 0-100, message, timestamps
- `DeviceRegistry.autoUpdate` — Boolean flag
- Device heartbeat/status payloads may include `firmware_version`/`firmware`/`fw_version` → broker syncs it to DeviceRegistry

## Frontend page structure (OtaManager.jsx)

- **Tab 1 — Version Management**: top bar = method selector (Auto/Section), device multi-select with search, "List Device", "Send Update"; device table with FW version, Auto Update toggle, per-device Push; live jobs list with progress bars (4s polling)
- **Tab 2 — File System**: firmware cards (version, description, window, size, MD5) + "Upload New Firmware" card → popup form (file upload, version, description, partition window, "Set All Version" checkbox = upload + push to every device); card actions: Download / Push / Delete