import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/database'

// Simple in-memory cache for summaries (in production, use Redis or similar)
const summaryCache = new Map<string, { summary: string; timestamp: number }>()
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params
    
    // Check cache first
    const cached = summaryCache.get(videoId)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json({ summary: cached.summary })
    }
    
    const client = await pool.connect()
    
    try {
      // First, get video details
      const videoQuery = `
        SELECT 
          yv.title,
          yv.description,
          yc.title as channel_name
        FROM youtube_videos yv
        JOIN youtube_channels yc ON yv.channel_id = yc.id
        WHERE yv.id = $1
      `
      
      const videoResult = await client.query(videoQuery, [videoId])
      
      if (videoResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Video not found' },
          { status: 404 }
        )
      }
      
      const video = videoResult.rows[0]
      
      // Check if we already have an analysis for this video
      const analysisQuery = `
        SELECT va.result, va.character_analysis, va.captions_preview
        FROM video_analyses va
        WHERE va.youtube_url LIKE '%' || $1 || '%'
          AND va.status = 'COMPLETED'
          AND va.result IS NOT NULL
      `
      
      const analysisResult = await client.query(analysisQuery, [videoId])
      
      if (analysisResult.rows.length > 0) {
        const analysis = analysisResult.rows[0]
        const summary = generateSummaryFromAnalysis(analysis, video)
        // Cache it
        summaryCache.set(videoId, { summary, timestamp: Date.now() })
        return NextResponse.json({ summary })
      }
      
      // For now, generate a placeholder summary based on available data
      // In production, this would call the AI service
      const summary = generatePlaceholderSummary(video)
      
      // For placeholder summaries, we don't store them in the database
      // Real AI summaries would be stored in video_analyses table by the backend
      
      // Cache it
      summaryCache.set(videoId, { summary, timestamp: Date.now() })
      
      return NextResponse.json({ summary })
      
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error generating video summary:', error)
    return NextResponse.json(
      { error: 'Failed to generate summary' },
      { status: 500 }
    )
  }
}

function generateSummaryFromAnalysis(analysis: {
  result: string | null
  character_analysis: string | null
  captions_preview?: string | null
}, video?: {
  title: string
  description: string | null
  channel_name: string
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
  
  // Fallback to placeholder if no analysis data
  if (!summary && video) {
    return generatePlaceholderSummary(video)
  }
  
  return summary || 'AI analysis completed but summary content is not available.'
}

function generatePlaceholderSummary(video: {
  title: string
  description: string | null
  channel_name: string
}): string {
  const description = video.description || 'No description available'
  const truncatedDesc = description.length > 200 
    ? description.substring(0, 200) + '...' 
    : description
  
  return `This video "${video.title}" by ${video.channel_name} is a golf-related content piece. ${truncatedDesc}\n\n[AI-powered summary will be generated when the video is processed by our analysis system.]`
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params
    
    // Check cache first
    const cached = summaryCache.get(videoId)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json({ summary: cached.summary })
    }
    
    const client = await pool.connect()
    
    try {
      const query = `
        SELECT va.result, va.character_analysis, va.created_at
        FROM video_analyses va
        WHERE va.youtube_url LIKE '%' || $1 || '%'
          AND va.status = 'COMPLETED'
          AND va.result IS NOT NULL
      `
      
      const result = await client.query(query, [videoId])
      
      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Summary not found' },
          { status: 404 }
        )
      }
      
      const analysis = result.rows[0]
      const summary = generateSummaryFromAnalysis(analysis)
      
      // Cache it
      summaryCache.set(videoId, { summary, timestamp: Date.now() })
      
      return NextResponse.json({ 
        summary,
        generated_at: analysis.created_at
      })
      
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error fetching video summary:', error)
    return NextResponse.json(
      { error: 'Failed to fetch summary' },
      { status: 500 }
    )
  }
}