import { NextResponse } from 'next/server'
import pool from '@/lib/database'

export async function GET() {
  try {
    const client = await pool.connect()
    
    try {
      // Get video count
      const videoCountResult = await client.query('SELECT COUNT(*) as count FROM youtube_videos')
      const videoCount = parseInt(videoCountResult.rows[0].count)

      // Get channel count
      const channelCountResult = await client.query('SELECT COUNT(*) as count FROM youtube_channels')
      const channelCount = parseInt(channelCountResult.rows[0].count)

      // Get category breakdown
      const categoryResult = await client.query(`
        SELECT category, COUNT(*) as count 
        FROM youtube_videos 
        WHERE category IS NOT NULL 
        GROUP BY category
      `)
      
      const categories: Record<string, number> = {}
      categoryResult.rows.forEach(row => {
        categories[row.category] = parseInt(row.count)
      })

      return NextResponse.json({
        total_videos: videoCount,
        total_channels: channelCount,
        categories,
        last_updated: new Date().toISOString()
      })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}