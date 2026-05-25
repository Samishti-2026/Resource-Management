#!/bin/bash
echo "Starting application..."

# Run Prisma migrations (safe to run multiple times)
echo "Running database migrations..."
npx prisma migrate deploy || echo "Migration warning (may already be applied)"

echo "Starting Node.js server..."
node src/app.js
