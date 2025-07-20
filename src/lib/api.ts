// API client for Golf Directory backend

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api'

// Types matching the backend models
export interface VideoRanking {
  rank: number
  title: string
  channel: string
  views: string
  likes: string
  engagement: string
  published: string
  url: string
  thumbnail: string
}

export interface ChannelStats {
  channel: string
  videos_tracked: number
  total_views: string
  avg_engagement: string
  url: string
}

export interface SearchResult {
  title: string
  channel: string
  views: string
  category: string
  published: string
  url: string
}

export interface DirectoryStats {
  total_videos: number
  total_channels: number
  categories: Record<string, number>
  last_updated: string
}

export interface VideoOfTheDay {
  video_id: string
  title: string
  channel: string
  views: string
  likes: string
  engagement: string
  published: string
  url: string
  thumbnail: string
  view_velocity: number
  momentum_score: number
  duration_seconds?: number
  is_short: boolean
  days_ago: number
  has_ai_analysis?: boolean
  analysis_status?: string | null
  ai_summary?: string | null
}

class GolfDirectoryAPI {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl
  }

  private async fetchWithErrorHandling<T>(url: string): Promise<T> {
    try {
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error(`API Error fetching ${url}:`, error)
      throw error
    }
  }

  // Get video rankings by type
  async getRankings(type: string = 'daily_trending', limit: number = 20, includeShorts: boolean = false): Promise<VideoRanking[]> {
    const params = new URLSearchParams({ 
      limit: limit.toString(),
      include_shorts: includeShorts.toString()
    })
    return this.fetchWithErrorHandling<VideoRanking[]>(
      `${this.baseUrl}/rankings/${type}?${params.toString()}`
    )
  }

  // Get top channels
  async getTopChannels(limit: number = 20): Promise<ChannelStats[]> {
    return this.fetchWithErrorHandling<ChannelStats[]>(
      `${this.baseUrl}/channels/top?limit=${limit}`
    )
  }

  // Search videos
  async searchVideos(query: string, category?: string): Promise<SearchResult[]> {
    const params = new URLSearchParams({ q: query })
    if (category) {
      params.append('category', category)
    }
    
    return this.fetchWithErrorHandling<SearchResult[]>(
      `${this.baseUrl}/search?${params.toString()}`
    )
  }

  // Get directory statistics
  async getStats(): Promise<DirectoryStats> {
    return this.fetchWithErrorHandling<DirectoryStats>(`${this.baseUrl}/stats`)
  }

  // Get video of the day
  async getVideoOfTheDay(): Promise<VideoOfTheDay> {
    return this.fetchWithErrorHandling<VideoOfTheDay>(`${this.baseUrl}/video-of-the-day`)
  }

  // Format view count for display
  formatViews(views: string | number): string {
    const num = typeof views === 'string' ? parseInt(views.replace(/,/g, '')) : views
    
    if (num >= 1000000) {
      return `${Math.floor(num / 1000000)}M`
    } else if (num >= 1000) {
      return `${Math.floor(num / 1000)}K`
    }
    
    return num.toLocaleString()
  }

  // Format duration from seconds to MM:SS
  formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  // Parse engagement rate percentage
  parseEngagement(engagement: string): number {
    return parseFloat(engagement.replace('%', ''))
  }
}

// Export singleton instance
export const api = new GolfDirectoryAPI()

// Export default class for testing
export default GolfDirectoryAPI