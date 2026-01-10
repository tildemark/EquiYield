#!/bin/bash
# Daily demo data reset script for production
# This script resets the demo database to initial state with sample data

set -e

echo "🔄 Starting daily demo data reset..."
echo "Timestamp: $(date)"

# Navigate to application directory
cd /opt/EquiYield

# Check if containers are running
if ! docker ps | grep -q equiyield-server; then
    echo "❌ Error: equiyield-server container is not running"
    exit 1
fi

if ! docker ps | grep -q equiyield-postgres; then
    echo "❌ Error: equiyield-postgres container is not running"
    exit 1
fi

# Wait for database to be ready
echo "⏳ Waiting for database..."
until docker exec equiyield-postgres pg_isready -h localhost -U equiyield; do
  sleep 2
done

echo "✅ Database is ready"

# Clear existing data and reseed
echo "🌱 Reseeding demo data..."
docker exec equiyield-server node dist/seed-demo.js

if [ $? -eq 0 ]; then
    echo "✨ Demo data reset complete!"
    echo "-----------------------------------"
else
    echo "❌ Demo data reset failed!"
    exit 1
fi
