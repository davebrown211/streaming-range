import { NextResponse } from 'next/server'
import pool from '@/lib/database'
import { WHITELISTED_CHANNEL_IDS } from '@/lib/content-whitelist'

function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function generateSummaryFromAnalysis(analysis: {
  result: string | null
  character_analysis: string | null
  captions_preview?: string | null
}): string {
  let summary = ''
  
  try {
    // Parse the AI analysis result
    if (analysis.result) {
      const result = JSON.parse(analysis.result)
      
      // Extract key information from AI analysis
      if (result.summary) {
        summary += result.summary + '\n\n'
      } else if (result.analysis) {
        summary += result.analysis + '\n\n'
      }
      
      // Add scoring information if available
      if (result.total_score || result.scores) {
        summary += `🏌️ Golf Performance: ${result.total_score || 'Multiple scores recorded'}\n\n`
      }
    }
    
    // Add character analysis if available
    if (analysis.character_analysis) {
      const characters = JSON.parse(analysis.character_analysis)
      if (characters && characters.length > 0) {
        summary += '👥 Key Players:\n'
        characters.slice(0, 3).forEach((char: any) => {
          summary += `• ${char.name || 'Player'}: ${char.role || char.personality || 'Golf enthusiast'}\n`
        })
        summary += '\n'
      }
    }
    
    // Add caption preview if no other content
    if (!summary && analysis.captions_preview) {
      summary = `📝 Video Content Preview:\n${analysis.captions_preview.substring(0, 300)}...\n\n`
    }
    
  } catch (error) {
    console.error('Error parsing analysis data:', error)
  }
  
  return summary || 'AI analysis completed but summary content is not available.'
}

export async function GET() {
  try {
    const client = await pool.connect()
    
    try {
      // Get video with highest momentum score - heavily favor today's uploads
      // Include AI analysis data if available
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
            -- Include AI analysis data
            va.result as ai_analysis,
            va.character_analysis,
            va.captions_preview,
            va.status as analysis_status,
            -- Calculate "freshness score" - heavily prioritize recent videos
            CASE 
              WHEN yv.published_at >= CURRENT_DATE THEN yv.view_count * 1000   -- 1000x boost for today's videos
              WHEN yv.published_at >= NOW() - '1 day'::interval THEN yv.view_count * 100    -- 100x boost for last 24h
              WHEN yv.published_at >= NOW() - '2 day'::interval THEN yv.view_count * 10     -- 10x boost for last 48h
              WHEN yv.published_at >= NOW() - '3 day'::interval THEN yv.view_count * 1      -- Raw view count for 3 days
              ELSE yv.view_count * 0.001                                                      -- Very low score for older
            END as momentum_score
          FROM youtube_videos yv
          JOIN youtube_channels yc ON yv.channel_id = yc.id
          LEFT JOIN video_analyses va ON va.video_id = yv.id
            AND va.status = 'COMPLETED'
          WHERE yv.published_at >= NOW() - '14 day'::interval  -- Expand search window  
            AND yv.view_count > 100                           -- Much lower threshold to find recent content
            AND (yv.engagement_rate > 0.1 OR yv.engagement_rate IS NULL)  -- Allow null engagement for recent videos
            AND yv.thumbnail_url IS NOT NULL                  -- Must have thumbnail
            AND (yv.duration_seconds IS NULL OR yv.duration_seconds > 60)  -- Exclude shorts
            AND yv.channel_id = ANY($1::text[])               -- Only whitelisted creators
            AND yv.title !~ '[あ-ん]'  -- Exclude Japanese hiragana
            AND yv.title !~ '[ア-ン]'  -- Exclude Japanese katakana
            AND yv.title !~ '[一-龯]'  -- Exclude Chinese/Japanese kanji
            AND yv.title !~ '[À-ÿ]'  -- Exclude accented characters (Italian, French, etc.)
            AND yv.title NOT ILIKE '%volkswagen%'  -- Exclude VW Golf cars
            AND yv.title NOT ILIKE '%vw golf%'
            AND yv.title NOT ILIKE '%gta%'  -- Exclude GTA games
            AND yv.title NOT ILIKE '%forza%'  -- Exclude racing games
            AND yv.title NOT ILIKE '%drive beyond%'  -- Exclude racing games
            AND yv.title NOT ILIKE '%golf cart%'  -- Focus on golf sport, not carts
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
          momentum_score,
          ai_analysis,
          character_analysis,
          captions_preview,
          analysis_status
        FROM trending_candidates
        ORDER BY momentum_score DESC, view_velocity DESC, engagement_rate DESC
        LIMIT 1
      `
      
      const result = await client.query(query, [WHITELISTED_CHANNEL_IDS])
      
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
        views: (video.view_count || 0).toString(),
        likes: (video.like_count || 0).toString(),
        engagement: video.engagement_rate ? `${video.engagement_rate.toFixed(2)}%` : 'N/A',
        published: video.published_at.toISOString().split('T')[0],
        url: `https://youtube.com/watch?v=${video.video_id}`,
        thumbnail: video.thumbnail_url,
        view_velocity: Math.round(video.view_velocity),
        momentum_score: Math.round(video.momentum_score),
        duration_seconds: video.duration_seconds,
        is_short: video.duration_seconds && video.duration_seconds <= 60,
        days_ago: Math.floor((Date.now() - new Date(video.published_at).getTime()) / (1000 * 60 * 60 * 24)),
        // Include AI analysis data
        has_ai_analysis: !!video.ai_analysis,
        analysis_status: video.analysis_status || null,
        ai_summary: video.ai_analysis ? generateSummaryFromAnalysis({
          result: video.ai_analysis,
          character_analysis: video.character_analysis,
          captions_preview: video.captions_preview
        }) : null
      }
      
      return NextResponse.json(videoOfTheDay, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
      
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error fetching video of the day:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}