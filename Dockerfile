# ─────────────────────────────────────────────
# Stage 1: Build Frontend
# ─────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install frontend dependencies
RUN npm install

# Copy all frontend source
COPY frontend/ ./

# Build the React app
RUN npm run build

# ─────────────────────────────────────────────
# Stage 2: Backend + Serve Frontend
# ─────────────────────────────────────────────
FROM node:20-alpine AS production

# Install required system packages
RUN apk add --no-cache \
    openssl \
    libc6-compat \
    python3 \
    make \
    g++

WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./backend/

# Install backend dependencies
RUN cd backend && npm install --omit=dev

# Copy backend source files
COPY backend/ ./backend/

# Copy prisma schema and generate client
COPY backend/prisma ./backend/prisma/
RUN cd backend && npx prisma generate

# Copy the built frontend into backend's public/dist folder
COPY --from=frontend-builder /app/frontend/dist ./backend/dist/

# Copy the SQLite database (dev.db) — includes all existing data
COPY backend/prisma/dev.db ./backend/prisma/dev.db

# Copy OTA firmware uploads if any
COPY backend/uploads ./backend/uploads/

# Set environment variables (override in docker-compose or .env)
ENV NODE_ENV=production
ENV PORT=5000

# Expose ports: 5000 (API), 1883 (MQTT TCP), 9001 (MQTT WS)
EXPOSE 5000
EXPOSE 1883
EXPOSE 9001

WORKDIR /app/backend

# Start the server
CMD ["node", "server.js"]
