import { NextResponse } from 'next/server'
import pool from '@/lib/database'

export async function POST() {
  const client = await pool.connect()
  
  try {
    // Add audio_url column if it doesn't exist
    await client.query(`
      ALTER TABLE video_analyses 
      ADD COLUMN IF NOT EXISTS audio_url VARCHAR(500)
    `)
    
    // Create index for faster lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_video_analyses_audio_url 
      ON video_analyses(audio_url) 
      WHERE audio_url IS NOT NULL
    `)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Audio URL column added successfully' 
    })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  } finally {
    client.release()
  }
}