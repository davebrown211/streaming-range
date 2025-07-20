import { NextResponse } from 'next/server'
import pool from '@/lib/database'

export async function GET() {
  try {
    const client = await pool.connect()
    
    try {
      // Get all videos that have AI audio, ordered by most recent first
      const query = `
        SELECT DISTINCT ON (yv.id)
          yv.id as video_id,
          yv.title,
          yc.title as channel,
          yv.view_count,
          yv.like_count,
          yv.engagement_rate,
          yv.published_at,
          yv.thumbnail_url,
          yv.duration_seconds,
          va.audio_url,
          va.result as ai_summary,
          va.created_at as audio_created_at,
          -- Calculate if this is today's video of the day
          CASE 
            WHEN yv.published_at >= CURRENT_DATE 
            THEN yv.view_count * 10 
            ELSE yv.view_count 
          END as momentum_score
        FROM youtube_videos yv
        JOIN youtube_channels yc ON yv.channel_id = yc.id
        JOIN video_analyses va ON va.youtube_url LIKE '%' || yv.id || '%'
        WHERE va.audio_url IS NOT NULL
          AND va.audio_url != ''
          AND va.status = 'COMPLETED'
        ORDER BY yv.id, va.created_at DESC
      `
      
      const result = await client.query(query)
      
      // Get current video of the day ID by calling the actual API endpoint internally
      let currentVodId = null
      try {
        const vodResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/video-of-the-day`)
        if (vodResponse.ok) {
          const vodData = await vodResponse.json()
          currentVodId = vodData.video_id
        }
      } catch (error) {
        console.error('Error fetching video of the day:', error)
        // Fallback to simple query if API call fails
        const fallbackQuery = `
          SELECT yv.id as video_id
          FROM youtube_videos yv
          WHERE yv.published_at >= (CURRENT_TIMESTAMP - '1 day'::interval)
            AND yv.view_count > 1000
            AND yv.thumbnail_url IS NOT NULL
          ORDER BY yv.view_count DESC
          LIMIT 1
        `
        const fallbackResult = await client.query(fallbackQuery)
        currentVodId = fallbackResult.rows[0]?.video_id
      }
      
      // Format videos and mark the current video of the day
      const videos = result.rows.map(video => ({
        video_id: video.video_id,
        title: video.title,
        channel: video.channel,
        views: (video.view_count || 0).toString(),
        likes: (video.like_count || 0).toString(),
        engagement: `${video.engagement_rate.toFixed(2)}%`,
        published: video.published_at.toISOString().split('T')[0],
        url: `https://youtube.com/watch?v=${video.video_id}`,
        thumbnail: video.thumbnail_url,
        duration_seconds: video.duration_seconds,
        is_short: video.duration_seconds && video.duration_seconds <= 60,
        days_ago: Math.floor((Date.now() - new Date(video.published_at).getTime()) / (1000 * 60 * 60 * 24)),
        audio_url: video.audio_url,
        ai_summary: video.ai_summary,
        is_video_of_day: video.video_id === currentVodId
      }))
      
      // Sort to put video of the day first, then by most recent audio
      videos.sort((a, b) => {
        if (a.is_video_of_day) return -1
        if (b.is_video_of_day) return 1
        return 0
      })
      
      return NextResponse.json({ videos })
      
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error fetching videos with audio:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}