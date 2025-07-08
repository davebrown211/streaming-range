'use client'

import { useState, useEffect } from 'react'
import { Play, RotateCcw, ExternalLink, Clock, TrendingUp, Gem, Zap } from 'lucide-react'
import { api } from '@/lib/api'
import { useRankingUpdates, useStatsUpdates } from '@/hooks/useWebSocket'
import VideoOfTheDayComponent from './VideoOfTheDay'

interface VideoRanking {
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

interface DirectoryStats {
  total_videos: number
  total_channels: number
  categories: Record<string, number>
  last_updated: string
}

interface VideoCardProps {
  video: VideoRanking
  index: number
}

function VideoCard({ video, index }: VideoCardProps) {
  const formatViews = (views: string) => {
    const num = parseInt(views.replace(/,/g, ''))
    return api.formatViews(num)
  }

  const getDaysAgo = (published: string) => {
    const publishedDate = new Date(published)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - publishedDate.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 1) return 'Today'
    if (diffDays === 2) return 'Yesterday'
    if (diffDays <= 7) return `${diffDays}d ago`
    return `${Math.floor(diffDays / 7)}w ago`
  }

  return (
    <div 
      className="group cursor-pointer transition-all duration-300"
      style={{ 
        animationDelay: `${index * 100}ms`,
        animation: 'fadeInUp 0.6s ease-out forwards'
      }}
    >
      {/* Video Thumbnail */}
      <div className="relative aspect-video rounded-xl overflow-hidden bg-gray-800 mb-3 group-hover:scale-[1.02] transition-transform duration-300">
        <img
          src={video.thumbnail || 'https://via.placeholder.com/480x270/1a1a1a/666666?text=No+Thumbnail'}
          alt={video.title}
          className="w-full h-full object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = 'https://via.placeholder.com/480x270/1a1a1a/666666?text=No+Thumbnail';
          }}
        />
        
        {/* Play Button Overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/20">
          <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
            <Play className="w-7 h-7 text-gray-900 ml-1" fill="currentColor" />
          </div>
        </div>


        {/* Duration Badge */}
        <div className="absolute bottom-2 right-2">
          <div className="px-2 py-1 bg-black/70 backdrop-blur-sm rounded text-white text-xs font-medium">
            {getDaysAgo(video.published)}
          </div>
        </div>

        {/* External Link */}
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0 z-10"
          aria-label={`Watch ${video.title}`}
        />
      </div>

      {/* Video Info - Below thumbnail like YouTube */}
      <div className="px-1">
        <h3 className="font-semibold text-white text-sm leading-tight mb-2 line-clamp-2 group-hover:text-blue-300 transition-colors duration-300">
          {video.title}
        </h3>
        
        <p className="text-gray-400 text-sm mb-1">{video.channel}</p>
        
        <div className="flex items-center text-gray-500 text-xs space-x-2">
          <span>{formatViews(video.views)} views</span>
          <span>•</span>
          <span>{video.engagement} engagement</span>
        </div>
      </div>
    </div>
  )
}

interface CategorySectionProps {
  title: string
  icon: React.ReactNode
  videos: VideoRanking[]
  accent: string
  onRefresh: () => void
  isLoading?: boolean
}

function CategorySection({ title, icon, videos, accent, onRefresh, isLoading = false }: CategorySectionProps) {
  return (
    <div className="mb-16">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className={`w-12 h-12 ${accent} rounded-2xl flex items-center justify-center shadow-lg`}>
            {icon}
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">{title}</h2>
        </div>
        
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className={`p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all duration-300 backdrop-blur-sm ${
            isLoading ? 'animate-spin' : 'hover:scale-110'
          }`}
        >
          <RotateCcw className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Video Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {videos.map((video, index) => (
          <VideoCard key={`${title}-${video.rank}-${index}`} video={video} index={index} />
        ))}
      </div>
    </div>
  )
}

export default function HomePage() {
  const [viralVideos, setViralVideos] = useState<VideoRanking[]>([])
  const [trendingVideos, setTrendingVideos] = useState<VideoRanking[]>([])
  const [hiddenGems, setHiddenGems] = useState<VideoRanking[]>([])
  const [dailyTrending, setDailyTrending] = useState<VideoRanking[]>([])
  const [stats, setStats] = useState<DirectoryStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [refreshingSection, setRefreshingSection] = useState<string | null>(null)
  const [includeShorts, setIncludeShorts] = useState(false)
  
  // WebSocket hooks for real-time updates
  const { rankings: liveRankings, isConnected: wsConnected } = useRankingUpdates()
  const { stats: liveStats } = useStatsUpdates()

  useEffect(() => {
    loadAllData()
  }, [])

  // Reload data when shorts setting changes
  useEffect(() => {
    if (!isLoading) {
      loadAllData()
    }
  }, [includeShorts])

  // Update data when WebSocket receives new rankings
  useEffect(() => {
    if (liveRankings.all_time_views) setViralVideos(liveRankings.all_time_views)
    if (liveRankings.weekly_trending) setTrendingVideos(liveRankings.weekly_trending)
    if (liveRankings.high_engagement) setHiddenGems(liveRankings.high_engagement)
    if (liveRankings.daily_trending) setDailyTrending(liveRankings.daily_trending)
  }, [liveRankings])

  useEffect(() => {
    if (liveStats && liveStats.total_videos) {
      setStats(liveStats)
    }
  }, [liveStats])

  const loadAllData = async () => {
    try {
      setIsLoading(true)
      const [viral, trending, gems, daily, directoryStats] = await Promise.all([
        api.getRankings('all_time_views', 3, includeShorts),
        api.getRankings('weekly_trending', 3, includeShorts),
        api.getRankings('high_engagement', 3, includeShorts),
        api.getRankings('daily_trending', 3, includeShorts),
        api.getStats()
      ])

      setViralVideos(viral)
      setTrendingVideos(trending)
      setHiddenGems(gems)
      setDailyTrending(daily)
      setStats(directoryStats)
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const refreshSection = async (section: string, apiCall: string) => {
    try {
      setRefreshingSection(section)
      const data = await api.getRankings(apiCall, 3, includeShorts)
      
      switch (section) {
        case 'viral':
          setViralVideos(data)
          break
        case 'trending':
          setTrendingVideos(data)
          break
        case 'gems':
          setHiddenGems(data)
          break
        case 'daily':
          setDailyTrending(data)
          break
      }
    } catch (err) {
      console.error(`Error refreshing ${section}:`, err)
    } finally {
      setRefreshingSection(null)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse">
            <Play className="w-10 h-10 text-white" />
          </div>
          <p className="text-white text-lg">Discovering fresh golf content...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      {/* Live Status */}
      <div className="fixed top-6 right-6 z-50">
        <div className="flex items-center space-x-2 px-4 py-2 bg-black/50 backdrop-blur-sm rounded-full border border-white/20">
          <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
          <span className="text-white text-sm font-medium">
            {wsConnected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="border-b border-white/10 bg-black/30 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between text-white">
              <div className="flex items-center justify-center space-x-8 flex-1">
                <div className="flex items-center space-x-2">
                  <Play className="w-4 h-4 text-blue-400" />
                  <span className="font-bold">{stats.total_videos.toLocaleString()}</span>
                  <span className="text-gray-400">videos</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-green-400" />
                  <span className="font-bold">{stats.total_channels.toLocaleString()}</span>
                  <span className="text-gray-400">channels</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-400">Updated</span>
                  <span className="font-bold">{new Date(stats.last_updated).toLocaleTimeString()}</span>
                </div>
              </div>
              
              {/* Shorts Toggle */}
              <div className="flex items-center space-x-3">
                <span className="text-gray-400 text-sm">{includeShorts ? 'Shorts' : 'Long-form'}</span>
                <button
                  onClick={() => setIncludeShorts(!includeShorts)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                    includeShorts ? 'bg-blue-500' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                      includeShorts ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        
        {/* Video of the Day */}
        <VideoOfTheDayComponent />
        
        {/* Daily Trending */}
        <CategorySection
          title="Recently Uploaded"
          icon={<Zap className="w-6 h-6 text-yellow-300" />}
          videos={dailyTrending}
          accent="bg-gradient-to-r from-yellow-500 to-orange-500"
          onRefresh={() => refreshSection('daily', 'daily_trending')}
          isLoading={refreshingSection === 'daily'}
        />

        {/* Viral Now */}
        <CategorySection
          title="Viral Now"
          icon={<TrendingUp className="w-6 h-6 text-red-300" />}
          videos={viralVideos}
          accent="bg-gradient-to-r from-red-500 to-pink-500"
          onRefresh={() => refreshSection('viral', 'all_time_views')}
          isLoading={refreshingSection === 'viral'}
        />

        {/* Trending Up */}
        <CategorySection
          title="Trending Up"
          icon={<TrendingUp className="w-6 h-6 text-blue-300" />}
          videos={trendingVideos}
          accent="bg-gradient-to-r from-blue-500 to-cyan-500"
          onRefresh={() => refreshSection('trending', 'weekly_trending')}
          isLoading={refreshingSection === 'trending'}
        />

        {/* Hidden Gems */}
        <CategorySection
          title="Hidden Gems"
          icon={<Gem className="w-6 h-6 text-purple-300" />}
          videos={hiddenGems}
          accent="bg-gradient-to-r from-purple-500 to-indigo-500"
          onRefresh={() => refreshSection('gems', 'high_engagement')}
          isLoading={refreshingSection === 'gems'}
        />
      </div>

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  )
}