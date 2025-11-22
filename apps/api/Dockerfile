# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:20-alpine AS deps

# Install build dependencies for Sharp and native modules
# vips-dev: Image processing library that Sharp uses
# python3, make, g++: Build tools for native Node.js modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    vips-dev

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Set working directory
WORKDIR /app

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy all package.json files for workspace
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
COPY packages/redis/package.json ./packages/redis/
COPY packages/solana/package.json ./packages/solana/
COPY packages/database/package.json ./packages/database/
COPY packages/config/package.json ./packages/config/
COPY packages/helius/package.json ./packages/helius/
COPY packages/onchain/package.json ./packages/onchain/

# Install dependencies (frozen lockfile for reproducibility)
RUN pnpm install --frozen-lockfile

# ============================================
# Stage 2: Builder
# ============================================
FROM node:20-alpine AS builder

# Cache bust for source code changes (update this to force rebuild)
ARG CACHE_BUST=2025-11-10-v2

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

# Copy dependencies from deps stage (including workspace node_modules)
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/types/node_modules ./packages/types/node_modules
COPY --from=deps /app/packages/redis/node_modules ./packages/redis/node_modules
COPY --from=deps /app/packages/solana/node_modules ./packages/solana/node_modules
COPY --from=deps /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=deps /app/packages/config/node_modules ./packages/config/node_modules
COPY --from=deps /app/packages/helius/node_modules ./packages/helius/node_modules
COPY --from=deps /app/packages/onchain/node_modules ./packages/onchain/node_modules
COPY --from=deps /app/pnpm-workspace.yaml ./
COPY --from=deps /app/package.json ./
COPY --from=deps /app/pnpm-lock.yaml ./

# Copy source code
COPY turbo.json ./
COPY packages ./packages
COPY apps/api ./apps/api

# Build shared packages first (order matters - respect dependencies)
RUN pnpm --filter "@blink402/types" build && \
    pnpm --filter "@blink402/config" build && \
    pnpm --filter "@blink402/redis" build && \
    pnpm --filter "@blink402/solana" build && \
    pnpm --filter "@blink402/helius" build && \
    pnpm --filter "@blink402/onchain" build && \
    pnpm --filter "@blink402/database" build

# Build API
RUN cd apps/api && pnpm build

# ============================================
# Stage 3: Runner
# ============================================
FROM node:20-alpine AS runner

# Install runtime dependencies
# vips: Runtime library for image processing (Sharp dependency)
# su-exec: Lightweight tool to switch users (like sudo/gosu)
RUN apk add --no-cache vips su-exec

WORKDIR /app

# Create nodejs user (non-root for security)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Install pnpm for runtime (needed for workspace resolution)
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Set environment
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

# Copy package files
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./

# Copy built packages
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/types/package.json ./packages/types/
COPY --from=builder /app/packages/redis/dist ./packages/redis/dist
COPY --from=builder /app/packages/redis/package.json ./packages/redis/
COPY --from=builder /app/packages/solana/dist ./packages/solana/dist
COPY --from=builder /app/packages/solana/package.json ./packages/solana/
COPY --from=builder /app/packages/helius/dist ./packages/helius/dist
COPY --from=builder /app/packages/helius/package.json ./packages/helius/
COPY --from=builder /app/packages/onchain/dist ./packages/onchain/dist
COPY --from=builder /app/packages/onchain/package.json ./packages/onchain/
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/database/package.json ./packages/database/
COPY --from=builder /app/packages/config/dist ./packages/config/dist
COPY --from=builder /app/packages/config/package.json ./packages/config/

# Copy built API
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy entrypoint script and make it executable
COPY apps/api/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Set correct permissions for app files
RUN chown -R nodejs:nodejs /app

# Note: Don't create /app/uploads here - Railway volume mount will replace it
# Entrypoint script creates /app/uploads/galleries AFTER volume is mounted

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Use entrypoint script to set up volume permissions and start server
# The entrypoint runs as root, sets up permissions, then switches to nodejs user
ENTRYPOINT ["/docker-entrypoint.sh"]
