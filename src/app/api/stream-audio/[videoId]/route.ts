import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/database'

export async function GET(request: NextRequest, { params }: { params: { videoId: string } }) {
  const { videoId } = params
  
  try {
    // Get the transcript summary from database
    const client = await pool.connect()
    
    try {
      const query = `
        SELECT result, status 
        FROM video_analyses 
        WHERE youtube_url LIKE '%' || $1 || '%' 
          AND status = 'COMPLETED' 
          AND result IS NOT NULL
        ORDER BY created_at DESC 
        LIMIT 1
      `
      
      const result = await client.query(query, [videoId])
      
      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'No transcript summary found' }, { status: 404 })
      }
      
      const summary = result.rows[0].result
      
      // Generate audio using ElevenLabs
      const audioResponse = await generateAudioStream(summary)
      
      if (!audioResponse) {
        return NextResponse.json({ error: 'Failed to generate audio' }, { status: 500 })
      }
      
      // Stream the audio directly
      return new NextResponse(audioResponse, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Disposition': `inline; filename="jim-nantz-${videoId}.mp3"`,
          'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
        }
      })
      
    } finally {
      client.release()
    }
    
  } catch (error) {
    console.error('Error streaming audio:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function generateAudioStream(text: string): Promise<ReadableStream | null> {
  try {
    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY
    if (!ELEVENLABS_API_KEY) {
      console.log('ELEVENLABS_API_KEY not configured')
      return null
    }
    
    // Clean the text for audio generation
    const cleanText = text
      .replace(/\[AI-generated from video transcript\]/g, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .trim()
    
    const voiceId = 'TxGEqnHWrfWFTfGW9XjX' // Josh voice ID
    
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: cleanText,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
          style: 0.2,
          use_speaker_boost: true
        }
      })
    })
    
    if (!response.ok) {
      console.error(`ElevenLabs API error: ${response.status} ${response.statusText}`)
      return null
    }
    
    return response.body
    
  } catch (error) {
    console.error('Error generating audio stream:', error)
    return null
  }
}