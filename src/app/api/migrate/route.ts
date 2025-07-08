import { NextResponse } from 'next/server'
import pool from '@/lib/database'
import fs from 'fs'
import path from 'path'

export async function POST() {
  try {
    // Read the schema.sql file
    const schemaPath = path.join(process.cwd(), 'src/lib/schema.sql')
    const schemaSql = fs.readFileSync(schemaPath, 'utf8')
    
    const client = await pool.connect()
    
    try {
      // Split SQL statements by semicolon and execute each one
      const statements = schemaSql
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
      
      const results = []
      
      for (const statement of statements) {
        try {
          console.log('Executing:', statement.substring(0, 100) + '...')
          await client.query(statement)
          results.push({ statement: statement.substring(0, 50) + '...', status: 'success' })
        } catch (error) {
          console.error('Migration error:', error)
          results.push({ 
            statement: statement.substring(0, 50) + '...', 
            status: 'error', 
            error: error instanceof Error ? error.message : 'Unknown error' 
          })
        }
      }
      
      return NextResponse.json({
        message: 'Migration completed',
        results
      })
      
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Migration failed:', error)
    return NextResponse.json(
      { 
        error: 'Migration failed', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}