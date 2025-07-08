import { NextRequest, NextResponse } from 'next/server'
import { channelMonitor } from '@/lib/channel-monitor'

export async function POST(request: NextRequest) {
  try {
    // Initialize channel monitoring system
    await channelMonitor.initializeChannels()
    
    // Discover additional channels from existing videos
    await channelMonitor.discoverChannelsFromVideos()
    
    // Get all monitored channels
    const channels = await channelMonitor.getMonitoredChannels()
    
    return NextResponse.json({
      message: 'Channel monitoring initialized',
      channels_count: channels.length,
      high_priority: channels.filter(c => c.priority === 'high').length,
      medium_priority: channels.filter(c => c.priority === 'medium').length,
      channels: channels.slice(0, 10) // Show first 10 as sample
    })
  } catch (error) {
    console.error('Channel initialization failed:', error)
    return NextResponse.json(
      { 
        error: 'Channel initialization failed', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}