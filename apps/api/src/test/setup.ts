// Vitest setup file - runs before all tests
// Set environment variables before any modules are imported

process.env.MOCK_PAYMENTS = 'true'
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:NajctWeCLYaSywSNHKxkWElcSbTsDSPc@caboose.proxy.rlwy.net:58182/railway'

// Disable Redis if not configured (optional for tests)
if (!process.env.REDIS_URL) {
  process.env.REDIS_OPTIONAL = 'true'
}
