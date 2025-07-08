import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)

    const client = await pool.connect()
    
    try {
      const query = `
        SELECT 
          yc.id,
          yc.title as channel,
          COUNT(yv.id) as video_count,
          SUM(yv.view_count) as total_views,
          AVG(yv.engagement_rate) as avg_engagement
        FROM youtube_channels yc
        JOIN youtube_videos yv ON yc.id = yv.channel_id
        GROUP BY yc.id, yc.title
        ORDER BY total_views DESC
        LIMIT $1
      `
      
      const result = await client.query(query, [limit])
      
      const channels = result.rows.map(row => ({
        channel: row.channel,
        videos_tracked: parseInt(row.video_count),
        total_views: parseInt(row.total_views).toLocaleString(),
        avg_engagement: `${parseFloat(row.avg_engagement).toFixed(2)}%`,
        url: `https://youtube.com/channel/${row.id}`
      }))

      return NextResponse.json(channels)
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error fetching top channels:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}