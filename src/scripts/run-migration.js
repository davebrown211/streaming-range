const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:mysecretpassword@localhost/postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

async function runMigration() {
  const client = await pool.connect()
  
  try {
    const migrationPath = path.join(__dirname, '../lib/migrations/006_add_content_type.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    console.log('Running migration: 006_add_content_type.sql')
    await client.query(migrationSQL)
    console.log('Migration completed successfully!')
    
  } catch (error) {
    console.error('Migration failed:', error)
  } finally {
    client.release()
    await pool.end()
  }
}

runMigration()