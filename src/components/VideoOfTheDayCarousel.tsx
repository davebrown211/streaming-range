'use client'

import { useState, useEffect, useRef } from 'react'
import { Play, Eye, ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '@/lib/api'
import { VideoStructuredData } from './StructuredData'

interface VideoWithAudio {
  video_id: string
  title: string
  channel: string
  views: string
  likes: string
  engagement: string
  published: string
  url: string
  thumbnail: string
  duration_seconds: number
  is_short: boolean
  days_ago: number
  audio_url: string
  ai_summary: string
  is_video_of_day: boolean
}

export default function VideoOfTheDayCarousel() {
  const [videos, setVideos] = useState<VideoWithAudio[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadVideosWithAudio()
  }, [])

  const loadVideosWithAudio = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await fetch('/api/videos-with-audio')
      if (!response.ok) throw new Error('Failed to load videos')
      
      const data = await response.json()
      
      // Also get the current video of the day if it doesn't have audio
      const vodResponse = await api.getVideoOfTheDay()
      
      // Check if VOD is already in our list
      const hasVod = data.videos.some((v: VideoWithAudio) => v.video_id === vodResponse.video_id)
      
      if (!hasVod && vodResponse) {
        // Add VOD at the beginning without audio
        data.videos.unshift({
          ...vodResponse,
          audio_url: null,
          ai_summary: vodResponse.ai_summary || null,
          is_video_of_day: true
        })
      }
      
      setVideos(data.videos)
    } catch (err) {
      console.error('Error loading videos:', err)
      setError('Failed to load videos')
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

  const nextVideo = () => {
    setCurrentIndex((prev) => (prev + 1) % videos.length)
  }

  const prevVideo = () => {
    setCurrentIndex((prev) => (prev - 1 + videos.length) % videos.length)
  }

  if (isLoading) {
    return (
      <div className="mb-16">
        <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 rounded-3xl p-8">
          <div className="animate-pulse">
            <div className="aspect-video bg-gray-700 rounded-xl"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error || videos.length === 0) {
    return null // Don't show anything if no videos with audio
  }

  const video = videos[currentIndex]

  return (
    <div className="mb-16">
      <VideoStructuredData video={video} />
      {/* Trending Now Indicator */}
      <div className="mb-6 flex items-center justify-between">
        <p className="text-purple-300">
          🔥 {video.is_video_of_day ? 'Video of the Day' : 'Featured Video'} • {getDaysAgoText(video.days_ago)}
        </p>
        
        {/* Carousel Controls */}
        {videos.length > 1 && (
          <div className="flex items-center space-x-2">
            <button
              onClick={prevVideo}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              aria-label="Previous video"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            
            <span className="text-purple-300 text-sm px-3">
              {currentIndex + 1} / {videos.length}
            </span>
            
            <button
              onClick={nextVideo}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              aria-label="Next video"
            >
              <ChevronRight className="w-5 h-5 text-white" />
            </button>
          </div>
        )}
      </div>

      {/* Main Video Card with Smooth Transitions */}
      <div className="bg-gradient-to-r from-purple-900 via-purple-800 to-indigo-900 rounded-3xl p-8 shadow-2xl border border-purple-500/20">
        <div 
          key={video.video_id}
          className="grid lg:grid-cols-3 gap-8 items-center animate-fadeIn"
        >
          
          {/* Video Thumbnail */}
          <div className="relative group cursor-pointer lg:col-span-2" onClick={() => window.open(video.url, '_blank')}>
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

            {/* Audio player if available */}
            {video.audio_url && (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <p className="text-white font-medium">Audio Recap</p>
                  
                  <audio
                    controls
                    className="h-8"
                    preload="metadata"
                  >
                    <source src={video.audio_url} type="audio/mpeg" />
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

      {/* Dots indicator */}
      {videos.length > 1 && (
        <div className="flex justify-center mt-6 space-x-2">
          {videos.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === currentIndex 
                  ? 'bg-purple-400 w-8' 
                  : 'bg-purple-600 hover:bg-purple-500'
              }`}
              aria-label={`Go to video ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

