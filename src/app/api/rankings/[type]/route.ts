import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/database'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '3'), 20) // Default to 3, max 20
    const includeShorts = searchParams.get('include_shorts') === 'true' // Default false

    const validTypes = ['daily_trending', 'weekly_trending', 'all_time_views', 'high_engagement']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid ranking type. Choose from: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const client = await pool.connect()
    
    try {
      let query: string
      let params: (string | number)[]

      if (type === 'all_time_views') {
        // Viral Now: Random selection from top 100 recent viral videos
        const shortsFilter = includeShorts ? 'AND yv.duration_seconds IS NOT NULL AND yv.duration_seconds <= 60' : 'AND (yv.duration_seconds IS NULL OR yv.duration_seconds > 60)'
        query = `
          WITH viral_videos AS (
            SELECT 
              yv.title,
              yc.title as channel,
              yv.view_count,
              yv.like_count,
              yv.engagement_rate,
              yv.published_at,
              yv.id as video_id,
              yv.thumbnail_url
            FROM youtube_videos yv
            JOIN youtube_channels yc ON yv.channel_id = yc.id
            WHERE yv.published_at >= NOW() - INTERVAL '7 days'
              AND yv.view_count > 50000
              ${shortsFilter}
            ORDER BY yv.view_count DESC
            LIMIT 100
          )
          SELECT 
            ROW_NUMBER() OVER (ORDER BY RANDOM()) as rank,
            *
          FROM viral_videos
          ORDER BY RANDOM()
          LIMIT $1
        `
        params = [limit]
      } else if (type === 'weekly_trending') {
        // Trending Up: Random selection from top 50 trending videos
        const shortsFilter = includeShorts ? 'AND yv.duration_seconds IS NOT NULL AND yv.duration_seconds <= 60' : 'AND (yv.duration_seconds IS NULL OR yv.duration_seconds > 60)'
        query = `
          WITH trending_videos AS (
            SELECT 
              yv.title,
              yc.title as channel,
              yv.view_count,
              yv.like_count,
              yv.engagement_rate,
              yv.published_at,
              yv.id as video_id,
              yv.thumbnail_url,
              yv.view_acceleration,
              yv.view_velocity,
              (yv.view_velocity * 10) + 
              (yv.engagement_rate * 30) +
              (GREATEST(0, (336 - EXTRACT(EPOCH FROM (NOW() - yv.published_at))/3600)) / 336 * 500) as trending_score
            FROM youtube_videos yv
            JOIN youtube_channels yc ON yv.channel_id = yc.id
            WHERE yv.published_at >= NOW() - INTERVAL '30 days'
              AND yv.view_count < 500000
              AND yv.view_count > 1000
              ${shortsFilter}
              AND yv.id NOT IN (
                SELECT yv2.id FROM youtube_videos yv2 
                WHERE yv2.published_at >= NOW() - INTERVAL '7 days' 
                AND yv2.view_count > 50000
              )
            ORDER BY trending_score DESC
            LIMIT 50
          )
          SELECT 
            ROW_NUMBER() OVER (ORDER BY RANDOM()) as rank,
            title, channel, view_count, like_count, engagement_rate, 
            published_at, video_id, thumbnail_url, view_acceleration, view_velocity
          FROM trending_videos
          ORDER BY RANDOM()
          LIMIT $1
        `
        params = [limit]
      } else if (type === 'high_engagement') {
        // Hidden Gems: Random selection from top 100 hidden gems
        const shortsFilter = includeShorts ? 'AND yv.duration_seconds IS NOT NULL AND yv.duration_seconds <= 60' : 'AND (yv.duration_seconds IS NULL OR yv.duration_seconds > 60)'
        query = `
          WITH channel_total_views AS (
            SELECT 
              yc.id as channel_id,
              SUM(yv.view_count) as total_channel_views
            FROM youtube_channels yc
            JOIN youtube_videos yv ON yc.id = yv.channel_id
            GROUP BY yc.id
          ),
          hidden_gems AS (
            SELECT 
              yv.title,
              yc.title as channel,
              yv.view_count,
              yv.like_count,
              yv.engagement_rate,
              yv.published_at,
              yv.id as video_id,
              yv.thumbnail_url,
              (yv.engagement_rate * 60) + 
              (CASE WHEN yv.view_count > 100000 THEN 300 ELSE 0 END) +
              (CASE WHEN ctv.total_channel_views < 5000000 THEN 200 ELSE 0 END) as gem_score
            FROM youtube_videos yv
            JOIN youtube_channels yc ON yv.channel_id = yc.id
            JOIN channel_total_views ctv ON yc.id = ctv.channel_id
            WHERE yv.view_count > 8000
              AND yv.view_count < 3000000  -- Not mega-viral
              AND yv.engagement_rate > 2.5  -- Good engagement
              AND ctv.total_channel_views < 50000000  -- Smaller channels
              ${shortsFilter}
              -- Exclude mega-channels
              AND yc.title NOT ILIKE '%dude perfect%'
              AND yc.title NOT ILIKE '%good good%'
              AND yc.title NOT ILIKE '%pga tour%'
              AND yc.title NOT ILIKE '%espn%'
              AND yc.title NOT ILIKE '%bryson%'
              AND yc.title NOT ILIKE '%hammy golf%'
              -- Exclude current viral videos
              AND yv.id NOT IN (
                SELECT yv2.id FROM youtube_videos yv2 
                WHERE yv2.published_at >= NOW() - INTERVAL '7 days' 
                AND yv2.view_count > 200000
              )
            ORDER BY gem_score DESC
            LIMIT 100
          )
          SELECT 
            ROW_NUMBER() OVER (ORDER BY RANDOM()) as rank,
            title, channel, view_count, like_count, engagement_rate, 
            published_at, video_id, thumbnail_url
          FROM hidden_gems
          ORDER BY RANDOM()
          LIMIT $1
        `
        params = [limit]
      } else if (type === 'daily_trending') {
        // Daily Trending: Videos uploaded in the last 24 hours with highest views
        const shortsFilter = includeShorts ? 'AND yv.duration_seconds IS NOT NULL AND yv.duration_seconds <= 60' : 'AND (yv.duration_seconds IS NULL OR yv.duration_seconds > 60)'
        query = `
          SELECT 
            ROW_NUMBER() OVER (ORDER BY yv.view_count DESC) as rank,
            yv.title,
            yc.title as channel,
            yv.view_count,
            yv.like_count,
            yv.engagement_rate,
            yv.published_at,
            yv.id as video_id,
            yv.thumbnail_url
          FROM youtube_videos yv
          JOIN youtube_channels yc ON yv.channel_id = yc.id
          WHERE yv.published_at >= NOW() - INTERVAL '24 hours'
            ${shortsFilter}
            AND yv.title ~ '^[A-Za-z0-9$#"'']'  -- Must start with English letters/numbers or common chars
            AND yv.title !~ '[가-힣]'  -- Exclude Korean
            AND yv.title !~ '[あ-ん]'  -- Exclude Japanese hiragana
            AND yv.title !~ '[ア-ン]'  -- Exclude Japanese katakana
            AND yv.title !~ '[一-龯]'  -- Exclude Chinese/Japanese kanji
            AND yv.title !~ '[ก-๙]'  -- Exclude Thai
            AND yv.title !~ '[א-ת]'  -- Exclude Hebrew
            AND yv.title !~ '[ا-ي]'  -- Exclude Arabic
            AND yv.title !~ '[а-я]'  -- Exclude Cyrillic
            AND yv.title NOT ILIKE '%volkswagen%'  -- Exclude VW Golf cars
            AND yv.title NOT ILIKE '%vw golf%'
            AND yv.title NOT ILIKE '%gta%'  -- Exclude GTA games
            AND yv.title NOT ILIKE '%forza%'  -- Exclude racing games
            AND yv.title NOT ILIKE '%drive beyond%'  -- Exclude racing games
          ORDER BY yv.view_count DESC
          LIMIT $1
        `
        params = [limit]
      } else {
        // Fallback to old ranking system
        query = `
          SELECT 
            vr.rank,
            yv.title,
            yc.title as channel,
            yv.view_count,
            yv.like_count,
            yv.engagement_rate,
            yv.published_at,
            yv.id as video_id,
            yv.thumbnail_url
          FROM video_rankings vr
          JOIN youtube_videos yv ON vr.video_id = yv.id
          JOIN youtube_channels yc ON yv.channel_id = yc.id
          WHERE vr.ranking_type = $1
          ORDER BY vr.rank
          LIMIT $2
        `
        params = [type, limit]
      }
      
      const result = await client.query(query, params)
      
      const rankings = result.rows.map(row => ({
        rank: row.rank,
        title: row.title,
        channel: row.channel,
        views: row.view_count.toLocaleString(),
        likes: row.like_count.toLocaleString(),
        engagement: `${row.engagement_rate.toFixed(2)}%`,
        published: row.published_at.toISOString().split('T')[0],
        url: `https://youtube.com/watch?v=${row.video_id}`,
        thumbnail: row.thumbnail_url || ''
      }))

      return NextResponse.json(rankings)
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error fetching rankings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}