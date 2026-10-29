#!/bin/bash

# Exit script if any command fails
set -e

echo "===================================================="
echo "  AT Induser Backend - Automated EC2 Setup Script  "
echo "===================================================="

echo "[1/6] Updating system and installing dependencies..."
sudo apt update -y
sudo apt install -y curl build-essential postgresql postgresql-contrib

echo "[2/6] Installing Node.js (v20)..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

echo "[3/6] Setting up PostgreSQL Database..."
# Run postgres commands as the postgres user
sudo -u postgres psql -c "CREATE DATABASE induser_db;" || echo "Database already exists"
sudo -u postgres psql -c "CREATE USER induser_admin WITH PASSWORD 'secure_password123';" || echo "User already exists"
sudo -u postgres psql -c "ALTER ROLE induser_admin SET client_encoding TO 'utf8';"
sudo -u postgres psql -c "ALTER ROLE induser_admin SET default_transaction_isolation TO 'read committed';"
sudo -u postgres psql -c "ALTER ROLE induser_admin SET timezone TO 'UTC';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE induser_db TO induser_admin;"
# For Prisma to work, we also need to grant schema public privileges
sudo -u postgres psql -d induser_db -c "GRANT ALL ON SCHEMA public TO induser_admin;"

echo "[4/6] Installing Backend Node Modules..."
# Assuming the script is run from the 'backend' folder
npm install

echo "[5/6] Setting up Prisma and Seeding the Database..."
# Change the prisma provider to postgresql via sed before pushing
# This automates switching from the local sqlite setup
sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma

# Set the production DATABASE_URL in the .env file
echo "" >> .env
echo "DATABASE_URL=\"postgresql://induser_admin:secure_password123@localhost:5432/induser_db?schema=public\"" >> .env

npx prisma db push
node seed.js

echo "[6/6] Installing PM2 and Starting the Server..."
sudo npm install -g pm2
pm2 start server.js --name "induser-backend"
pm2 save
pm2 startup

echo "===================================================="
echo "  Setup Complete! The backend is now running 24/7.  "
echo "  Verify with: pm2 status                            "
echo "===================================================="
