# Blink402

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15.5-black)](https://nextjs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5.2-black)](https://fastify.dev/)

**Turn any HTTP endpoint into a pay-per-call Blink (Solana Action) that can be shared on X/Discord/web.**

Users click, approve micro-payments in USDC on Solana, and the platform proxies API calls—no accounts, API keys, or custom smart contracts needed.

> **Note**: This project is currently in active development (Phase 2/8 of monorepo migration). See [MONOREPO_MIGRATION.md](./docs/MONOREPO_MIGRATION.md) for roadmap and progress.

---

## 🚀 Quick Start

### Option 1: Docker Compose (Recommended for Local Dev)

```bash
# 1. Clone and setup
git clone <your-repo>
cd BlinkBazaar
cp .env.example .env.local

# 2. Start all services (PostgreSQL, Redis, API, Web)
docker-compose up -d

# 3. Run database migrations
docker-compose exec api pnpm --filter "@blink402/database" migrate

# 4. Access the app
# Web: http://localhost:3000
# API: http://localhost:3001
# Docs: http://localhost:3001/docs
```

### Option 2: Local Development (without Docker)

```bash
# 1. Prerequisites
# - Node.js 20+
# - pnpm 9.x
# - PostgreSQL 15+
# - Redis 7+ (optional)

# 2. Setup
pnpm install
cp .env.example .env.local

# 3. Configure DATABASE_URL in .env.local
# DATABASE_URL=postgresql://user:pass@localhost:5432/blink402

# 4. Run migrations
pnpm --filter "@blink402/database" migrate

# 5. Start development servers
pnpm dev  # Starts both web (3000) and api (3001)
```

---

## 📦 Monorepo Structure

```
BlinkBazaar/
├── apps/
│   ├── web/          # Next.js 15 frontend (port 3000)
│   └── api/          # Fastify backend (port 3001)
├── packages/
│   ├── types/        # Shared TypeScript interfaces
│   ├── solana/       # Solana payment utilities
│   ├── database/     # PostgreSQL database layer
│   └── config/       # Environment configuration
├── docker-compose.yml
├── turbo.json
└── pnpm-workspace.yaml
```

---

## 🛠️ Development Commands

```bash
# Install dependencies
pnpm install

# Build all packages and apps
pnpm build

# Run all apps in development
pnpm dev

# Run type checking
pnpm typecheck

# Run linting (if configured)
pnpm lint

# Run tests
pnpm test

# Run API tests only
cd apps/api && pnpm test

# Database migrations
pnpm --filter "@blink402/database" migrate
pnpm --filter "@blink402/database" migrate:status
```

---

## 🐳 Docker Commands

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
docker-compose logs -f api    # API only
docker-compose logs -f web    # Web only

# Stop services
docker-compose down

# Rebuild after code changes
docker-compose up -d --build

# Clean slate (removes volumes)
docker-compose down -v
```

---

## 🚢 Deployment

### Railway (Recommended)

1. **Create Railway project**: https://railway.app/new
2. **Add services**:
   - PostgreSQL database
   - Redis (optional, recommended for production)
   - API service (from `apps/api`)
   - Web service (from `apps/web`)
3. **Configure environment variables** (see `DEPLOYMENT.md`)
4. **Deploy**: `git push origin master`

Railway auto-deploys on push using the nixpacks.toml configurations.

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for detailed deployment instructions.

---

## 🏗️ Architecture

### Frontend (`apps/web`)
- **Framework**: Next.js 15.5.6 with App Router
- **Styling**: Tailwind CSS v4 with custom neon theme
- **Animations**: Motion One (NOT Framer Motion), baffle.js, dotLottie
- **Solana**: Wallet adapters, Solana Pay

### Backend (`apps/api`)
- **Framework**: Fastify 5.2.0
- **Database**: PostgreSQL with pg library
- **Rate Limiting**: Redis-backed (falls back to in-memory)
- **Security**: Helmet, CORS, rate limiting
- **Logging**: Pino structured logging

### Key Features
- **Solana Actions/Blinks**: Dialect standard implementation
- **x402 Payment Proxy**: HTTP 402 Payment Required
- **Payment Verification**: On-chain USDC transfer verification
- **No Custom Contracts**: Uses standard Solana SPL tokens

---

## 📚 Documentation

- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Deployment guide (Docker, Railway)
- **[CLAUDE.md](./CLAUDE.md)** - Complete project documentation
- **[MONOREPO_MIGRATION.md](./docs/MONOREPO_MIGRATION.md)** - Migration progress

---

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run API integration tests
cd apps/api && pnpm test

# Run tests in watch mode
cd apps/api && pnpm test:watch

# Run with coverage
cd apps/api && pnpm test:coverage
```

---

## 🔐 Environment Variables

See `.env.example` for all available environment variables.

**Required**:
- `DATABASE_URL` - PostgreSQL connection string
- `NEXT_PUBLIC_SOLANA_NETWORK` - `devnet` or `mainnet-beta`
- `NEXT_PUBLIC_SOLANA_RPC_URL` - Solana RPC endpoint
- `NEXT_PUBLIC_USDC_MINT` - USDC token mint address

**Optional**:
- `REDIS_URL` - Redis connection (recommended for production)
- `PORT` - API server port (default: 3001)
- `HOST` - API server host (default: 0.0.0.0)

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and type checking
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙋 Support

- **Documentation**: See `CLAUDE.md` and `DEPLOYMENT.md`
- **Issues**: https://github.com/your-org/blink402/issues

---

**Built with ❤️ using Next.js, Fastify, Solana, and Turborepo**
