import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const category = searchParams.get('category')

    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: 'Query must be at least 2 characters' },
        { status: 400 }
      )
    }

    const client = await pool.connect()
    
    try {
      let sqlQuery = `
        SELECT 
          yv.title,
          yc.title as channel,
          yv.view_count,
          yv.category,
          yv.published_at,
          yv.id as video_id
        FROM youtube_videos yv
        JOIN youtube_channels yc ON yv.channel_id = yc.id
        WHERE (yv.title ILIKE $1 OR yv.description ILIKE $1)
      `
      
      const params = [`%${query}%`]
      
      if (category) {
        sqlQuery += ` AND yv.category = $2`
        params.push(category)
      }
      
      sqlQuery += ` ORDER BY yv.view_count DESC LIMIT 50`
      
      const result = await client.query(sqlQuery, params)
      
      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'No videos found' },
          { status: 404 }
        )
      }

      const results = result.rows.map(row => ({
        title: row.title,
        channel: row.channel,
        views: row.view_count.toLocaleString(),
        category: row.category || 'general',
        published: row.published_at.toISOString().split('T')[0],
        url: `https://youtube.com/watch?v=${row.video_id}`
      }))

      return NextResponse.json(results)
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error searching videos:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}