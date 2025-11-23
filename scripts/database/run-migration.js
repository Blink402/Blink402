// Simple script to run a migration SQL file
const { Client } = require('pg')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env') })

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  })

  try {
    const sqlFile = process.argv[2]
    if (!sqlFile) {
      console.error('Usage: node run-migration.js <sql-file>')
      process.exit(1)
    }

    const sqlPath = path.join(__dirname, sqlFile)
    const sql = fs.readFileSync(sqlPath, 'utf8')

    console.log(`Running migration: ${sqlFile}`)
    console.log(`Connecting to database...`)

    await client.connect()
    const result = await client.query(sql)

    console.log('✅ Migration completed successfully!')
    console.log('Notices:', result)
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    console.error('Full error:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

runMigration()
