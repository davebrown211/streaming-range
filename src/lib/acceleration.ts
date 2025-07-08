import pool from './database'

export interface ViewCountSnapshot {
  video_id: string
  view_count: number
  recorded_at: Date
}

export async function calculateViewAcceleration(videoId: string): Promise<number> {
  const client = await pool.connect()
  
  try {
    // Get the last 3 data points for this video (minimum needed for acceleration)
    const query = `
      SELECT view_count, recorded_at
      FROM video_view_history 
      WHERE video_id = $1 
      ORDER BY recorded_at DESC 
      LIMIT 3
    `
    
    const result = await client.query(query, [videoId])
    
    if (result.rows.length < 3) {
      return 0 // Not enough data points
    }
    
    const points = result.rows.map(row => ({
      views: parseInt(row.view_count),
      time: new Date(row.recorded_at).getTime()
    })).reverse() // Oldest first
    
    // Calculate velocities between consecutive points
    const velocity1 = (points[1].views - points[0].views) / (points[1].time - points[0].time)
    const velocity2 = (points[2].views - points[1].views) / (points[2].time - points[1].time)
    
    // Acceleration = change in velocity / time
    const acceleration = (velocity2 - velocity1) / (points[2].time - points[1].time)
    
    // Convert to views per hour squared for meaningful scale
    return acceleration * (1000 * 60 * 60) * (1000 * 60 * 60)
    
  } finally {
    client.release()
  }
}

export async function updateAllVideoAccelerations(): Promise<void> {
  const client = await pool.connect()
  
  try {
    // Get all videos that have been updated recently
    const videosQuery = `
      SELECT DISTINCT video_id 
      FROM video_view_history 
      WHERE recorded_at >= NOW() - INTERVAL '7 days'
    `
    
    const videosResult = await client.query(videosQuery)
    
    for (const row of videosResult.rows) {
      const acceleration = await calculateViewAcceleration(row.video_id)
      
      // Update the video's acceleration score
      await client.query(
        'UPDATE youtube_videos SET view_acceleration = $1 WHERE id = $2',
        [acceleration, row.video_id]
      )
    }
    
  } finally {
    client.release()
  }
}

export async function recordViewSnapshot(videoId: string, viewCount: number): Promise<void> {
  const client = await pool.connect()
  
  try {
    await client.query(
      'INSERT INTO video_view_history (video_id, view_count) VALUES ($1, $2)',
      [videoId, viewCount]
    )
  } finally {
    client.release()
  }
}

export async function getTrendingScore(videoId: string): Promise<number> {
  const client = await pool.connect()
  
  try {
    const query = `
      SELECT 
        yv.view_count,
        yv.view_velocity,
        yv.view_acceleration,
        yv.published_at,
        yv.engagement_rate
      FROM youtube_videos yv
      WHERE yv.id = $1
    `
    
    const result = await client.query(query, [videoId])
    
    if (result.rows.length === 0) return 0
    
    const video = result.rows[0]
    const hoursSincePublished = (Date.now() - new Date(video.published_at).getTime()) / (1000 * 60 * 60)
    
    // Trending score combines multiple factors:
    // - View acceleration (most important)
    // - View velocity 
    // - Engagement rate
    // - Recency boost (newer videos get higher scores)
    
    const accelerationScore = Math.max(0, video.view_acceleration) * 100
    const velocityScore = video.view_velocity * 10
    const engagementScore = video.engagement_rate * 50
    const recencyBoost = Math.max(0, (168 - hoursSincePublished)) / 168 * 1000 // 168 hours = 1 week
    
    return accelerationScore + velocityScore + engagementScore + recencyBoost
    
  } finally {
    client.release()
  }
}