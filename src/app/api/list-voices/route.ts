import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY
    
    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json({ error: 'ElevenLabs API key not found' }, { status: 500 })
    }
    
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
      },
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json({ 
        error: 'Failed to fetch voices', 
        status: response.status,
        details: errorText 
      }, { status: 500 })
    }
    
    const data = await response.json()
    
    // Format the response to show voice names and IDs
    const voices = data.voices.map((voice: any) => ({
      voice_id: voice.voice_id,
      name: voice.name,
      category: voice.category,
      description: voice.description,
      preview_url: voice.preview_url,
      available_for_tiers: voice.available_for_tiers
    }))
    
    return NextResponse.json({ voices })
    
  } catch (error) {
    console.error('Error fetching voices:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch voices', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}