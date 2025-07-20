'use client'

import { useState, useEffect } from 'react'
import { Play, TrendingUp, Eye } from 'lucide-react'
import { api, VideoOfTheDay } from '@/lib/api'

export default function VideoOfTheDayComponent() {
  const [video, setVideo] = useState<VideoOfTheDay | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadVideoOfTheDay()
  }, [])

  const loadVideoOfTheDay = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const videoData = await api.getVideoOfTheDay()
      setVideo(videoData)
      
      // Check if this video has existing audio
      if (videoData.video_id) {
        try {
          const response = await fetch(`/api/generate-transcript-summary/${videoData.video_id}`, {
            method: 'GET'
          })
          if (response.ok) {
            const data = await response.json()
            if (data.audioUrl) {
              setAudioUrl(data.audioUrl)
            }
          }
        } catch (err) {
          // Silently fail - no audio available
          console.log('No existing audio found for video')
        }
      }
    } catch (err) {
      console.error('Error loading video of the day:', err)
      setError('Failed to load video of the day')
    } finally {
      setIsLoading(false)
    }
  }

  const formatViews = (views: string) => {
    const num = parseInt(views.replace(/,/g, ''))
    return api.formatViews(num)
  }

  const getDaysAgoText = (daysAgo: number) => {
    if (daysAgo === 0) return 'Today'
    if (daysAgo === 1) return 'Yesterday'
    return `${daysAgo}d ago`
  }

  const getVelocityText = (velocity: number) => {
    if (velocity > 10000) return 'Viral speed'
    if (velocity > 5000) return 'Fast trending'
    if (velocity > 1000) return 'Gaining momentum'
    return 'Steady growth'
  }

  const loadSummary = async (videoId: string) => {
    try {
      setSummaryLoading(true)
      
      // First check if video of the day already has AI summary
      if (video?.ai_summary) {
        setSummary(video.ai_summary)
        return
      }
      
      // Try the new transcript-based summary first
      let response = await fetch(`/api/generate-transcript-summary/${videoId}`, {
        method: 'POST'
      })
      
      if (response.ok) {
        const data = await response.json()
        setSummary(data.summary)
        // Set audio URL if available (should be streaming URL)
        if (data.audioUrl) {
          setAudioUrl(data.audioUrl)
        }
        return
      }
      
      // Fallback to original summary API
      response = await fetch(`/api/video-summary/${videoId}`, {
        method: 'POST'
      })
      
      if (response.ok) {
        const data = await response.json()
        setSummary(data.summary)
      } else {
        setSummary('Unable to generate summary at this time. The video may not have captions available.')
      }
    } catch (err) {
      console.error('Error loading summary:', err)
      setSummary('Error generating summary. Please try again later.')
    } finally {
      setSummaryLoading(false)
    }
  }

  const loadAudio = async (videoId: string) => {
    try {
      setAudioLoading(true)
      
      // Generate audio by calling the transcript summary endpoint
      // This will create the audio file and return the URL
      const response = await fetch(`/api/generate-transcript-summary/${videoId}`, {
        method: 'POST'
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.audioUrl) {
          setAudioUrl(data.audioUrl)
        }
      } else {
        console.error('Failed to generate audio')
      }
      
    } catch (err) {
      console.error('Error loading audio:', err)
    } finally {
      setAudioLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="mb-16">
        <div className="bg-gradient-to-r from-purple-900 via-purple-800 to-indigo-900 rounded-3xl p-8">
          <div className="animate-pulse">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center">
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
              <div>
                <div className="h-8 bg-purple-600 rounded w-48 mb-2"></div>
                <div className="h-4 bg-purple-700 rounded w-32"></div>
              </div>
            </div>
            <div className="grid lg:grid-cols-2 gap-8">
              <div className="aspect-video bg-purple-700 rounded-xl"></div>
              <div className="space-y-4">
                <div className="h-6 bg-purple-600 rounded w-3/4"></div>
                <div className="h-4 bg-purple-700 rounded w-1/2"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-purple-700 rounded w-full"></div>
                  <div className="h-4 bg-purple-700 rounded w-2/3"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !video) {
    return (
      <div className="mb-16">
        <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-3xl p-8 text-center">
          <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Video of the Day</h2>
          <p className="text-gray-400">Unable to load today's featured video</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-16">
      {/* Trending Now Indicator */}
      <div className="mb-6">
        <p className="text-purple-300">🔥 Trending now • {getDaysAgoText(video.days_ago)}</p>
      </div>

      {/* Main Video Card */}
      <div className="bg-gradient-to-r from-purple-900 via-purple-800 to-indigo-900 rounded-3xl p-8 shadow-2xl border border-purple-500/20">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          
          {/* Video Thumbnail */}
          <div className="relative group cursor-pointer" onClick={() => window.open(video.url, '_blank')}>
            <div className="aspect-video rounded-xl overflow-hidden bg-gray-800 group-hover:scale-[1.02] transition-transform duration-300">
              <img
                src={video.thumbnail || 'https://via.placeholder.com/640x360/1a1a1a/666666?text=No+Thumbnail'}
                alt={video.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = 'https://via.placeholder.com/640x360/1a1a1a/666666?text=No+Thumbnail';
                }}
              />
              
              {/* Play Button Overlay */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/30">
                <div className="w-20 h-20 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
                  <Play className="w-10 h-10 text-gray-900 ml-1" fill="currentColor" />
                </div>
              </div>

            </div>
          </div>

          {/* Video Info */}
          <div className="space-y-6">
            <div>
              <h3 className="text-2xl font-bold text-white leading-tight mb-3 line-clamp-3">
                {video.title}
              </h3>
              <p className="text-purple-200 text-lg font-medium">{video.channel}</p>
              
              {/* View count */}
              <div className="flex items-center space-x-2 mt-3">
                <Eye className="w-5 h-5 text-blue-400" />
                <span className="text-blue-300 font-medium">{formatViews(video.views)} views</span>
              </div>
            </div>

            {/* Show audio player if available, otherwise show nothing */}
            {audioUrl && (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <p className="text-white font-medium">Audio Recap</p>
                  
                  <audio
                    controls
                    className="h-8"
                    preload="metadata"
                  >
                    <source src={audioUrl} type="audio/mpeg" />
                    Your browser does not support the audio element.
                  </audio>
                </div>
              </div>
            )}

            {/* Watch Button */}
            <button
              onClick={() => window.open(video.url, '_blank')}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg"
            >
              <Play className="w-6 h-6" fill="currentColor" />
              <span>Watch on YouTube</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}