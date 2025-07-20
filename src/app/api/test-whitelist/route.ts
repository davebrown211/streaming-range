import { NextResponse } from 'next/server'
import pool from '@/lib/database'
import { WHITELISTED_CHANNEL_IDS } from '@/lib/content-whitelist'

export async function GET() {
  const client = await pool.connect()
  
  try {
    console.log('Testing with', WHITELISTED_CHANNEL_IDS.length, 'whitelisted channels')
    
    // Simple query without complex filters
    const query = `
      SELECT 
        yv.id,
        yv.title,
        yc.title as channel_name,
        yv.published_at,
        yv.view_count,
        yv.engagement_rate,
        EXTRACT(EPOCH FROM (NOW() - yv.published_at))/3600 as hours_old
      FROM youtube_videos yv
      JOIN youtube_channels yc ON yv.channel_id = yc.id
      WHERE yv.channel_id = ANY($1::text[])
        AND yv.published_at >= NOW() - INTERVAL '7 days'
        AND yv.view_count >= 50
        AND yv.thumbnail_url IS NOT NULL
      ORDER BY yv.published_at DESC
      LIMIT 10
    `
    
    const result = await client.query(query, [WHITELISTED_CHANNEL_IDS])
    
    const videos = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      channel: row.channel_name,
      published_at: row.published_at,
      view_count: row.view_count,
      engagement_rate: row.engagement_rate,
      hours_old: Math.floor(row.hours_old),
      url: `https://youtube.com/watch?v=${row.id}`
    }))

    return NextResponse.json({
      total_whitelisted_channels: WHITELISTED_CHANNEL_IDS.length,
      videos_found: videos.length,
      videos,
      whitelist_sample: WHITELISTED_CHANNEL_IDS.slice(0, 5)
    })

  } catch (error) {
    console.error('Error in test endpoint:', error)
    return NextResponse.json(
      { error: 'Test failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  } finally {
    client.release()
  }
}