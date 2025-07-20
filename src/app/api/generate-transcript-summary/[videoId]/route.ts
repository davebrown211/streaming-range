import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import pool from '@/lib/database'

// Cache for summaries
const summaryCache = new Map<string, { summary: string; timestamp: number }>()
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params
    
    // Check for existing transcript summary and audio
    const existingData = await getExistingTranscriptSummary(videoId)
    if (existingData) {
      return NextResponse.json({ 
        summary: existingData.summary, 
        audioUrl: existingData.audioUrl 
      })
    }
    
    return NextResponse.json({ summary: null, audioUrl: null })
    
  } catch (error) {
    console.error('Error checking existing transcript summary:', error)
    return NextResponse.json(
      { error: 'Failed to check existing summary' },
      { status: 500 }
    )
  }
}

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
    
    // Check database for existing transcript-based summary
    const existingData = await getExistingTranscriptSummary(videoId)
    if (existingData) {
      summaryCache.set(videoId, { summary: existingData.summary, timestamp: Date.now() })
      return NextResponse.json({ 
        summary: existingData.summary, 
        audioUrl: existingData.audioUrl 
      })
    }
    
    // Download transcript and generate summary
    const summary = await generateTranscriptSummary(videoId)
    
    // Generate Jim Nantz audio alongside the summary
    console.log('Generating audio for video:', videoId)
    const audioUrl = await generateJimNantzAudio(summary, videoId)
    console.log('Audio URL generated:', audioUrl)
    
    // Save both summary and audio to database
    await saveTranscriptSummary(videoId, summary, audioUrl)
    
    // Cache the result
    summaryCache.set(videoId, { summary, timestamp: Date.now() })
    
    return NextResponse.json({ summary, audioUrl })
    
  } catch (error) {
    console.error('Error generating transcript summary:', error)
    return NextResponse.json(
      { error: 'Failed to generate summary' },
      { status: 500 }
    )
  }
}

async function generateTranscriptSummary(videoId: string): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'golf-transcript-'))
  
  try {
    // Download transcript using yt-dlp
    const transcript = await downloadTranscript(videoId, tempDir)
    
    if (!transcript) {
      return "No transcript available for this video. The video may not have captions or subtitles."
    }
    
    // Generate AI summary from transcript
    const summary = await generateAISummary(transcript, videoId)
    
    return summary
    
  } finally {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch (cleanupError) {
      console.error('Error cleaning up temp directory:', cleanupError)
    }
  }
}

async function downloadTranscript(videoId: string, tempDir: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const ytDlpArgs = [
      `https://youtube.com/watch?v=${videoId}`,
      '--skip-download',
      '--write-auto-sub',
      '--write-sub',
      '--sub-langs', 'en,en-US,en-GB',
      '--sub-format', 'vtt',
      '--output', path.join(tempDir, '%(id)s.%(ext)s')
    ]
    
    const ytDlp = spawn('yt-dlp', ytDlpArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    })
    
    let stdout = ''
    let stderr = ''
    
    ytDlp.stdout.on('data', (data) => {
      stdout += data.toString()
    })
    
    ytDlp.stderr.on('data', (data) => {
      stderr += data.toString()
    })
    
    ytDlp.on('close', async (code) => {
      try {
        if (code !== 0) {
          console.error('yt-dlp failed:', stderr)
          resolve(null)
          return
        }
        
        // Look for VTT files
        const vttFiles = [
          path.join(tempDir, `${videoId}.en.vtt`),
          path.join(tempDir, `${videoId}.en-US.vtt`),
          path.join(tempDir, `${videoId}.en-GB.vtt`),
          path.join(tempDir, `${videoId}.vtt`)
        ]
        
        for (const vttFile of vttFiles) {
          try {
            const content = await fs.readFile(vttFile, 'utf-8')
            const transcript = parseVTT(content)
            if (transcript) {
              resolve(transcript)
              return
            }
          } catch (error) {
            // File doesn't exist, try next one
            continue
          }
        }
        
        resolve(null)
      } catch (error) {
        reject(error)
      }
    })
    
    ytDlp.on('error', (error) => {
      reject(error)
    })
  })
}

function parseVTT(vttContent: string): string {
  // Simple VTT parser - extract text and remove timestamps
  const lines = vttContent.split('\n')
  let transcript = ''
  let isTextLine = false
  
  for (const line of lines) {
    const trimmedLine = line.trim()
    
    // Skip header and empty lines
    if (trimmedLine === 'WEBVTT' || trimmedLine === '') {
      isTextLine = false
      continue
    }
    
    // Skip timestamp lines (contain -->)
    if (trimmedLine.includes('-->')) {
      isTextLine = true
      continue
    }
    
    // Skip cue settings lines
    if (trimmedLine.match(/^NOTE\s/)) {
      continue
    }
    
    // If we're expecting text and this line doesn't look like metadata
    if (isTextLine && trimmedLine && !trimmedLine.match(/^\d+$/)) {
      // Remove VTT formatting tags
      const cleanedLine = trimmedLine
        .replace(/<[^>]*>/g, '') // Remove HTML/VTT tags
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .trim()
      
      if (cleanedLine) {
        transcript += cleanedLine + ' '
      }
    }
  }
  
  return transcript.trim()
}

async function generateAISummary(transcript: string, videoId: string): Promise<string> {
  // Get video details for context
  const client = await pool.connect()
  let videoDetails = null
  
  try {
    const videoQuery = `
      SELECT yv.title, yc.title as channel_name
      FROM youtube_videos yv
      JOIN youtube_channels yc ON yv.channel_id = yc.id
      WHERE yv.id = $1
    `
    const result = await client.query(videoQuery, [videoId])
    if (result.rows.length > 0) {
      videoDetails = result.rows[0]
    }
  } finally {
    client.release()
  }
  
  // Use Gemini API for proper text summarization
  const summary = await generateGeminiSummary(transcript, videoDetails)
  
  return summary
}

async function generateGeminiSummary(transcript: string, videoDetails?: any): Promise<string> {
  try {
    // Configure Gemini API
    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY
    if (!GOOGLE_API_KEY) {
      throw new Error('GOOGLE_API_KEY not configured')
    }

    const prompt = `You are channeling the legendary golf announcer Jim Nantz. Analyze this golf video transcript and create a compelling TRAILER-STYLE preview in Jim's distinctive broadcasting style.

Video Details:
${videoDetails ? `Title: "${videoDetails.title}"` : ''}
${videoDetails ? `Channel: ${videoDetails.channel_name}` : ''}

Transcript:
${transcript}

Create a TRAILER-STYLE preview (NOT a full recap) in Jim Nantz's signature style:
- Build anticipation and excitement without revealing outcomes or spoilers
- Focus on what viewers WILL SEE, not what happens
- Tease key moments, players, or situations without giving away results
- Use phrases like "Ladies and gentlemen," "Coming up," "You'll witness," "Hello friends"
- Poetic, measured cadence that creates anticipation
- MAXIMUM 60-75 words (30 seconds of speaking time)
- Think movie trailer energy with Jim's elegant golf sensibility
- End with intrigue that makes people want to watch

Examples of trailer language:
- "Coming up, witness..." 
- "You'll see remarkable..." 
- "Get ready for..." 
- "An unforgettable moment awaits..."

NO SPOILERS. Build excitement for what's TO COME, not what happened.`

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GOOGLE_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.8,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 150,
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const summary = data.candidates[0].content.parts[0].text.trim()
      return summary + '\n\n[AI-generated from video transcript]'
    } else {
      throw new Error('Unexpected response format from Gemini API')
    }

  } catch (error) {
    console.error('Error generating Gemini summary:', error)
    
    // Fallback to a basic summary if Gemini fails
    return createFallbackSummary(transcript, videoDetails)
  }
}

function createFallbackSummary(transcript: string, videoDetails?: any): string {
  if (videoDetails) {
    return `This golf video "${videoDetails.title}" by ${videoDetails.channel_name} discusses golf-related content based on the available transcript. The video appears to cover golf techniques, gameplay, or instruction.\n\n[AI summarization temporarily unavailable - basic summary provided]`
  } else {
    return `This golf video covers various golf-related topics based on the transcript content.\n\n[AI summarization temporarily unavailable - basic summary provided]`
  }
}

async function generateJimNantzAudio(text: string, videoId: string): Promise<string | null> {
  try {
    // ElevenLabs API configuration
    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY
    if (!ELEVENLABS_API_KEY) {
      console.log('ELEVENLABS_API_KEY not configured, skipping audio generation')
      return null
    }
    
    console.log('ElevenLabs API Key found:', ELEVENLABS_API_KEY ? 'Yes' : 'No')
    console.log('Text length for audio:', text.length)
    
    // Clean the text for audio generation (remove markdown formatting)
    const cleanText = text
      .replace(/\[AI-generated from video transcript\]/g, '')
      .replace(/\*\*/g, '') // Remove bold markdown
      .replace(/\*/g, '')   // Remove italic markdown
      .trim()
    
    // Use Grandpa Spuds Oxley voice
    const voiceId = 'NOpBlnGInO9m6vDvFkFC' // Grandpa Spuds Oxley voice ID
    
    // ElevenLabs TTS API call
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: cleanText,
        model_id: 'eleven_multilingual_v2',
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
      const errorText = await response.text()
      console.error('Error details:', errorText)
      return null
    }
    
    // ElevenLabs returns audio as binary data
    const audioBuffer = await response.arrayBuffer()
    
    // Save audio file and return URL
    return await saveAudioBuffer(audioBuffer, videoId)
    
  } catch (error) {
    console.error('Error generating ElevenLabs audio:', error)
    return null // Don't fail the entire request if audio generation fails
  }
}

async function saveAudioBuffer(audioBuffer: ArrayBuffer, videoId: string): Promise<string> {
  const { promises: fs } = require('fs')
  const path = require('path')
  
  try {
    // Create audio file in public directory for serving
    const audioDir = path.join(process.cwd(), 'public', 'audio')
    await fs.mkdir(audioDir, { recursive: true })
    
    const fileName = `jim-nantz-${videoId}.mp3`
    const filePath = path.join(audioDir, fileName)
    
    // Convert ArrayBuffer to Buffer and save
    const buffer = Buffer.from(audioBuffer)
    await fs.writeFile(filePath, buffer)
    
    // Return public URL
    return `/audio/${fileName}`
    
  } catch (error) {
    console.error('Error saving audio file:', error)
    throw error
  }
}


async function getExistingTranscriptSummary(videoId: string): Promise<{ summary: string; audioUrl: string | null } | null> {
  const client = await pool.connect()
  
  try {
    // Check for transcript-based summaries in video_analyses table
    const query = `
      SELECT result, captions_preview, audio_url
      FROM video_analyses
      WHERE youtube_url LIKE '%' || $1 || '%'
        AND status = 'COMPLETED'
        AND transcript_source IS NOT NULL
        AND transcript_source != 'none'
      ORDER BY created_at DESC
      LIMIT 1
    `
    
    const result = await client.query(query, [videoId])
    
    if (result.rows.length > 0) {
      const analysis = result.rows[0]
      
      // If we have a proper analysis result, parse it
      if (analysis.result) {
        try {
          const parsed = JSON.parse(analysis.result)
          if (parsed.summary) {
            return {
              summary: parsed.summary + '\n\n[Generated from video transcript]',
              audioUrl: analysis.audio_url
            }
          }
        } catch (error) {
          console.log('Could not parse existing analysis result')
        }
      }
      
      // Fallback to captions preview if available
      if (analysis.captions_preview) {
        return {
          summary: `Video Content Preview:\n${analysis.captions_preview}\n\n[Generated from video transcript]`,
          audioUrl: analysis.audio_url
        }
      }
    }
    
    return null
  } finally {
    client.release()
  }
}

async function saveTranscriptSummary(videoId: string, summary: string, audioUrl: string | null): Promise<void> {
  const client = await pool.connect()
  
  try {
    const youtubeUrl = `https://youtube.com/watch?v=${videoId}`
    
    // Create a video analysis record with transcript-based summary and audio
    const insertQuery = `
      INSERT INTO video_analyses (
        youtube_url,
        status,
        result,
        transcript_source,
        audio_url,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (youtube_url) 
      DO UPDATE SET 
        result = EXCLUDED.result,
        transcript_source = EXCLUDED.transcript_source,
        audio_url = EXCLUDED.audio_url,
        updated_at = NOW()
    `
    
    const analysisResult = JSON.stringify({
      summary: summary.replace('\n\n[Generated from video transcript]', ''),
      source: 'transcript_analysis',
      generated_at: new Date().toISOString()
    })
    
    await client.query(insertQuery, [
      youtubeUrl,
      'COMPLETED',
      analysisResult,
      'transcript',
      audioUrl
    ])
    
    console.log(`Saved transcript summary and audio for video ${videoId} to database`)
  } catch (error) {
    console.error('Error saving transcript summary to database:', error)
    // Don't throw - we don't want to fail the request if DB save fails
  } finally {
    client.release()
  }
}