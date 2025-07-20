import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/database'
import { google } from 'googleapis'

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.GOOGLE_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    // Check if Google API key is configured
    if (!process.env.GOOGLE_API_KEY) {
      return NextResponse.json(
        { error: 'Google API key not configured' },
        { status: 500 }
      )
    }
    
    const client = await pool.connect()
    
    try {
      // Calculate date range for today (in UTC)
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const todayEnd = new Date(todayStart)
      todayEnd.setDate(todayEnd.getDate() + 1)
      
      // Convert to RFC3339 format for YouTube API
      const publishedAfter = todayStart.toISOString()
      const publishedBefore = todayEnd.toISOString()
      
      console.log(`Collecting videos published between ${publishedAfter} and ${publishedBefore}`)
      
      // Search for golf videos published today
      // First, get videos ordered by view count
      const searchResponse = await youtube.search.list({
        part: ['snippet'],
        q: 'golf',
        type: ['video'],
        order: 'viewCount',  // Changed from 'date' to prioritize popular videos
        publishedAfter: publishedAfter,
        publishedBefore: publishedBefore,
        maxResults: 50,
        regionCode: 'US',
        relevanceLanguage: 'en'
      })
      
      if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
        return NextResponse.json({
          message: 'No new golf videos found for today',
          date: todayStart.toISOString().split('T')[0],
          count: 0,
          videos: []
        })
      }
      
      // Get video IDs for detailed stats
      const videoIds = searchResponse.data.items.map(item => item.id?.videoId).filter(Boolean)
      
      // Fetch detailed video statistics
      const videosResponse = await youtube.videos.list({
        part: ['statistics', 'contentDetails', 'snippet'],
        id: videoIds as string[],
      })
      
      const videosWithStats = videosResponse.data.items || []
      let newVideosCount = 0
      let updatedVideosCount = 0
      const collectedVideos = []
      
      // Process each video
      for (const video of videosWithStats) {
        if (!video.id) continue
        
        // Skip non-English videos
        const title = video.snippet?.title || ''
        if (!title.match(/[A-Za-z]/) || 
            title.match(/[あ-ん]/) || 
            title.match(/[ア-ン]/) || 
            title.match(/[一-龯]/) || 
            title.match(/[À-ÿ]/)) {
          continue
        }
        
        const channelId = video.snippet?.channelId
        const channelTitle = video.snippet?.channelTitle || 'Unknown Channel'
        
        // Check if channel exists, if not create it
        const channelQuery = `
          INSERT INTO youtube_channels (id, title)
          VALUES ($1, $2)
          ON CONFLICT (id) DO UPDATE SET title = $2
          RETURNING id
        `
        
        await client.query(channelQuery, [channelId, channelTitle])
        
        // Calculate engagement rate
        const viewCount = parseInt(video.statistics?.viewCount || '0')
        const likeCount = parseInt(video.statistics?.likeCount || '0')
        const engagementRate = viewCount > 0 ? (likeCount / viewCount) * 100 : 0
        
        // Parse duration to seconds
        const duration = video.contentDetails?.duration || 'PT0S'
        const durationMatch = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
        const hours = parseInt(durationMatch?.[1] || '0')
        const minutes = parseInt(durationMatch?.[2] || '0')
        const seconds = parseInt(durationMatch?.[3] || '0')
        const durationSeconds = hours * 3600 + minutes * 60 + seconds
        
        // Insert or update video
        const videoQuery = `
          INSERT INTO youtube_videos (
            id, title, description, channel_id, published_at,
            view_count, like_count, comment_count, engagement_rate,
            duration_seconds, thumbnail_url
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (id) DO UPDATE SET
            view_count = $6,
            like_count = $7,
            comment_count = $8,
            engagement_rate = $9
          RETURNING (xmax = 0) as is_new
        `
        
        const videoResult = await client.query(videoQuery, [
          video.id,
          video.snippet?.title || 'Untitled',
          video.snippet?.description || '',
          channelId,
          video.snippet?.publishedAt,
          viewCount,
          likeCount,
          parseInt(video.statistics?.commentCount || '0'),
          engagementRate,
          durationSeconds,
          video.snippet?.thumbnails?.high?.url || video.snippet?.thumbnails?.default?.url,
        ])
        
        if (videoResult.rows[0]?.is_new) {
          newVideosCount++
        } else {
          updatedVideosCount++
        }
        
        collectedVideos.push({
          id: video.id,
          title: video.snippet?.title,
          channel: channelTitle,
          views: viewCount.toLocaleString(),
          likes: likeCount.toLocaleString(),
          published: video.snippet?.publishedAt,
          engagement: `${engagementRate.toFixed(2)}%`,
          duration: durationSeconds,
          thumbnail: video.snippet?.thumbnails?.high?.url,
          url: `https://youtube.com/watch?v=${video.id}`,
          is_short: durationSeconds <= 60
        })
      }
      
      return NextResponse.json({
        message: `Collected ${newVideosCount} new and updated ${updatedVideosCount} existing golf videos for today`,
        date: todayStart.toISOString().split('T')[0],
        newVideos: newVideosCount,
        updatedVideos: updatedVideosCount,
        totalProcessed: collectedVideos.length,
        videos: collectedVideos
      })
      
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error collecting today\'s videos:', error)
    
    // Provide more specific error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return NextResponse.json(
      { 
        error: 'Failed to collect today\'s videos',
        details: errorMessage,
        hasApiKey: !!process.env.GOOGLE_API_KEY
      },
      { status: 500 }
    )
  }
}

// GET endpoint to retrieve today's collected videos
export async function GET(request: NextRequest) {
  try {
    const client = await pool.connect()
    
    try {
      const today = new Date().toISOString().split('T')[0]
      
      const query = `
        SELECT 
          yv.id,
          yv.title,
          yc.title as channel_name,
          yv.view_count,
          yv.like_count,
          yv.published_at,
          yv.engagement_rate,
          yv.duration_seconds,
          yv.thumbnail_url,
          COUNT(*) OVER() as total_count
        FROM youtube_videos yv
        JOIN youtube_channels yc ON yv.channel_id = yc.id
        WHERE DATE(yv.published_at) = $1
          AND (yv.title ILIKE '%golf%' OR yc.title ILIKE '%golf%' OR yc.title ILIKE '%pga%')
        ORDER BY yv.view_count DESC, yv.published_at DESC
        LIMIT 50
      `
      
      const result = await client.query(query, [today])
      
      const videos = result.rows.map(video => ({
        id: video.id,
        title: video.title,
        channel: video.channel_name,
        views: video.view_count?.toLocaleString() || '0',
        likes: video.like_count?.toLocaleString() || '0',
        published: video.published_at,
        engagement: video.engagement_rate ? `${video.engagement_rate.toFixed(2)}%` : '0%',
        duration: video.duration_seconds,
        thumbnail: video.thumbnail_url,
        url: `https://youtube.com/watch?v=${video.id}`,
        is_short: video.duration_seconds && video.duration_seconds <= 60
      }))
      
      return NextResponse.json({
        date: today,
        count: videos.length,
        videos: videos
      })
      
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error retrieving today\'s videos:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve today\'s videos' },
      { status: 500 }
    )
  }
}