import cron from 'node-cron'
import { updateAllVideoAccelerations, recordViewSnapshot } from './acceleration'
import { wsServer } from './websocket-server'
import pool from './database'
import { channelMonitor } from './channel-monitor'
import { videoService } from './video-service'
import { quotaTracker } from './quota-tracker'

class GolfDirectoryScheduler {
  private tasks: Map<string, cron.ScheduledTask> = new Map()
  private isRunning = false

  start() {
    if (this.isRunning) {
      console.log('Scheduler already running')
      return
    }

    console.log('Starting Golf Directory scheduler...')
    this.isRunning = true

    // Every 5 minutes: High-frequency updates for trending detection
    const highFreqTask = cron.schedule('*/5 * * * *', async () => {
      await this.performHighFrequencyUpdate()
    }, {
      scheduled: false
    })

    // Every 15 minutes: Full data update with acceleration calculation
    const mainTask = cron.schedule('*/15 * * * *', async () => {
      await this.performDataUpdate()
    }, {
      scheduled: false
    })

    // Every hour: Check channels for new videos
    const channelTask = cron.schedule('0 * * * *', async () => {
      await this.performChannelCheck()
    }, {
      scheduled: false
    })

    // Every 4 hours: Batch update all video stats efficiently
    const batchUpdateTask = cron.schedule('0 */4 * * *', async () => {
      await this.performBatchVideoUpdate()
    }, {
      scheduled: false
    })

    // Every 2 minutes during peak hours (8 AM - 11 PM): Ultra-frequent for viral detection
    const viralDetectionTask = cron.schedule('*/2 8-23 * * *', async () => {
      await this.performViralDetection()
    }, {
      scheduled: false
    })

    // Every 30 seconds: Broadcast current rankings (lightweight)
    const broadcastTask = cron.schedule('*/30 * * * * *', async () => {
      await this.broadcastCurrentRankings()
    }, {
      scheduled: false
    })

    this.tasks.set('highFreq', highFreqTask)
    this.tasks.set('main', mainTask)
    this.tasks.set('channel', channelTask)
    this.tasks.set('batchUpdate', batchUpdateTask)
    this.tasks.set('viral', viralDetectionTask)
    this.tasks.set('broadcast', broadcastTask)

    // Start all tasks
    highFreqTask.start()
    mainTask.start()
    channelTask.start()
    batchUpdateTask.start()
    viralDetectionTask.start()
    broadcastTask.start()

    console.log('Scheduler tasks started:')
    console.log('- High frequency: Every 5 minutes')
    console.log('- Main updates: Every 15 minutes') 
    console.log('- Channel checks: Every hour')
    console.log('- Batch updates: Every 4 hours')
    console.log('- Viral detection: Every 2 min (8 AM - 11 PM)')
    console.log('- Broadcasts: Every 30 seconds')
  }

  stop() {
    console.log('Stopping scheduler...')
    this.tasks.forEach((task, name) => {
      task.stop()
      console.log(`Stopped task: ${name}`)
    })
    this.tasks.clear()
    this.isRunning = false
  }

  private async performHighFrequencyUpdate() {
    console.log('High-frequency update...', new Date().toISOString())
    
    try {
      const client = await pool.connect()
      
      try {
        // Focus on recently published videos (last 24 hours) for high-frequency monitoring
        const query = `
          SELECT id, view_count, title
          FROM youtube_videos 
          WHERE published_at >= NOW() - INTERVAL '24 hours'
          ORDER BY published_at DESC
          LIMIT 100
        `
        
        const result = await client.query(query)
        
        // Record snapshots for recent videos only
        for (const video of result.rows) {
          try {
            await recordViewSnapshot(video.id, video.view_count)
          } catch (error) {
            console.error(`High-freq snapshot error for ${video.id}:`, error)
          }
        }
        
        console.log(`High-freq update: ${result.rows.length} recent videos processed`)
        
      } finally {
        client.release()
      }
    } catch (error) {
      console.error('High-frequency update failed:', error)
    }
  }

  private async performViralDetection() {
    console.log('Viral detection scan...', new Date().toISOString())
    
    try {
      const client = await pool.connect()
      
      try {
        // Focus on videos with potential for viral growth (last 7 days, >1k views)
        const query = `
          SELECT id, view_count, title, published_at
          FROM youtube_videos 
          WHERE published_at >= NOW() - INTERVAL '7 days'
            AND view_count > 1000
            AND view_count < 10000000
          ORDER BY view_velocity DESC, view_count DESC
          LIMIT 50
        `
        
        const result = await client.query(query)
        
        // Record snapshots for potentially viral content
        for (const video of result.rows) {
          try {
            await recordViewSnapshot(video.id, video.view_count)
          } catch (error) {
            console.error(`Viral detection snapshot error for ${video.id}:`, error)
          }
        }
        
        console.log(`Viral detection: ${result.rows.length} potential viral videos tracked`)
        
      } finally {
        client.release()
      }
    } catch (error) {
      console.error('Viral detection failed:', error)
    }
  }

  private async performDataUpdate() {
    const startTime = Date.now()
    console.log('Starting scheduled data update...', new Date().toISOString())

    try {
      const client = await pool.connect()
      
      try {
        // Get videos that need acceleration calculation (have enough snapshots)
        const query = `
          SELECT DISTINCT yv.id, yv.view_count, yv.title
          FROM youtube_videos yv
          WHERE (yv.updated_at >= NOW() - INTERVAL '2 hours'
             OR yv.published_at >= NOW() - INTERVAL '3 days')
          AND EXISTS (
            SELECT 1 FROM video_view_history vvh 
            WHERE vvh.video_id = yv.id 
            AND vvh.recorded_at >= NOW() - INTERVAL '2 hours'
          )
          ORDER BY yv.updated_at DESC
          LIMIT 200
        `
        
        const result = await client.query(query)
        let snapshotsRecorded = 0
        
        // Record snapshots
        for (const video of result.rows) {
          try {
            await recordViewSnapshot(video.id, video.view_count)
            snapshotsRecorded++
          } catch (error) {
            console.error(`Snapshot error for ${video.id}:`, error)
          }
        }
        
        // Calculate accelerations
        await updateAllVideoAccelerations()
        
        // Broadcast updates
        await this.broadcastCurrentRankings()
        
        const duration = Date.now() - startTime
        const summary = {
          videos_processed: result.rows.length,
          snapshots_recorded: snapshotsRecorded,
          duration_ms: duration,
          timestamp: new Date().toISOString()
        }
        
        console.log('Data update completed:', summary)
        
        // Broadcast update notification
        wsServer.broadcastStatsUpdate({
          message: 'Scheduled update completed',
          ...summary
        })
        
      } finally {
        client.release()
      }
    } catch (error) {
      console.error('Scheduled update failed:', error)
      wsServer.broadcastStatsUpdate({
        message: 'Scheduled update failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  }

  private async broadcastCurrentRankings() {
    try {
      const rankingTypes = ['all_time_views', 'weekly_trending', 'high_engagement']
      
      for (const type of rankingTypes) {
        try {
          // Fetch current rankings from database directly (no HTTP call)
          const client = await pool.connect()
          
          let query: string
          let params: any[] = [3] // limit to 3
          
          if (type === 'all_time_views') {
            query = `
              SELECT 
                ROW_NUMBER() OVER (ORDER BY yv.view_count DESC) as rank,
                yv.title, yc.title as channel, yv.view_count, yv.like_count,
                yv.engagement_rate, yv.published_at, yv.id as video_id, yv.thumbnail_url
              FROM youtube_videos yv
              JOIN youtube_channels yc ON yv.channel_id = yc.id
              WHERE yv.published_at >= NOW() - INTERVAL '7 days' AND yv.view_count > 50000
              ORDER BY yv.view_count DESC LIMIT $1
            `
          } else if (type === 'weekly_trending') {
            query = `
              SELECT 
                ROW_NUMBER() OVER (ORDER BY 
                  (COALESCE(yv.view_acceleration, 0) * 100) + (yv.view_velocity * 10) + 
                  (yv.engagement_rate * 50) + (GREATEST(0, (168 - EXTRACT(EPOCH FROM (NOW() - yv.published_at))/3600)) / 168 * 1000)
                  DESC
                ) as rank,
                yv.title, yc.title as channel, yv.view_count, yv.like_count,
                yv.engagement_rate, yv.published_at, yv.id as video_id, yv.thumbnail_url
              FROM youtube_videos yv
              JOIN youtube_channels yc ON yv.channel_id = yc.id
              WHERE yv.published_at >= NOW() - INTERVAL '14 days' AND yv.view_count < 100000 AND yv.view_count > 5000
              ORDER BY (COALESCE(yv.view_acceleration, 0) * 100) + (yv.view_velocity * 10) + 
                       (yv.engagement_rate * 50) + (GREATEST(0, (168 - EXTRACT(EPOCH FROM (NOW() - yv.published_at))/3600)) / 168 * 1000) DESC
              LIMIT $1
            `
          } else {
            query = `
              SELECT 
                ROW_NUMBER() OVER (ORDER BY yv.engagement_rate DESC) as rank,
                yv.title, yc.title as channel, yv.view_count, yv.like_count,
                yv.engagement_rate, yv.published_at, yv.id as video_id, yv.thumbnail_url
              FROM youtube_videos yv
              JOIN youtube_channels yc ON yv.channel_id = yc.id
              WHERE yv.view_count > 5000 AND yv.engagement_rate > 3.0
              ORDER BY yv.engagement_rate DESC LIMIT $1
            `
          }
          
          const result = await client.query(query, params)
          client.release()
          
          const rankings = result.rows.map(row => ({
            rank: row.rank,
            title: row.title,
            channel: row.channel,
            views: row.view_count.toLocaleString(),
            likes: row.like_count.toLocaleString(),
            engagement: `${row.engagement_rate.toFixed(2)}%`,
            published: row.published_at.toISOString().split('T')[0],
            url: `https://youtube.com/watch?v=${row.video_id}`,
            thumbnail: row.thumbnail_url || ''
          }))
          
          wsServer.broadcastRankingUpdate(type, rankings)
          
        } catch (error) {
          console.error(`Broadcast error for ${type}:`, error)
        }
      }
    } catch (error) {
      console.error('Broadcast rankings failed:', error)
    }
  }

  private async performChannelCheck() {
    console.log('Channel check...', new Date().toISOString())
    
    try {
      // Initialize channels if needed
      await channelMonitor.initializeChannels()
      
      // Check channels for new videos
      const newVideos = await channelMonitor.checkChannelsForNewVideos(10)
      
      console.log(`Channel check complete: ${newVideos} new videos found`)
      
      // Broadcast update if new videos found
      if (newVideos > 0) {
        wsServer.broadcastStatsUpdate({
          message: 'New videos discovered from channels',
          new_videos: newVideos,
          timestamp: new Date().toISOString()
        })
      }
    } catch (error) {
      console.error('Channel check failed:', error)
    }
  }

  private async performBatchVideoUpdate() {
    console.log('Batch video update...', new Date().toISOString())
    
    try {
      const startTime = Date.now()
      
      // Check quota before proceeding
      const usage = await quotaTracker.getTodayUsage()
      const remainingQuota = 10000 - usage.units_used
      
      if (remainingQuota < 100) {
        console.log('Insufficient quota for batch update')
        return
      }
      
      const client = await pool.connect()
      
      try {
        // Get all videos that need updating (prioritize popular and recent)
        const result = await client.query(`
          SELECT id, title
          FROM youtube_videos
          WHERE updated_at < NOW() - INTERVAL '6 hours'
          ORDER BY 
            CASE 
              WHEN published_at >= NOW() - INTERVAL '7 days' THEN 1
              WHEN view_count > 100000 THEN 2
              WHEN published_at >= NOW() - INTERVAL '30 days' THEN 3
              ELSE 4
            END,
            view_count DESC
          LIMIT $1
        `, [Math.min(remainingQuota * 50, 5000)]) // Max videos based on quota
        
        const videoIds = result.rows.map(row => row.id)
        
        if (videoIds.length === 0) {
          console.log('No videos need updating')
          return
        }
        
        console.log(`Updating ${videoIds.length} videos in batches...`)
        
        // Update videos in batches of 50
        let totalUpdated = 0
        for (let i = 0; i < videoIds.length; i += 50) {
          const batch = videoIds.slice(i, i + 50)
          
          // Check quota for this batch
          if (!await quotaTracker.canPerformOperation('videoList')) {
            console.log('Quota limit reached during batch update')
            break
          }
          
          try {
            const updated = await videoService.updateVideoBatch(batch)
            totalUpdated += updated
            
            // Record quota usage (1 unit per batch of up to 50)
            await quotaTracker.recordUsage('video_update', 1)
            
            // Small delay between batches to avoid rate limiting
            if (i + 50 < videoIds.length) {
              await new Promise(resolve => setTimeout(resolve, 100))
            }
          } catch (error) {
            console.error(`Batch update error for videos ${i}-${i+50}:`, error)
          }
        }
        
        const duration = Date.now() - startTime
        const summary = {
          videos_checked: videoIds.length,
          videos_updated: totalUpdated,
          batches_processed: Math.ceil(totalUpdated / 50),
          quota_used: Math.ceil(totalUpdated / 50),
          duration_ms: duration,
          timestamp: new Date().toISOString()
        }
        
        console.log('Batch update completed:', summary)
        
        // Broadcast completion
        wsServer.broadcastStatsUpdate({
          message: 'Batch video update completed',
          ...summary
        })
        
      } finally {
        client.release()
      }
    } catch (error) {
      console.error('Batch video update failed:', error)
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      activeTasks: Array.from(this.tasks.keys()),
      tasksCount: this.tasks.size
    }
  }
}

// Singleton instance
export const scheduler = new GolfDirectoryScheduler()

// Auto-start in production, delay start in development
if (process.env.NODE_ENV === 'production') {
  scheduler.start()
} else {
  // Start after 10 seconds in development to let server fully start
  setTimeout(() => {
    console.log('Starting scheduler in development mode...')
    scheduler.start()
  }, 10000)
}