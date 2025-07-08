import { NextRequest, NextResponse } from 'next/server'
import { recordViewSnapshot, updateAllVideoAccelerations } from '@/lib/acceleration'
import pool from '@/lib/database'

export async function GET(request: NextRequest) {
  // Simple auth check - can be called by cron services like Vercel Cron
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const startTime = Date.now()
    const client = await pool.connect()
    
    try {
      // Get all videos updated in the last day for polling
      const query = `
        SELECT id, view_count, title
        FROM youtube_videos 
        WHERE updated_at >= NOW() - INTERVAL '2 days'
        OR published_at >= NOW() - INTERVAL '7 days'
        ORDER BY updated_at DESC
        LIMIT 1000
      `
      
      const result = await client.query(query)
      let snapshotsRecorded = 0
      
      // Record view count snapshots
      for (const video of result.rows) {
        try {
          await recordViewSnapshot(video.id, video.view_count)
          snapshotsRecorded++
        } catch (error) {
          console.error(`Failed to record snapshot for ${video.id}:`, error)
        }
      }
      
      // Calculate accelerations for videos with enough data
      await updateAllVideoAccelerations()
      
      const duration = Date.now() - startTime
      
      return NextResponse.json({
        success: true,
        videos_processed: result.rows.length,
        snapshots_recorded: snapshotsRecorded,
        duration_ms: duration,
        timestamp: new Date().toISOString()
      })
      
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Cron job failed:', error)
    return NextResponse.json(
      { 
        error: 'Cron job failed', 
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// Also allow POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request)
}