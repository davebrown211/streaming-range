import pool from './database'
import { YouTubeClient } from './youtube-client'
import { videoService } from './video-service'
import { quotaTracker } from './quota-tracker'

export interface GolfChannel {
  id: string
  title: string
  priority: 'high' | 'medium' | 'low'
  last_checked?: Date
}

export class ChannelMonitor {
  private youtubeClient: YouTubeClient
  
  // Top golf channels to monitor
  private static HIGH_PRIORITY_CHANNELS = [
    { id: 'UCq-Cy3CK3r-qmjM7fXPqTlQ', title: 'Good Good' },
    { id: 'UCRvqjQPSeaWn-uEx-w0XOIg', title: 'Dude Perfect' },
    { id: 'UCgUueMmSpcl-aCTt5CuCKQw', title: 'Grant Horvat Golf' },
    { id: 'UCpzR85N5b5Cil_VE-P0HqWg', title: 'Rick Shiels Golf' },
    { id: 'UCGhLVzjASYN8oUxYBtfBfAw', title: 'Peter Finch Golf' },
    { id: 'UC5SQGzkWyQSW_fe-URgq7xw', title: 'Bryson DeChambeau' },
    { id: 'UCwOImVq9GMSalyC_uS3b-2Q', title: 'TaylorMade Golf' },
    { id: 'UCJKDS0Kym93MJSdhFqA8HTg', title: 'Mark Crossfield' },
    { id: 'UCm8OIxLBpNJFRbcnXJcXdNw', title: 'Golf Sidekick' },
    { id: 'UCbNRBQptR5CL4rX7eI3SWPQ', title: 'James Robinson Golf' },
    { id: 'UCqr4sONkmFEOPc3rfoVLEvg', title: 'Bob Does Sports' },
    // Recently added creators
    { id: 'UClOp9ASmFYATO1zFfpB7QlA', title: 'Eric Cogorno Golf' },
    { id: 'UCokFauAYvXnr3e9TZQFESIQ', title: 'Matt Fryer Golf' },
    { id: 'UCJolpQHWLAW6cCUYGgean8w', title: 'Padraig Harrington' },
    { id: 'UC_GolfChannelID', title: 'Golf Channel' } // Need to find actual ID
  ]

  constructor() {
    this.youtubeClient = new YouTubeClient()
  }

  async initializeChannels(): Promise<void> {
    const client = await pool.connect()
    
    try {
      // Create monitoring table
      await client.query(`
        CREATE TABLE IF NOT EXISTS monitored_channels (
          id VARCHAR(255) PRIMARY KEY,
          title VARCHAR(255),
          priority VARCHAR(20) DEFAULT 'medium',
          last_checked TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `)

      // Insert high priority channels
      for (const channel of ChannelMonitor.HIGH_PRIORITY_CHANNELS) {
        await client.query(`
          INSERT INTO monitored_channels (id, title, priority)
          VALUES ($1, $2, $3)
          ON CONFLICT (id) DO UPDATE SET priority = $3
        `, [channel.id, channel.title, 'high'])
      }

    } finally {
      client.release()
    }
  }

  async discoverChannelsFromVideos(): Promise<void> {
    const client = await pool.connect()
    
    try {
      // Find popular channels from our existing videos
      const result = await client.query(`
        SELECT 
          yc.id,
          yc.title,
          COUNT(yv.id) as video_count,
          SUM(yv.view_count) as total_views
        FROM youtube_channels yc
        JOIN youtube_videos yv ON yc.id = yv.channel_id
        WHERE yc.id NOT IN (
          SELECT id FROM monitored_channels
        )
        GROUP BY yc.id, yc.title
        HAVING COUNT(yv.id) >= 2
        ORDER BY SUM(yv.view_count) DESC
        LIMIT 20
      `)

      // Add discovered channels as medium priority
      for (const row of result.rows) {
        await client.query(`
          INSERT INTO monitored_channels (id, title, priority)
          VALUES ($1, $2, $3)
          ON CONFLICT (id) DO NOTHING
        `, [row.id, row.title, 'medium'])
      }

    } finally {
      client.release()
    }
  }

  async checkChannelsForNewVideos(limit: number = 10): Promise<number> {
    // Check quota first
    if (!await quotaTracker.canPerformOperation('channel_check')) {
      console.log('Quota limit reached, skipping channel check')
      return 0
    }

    const client = await pool.connect()
    
    try {
      // Get channels that need checking (prioritize high priority and least recently checked)
      const result = await client.query(`
        SELECT id, title
        FROM monitored_channels
        WHERE last_checked IS NULL 
           OR last_checked < NOW() - INTERVAL '12 hours'
        ORDER BY 
          CASE priority 
            WHEN 'high' THEN 1 
            WHEN 'medium' THEN 2 
            ELSE 3 
          END,
          last_checked ASC NULLS FIRST
        LIMIT $1
      `, [limit])

      let newVideosCount = 0

      for (const channel of result.rows) {
        try {
          console.log(`Checking channel: ${channel.title}`)
          
          // Get recent videos from channel
          const videos = await this.youtubeClient.getChannelVideos(channel.id, 10)
          
          // Record quota usage
          await quotaTracker.recordUsage('channel_check', 1)
          
          // Save new videos
          for (const video of videos) {
            await videoService.upsertVideo(video)
            newVideosCount++
          }

          // Update last checked
          await client.query(`
            UPDATE monitored_channels 
            SET last_checked = NOW() 
            WHERE id = $1
          `, [channel.id])

        } catch (error) {
          console.error(`Error checking channel ${channel.title}:`, error)
        }
      }

      return newVideosCount

    } finally {
      client.release()
    }
  }

  async getMonitoredChannels(): Promise<GolfChannel[]> {
    const client = await pool.connect()
    
    try {
      const result = await client.query(`
        SELECT id, title, priority, last_checked
        FROM monitored_channels
        ORDER BY 
          CASE priority 
            WHEN 'high' THEN 1 
            WHEN 'medium' THEN 2 
            ELSE 3 
          END,
          title
      `)

      return result.rows.map(row => ({
        id: row.id,
        title: row.title,
        priority: row.priority,
        last_checked: row.last_checked
      }))

    } finally {
      client.release()
    }
  }
}

export const channelMonitor = new ChannelMonitor()