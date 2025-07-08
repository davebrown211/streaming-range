import { NextResponse } from 'next/server'
import { YouTubeClient } from '@/lib/youtube-client'

export async function GET() {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY
    
    if (!apiKey) {
      return NextResponse.json({
        error: 'No YouTube API key found',
        message: 'Set YOUTUBE_API_KEY or GOOGLE_API_KEY environment variable',
        env_check: {
          YOUTUBE_API_KEY: !!process.env.YOUTUBE_API_KEY,
          GOOGLE_API_KEY: !!process.env.GOOGLE_API_KEY
        }
      }, { status: 400 })
    }

    const client = new YouTubeClient(apiKey)
    
    // Test with a simple search
    const videos = await client.searchGolfVideos('golf', 5)
    
    return NextResponse.json({
      message: 'YouTube API connection successful',
      api_key_present: true,
      videos_found: videos.length,
      sample_video: videos[0] ? {
        title: videos[0].title,
        channel: videos[0].channel_title,
        views: videos[0].view_count
      } : null
    })

  } catch (error) {
    return NextResponse.json({
      error: 'YouTube API test failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      api_key_present: !!(process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY)
    }, { status: 500 })
  }
}