import { NextRequest, NextResponse } from 'next/server'
import { videoService } from '@/lib/video-service'

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const updateOnly = searchParams.get('update_only') === 'true'
    const maxSearches = parseInt(searchParams.get('max_searches') || '3') // Limit searches
    
    let videosProcessed = 0
    const startTime = Date.now()

    if (updateOnly) {
      // Just update existing videos (1 unit per video, much cheaper)
      videosProcessed = await videoService.updateExistingVideos()
    } else {
      // Limited search collection to manage quota
      const body = await request.json().catch(() => ({}))
      const searchTerms = body.searchTerms || [
        'golf', // 100 units
        'Good Good golf', // 100 units  
        'golf highlights' // 100 units
      ] // Total: 300 units instead of 1400

      videosProcessed = await videoService.collectGolfVideos(searchTerms.slice(0, maxSearches))
    }

    const duration = Date.now() - startTime
    const estimatedQuotaUsed = updateOnly ? videosProcessed : (maxSearches * 100)

    return NextResponse.json({
      message: updateOnly ? 'Videos updated efficiently' : 'Videos collected with quota management',
      videos_processed: videosProcessed,
      estimated_quota_used: estimatedQuotaUsed,
      duration_ms: duration,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Efficient video collection failed:', error)
    return NextResponse.json(
      { 
        error: 'Efficient video collection failed', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}