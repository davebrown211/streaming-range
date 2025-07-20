import { NextResponse } from 'next/server'
import { updateAllVideoAccelerations, recordViewSnapshot } from '@/lib/acceleration'
import { wsServer } from '@/lib/websocket-server'
import pool from '@/lib/database'

export async function POST() {
  try {
    const client = await pool.connect()
    
    try {
      // First, record current view counts as snapshots
      const videosQuery = `
        SELECT id, view_count 
        FROM youtube_videos 
        WHERE updated_at >= NOW() - INTERVAL '1 day'
      `
      
      const videosResult = await client.query(videosQuery)
      
      // Record snapshots for recently updated videos
      for (const video of videosResult.rows) {
        await recordViewSnapshot(video.id, video.view_count)
      }
      
      // Calculate acceleration for all videos with enough data
      await updateAllVideoAccelerations()
      
      // Broadcast simple update notification (no rankings)
      wsServer.broadcastStatsUpdate({
        message: 'View data updated',
        videos_processed: videosResult.rows.length,
        timestamp: new Date().toISOString()
      })
      
      return NextResponse.json({ 
        message: 'Acceleration calculations updated',
        videos_processed: videosResult.rows.length
      })
      
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error updating accelerations:', error)
    return NextResponse.json(
      { error: 'Failed to update accelerations' },
      { status: 500 }
    )
  }
}