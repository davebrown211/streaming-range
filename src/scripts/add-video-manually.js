const { Pool } = require('pg')
const { google } = require('googleapis')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:mysecretpassword@localhost/postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

async function addVideoManually(videoId) {
  const client = await pool.connect()
  
  try {
    // Initialize YouTube API
    const apiKey = process.env.GOOGLE_API_KEY || 'AIzaSyCx-_bIRPkMoOquZALZPsV9e05oTuTrAiE'
    const youtube = google.youtube({
      version: 'v3',
      auth: apiKey
    })
    
    // Get video details
    const response = await youtube.videos.list({
      part: ['snippet', 'statistics', 'contentDetails'],
      id: videoId
    })
    
    const videos = response.data.items || []
    
    if (videos.length === 0) {
      console.error('Video not found')
      return
    }
    
    const item = videos[0]
    const video = {
      id: item.id,
      title: item.snippet.title,
      description: item.snippet.description || '',
      channel_id: item.snippet.channelId,
      channel_title: item.snippet.channelTitle,
      published_at: item.snippet.publishedAt,
      view_count: parseInt(item.statistics.viewCount || '0'),
      like_count: parseInt(item.statistics.likeCount || '0'),
      comment_count: parseInt(item.statistics.commentCount || '0'),
      duration: item.contentDetails.duration,
      thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || ''
    }
    
    console.log('Found video:', video.title)
    
    // First, ensure channel exists
    const channelResult = await client.query(
      `INSERT INTO youtube_channels (id, title, subscriber_count)
       VALUES ($1, $2, 0)
       ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title
       RETURNING id`,
      [video.channel_id, video.channel_title]
    )
    
    console.log('Channel ensured:', video.channel_title)
    
    // Calculate duration in seconds
    const durationMatch = video.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
    const hours = parseInt(durationMatch[1] || 0)
    const minutes = parseInt(durationMatch[2] || 0)
    const seconds = parseInt(durationMatch[3] || 0)
    const durationSeconds = hours * 3600 + minutes * 60 + seconds
    
    // Insert video
    const videoResult = await client.query(
      `INSERT INTO youtube_videos (
        id, channel_id, title, description, published_at,
        view_count, like_count, comment_count, duration_seconds,
        thumbnail_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        view_count = EXCLUDED.view_count,
        like_count = EXCLUDED.like_count,
        comment_count = EXCLUDED.comment_count,
        updated_at = NOW()
      RETURNING id`,
      [
        video.id,
        video.channel_id,
        video.title,
        video.description,
        video.published_at,
        video.view_count,
        video.like_count,
        video.comment_count,
        durationSeconds,
        video.thumbnail
      ]
    )
    
    console.log('Video added/updated successfully!')
    console.log('Video ID:', videoResult.rows[0].id)
    console.log('Views:', video.view_count.toLocaleString())
    console.log('Likes:', video.like_count.toLocaleString())
    console.log('Published:', new Date(video.published_at).toLocaleString())
    
  } catch (error) {
    console.error('Error adding video:', error)
  } finally {
    client.release()
    await pool.end()
  }
}

// Run with the Bob Does Sports video
addVideoManually('bC7XBqzx2N0')