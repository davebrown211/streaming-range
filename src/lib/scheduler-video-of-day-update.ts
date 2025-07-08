// Proposed enhancement to scheduler.ts to auto-update video of the day

// Add this method to the Scheduler class:
private async updateVideoOfTheDay() {
  console.log('Updating video of the day stats...', new Date().toISOString())
  
  try {
    const client = await pool.connect()
    
    try {
      // Get the current video of the day
      const query = `
        WITH trending_candidates AS (
          SELECT 
            yv.id,
            CASE 
              WHEN yv.published_at >= CURRENT_DATE THEN yv.view_count * 100000
              WHEN yv.published_at >= NOW() - INTERVAL '24 hours' THEN yv.view_count * 100
              WHEN yv.published_at >= NOW() - INTERVAL '48 hours' THEN yv.view_count * 10
              ELSE yv.view_count * 0.1
            END as momentum_score
          FROM youtube_videos yv
          JOIN youtube_channels yc ON yv.channel_id = yc.id
          WHERE yv.published_at >= NOW() - INTERVAL '7 days'
            AND yv.view_count > 500
            AND yv.engagement_rate > 0.5
            AND yv.thumbnail_url IS NOT NULL
            AND (yv.duration_seconds IS NULL OR yv.duration_seconds > 60)
            AND (yv.title ILIKE '%golf%' OR yc.title ILIKE '%golf%')
        )
        SELECT id
        FROM trending_candidates
        ORDER BY momentum_score DESC, view_velocity DESC
        LIMIT 1
      `
      
      const result = await client.query(query)
      
      if (result.rows.length > 0) {
        const videoId = result.rows[0].id
        
        // Update this specific video
        await videoService.updateVideoBatch([videoId])
        await quotaTracker.recordUsage('video_update', 1)
        
        console.log(`Video of the day updated: ${videoId}`)
      }
      
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Video of the day update failed:', error)
  }
}

// Add this to the scheduler initialization:
// Every 30 minutes: Update video of the day
const vodUpdateTask = cron.schedule('*/30 * * * *', async () => {
  await this.updateVideoOfTheDay()
}, {
  scheduled: false
})

this.tasks.set('vodUpdate', vodUpdateTask)
vodUpdateTask.start()