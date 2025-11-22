#!/usr/bin/env node

/**
 * Database Migration Runner
 * Usage: pnpm migrate [up|down|status]
 */

import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const { Pool } = pg

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL environment variable is not set')
  process.exit(1)
}

const pool = new Pool({
  connectionString: DATABASE_URL,
})

// Create migrations tracking table
async function createMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `)
}

// Get list of applied migrations
async function getAppliedMigrations(): Promise<string[]> {
  const result = await pool.query(
    'SELECT name FROM migrations ORDER BY id ASC'
  )
  return result.rows.map((row) => row.name)
}

// Get list of migration files
function getMigrationFiles(): string[] {
  const migrationsDir = join(__dirname, 'migrations')
  const files = readdirSync(migrationsDir)
  return files.filter((f) => f.endsWith('.sql')).sort()
}

// Apply a migration
async function applyMigration(filename: string) {
  const filepath = join(__dirname, 'migrations', filename)
  const sql = readFileSync(filepath, 'utf-8')

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('INSERT INTO migrations (name) VALUES ($1)', [filename])
    await client.query('COMMIT')
    console.log(`✅ Applied migration: ${filename}`)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

// Run pending migrations
async function migrateUp() {
  console.log('🔄 Running migrations...\n')

  await createMigrationsTable()
  const applied = await getAppliedMigrations()
  const allMigrations = getMigrationFiles()
  const pending = allMigrations.filter((m) => !applied.includes(m))

  if (pending.length === 0) {
    console.log('✅ No pending migrations')
    return
  }

  console.log(`📋 Found ${pending.length} pending migration(s):\n`)
  pending.forEach((m) => console.log(`   - ${m}`))
  console.log()

  for (const migration of pending) {
    await applyMigration(migration)
  }

  console.log(`\n🎉 Successfully applied ${pending.length} migration(s)`)
}

// Show migration status
async function showStatus() {
  await createMigrationsTable()
  const applied = await getAppliedMigrations()
  const allMigrations = getMigrationFiles()

  console.log('📊 Migration Status:\n')
  console.log(`Total migrations: ${allMigrations.length}`)
  console.log(`Applied: ${applied.length}`)
  console.log(`Pending: ${allMigrations.length - applied.length}\n`)

  if (applied.length > 0) {
    console.log('✅ Applied migrations:')
    applied.forEach((m) => console.log(`   - ${m}`))
    console.log()
  }

  const pending = allMigrations.filter((m) => !applied.includes(m))
  if (pending.length > 0) {
    console.log('⏳ Pending migrations:')
    pending.forEach((m) => console.log(`   - ${m}`))
  }
}

// Main
async function main() {
  const command = process.argv[2] || 'up'

  try {
    switch (command) {
      case 'up':
        await migrateUp()
        break
      case 'status':
        await showStatus()
        break
      default:
        console.log(`
Usage: pnpm migrate [command]

Commands:
  up       Run pending migrations (default)
  status   Show migration status

Environment:
  DATABASE_URL   PostgreSQL connection string (required)
        `)
        process.exit(1)
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
