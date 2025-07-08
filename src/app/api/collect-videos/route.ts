import { NextRequest, NextResponse } from 'next/server'
import { videoService } from '@/lib/video-service'

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const updateOnly = searchParams.get('update_only') === 'true'
    
    let videosProcessed = 0
    const startTime = Date.now()

    if (updateOnly) {
      // Just update existing videos
      videosProcessed = await videoService.updateExistingVideos()
    } else {
      // Collect new videos
      const body = await request.json().catch(() => ({}))
      const searchTerms = body.searchTerms
      
      videosProcessed = await videoService.collectGolfVideos(searchTerms)
    }

    const duration = Date.now() - startTime

    return NextResponse.json({
      message: updateOnly ? 'Videos updated successfully' : 'Videos collected successfully',
      videos_processed: videosProcessed,
      duration_ms: duration,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Video collection failed:', error)
    return NextResponse.json(
      { 
        error: 'Video collection failed', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}