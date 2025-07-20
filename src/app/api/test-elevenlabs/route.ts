import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY
    
    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json({ error: 'ElevenLabs API key not found' }, { status: 500 })
    }
    
    // Test with a simple text
    const voiceId = 'NOpBlnGInO9m6vDvFkFC' // Grandpa Spuds Oxley voice ID
    const testText = 'Hello, this is a test of the ElevenLabs API integration.'
    
    console.log('Testing ElevenLabs API with key:', ELEVENLABS_API_KEY.substring(0, 10) + '...')
    
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: testText,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
          style: 0.2,
          use_speaker_boost: true
        }
      })
    })
    
    console.log('ElevenLabs response status:', response.status)
    console.log('ElevenLabs response headers:', Object.fromEntries(response.headers.entries()))
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('ElevenLabs error:', errorText)
      return NextResponse.json({ 
        error: 'ElevenLabs API error', 
        status: response.status,
        details: errorText 
      }, { status: 500 })
    }
    
    const contentType = response.headers.get('content-type')
    console.log('Content type:', contentType)
    
    return NextResponse.json({ 
      success: true, 
      message: 'ElevenLabs API test successful',
      contentType: contentType,
      hasApiKey: !!ELEVENLABS_API_KEY
    })
    
  } catch (error) {
    console.error('Test error:', error)
    return NextResponse.json({ 
      error: 'Test failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}