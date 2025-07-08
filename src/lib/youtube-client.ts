import { google } from 'googleapis'

export interface YouTubeVideoData {
  id: string
  title: string
  description: string
  channel_id: string
  channel_title: string
  published_at: string
  view_count: number
  like_count: number
  comment_count: number
  duration: string
  thumbnail: string
  tags?: string[]
}

export class YouTubeClient {
  private youtube: any
  private apiKey: string

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY || ''
    
    if (!this.apiKey) {
      console.warn('No YouTube API key provided')
      return
    }

    this.youtube = google.youtube({
      version: 'v3',
      auth: this.apiKey
    })
  }

  async searchGolfVideos(query: string = 'golf', maxResults: number = 50): Promise<YouTubeVideoData[]> {
    if (!this.youtube) {
      throw new Error('YouTube client not initialized - missing API key')
    }

    try {
      // Search for videos
      const searchResponse = await this.youtube.search.list({
        part: ['snippet'],
        q: query,
        type: 'video',
        maxResults,
        order: 'relevance',
        publishedAfter: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // Last 30 days
        videoDuration: 'any',
        videoDefinition: 'any'
      })

      const videoIds = searchResponse.data.items?.map((item: any) => item.id.videoId) || []
      
      if (videoIds.length === 0) {
        return []
      }

      // Get detailed video information
      const videosResponse = await this.youtube.videos.list({
        part: ['snippet', 'statistics', 'contentDetails'],
        id: videoIds.join(',')
      })

      const videos: YouTubeVideoData[] = []
      
      for (const item of videosResponse.data.items || []) {
        try {
          const snippet = item.snippet
          const stats = item.statistics
          const contentDetails = item.contentDetails

          // Calculate engagement rate
          const views = parseInt(stats.viewCount || '0')
          const likes = parseInt(stats.likeCount || '0')
          const comments = parseInt(stats.commentCount || '0')
          
          const video: YouTubeVideoData = {
            id: item.id,
            title: snippet.title,
            description: snippet.description || '',
            channel_id: snippet.channelId,
            channel_title: snippet.channelTitle,
            published_at: snippet.publishedAt,
            view_count: views,
            like_count: likes,
            comment_count: comments,
            duration: contentDetails.duration,
            thumbnail: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || '',
            tags: snippet.tags || []
          }

          videos.push(video)
        } catch (error) {
          console.error('Error processing video:', error)
        }
      }

      return videos
    } catch (error) {
      console.error('YouTube API error:', error)
      throw error
    }
  }

  async getChannelVideos(channelId: string, maxResults: number = 50): Promise<YouTubeVideoData[]> {
    if (!this.youtube) {
      throw new Error('YouTube client not initialized - missing API key')
    }

    try {
      // Get channel's uploads playlist
      const channelResponse = await this.youtube.channels.list({
        part: ['contentDetails'],
        id: channelId
      })

      const uploadsPlaylistId = channelResponse.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
      
      if (!uploadsPlaylistId) {
        return []
      }

      // Get recent videos from uploads playlist
      const playlistResponse = await this.youtube.playlistItems.list({
        part: ['snippet'],
        playlistId: uploadsPlaylistId,
        maxResults,
        order: 'date'
      })

      const videoIds = playlistResponse.data.items?.map((item: any) => item.snippet.resourceId.videoId) || []
      
      if (videoIds.length === 0) {
        return []
      }

      // Get detailed video information
      const videosResponse = await this.youtube.videos.list({
        part: ['snippet', 'statistics', 'contentDetails'],
        id: videoIds.join(',')
      })

      const videos: YouTubeVideoData[] = []
      
      for (const item of videosResponse.data.items || []) {
        try {
          const snippet = item.snippet
          const stats = item.statistics
          const contentDetails = item.contentDetails

          const views = parseInt(stats.viewCount || '0')
          const likes = parseInt(stats.likeCount || '0')
          const comments = parseInt(stats.commentCount || '0')
          
          const video: YouTubeVideoData = {
            id: item.id,
            title: snippet.title,
            description: snippet.description || '',
            channel_id: snippet.channelId,
            channel_title: snippet.channelTitle,
            published_at: snippet.publishedAt,
            view_count: views,
            like_count: likes,
            comment_count: comments,
            duration: contentDetails.duration,
            thumbnail: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || '',
            tags: snippet.tags || []
          }

          videos.push(video)
        } catch (error) {
          console.error('Error processing video:', error)
        }
      }

      return videos
    } catch (error) {
      console.error('YouTube API error for channel:', error)
      throw error
    }
  }

  async updateVideoStats(videoIds: string[]): Promise<YouTubeVideoData[]> {
    if (!this.youtube) {
      throw new Error('YouTube client not initialized - missing API key')
    }

    try {
      // Batch process video IDs (YouTube API limits to 50 per request)
      const batches = []
      for (let i = 0; i < videoIds.length; i += 50) {
        batches.push(videoIds.slice(i, i + 50))
      }

      const allVideos: YouTubeVideoData[] = []

      for (const batch of batches) {
        const videosResponse = await this.youtube.videos.list({
          part: ['snippet', 'statistics', 'contentDetails'],
          id: batch.join(',')
        })

        for (const item of videosResponse.data.items || []) {
          try {
            const snippet = item.snippet
            const stats = item.statistics
            const contentDetails = item.contentDetails

            const views = parseInt(stats.viewCount || '0')
            const likes = parseInt(stats.likeCount || '0')
            const comments = parseInt(stats.commentCount || '0')
            
            const video: YouTubeVideoData = {
              id: item.id,
              title: snippet.title,
              description: snippet.description || '',
              channel_id: snippet.channelId,
              channel_title: snippet.channelTitle,
              published_at: snippet.publishedAt,
              view_count: views,
              like_count: likes,
              comment_count: comments,
              duration: contentDetails.duration,
              thumbnail: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || '',
              tags: snippet.tags || []
            }

            allVideos.push(video)
          } catch (error) {
            console.error('Error processing video in batch:', error)
          }
        }
      }

      return allVideos
    } catch (error) {
      console.error('YouTube API error updating stats:', error)
      throw error
    }
  }

  async getChannelVideos(channelId: string, maxResults: number = 10): Promise<YouTubeVideoData[]> {
    if (!this.youtube) {
      throw new Error('YouTube client not initialized - missing API key')
    }

    try {
      // Get channel's uploads playlist
      const channelsResponse = await this.youtube.channels.list({
        part: ['contentDetails'],
        id: channelId
      })

      const uploadsPlaylistId = channelsResponse.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
      if (!uploadsPlaylistId) {
        console.warn(`No uploads playlist found for channel ${channelId}`)
        return []
      }

      // Get recent videos from uploads playlist
      const playlistResponse = await this.youtube.playlistItems.list({
        part: ['snippet'],
        playlistId: uploadsPlaylistId,
        maxResults,
        order: 'date'
      })

      const videoIds = playlistResponse.data.items
        ?.map((item: any) => item.snippet.resourceId.videoId)
        .filter(Boolean) || []

      if (videoIds.length === 0) {
        return []
      }

      // Get detailed info for these videos
      const videosResponse = await this.youtube.videos.list({
        part: ['snippet', 'statistics', 'contentDetails'],
        id: videoIds.join(',')
      })

      const videos: YouTubeVideoData[] = []

      for (const item of videosResponse.data.items || []) {
        try {
          const snippet = item.snippet
          const stats = item.statistics
          const contentDetails = item.contentDetails

          const views = parseInt(stats.viewCount || '0')
          const likes = parseInt(stats.likeCount || '0')
          const comments = parseInt(stats.commentCount || '0')
          
          const video: YouTubeVideoData = {
            id: item.id,
            title: snippet.title,
            description: snippet.description || '',
            channel_id: snippet.channelId,
            channel_title: snippet.channelTitle,
            published_at: snippet.publishedAt,
            view_count: views,
            like_count: likes,
            comment_count: comments,
            duration: contentDetails.duration,
            thumbnail: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || '',
            tags: snippet.tags || []
          }

          videos.push(video)
        } catch (error) {
          console.error('Error processing channel video:', error)
        }
      }

      return videos
    } catch (error) {
      console.error('YouTube API error getting channel videos:', error)
      throw error
    }
  }
}