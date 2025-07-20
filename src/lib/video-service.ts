import pool from './database'
import { YouTubeClient, YouTubeVideoData } from './youtube-client'

export class VideoService {
  private youtubeClient: YouTubeClient

  constructor() {
    this.youtubeClient = new YouTubeClient()
  }

  async upsertVideo(videoData: YouTubeVideoData, mode: 'curated' | 'discovery' = 'curated'): Promise<void> {
    // No content validation - accept all videos for updates

    const client = await pool.connect()
    
    try {
      // Upsert channel first
      await client.query(`
        INSERT INTO youtube_channels (id, title) 
        VALUES ($1, $2) 
        ON CONFLICT (id) DO UPDATE SET title = $2
      `, [videoData.channel_id, videoData.channel_title])

      // Parse duration from ISO 8601 to seconds
      const durationSeconds = this.parseDuration(videoData.duration)
      
      // Calculate engagement rate
      const engagementRate = videoData.view_count > 0 
        ? ((videoData.like_count + videoData.comment_count) / videoData.view_count) * 100 
        : 0

      // Calculate view velocity (views per day since upload)
      const publishedDate = new Date(videoData.published_at)
      const daysSinceUpload = Math.max(1, (Date.now() - publishedDate.getTime()) / (1000 * 60 * 60 * 24))
      const viewVelocity = videoData.view_count / daysSinceUpload

      // Categorize video
      const category = this.categorizeVideo(videoData.title, videoData.description)

      // Upsert video
      await client.query(`
        INSERT INTO youtube_videos (
          id, title, description, channel_id, published_at, view_count, 
          like_count, comment_count, engagement_rate, view_velocity,
          duration_seconds, thumbnail_url, category, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
        ON CONFLICT (id) DO UPDATE SET
          view_count = $6,
          like_count = $7,
          comment_count = $8,
          engagement_rate = $9,
          view_velocity = $10,
          thumbnail_url = $12,
          updated_at = NOW()
      `, [
        videoData.id,
        videoData.title,
        videoData.description.substring(0, 1000), // Truncate long descriptions
        videoData.channel_id,
        videoData.published_at,
        videoData.view_count,
        videoData.like_count,
        videoData.comment_count,
        engagementRate,
        viewVelocity,
        durationSeconds,
        videoData.thumbnail,
        category
      ])

    } finally {
      client.release()
    }
  }

  async collectGolfVideos(searchTerms?: string[]): Promise<number> {
    const defaultSearchTerms = [
      'golf instruction',
      'golf tips',
      'golf swing',
      'PGA Tour',
      'golf course',
      'golf equipment',
      'golf highlights',
      'golf vlog',
      'Good Good',
      'Dude Perfect golf',
      'Rick Shiels',
      'Peter Finch golf',
      'Mark Crossfield',
      'Golf Sidekick'
    ]

    const terms = searchTerms || defaultSearchTerms
    let totalVideosCollected = 0

    for (const term of terms) {
      try {
        console.log(`Collecting videos for: ${term}`)
        const videos = await this.youtubeClient.searchGolfVideos(term, 25)
        
        for (const video of videos) {
          try {
            await this.upsertVideo(video, 'curated')
            totalVideosCollected++
          } catch (error) {
            console.error(`Error saving video ${video.id}:`, error)
          }
        }

        // Rate limiting - pause between searches
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (error) {
        console.error(`Error searching for ${term}:`, error)
      }
    }

    return totalVideosCollected
  }

  async updateExistingVideos(): Promise<number> {
    const client = await pool.connect()
    
    try {
      // Get videos that need updating (recent videos or haven't been updated in a while)
      const result = await client.query(`
        SELECT id 
        FROM youtube_videos 
        WHERE updated_at <= NOW() - INTERVAL '2 hours'
           OR published_at >= NOW() - INTERVAL '7 days'
        ORDER BY published_at DESC
        LIMIT 100
      `)

      const videoIds = result.rows.map(row => row.id)
      
      if (videoIds.length === 0) {
        return 0
      }

      console.log(`Updating ${videoIds.length} existing videos`)
      const updatedVideos = await this.youtubeClient.updateVideoStats(videoIds)
      
      let updatedCount = 0
      for (const video of updatedVideos) {
        try {
          await this.upsertVideo(video, 'curated')
          updatedCount++
        } catch (error) {
          console.error(`Error updating video ${video.id}:`, error)
        }
      }

      return updatedCount
    } finally {
      client.release()
    }
  }

  async updateVideoBatch(videoIds: string[]): Promise<number> {
    if (videoIds.length === 0) {
      return 0
    }

    console.log(`Updating batch of ${videoIds.length} videos`)
    
    try {
      // Use YouTube API to get updated stats for all videos in batch
      const updatedVideos = await this.youtubeClient.updateVideoStats(videoIds)
      
      let updatedCount = 0
      for (const video of updatedVideos) {
        try {
          await this.upsertVideo(video, 'curated')
          updatedCount++
        } catch (error) {
          console.error(`Error updating video ${video.id}:`, error)
        }
      }

      return updatedCount
    } catch (error) {
      console.error('Batch update failed:', error)
      return 0
    }
  }

  private parseDuration(duration: string): number {
    // Parse ISO 8601 duration (e.g., "PT4M13S" = 4 minutes 13 seconds)
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
    if (!match) return 0

    const hours = parseInt(match[1] || '0')
    const minutes = parseInt(match[2] || '0')
    const seconds = parseInt(match[3] || '0')

    return hours * 3600 + minutes * 60 + seconds
  }


  private categorizeVideo(title: string, description: string): string {
    const text = (title + ' ' + description).toLowerCase()
    
    const categories = {
      'instruction': ['lesson', 'tip', 'how to', 'tutorial', 'teach', 'swing', 'putting', 'chipping', 'drill'],
      'equipment': ['review', 'club', 'ball', 'gear', 'equipment', 'shaft', 'driver', 'iron', 'test'],
      'tour': ['pga', 'tour', 'tournament', 'round', 'leaderboard', 'championship', 'masters', 'open'],
      'highlights': ['highlight', 'best', 'shot', 'hole in one', 'ace', 'eagle', 'amazing'],
      'vlog': ['vlog', 'course', 'round', 'playing', 'golf with', 'day at', 'experience'],
      'news': ['news', 'update', 'announcement', 'breaking', 'interview']
    }
    
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return category
      }
    }
    
    return 'general'
  }
}

export const videoService = new VideoService()