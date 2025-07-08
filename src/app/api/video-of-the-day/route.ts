import { NextResponse } from 'next/server'
import pool from '@/lib/database'

export async function GET() {
  try {
    const client = await pool.connect()
    
    try {
      // Get video with highest momentum score - heavily favor today's uploads
      const query = `
        WITH trending_candidates AS (
          SELECT 
            yv.id,
            yv.title,
            yc.title as channel,
            yv.view_count,
            yv.like_count,
            yv.engagement_rate,
            yv.published_at,
            yv.view_velocity,
            yv.thumbnail_url,
            yv.duration_seconds,
            -- Calculate "freshness score" - heavily favor today's uploads
            CASE 
              WHEN yv.published_at >= CURRENT_DATE THEN yv.view_count * 100000               -- Massive boost for today only
              WHEN yv.published_at >= NOW() - INTERVAL '24 hours' THEN yv.view_count * 100   -- Decent boost for last 24h
              WHEN yv.published_at >= NOW() - INTERVAL '48 hours' THEN yv.view_count * 10    -- Small boost for yesterday  
              ELSE yv.view_count * 0.1                                                       -- Minimal score for older
            END as momentum_score
          FROM youtube_videos yv
          JOIN youtube_channels yc ON yv.channel_id = yc.id
          WHERE yv.published_at >= NOW() - INTERVAL '7 days'  -- Only consider recent videos
            AND yv.view_count > 500                           -- Lower threshold to find today's content
            AND yv.engagement_rate > 0.5                      -- Lower engagement threshold
            AND yv.thumbnail_url IS NOT NULL                  -- Must have thumbnail
            AND (yv.duration_seconds IS NULL OR yv.duration_seconds > 60)  -- Exclude shorts
            AND (yv.title ILIKE '%golf%' OR yc.title ILIKE '%golf%' OR yc.title ILIKE '%pga%' OR yc.title ILIKE '%tour%')  -- Must be golf content
        )
        SELECT 
          id as video_id,
          title,
          channel,
          view_count,
          like_count,
          engagement_rate,
          published_at,
          view_velocity,
          thumbnail_url,
          duration_seconds,
          momentum_score
        FROM trending_candidates
        ORDER BY momentum_score DESC, view_velocity DESC, engagement_rate DESC
        LIMIT 1
      `
      
      const result = await client.query(query)
      
      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'No video of the day found' },
          { status: 404 }
        )
      }
      
      const video = result.rows[0]
      
      // Format the response
      const videoOfTheDay = {
        video_id: video.video_id,
        title: video.title,
        channel: video.channel,
        views: video.view_count.toLocaleString(),
        likes: video.like_count.toLocaleString(),
        engagement: `${video.engagement_rate.toFixed(2)}%`,
        published: video.published_at.toISOString().split('T')[0],
        url: `https://youtube.com/watch?v=${video.video_id}`,
        thumbnail: video.thumbnail_url,
        view_velocity: Math.round(video.view_velocity),
        momentum_score: Math.round(video.momentum_score),
        duration_seconds: video.duration_seconds,
        is_short: video.duration_seconds && video.duration_seconds <= 60,
        days_ago: Math.floor((Date.now() - new Date(video.published_at).getTime()) / (1000 * 60 * 60 * 24))
      }
      
      return NextResponse.json(videoOfTheDay)
      
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error fetching video of the day:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}