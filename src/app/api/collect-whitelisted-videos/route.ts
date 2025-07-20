import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/database'
import { google } from 'googleapis'
import { WHITELISTED_CHANNEL_IDS } from '@/lib/content-whitelist'

interface VideoData {
  id: string
  title: string
  description: string
  channel_id: string
  channel_title: string
  published_at: string
  view_count: number
  like_count: number
  comment_count: number
  engagement_rate: number
  view_velocity: number
  duration_seconds: number | null
  thumbnail_url: string
  category: string
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const maxVideosPerChannel = parseInt(searchParams.get('max_videos') || '10')
  const daysBack = parseInt(searchParams.get('days_back') || '7')
  const channelIdsParam = searchParams.get('channel_ids')
  
  // Allow override of channel IDs via parameter, otherwise use whitelist
  const channelIds = channelIdsParam ? 
    channelIdsParam.split(',').map(id => id.trim()) : 
    WHITELISTED_CHANNEL_IDS

  try {
    const apiKey = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY
    
    if (!apiKey) {
      return NextResponse.json({
        error: 'YouTube API key not configured'
      }, { status: 500 })
    }

    const youtube = google.youtube({
      version: 'v3',
      auth: apiKey
    })

    const client = await pool.connect()
    
    try {
      console.log(`🎬 Collecting videos from ${channelIds.length} whitelisted channels using batch API calls...`)
      
      let totalVideosProcessed = 0
      let totalVideosAdded = 0
      let totalVideosUpdated = 0
      const channelResults = []
      
      // Calculate date threshold
      const dateThreshold = new Date()
      dateThreshold.setDate(dateThreshold.getDate() - daysBack)
      
      // STEP 1: Batch create/update all channels at once
      console.log(`📺 Batch processing ${channelIds.length} channels...`)
      await ensureChannelsExist(client, youtube, channelIds)
      
      // STEP 2: Get all videos from all channels in batches
      const allVideos = await getAllChannelVideosBatch(youtube, channelIds, maxVideosPerChannel, dateThreshold)
      
      console.log(`🎥 Found ${allVideos.length} total videos across all channels`)
      
      // STEP 3: Batch upsert all videos
      const channelVideoCount: Record<string, { found: number, added: number, updated: number }> = {}
      
      for (const channelId of channelIds) {
        channelVideoCount[channelId] = { found: 0, added: 0, updated: 0 }
      }
      
      for (const videoData of allVideos) {
        try {
          const result = await upsertVideo(client, videoData)
          if (result === 'inserted') {
            totalVideosAdded++
            channelVideoCount[videoData.channel_id].added++
          } else if (result === 'updated') {
            totalVideosUpdated++
            channelVideoCount[videoData.channel_id].updated++
          }
          channelVideoCount[videoData.channel_id].found++
          totalVideosProcessed++
        } catch (error) {
          console.error(`❌ Error upserting video ${videoData.id}:`, error)
        }
      }
      
      // Build results
      for (const channelId of channelIds) {
        const counts = channelVideoCount[channelId]
        channelResults.push({
          channel_id: channelId,
          videos_found: counts.found,
          videos_added: counts.added,
          videos_updated: counts.updated,
          status: 'success'
        })
        console.log(`   ✅ ${channelId}: ${counts.found} videos (${counts.added} new, ${counts.updated} updated)`)
      }

      return NextResponse.json({
        message: 'Whitelisted video collection completed',
        summary: {
          channels_processed: channelIds.length,
          total_videos_processed: totalVideosProcessed,
          total_videos_added: totalVideosAdded,
          total_videos_updated: totalVideosUpdated,
          success_channels: channelResults.filter(r => r.status === 'success').length,
          error_channels: channelResults.filter(r => r.status === 'error').length
        },
        channel_results: channelResults,
        parameters: {
          max_videos_per_channel: maxVideosPerChannel,
          days_back: daysBack,
          channels_targeted: channelIds.length
        },
        timestamp: new Date().toISOString()
      })

    } finally {
      client.release()
    }

  } catch (error) {
    console.error('Whitelisted video collection error:', error)
    return NextResponse.json({
      error: 'Failed to collect whitelisted videos',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function ensureChannelsExist(client: any, youtube: any, channelIds: string[]) {
  // Check which channels are missing from database
  const existingChannels = await client.query(
    'SELECT id FROM youtube_channels WHERE id = ANY($1::text[])',
    [channelIds]
  )
  
  const existingIds = existingChannels.rows.map((row: any) => row.id)
  const missingIds = channelIds.filter(id => !existingIds.includes(id))
  
  if (missingIds.length === 0) {
    console.log(`   ✅ All ${channelIds.length} channels already exist in database`)
    return
  }
  
  console.log(`   📍 Adding ${missingIds.length} new channels to database`)
  
  // Batch fetch channel details from YouTube (up to 50 at once)
  for (let i = 0; i < missingIds.length; i += 50) {
    const batch = missingIds.slice(i, i + 50)
    
    const channelResponse = await youtube.channels.list({
      part: ['snippet', 'statistics'],
      id: batch.join(',')
    })
    
    for (const channelData of channelResponse.data.items || []) {
      await client.query(`
        INSERT INTO youtube_channels (
          id, title, description, subscriber_count, video_count, view_count, 
          thumbnail_url, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          subscriber_count = EXCLUDED.subscriber_count,
          updated_at = NOW()
      `, [
        channelData.id,
        channelData.snippet.title,
        channelData.snippet.description || '',
        parseInt(channelData.statistics?.subscriberCount || '0'),
        parseInt(channelData.statistics?.videoCount || '0'),
        parseInt(channelData.statistics?.viewCount || '0'),
        channelData.snippet.thumbnails?.default?.url || null
      ])
    }
  }
}

async function getAllChannelVideosBatch(
  youtube: any, 
  channelIds: string[], 
  maxResults: number, 
  dateThreshold: Date
): Promise<VideoData[]> {
  
  console.log(`🔍 Getting upload playlists for ${channelIds.length} channels...`)
  
  // STEP 1: Get all upload playlists in batches (up to 50 channels at once)
  const channelUploadPlaylists: Record<string, string> = {}
  
  for (let i = 0; i < channelIds.length; i += 50) {
    const batch = channelIds.slice(i, i + 50)
    
    const channelResponse = await youtube.channels.list({
      part: ['contentDetails'],
      id: batch.join(',')
    })

    for (const item of channelResponse.data.items || []) {
      const uploadsPlaylistId = item.contentDetails?.relatedPlaylists?.uploads
      if (uploadsPlaylistId) {
        channelUploadPlaylists[item.id] = uploadsPlaylistId
      }
    }
  }
  
  console.log(`📋 Found upload playlists for ${Object.keys(channelUploadPlaylists).length} channels`)
  
  // STEP 2: Get recent video IDs from all playlists
  const allVideoIds: string[] = []
  
  for (const [channelId, playlistId] of Object.entries(channelUploadPlaylists)) {
    try {
      const playlistResponse = await youtube.playlistItems.list({
        part: ['snippet'],
        playlistId: playlistId,
        maxResults: maxResults * 2, // Get more to filter by date
        order: 'date'
      })

      const videoItems = playlistResponse.data.items || []
      
      // Filter by date and get video IDs
      const recentVideoIds = videoItems
        .filter((item: any) => {
          const publishedAt = new Date(item.snippet.publishedAt)
          return publishedAt >= dateThreshold
        })
        .map((item: any) => item.snippet.resourceId.videoId)
        .slice(0, maxResults) // Limit to requested amount

      allVideoIds.push(...recentVideoIds)
      
      // Rate limiting between playlist requests
      if (Object.keys(channelUploadPlaylists).length > 5) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
    } catch (error) {
      console.error(`❌ Error getting playlist ${playlistId} for channel ${channelId}:`, error)
    }
  }
  
  if (allVideoIds.length === 0) {
    console.log('⚠️  No recent videos found across all channels')
    return []
  }
  
  console.log(`🎥 Found ${allVideoIds.length} recent videos, getting detailed information...`)
  
  // STEP 3: Get detailed video information in batches (up to 50 videos at once)
  const allVideos: VideoData[] = []
  
  for (let i = 0; i < allVideoIds.length; i += 50) {
    const batch = allVideoIds.slice(i, i + 50)
    
    try {
      const videosResponse = await youtube.videos.list({
        part: ['snippet', 'statistics', 'contentDetails'],
        id: batch.join(',')
      })

      for (const item of videosResponse.data.items || []) {
        try {
          const video = processVideoData(item)
          if (video) {
            allVideos.push(video)
          }
        } catch (error) {
          console.error('Error processing individual video:', error)
        }
      }
      
      // Rate limiting between batch requests
      if (allVideoIds.length > 50) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
      
    } catch (error) {
      console.error(`❌ Error getting video details for batch ${i / 50 + 1}:`, error)
    }
  }

  return allVideos
}

function processVideoData(item: any): VideoData | null {
  try {
    const snippet = item.snippet
    const stats = item.statistics
    const contentDetails = item.contentDetails

    // Parse duration (PT1H2M10S format)
    const duration = contentDetails.duration
    let durationSeconds: number | null = null
    if (duration) {
      const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
      if (match) {
        const hours = parseInt(match[1] || '0')
        const minutes = parseInt(match[2] || '0')
        const seconds = parseInt(match[3] || '0')
        durationSeconds = hours * 3600 + minutes * 60 + seconds
      }
    }

    const views = parseInt(stats.viewCount || '0')
    const likes = parseInt(stats.likeCount || '0')
    const comments = parseInt(stats.commentCount || '0')
    
    // Calculate engagement rate
    const engagementRate = views > 0 ? ((likes + comments) / views) * 100 : 0
    
    // Calculate view velocity (views per day since upload)
    const publishedAt = new Date(snippet.publishedAt)
    const daysSinceUpload = Math.max(1, (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60 * 24))
    const viewVelocity = views / daysSinceUpload

    // Auto-categorize based on title and description
    const content = (snippet.title + ' ' + snippet.description).toLowerCase()
    let category = 'general'
    if (content.includes('instruction') || content.includes('lesson') || content.includes('tip')) {
      category = 'instruction'
    } else if (content.includes('review') || content.includes('test') || content.includes('equipment')) {
      category = 'equipment'
    } else if (content.includes('highlights') || content.includes('tournament')) {
      category = 'highlights'
    } else if (content.includes('vlog') || content.includes('course') || content.includes('round')) {
      category = 'vlog'
    }

    const video: VideoData = {
      id: item.id,
      title: snippet.title,
      description: (snippet.description || '').substring(0, 1000), // Truncate long descriptions
      channel_id: snippet.channelId,
      channel_title: snippet.channelTitle,
      published_at: snippet.publishedAt,
      view_count: views,
      like_count: likes,
      comment_count: comments,
      engagement_rate: engagementRate,
      view_velocity: viewVelocity,
      duration_seconds: durationSeconds,
      thumbnail_url: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || '',
      category
    }

    return video

  } catch (error) {
    console.error('Error processing video data:', error)
    return null
  }
}

async function upsertVideo(client: any, video: VideoData): Promise<'inserted' | 'updated' | 'unchanged'> {
  try {
    // Check if video exists
    const existingVideo = await client.query(
      'SELECT id, view_count, like_count, comment_count FROM youtube_videos WHERE id = $1',
      [video.id]
    )

    if (existingVideo.rows.length === 0) {
      // Insert new video
      await client.query(`
        INSERT INTO youtube_videos (
          id, title, description, channel_id, published_at, view_count, like_count,
          comment_count, engagement_rate, view_velocity, duration_seconds, 
          thumbnail_url, category, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
      `, [
        video.id, video.title, video.description, video.channel_id, video.published_at,
        video.view_count, video.like_count, video.comment_count, video.engagement_rate,
        video.view_velocity, video.duration_seconds, video.thumbnail_url, video.category
      ])
      
      return 'inserted'
    } else {
      // Update existing video stats
      const existing = existingVideo.rows[0]
      
      // Only update if stats have changed significantly
      const viewDiff = Math.abs(existing.view_count - video.view_count)
      const likeDiff = Math.abs(existing.like_count - video.like_count)
      
      if (viewDiff > 10 || likeDiff > 0) {
        await client.query(`
          UPDATE youtube_videos SET
            view_count = $2,
            like_count = $3,
            comment_count = $4,
            engagement_rate = $5,
            view_velocity = $6,
            updated_at = NOW()
          WHERE id = $1
        `, [
          video.id, video.view_count, video.like_count, video.comment_count,
          video.engagement_rate, video.view_velocity
        ])
        
        return 'updated'
      }
      
      return 'unchanged'
    }

  } catch (error) {
    console.error('Error upserting video:', error)
    throw error
  }
}

// GET endpoint for testing/status
export async function GET() {
  return NextResponse.json({
    message: 'Whitelisted video collection endpoint',
    description: 'POST to collect videos from whitelisted channels using YouTube Data API',
    whitelisted_channels: WHITELISTED_CHANNEL_IDS.length,
    usage: {
      endpoint: '/api/collect-whitelisted-videos',
      method: 'POST',
      parameters: {
        max_videos: 'Number of videos per channel (default: 10)',
        days_back: 'How many days back to look (default: 7)',
        channel_ids: 'Comma-separated channel IDs (optional, defaults to whitelist)'
      },
      examples: [
        'POST /api/collect-whitelisted-videos',
        'POST /api/collect-whitelisted-videos?max_videos=5&days_back=3',
        'POST /api/collect-whitelisted-videos?channel_ids=UCfi-mPMOmche6WI-jkvnGXw,UCqr4sONkmFEOPc3rfoVLEvg'
      ]
    }
  })
}