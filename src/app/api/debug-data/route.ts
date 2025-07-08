import { NextResponse } from 'next/server'
import pool from '@/lib/database'

export async function GET() {
  try {
    const client = await pool.connect()
    
    try {
      // Check what data we have
      const queries = {
        totalVideos: 'SELECT COUNT(*) as count FROM youtube_videos',
        recentVideos: `
          SELECT COUNT(*) as count 
          FROM youtube_videos 
          WHERE published_at >= NOW() - INTERVAL '14 days'
        `,
        viewCountRange: `
          SELECT 
            MIN(view_count) as min_views,
            MAX(view_count) as max_views,
            AVG(view_count) as avg_views
          FROM youtube_videos
        `,
        accelerationData: `
          SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN view_acceleration > 0 THEN 1 END) as positive_accel,
            AVG(view_acceleration) as avg_accel
          FROM youtube_videos
          WHERE view_acceleration IS NOT NULL
        `,
        sampleVideos: `
          SELECT 
            title, view_count, view_velocity, view_acceleration, 
            engagement_rate, published_at
          FROM youtube_videos 
          ORDER BY published_at DESC 
          LIMIT 10
        `,
        viewHistory: `
          SELECT COUNT(*) as count 
          FROM video_view_history
        `
      }
      
      const results: any = {}
      
      for (const [key, query] of Object.entries(queries)) {
        try {
          const result = await client.query(query)
          results[key] = result.rows
        } catch (error) {
          results[key] = { error: (error as Error).message }
        }
      }
      
      return NextResponse.json(results)
      
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