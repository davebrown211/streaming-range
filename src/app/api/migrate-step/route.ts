import { NextResponse } from 'next/server'
import pool from '@/lib/database'

export async function POST() {
  const client = await pool.connect()
  
  try {
    const results = []
    
    // Step 1: Add acceleration column
    try {
      console.log('Adding view_acceleration column...')
      await client.query(`
        ALTER TABLE youtube_videos 
        ADD COLUMN IF NOT EXISTS view_acceleration FLOAT DEFAULT 0.0
      `)
      results.push({ step: 'Add view_acceleration column', status: 'success' })
    } catch (error) {
      results.push({ step: 'Add view_acceleration column', status: 'error', error: (error as Error).message })
    }
    
    // Step 2: Create view history table
    try {
      console.log('Creating video_view_history table...')
      await client.query(`
        CREATE TABLE IF NOT EXISTS video_view_history (
          id SERIAL PRIMARY KEY,
          video_id VARCHAR(255) NOT NULL REFERENCES youtube_videos(id),
          view_count BIGINT NOT NULL,
          recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `)
      results.push({ step: 'Create video_view_history table', status: 'success' })
    } catch (error) {
      results.push({ step: 'Create video_view_history table', status: 'error', error: (error as Error).message })
    }
    
    // Step 3: Create indexes
    const indexes = [
      { name: 'idx_video_acceleration', sql: 'CREATE INDEX IF NOT EXISTS idx_video_acceleration ON youtube_videos(view_acceleration)' },
      { name: 'idx_view_history_video_time', sql: 'CREATE INDEX IF NOT EXISTS idx_view_history_video_time ON video_view_history(video_id, recorded_at)' },
      { name: 'idx_view_history_recorded', sql: 'CREATE INDEX IF NOT EXISTS idx_view_history_recorded ON video_view_history(recorded_at)' }
    ]
    
    for (const index of indexes) {
      try {
        console.log(`Creating index ${index.name}...`)
        await client.query(index.sql)
        results.push({ step: `Create index ${index.name}`, status: 'success' })
      } catch (error) {
        results.push({ step: `Create index ${index.name}`, status: 'error', error: (error as Error).message })
      }
    }
    
    return NextResponse.json({
      message: 'Step-by-step migration completed',
      results
    })
    
  } finally {
    client.release()
  }
}