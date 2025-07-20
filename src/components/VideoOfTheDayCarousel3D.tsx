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

export default function VideoOfTheDayCarousel3D() {
  const [videos, setVideos] = useState<VideoWithAudio[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rotation, setRotation] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const startX = useRef(0)
  const startRotation = useRef(0)

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

  // Handle mouse/touch interactions
  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    isDragging.current = true
    startX.current = 'touches' in e ? e.touches[0].clientX : e.clientX
    startRotation.current = rotation
  }

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging.current) return
    
    const currentX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const deltaX = currentX - startX.current
    const newRotation = startRotation.current + (deltaX * 0.5)
    
    setRotation(newRotation)
    
    // Calculate which video should be in front
    const anglePerVideo = 360 / videos.length
    const normalizedRotation = ((newRotation % 360) + 360) % 360
    const newIndex = Math.round(normalizedRotation / anglePerVideo) % videos.length
    setCurrentIndex(newIndex)
  }

  const handleMouseUp = () => {
    if (!isDragging.current) return
    isDragging.current = false
    
    // Snap to nearest video
    const anglePerVideo = 360 / videos.length
    const targetRotation = currentIndex * anglePerVideo
    setRotation(targetRotation)
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
  }, [rotation, currentIndex, videos.length])

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

  const anglePerVideo = 360 / videos.length
  const radius = videos.length > 2 ? 300 : 200

  return (
    <div className="mb-16">
      {/* 3D Carousel Container */}
      <div 
        ref={containerRef}
        className="relative h-[600px] overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
        style={{ perspective: '1200px' }}
      >
        <div 
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateY(${-rotation}deg)`,
            transition: isDragging.current ? 'none' : 'transform 0.5s ease-out'
          }}
        >
          {videos.map((video, index) => {
            const angle = index * anglePerVideo
            const isActive = index === currentIndex
            
            return (
              <div
                key={video.video_id}
                className={`absolute w-[800px] transition-all duration-500 ${
                  isActive ? 'z-20' : 'z-10'
                }`}
                style={{
                  transform: `rotateY(${angle}deg) translateZ(${radius}px)`,
                  opacity: isActive ? 1 : 0.7,
                  filter: isActive ? 'none' : 'brightness(0.7)'
                }}
              >
                {/* Video Card */}
                <div className={`bg-gradient-to-r from-purple-900 via-purple-800 to-indigo-900 rounded-3xl p-8 shadow-2xl border border-purple-500/20 ${
                  isActive ? 'scale-100' : 'scale-90'
                } transition-transform duration-500`}>
                  {/* Indicator */}
                  <div className="mb-4">
                    <p className="text-purple-300">
                      🔥 {video.is_video_of_day ? 'Video of the Day' : 'Featured Video'} • {getDaysAgoText(video.days_ago)}
                    </p>
                  </div>

                  <div className="grid lg:grid-cols-2 gap-8 items-center">
                    {/* Video Thumbnail */}
                    <div 
                      className="relative group cursor-pointer" 
                      onClick={() => isActive && window.open(video.url, '_blank')}
                    >
                      <div className="aspect-video rounded-xl overflow-hidden bg-gray-800">
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
                        {isActive && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/30">
                            <div className="w-20 h-20 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
                              <Play className="w-10 h-10 text-gray-900 ml-1" fill="currentColor" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Video Info */}
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-xl font-bold text-white leading-tight mb-2 line-clamp-2">
                          {video.title}
                        </h3>
                        <p className="text-purple-200 font-medium">{video.channel}</p>
                        
                        {/* View count */}
                        <div className="flex items-center space-x-2 mt-2">
                          <Eye className="w-4 h-4 text-blue-400" />
                          <span className="text-blue-300 text-sm">{formatViews(video.views)} views</span>
                        </div>
                      </div>

                      {/* Audio player if available and active */}
                      {isActive && video.audio_url && (
                        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
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
                      {isActive && (
                        <button
                          onClick={() => window.open(video.url, '_blank')}
                          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg text-sm"
                        >
                          <Play className="w-5 h-5" fill="currentColor" />
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
      </div>

      {/* Instructions */}
      <div className="text-center mt-4">
        <p className="text-gray-400 text-sm">Drag to rotate • Click thumbnail to watch</p>
      </div>
    </div>
  )
}