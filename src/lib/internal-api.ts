/**
 * Internal API service for server-to-server communication
 * Handles all internal API calls within the application
 */

// Use the appropriate URL based on environment
// For server-to-server calls, always use localhost
const BASE_URL = 'http://localhost:3000'

export class InternalApiService {
  
  async collectTodayVideos(): Promise<{ videos_collected?: number }> {
    const response = await fetch(`${BASE_URL}/api/collect-today-videos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    if (!response.ok) {
      throw new Error(`Failed to collect today videos: ${response.status} ${response.statusText}`)
    }
    
    return response.json()
  }

  async getVideoOfTheDay(): Promise<{
    video_id: string
    title: string
    url: string
    has_ai_analysis: boolean
  }> {
    const response = await fetch(`${BASE_URL}/api/video-of-the-day`)
    
    if (!response.ok) {
      throw new Error(`Failed to get video of the day: ${response.status} ${response.statusText}`)
    }
    
    return response.json()
  }

  async generateTranscriptSummary(videoId: string): Promise<{ summary?: string; audioUrl?: string }> {
    const response = await fetch(`${BASE_URL}/api/generate-transcript-summary/${videoId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    if (!response.ok) {
      throw new Error(`Failed to generate transcript summary: ${response.status} ${response.statusText}`)
    }
    
    return response.json()
  }
}

// Singleton instance
export const internalApi = new InternalApiService()