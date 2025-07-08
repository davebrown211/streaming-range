import { NextRequest, NextResponse } from 'next/server'
import { channelMonitor } from '@/lib/channel-monitor'
import { quotaTracker } from '@/lib/quota-tracker'

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '5')
    
    // Check current quota usage
    const quotaUsage = await quotaTracker.getTodayUsage()
    
    // Check channels for new videos
    const newVideos = await channelMonitor.checkChannelsForNewVideos(limit)
    
    // Get updated quota usage
    const updatedQuotaUsage = await quotaTracker.getTodayUsage()
    
    return NextResponse.json({
      message: 'Channel check completed',
      channels_checked: limit,
      new_videos_found: newVideos,
      quota_used: updatedQuotaUsage.units_used - quotaUsage.units_used,
      total_quota_today: updatedQuotaUsage.units_used,
      quota_remaining: 10000 - updatedQuotaUsage.units_used
    })
  } catch (error) {
    console.error('Channel check failed:', error)
    return NextResponse.json(
      { 
        error: 'Channel check failed', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}