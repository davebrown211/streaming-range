import { NextResponse } from 'next/server'
import pool from '@/lib/database'

export async function GET() {
  try {
    const client = await pool.connect()
    
    try {
      // Check channel stats to understand the data
      const query = `
        SELECT 
          yc.title as channel_name,
          COUNT(yv.id) as video_count,
          AVG(yv.view_count) as avg_views,
          MAX(yv.view_count) as max_views,
          MIN(yv.view_count) as min_views
        FROM youtube_channels yc
        JOIN youtube_videos yv ON yc.id = yv.channel_id
        GROUP BY yc.id, yc.title
        ORDER BY avg_views DESC
        LIMIT 15
      `
      
      const result = await client.query(query)
      
      return NextResponse.json({
        message: 'Channel stats for debugging hidden gems',
        channels: result.rows.map(row => ({
          channel: row.channel_name,
          video_count: parseInt(row.video_count),
          avg_views: Math.round(parseFloat(row.avg_views)),
          max_views: parseInt(row.max_views),
          min_views: parseInt(row.min_views),
          performance_ratio: Math.round((parseInt(row.max_views) / parseFloat(row.avg_views)) * 100) / 100
        }))
      })
      
    } finally {
      client.release()
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Debug failed', message: (error as Error).message },
      { status: 500 }
    )
  }
}