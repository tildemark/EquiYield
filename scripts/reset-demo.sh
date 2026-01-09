#!/bin/bash
# Daily demo data reset script

set -e

echo "🔄 Starting daily demo data reset..."
echo "Timestamp: $(date)"

# Wait for database to be ready
echo "⏳ Waiting for database..."
until docker exec equiyield-server pg_isready -h postgres -p 5432 -U postgres; do
  sleep 2
done

echo "✅ Database is ready"

# Run the demo seeder inside the server container
echo "🌱 Seeding demo data..."
docker exec equiyield-server npx ts-node /app/apps/server/seed-demo.ts

echo "✨ Demo data reset complete!"
echo "-----------------------------------"
