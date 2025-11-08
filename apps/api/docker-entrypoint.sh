#!/bin/sh
set -e

echo "🔧 Setting up volume permissions..."

# Create uploads directory structure if it doesn't exist
# This runs as root when the container starts (after Railway volume mount)
mkdir -p /app/uploads/galleries

# Set ownership to nodejs user (non-root)
chown -R nodejs:nodejs /app/uploads

echo "✅ Volume permissions configured"
echo "🚀 Starting API server as nodejs user..."

# Switch to nodejs user and start the application
exec su-exec nodejs node apps/api/dist/index.js
