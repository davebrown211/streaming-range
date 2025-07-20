'use client'

import { useState, useEffect, useRef } from 'react'
import { Play, Eye } from 'lucide-react'
import { api } from '@/lib/api'

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

export default function VideoOfTheDayCarouselFlow() {
  const [videos, setVideos] = useState<VideoWithAudio[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollX, setScrollX] = useState(0)
  const [startScrollX, setStartScrollX] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

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
      
      // Create infinite scroll effect by duplicating videos
      const extendedVideos = [...data.videos, ...data.videos, ...data.videos]
      setVideos(extendedVideos)
      setCurrentIndex(data.videos.length) // Start in the middle set
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

  // Handle mouse/touch interactions
  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true)
    setStartX('touches' in e ? e.touches[0].clientX : e.clientX)
    setStartScrollX(scrollX)
  }

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return
    
    e.preventDefault()
    const currentX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const deltaX = currentX - startX
    const newScrollX = startScrollX - deltaX
    
    setScrollX(newScrollX)
  }

  const handleMouseUp = () => {
    if (!isDragging) return
    setIsDragging(false)
    
    // Snap to nearest video
    const videoWidth = 900 // Width of each video card
    const nearestIndex = Math.round(scrollX / videoWidth)
    const targetScrollX = nearestIndex * videoWidth
    
    setScrollX(targetScrollX)
    setCurrentIndex(nearestIndex)
  }

  useEffect(() => {
    const handleGlobalMouseUp = () => handleMouseUp()
    const handleGlobalMouseMove = (e: MouseEvent) => handleMouseMove(e as any)
    
    window.addEventListener('mouseup', handleGlobalMouseUp)
    window.addEventListener('mousemove', handleGlobalMouseMove)
    window.addEventListener('touchend', handleGlobalMouseUp)
    window.addEventListener('touchmove', handleGlobalMouseMove)
    
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp)
      window.removeEventListener('mousemove', handleGlobalMouseMove)
      window.removeEventListener('touchend', handleGlobalMouseUp)
      window.removeEventListener('touchmove', handleGlobalMouseMove)
    }
  }, [isDragging, scrollX, startX, startScrollX])

  // Handle infinite scroll
  useEffect(() => {
    if (videos.length === 0) return
    
    const originalLength = videos.length / 3
    const videoWidth = 900
    
    if (currentIndex < originalLength) {
      setCurrentIndex(currentIndex + originalLength)
      setScrollX((currentIndex + originalLength) * videoWidth)
    } else if (currentIndex >= originalLength * 2) {
      setCurrentIndex(currentIndex - originalLength)
      setScrollX((currentIndex - originalLength) * videoWidth)
    }
  }, [currentIndex, videos.length])

  if (isLoading) {
    return (
      <div className="mb-16">
        <div className="bg-gradient-to-r from-purple-900 via-purple-800 to-indigo-900 rounded-3xl p-8">
          <div className="animate-pulse">
            <div className="aspect-video bg-purple-700 rounded-xl"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error || videos.length === 0) {
    return null
  }

  return (
    <div className="mb-16">
      {/* Carousel Container */}
      <div 
        ref={containerRef}
        className="relative h-[550px] overflow-hidden cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
      >
        {/* Videos Track */}
        <div 
          className="absolute top-1/2 left-1/2 flex items-center"
          style={{
            transform: `translate(-50%, -50%) translateX(${-scrollX}px)`,
            transition: isDragging ? 'none' : 'transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
          }}
        >
          {videos.map((video, index) => {
            const distance = Math.abs(index - currentIndex)
            const scale = Math.max(0.7, 1 - distance * 0.15)
            const opacity = Math.max(0.4, 1 - distance * 0.2)
            const blur = distance > 1 ? 2 : 0
            const zIndex = 10 - distance
            
            return (
              <div
                key={`${video.video_id}-${index}`}
                className="relative flex-shrink-0 px-8"
                style={{
                  width: '900px',
                  transform: `scale(${scale})`,
                  opacity: opacity,
                  filter: `blur(${blur}px)`,
                  zIndex: zIndex,
                  transition: isDragging ? 'none' : 'all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
                }}
              >
                {/* Video Card */}
                <div className={`bg-gradient-to-r from-purple-900 via-purple-800 to-indigo-900 rounded-3xl p-6 shadow-2xl border border-purple-500/20 ${
                  index === currentIndex ? 'ring-2 ring-purple-400' : ''
                }`}>
                  {/* Indicator */}
                  <div className="mb-4">
                    <p className="text-purple-300 text-sm">
                      🔥 {video.is_video_of_day ? 'Video of the Day' : 'Featured Video'} • {getDaysAgoText(video.days_ago)}
                    </p>
                  </div>

                  <div className="grid lg:grid-cols-2 gap-6 items-center">
                    {/* Video Thumbnail */}
                    <div 
                      className="relative group cursor-pointer" 
                      onClick={() => index === currentIndex && window.open(video.url, '_blank')}
                    >
                      <div className="aspect-video rounded-xl overflow-hidden bg-gray-800">
                        <img
                          src={video.thumbnail || 'https://via.placeholder.com/640x360/1a1a1a/666666?text=No+Thumbnail'}
                          alt={video.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = 'https://via.placeholder.com/640x360/1a1a1a/666666?text=No+Thumbnail';
                          }}
                        />
                        
                        {/* Play Button Overlay */}
                        {index === currentIndex && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/30">
                            <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
                              <Play className="w-8 h-8 text-gray-900 ml-1" fill="currentColor" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Video Info */}
                    <div className="space-y-3">
                      <div>
                        <h3 className="text-lg font-bold text-white leading-tight mb-2 line-clamp-2">
                          {video.title}
                        </h3>
                        <p className="text-purple-200 text-sm font-medium">{video.channel}</p>
                        
                        {/* View count */}
                        <div className="flex items-center space-x-2 mt-2">
                          <Eye className="w-4 h-4 text-blue-400" />
                          <span className="text-blue-300 text-sm">{formatViews(video.views)} views</span>
                        </div>
                      </div>

                      {/* Audio player if available and active */}
                      {index === currentIndex && video.audio_url && (
                        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-white text-sm font-medium">Audio Recap</p>
                            
                            <audio
                              controls
                              className="h-8 scale-90"
                              preload="metadata"
                            >
                              <source src={video.audio_url} type="audio/mpeg" />
                              Your browser does not support the audio element.
                            </audio>
                          </div>
                        </div>
                      )}

                      {/* Watch Button */}
                      {index === currentIndex && (
                        <button
                          onClick={() => window.open(video.url, '_blank')}
                          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg text-sm"
                        >
                          <Play className="w-4 h-4" fill="currentColor" />
                          <span>Watch on YouTube</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Gradient Overlays */}
        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-gray-900 to-transparent pointer-events-none"></div>
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-gray-900 to-transparent pointer-events-none"></div>
      </div>

      {/* Instructions */}
      <div className="text-center mt-4">
        <p className="text-gray-400 text-sm">Drag to browse • Click thumbnail to watch</p>
      </div>
    </div>
  )
}