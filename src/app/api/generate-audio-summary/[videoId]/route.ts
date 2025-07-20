import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import pool from '@/lib/database'

// Cache for audio files (in production, use proper file storage)
const audioCache = new Map<string, { audioUrl: string; timestamp: number }>()
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params
    
    // Check cache first
    const cached = audioCache.get(videoId)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json({ audioUrl: cached.audioUrl })
    }
    
    // Get the text summary for this video
    const summary = await getVideoSummary(videoId)
    if (!summary) {
      return NextResponse.json(
        { error: 'No summary found for this video' },
        { status: 404 }
      )
    }
    
    // Generate audio using TopMediai API
    const audioUrl = await generateJimNantzAudio(summary, videoId)
    
    // Cache the result
    audioCache.set(videoId, { audioUrl, timestamp: Date.now() })
    
    return NextResponse.json({ audioUrl })
    
  } catch (error) {
    console.error('Error generating audio summary:', error)
    return NextResponse.json(
      { error: 'Failed to generate audio summary' },
      { status: 500 }
    )
  }
}

async function getVideoSummary(videoId: string): Promise<string | null> {
  const client = await pool.connect()
  
  try {
    // Check for existing transcript-based summary
    const query = `
      SELECT result, captions_preview
      FROM video_analyses
      WHERE youtube_url LIKE '%' || $1 || '%'
        AND status = 'COMPLETED'
        AND (result IS NOT NULL OR captions_preview IS NOT NULL)
      ORDER BY created_at DESC
      LIMIT 1
    `
    
    const result = await client.query(query, [videoId])
    
    if (result.rows.length > 0) {
      const analysis = result.rows[0]
      
      // Try to parse the result JSON first
      if (analysis.result) {
        try {
          const parsed = JSON.parse(analysis.result)
          if (parsed.summary) {
            return parsed.summary
          }
        } catch (error) {
          console.log('Could not parse analysis result')
        }
      }
      
      // Fallback to captions preview
      if (analysis.captions_preview) {
        return analysis.captions_preview
      }
    }
    
    return null
  } finally {
    client.release()
  }
}

async function generateJimNantzAudio(text: string, videoId: string): Promise<string> {
  try {
    // TopMediai API configuration
    const TOPMEDIAI_API_KEY = process.env.TOPMEDIAI_API_KEY
    if (!TOPMEDIAI_API_KEY) {
      throw new Error('TOPMEDIAI_API_KEY not configured')
    }
    
    // Clean the text for audio generation (remove markdown formatting)
    const cleanText = text
      .replace(/\[AI-generated from video transcript\]/g, '')
      .replace(/\*\*/g, '') // Remove bold markdown
      .replace(/\*/g, '')   // Remove italic markdown
      .trim()
    
    // TopMediai TTS API call
    const response = await fetch('https://api.topmediai.com/v1/text-to-speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOPMEDIAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: cleanText,
        voice_id: 'jim_nantz', // This might need to be adjusted based on TopMediai's actual voice ID
        speed: 0.9, // Slightly slower for Jim Nantz's measured pace
        pitch: 0.95, // Slightly lower for gravitas
        output_format: 'mp3'
      })
    })
    
    if (!response.ok) {
      throw new Error(`TopMediai API error: ${response.status} ${response.statusText}`)
    }
    
    const audioData = await response.json()
    
    if (audioData.audio_url) {
      return audioData.audio_url
    } else if (audioData.audio_base64) {
      // If API returns base64, save it as a file and return URL
      return await saveBase64Audio(audioData.audio_base64, videoId)
    } else {
      throw new Error('Unexpected response format from TopMediai API')
    }
    
  } catch (error) {
    console.error('Error generating Jim Nantz audio:', error)
    
    // Fallback: return a placeholder or error
    throw new Error(`Audio generation failed: ${error.message}`)
  }
}

async function saveBase64Audio(base64Audio: string, videoId: string): Promise<string> {
  try {
    // Create audio file in public directory for serving
    const audioDir = path.join(process.cwd(), 'public', 'audio')
    await fs.mkdir(audioDir, { recursive: true })
    
    const fileName = `jim-nantz-${videoId}.mp3`
    const filePath = path.join(audioDir, fileName)
    
    // Convert base64 to buffer and save
    const audioBuffer = Buffer.from(base64Audio, 'base64')
    await fs.writeFile(filePath, audioBuffer)
    
    // Return public URL
    return `/audio/${fileName}`
    
  } catch (error) {
    console.error('Error saving audio file:', error)
    throw error
  }
}

// GET endpoint to retrieve cached audio
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params
    
    const cached = audioCache.get(videoId)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json({ audioUrl: cached.audioUrl })
    }
    
    return NextResponse.json(
      { error: 'No cached audio found' },
      { status: 404 }
    )
    
  } catch (error) {
    console.error('Error retrieving audio:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve audio' },
      { status: 500 }
    )
  }
}