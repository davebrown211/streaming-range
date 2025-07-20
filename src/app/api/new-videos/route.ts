import { NextResponse } from 'next/server'
import pool from '@/lib/database'
import { WHITELISTED_CHANNEL_IDS } from '@/lib/content-whitelist'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  
  // Parse query parameters with defaults
  const hours = Math.min(parseInt(searchParams.get('hours') || '24'), 168) // Max 7 days
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)  // Max 100 videos
  const minViews = parseInt(searchParams.get('minViews') || '100')
  const excludeShorts = searchParams.get('excludeShorts') !== 'false'
  const sortBy = searchParams.get('sortBy') || 'published' // published, views, engagement, velocity
  
  const client = await pool.connect()
  
  try {
    // Build dynamic ORDER BY clause
    let orderClause: string
    switch (sortBy) {
      case 'views':
        orderClause = 'yv.view_count DESC, yv.published_at DESC'
        break
      case 'engagement':
        orderClause = 'yv.engagement_rate DESC, yv.published_at DESC'
        break
      case 'velocity':
        orderClause = 'yv.view_velocity DESC, yv.published_at DESC'
        break
      case 'momentum':
        orderClause = 'momentum_score DESC, yv.published_at DESC'
        break
      default:
        orderClause = 'yv.published_at DESC, yv.view_count DESC'
    }

    const query = `
      SELECT 
        yv.id,
        yv.title,
        yc.title as channel_name,
        yv.published_at,
        yv.view_count,
        yv.like_count,
        yv.comment_count,
        yv.engagement_rate,
        yv.view_velocity,
        yv.duration_seconds,
        yv.thumbnail_url,
        yv.updated_at,
        -- Calculate age metrics
        EXTRACT(EPOCH FROM (NOW() - yv.published_at))/3600 as hours_old,
        EXTRACT(EPOCH FROM (NOW() - yv.published_at))/86400 as days_old,
        -- Calculate momentum score (recency + view boost)
        CASE 
          WHEN yv.published_at >= NOW() - INTERVAL '6 hours' THEN yv.view_count * 100
          WHEN yv.published_at >= NOW() - INTERVAL '12 hours' THEN yv.view_count * 50
          WHEN yv.published_at >= NOW() - INTERVAL '24 hours' THEN yv.view_count * 20
          WHEN yv.published_at >= NOW() - INTERVAL '48 hours' THEN yv.view_count * 5
          ELSE yv.view_count
        END as momentum_score,
        -- Performance metrics
        CASE WHEN yv.duration_seconds <= 60 THEN true ELSE false END as is_short,
        ROUND(yv.view_count::numeric / NULLIF(EXTRACT(EPOCH FROM (NOW() - yv.published_at))/3600, 0), 2) as views_per_hour
      FROM youtube_videos yv
      JOIN youtube_channels yc ON yv.channel_id = yc.id
      WHERE 
        -- Primary filters (most selective first for query optimization)
        yv.channel_id = ANY($1::text[])                    -- Only whitelisted channels
        AND yv.published_at >= NOW() - INTERVAL '${hours} hours'  -- Time window
        AND yv.view_count >= $2                            -- Minimum view threshold
        AND yv.thumbnail_url IS NOT NULL                   -- Must have thumbnail
        ${excludeShorts ? 'AND (yv.duration_seconds IS NULL OR yv.duration_seconds > 60)' : ''}
        -- Content quality filters
        AND yv.title !~ '[あ-ん]'                          -- Exclude Japanese hiragana
        AND yv.title !~ '[ア-ン]'                          -- Exclude Japanese katakana
        AND yv.title !~ '[一-龯]'                          -- Exclude Chinese/Japanese kanji
        AND yv.title !~ '[À-ÿ]'                           -- Exclude accented characters
        AND yv.title NOT ILIKE '%volkswagen%'              -- Exclude VW Golf cars
        AND yv.title NOT ILIKE '%vw golf%'
        AND yv.title NOT ILIKE '%gta%'                     -- Exclude GTA games
        AND yv.title NOT ILIKE '%forza%'                   -- Exclude racing games
        AND yv.title NOT ILIKE '%golf cart%'               -- Focus on golf sport
        -- Tournament exclusions (professional golf events)
        AND yv.title !~* '(round [0-9]|r[0-9]|mpo \\\\||fpo \\\\||klpga|kpga|championship 20|tournament highlights|final round|course maintenance)'
      ORDER BY ${orderClause}
      LIMIT $3
    `
    
    const result = await client.query(query, [WHITELISTED_CHANNEL_IDS, minViews, limit])
    
    // Format the response with rich metadata
    const videos = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      channel: row.channel_name,
      published_at: row.published_at,
      url: `https://youtube.com/watch?v=${row.id}`,
      thumbnail: row.thumbnail_url,
      
      // View metrics
      view_count: row.view_count,
      like_count: row.like_count,
      comment_count: row.comment_count,
      engagement_rate: row.engagement_rate ? parseFloat(row.engagement_rate.toFixed(2)) : null,
      
      // Performance metrics
      view_velocity: Math.round(row.view_velocity),
      views_per_hour: row.views_per_hour ? parseFloat(row.views_per_hour) : null,
      momentum_score: Math.round(row.momentum_score),
      
      // Time metrics
      hours_old: Math.floor(row.hours_old),
      days_old: Math.floor(row.days_old),
      
      // Content metadata
      duration_seconds: row.duration_seconds,
      is_short: row.is_short,
      updated_at: row.updated_at
    }))

    // Add summary statistics
    const summary = {
      total_videos: videos.length,
      time_window_hours: hours,
      avg_views: videos.length > 0 ? Math.round(videos.reduce((sum, v) => sum + v.view_count, 0) / videos.length) : 0,
      avg_engagement: videos.length > 0 ? 
        parseFloat((videos.filter(v => v.engagement_rate).reduce((sum, v) => sum + (v.engagement_rate || 0), 0) / 
                   videos.filter(v => v.engagement_rate).length || 0).toFixed(2)) : 0,
      newest_video_hours: videos.length > 0 ? Math.min(...videos.map(v => v.hours_old)) : 0,
      oldest_video_hours: videos.length > 0 ? Math.max(...videos.map(v => v.hours_old)) : 0,
      channels_represented: [...new Set(videos.map(v => v.channel))].length,
      shorts_count: videos.filter(v => v.is_short).length,
      generated_at: new Date().toISOString()
    }

    return NextResponse.json({
      videos,
      summary,
      query_params: {
        hours,
        limit,
        minViews,
        excludeShorts,
        sortBy
      }
    }, {
      headers: {
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        'X-Total-Videos': videos.length.toString(),
        'X-Query-Time': Date.now().toString()
      }
    })

  } catch (error) {
    console.error('Error fetching new whitelisted videos:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch new videos',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  } finally {
    client.release()
  }
}

// Optional: Add POST endpoint for more complex queries
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      channel_ids = WHITELISTED_CHANNEL_IDS,
      time_filters = {},
      content_filters = {},
      sort_options = {},
      limit = 20
    } = body

    // This could handle more complex filtering logic
    // For now, redirect to GET with query params
    const searchParams = new URLSearchParams({
      hours: time_filters.hours?.toString() || '24',
      limit: limit.toString(),
      sortBy: sort_options.sort_by || 'published'
    })

    return NextResponse.redirect(`/api/new-videos?${searchParams.toString()}`)

  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  }
}