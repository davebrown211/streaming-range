import { NextResponse } from 'next/server'
import pool from '@/lib/database'
import { WHITELISTED_CHANNEL_IDS } from '@/lib/content-whitelist'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const offset = parseInt(searchParams.get('offset') || '0')
  const limit = parseInt(searchParams.get('limit') || '50') // Default to 50, no max limit
  
  const client = await pool.connect()
  
  try {
    // Get curated videos from whitelisted creators only, sorted by upload date (newest first)
    const query = `
      SELECT 
        yv.id,
        yv.title,
        yc.title as channel,
        yv.view_count::text as views,
        yv.like_count::text as likes,
        ROUND(yv.engagement_rate::numeric, 2)::text as engagement,
        yv.published_at as published,
        'https://youtube.com/watch?v=' || yv.id as url,
        yv.thumbnail_url as thumbnail,
        ROW_NUMBER() OVER (ORDER BY yv.published_at DESC) as rank
      FROM youtube_videos yv
      JOIN youtube_channels yc ON yv.channel_id = yc.id
      WHERE yv.channel_id = ANY($1::text[])
        AND yv.published_at >= NOW() - INTERVAL '90 days'  -- Expand to 90 days for more content
        AND yv.view_count > 100   -- Lower threshold for more variety
        AND yv.duration_seconds >= 180   -- At least 3 minutes to filter out shorts
        AND yv.title !~* '(round [0-9]|r[0-9]|mpo \\||fpo \\||klpga|kpga|championship 20|tournament highlights|final round|course maintenance)'
      ORDER BY yv.published_at DESC
      OFFSET $2
      LIMIT $3
    `
    
    const result = await client.query(query, [WHITELISTED_CHANNEL_IDS, offset, limit])
    
    const videos = result.rows.map((row, index) => ({
      rank: index + 1,
      title: row.title,
      channel: row.channel,
      views: row.views,
      likes: row.likes,
      engagement: row.engagement,
      published: row.published,
      url: row.url,
      thumbnail: row.thumbnail
    }))
    
    return NextResponse.json({ videos })
    
  } catch (error) {
    console.error('Error fetching curated videos:', error)
    return NextResponse.json(
      { error: 'Failed to fetch curated videos' },
      { status: 500 }
    )
  } finally {
    client.release()
  }
}