import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Play, Eye, Calendar, User } from 'lucide-react'
import pool from '@/lib/database'
import { VideoStructuredData } from '@/components/StructuredData'
import { api } from '@/lib/api'

interface VideoPageProps {
  params: Promise<{ id: string }>
}

async function getVideo(id: string) {
  try {
    const client = await pool.connect()
    
    const result = await client.query(`
      SELECT 
        yv.id,
        yv.title,
        yv.published_at,
        yv.view_count,
        yv.like_count,
        yv.duration_seconds,
        yv.thumbnail_url,
        yc.title as channel_name,
        va.result as ai_summary,
        va.audio_url
      FROM youtube_videos yv
      JOIN youtube_channels yc ON yv.channel_id = yc.id
      LEFT JOIN video_analyses va ON va.youtube_url LIKE '%' || yv.id || '%'
      WHERE yv.id = $1
    `, [id])
    
    client.release()
    
    if (result.rows.length === 0) {
      return null
    }
    
    const video = result.rows[0]
    return {
      video_id: video.id,
      title: video.title,
      channel: video.channel_name,
      views: video.view_count?.toString() || '0',
      likes: video.like_count?.toString() || '0',
      published: video.published_at,
      url: `https://youtube.com/watch?v=${video.id}`,
      thumbnail: video.thumbnail_url,
      duration_seconds: video.duration_seconds || 0,
      ai_summary: video.ai_summary ? JSON.parse(video.ai_summary).summary : null,
      audio_url: video.audio_url,
      days_ago: Math.floor((Date.now() - new Date(video.published_at).getTime()) / (1000 * 60 * 60 * 24))
    }
  } catch (error) {
    console.error('Error fetching video:', error)
    return null
  }
}

export async function generateMetadata({ params }: VideoPageProps): Promise<Metadata> {
  const { id } = await params
  const video = await getVideo(id)
  
  if (!video) {
    return {
      title: 'Video Not Found - Golf Discovery',
      description: 'The requested golf video could not be found.'
    }
  }

  const description = video.ai_summary 
    ? `${video.ai_summary.slice(0, 155)}...`
    : `Watch this trending golf video by ${video.channel}. Discover the best golf content before it goes viral.`

  return {
    title: `${video.title} - Golf Discovery`,
    description,
    keywords: `golf video, ${video.channel}, golf highlights, golf instruction, trending golf, ${video.title}`,
    openGraph: {
      title: video.title,
      description,
      images: [
        {
          url: video.thumbnail,
          width: 1280,
          height: 720,
          alt: video.title,
        }
      ],
      type: 'video.other',
      url: `https://golfdiscovery.com/video/${id}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: video.title,
      description,
      images: [video.thumbnail],
    },
    alternates: {
      canonical: `/video/${id}`,
    }
  }
}

export default async function VideoPage({ params }: VideoPageProps) {
  const { id } = await params
  const video = await getVideo(id)
  
  if (!video) {
    notFound()
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900">
      <VideoStructuredData video={video} />
      
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumbs */}
        <nav className="mb-6">
          <ol className="flex items-center space-x-2 text-purple-300">
            <li><a href="/" className="hover:text-white">Home</a></li>
            <li>•</li>
            <li className="text-white">Video</li>
          </ol>
        </nav>

        {/* Video Content */}
        <div className="max-w-6xl mx-auto">
          <div className="bg-gradient-to-r from-purple-900 via-purple-800 to-indigo-900 rounded-3xl p-8 shadow-2xl border border-purple-500/20">
            <div className="grid lg:grid-cols-3 gap-8 items-start">
              
              {/* Video Thumbnail */}
              <div className="lg:col-span-2">
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

                {/* Video Title */}
                <h1 className="text-3xl font-bold text-white leading-tight mt-6 mb-4">
                  {video.title}
                </h1>

                {/* Video Metadata */}
                <div className="flex flex-wrap items-center gap-6 text-purple-200 mb-6">
                  <div className="flex items-center space-x-2">
                    <User className="w-5 h-5" />
                    <span className="font-medium">{video.channel}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Eye className="w-5 h-5" />
                    <span>{formatViews(video.views)} views</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-5 h-5" />
                    <span>{getDaysAgoText(video.days_ago)}</span>
                  </div>
                </div>

                {/* AI Summary */}
                {video.ai_summary && (
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-6">
                    <h2 className="text-xl font-semibold text-white mb-3">Video Preview</h2>
                    <p className="text-purple-100 leading-relaxed">{video.ai_summary}</p>
                  </div>
                )}
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Audio Player */}
                {video.audio_url && (
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                    <h3 className="text-white font-medium mb-4">Audio Recap</h3>
                    <audio
                      controls
                      className="w-full"
                      preload="metadata"
                    >
                      <source src={video.audio_url} type="audio/mpeg" />
                      Your browser does not support the audio element.
                    </audio>
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

                {/* Share */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                  <h3 className="text-white font-medium mb-4">Share This Video</h3>
                  <div className="space-y-2">
                    <button 
                      onClick={() => navigator.share({ title: video.title, url: window.location.href })}
                      className="w-full text-left text-purple-200 hover:text-white transition-colors py-2"
                    >
                      Share this page
                    </button>
                    <button 
                      onClick={() => navigator.clipboard.writeText(window.location.href)}
                      className="w-full text-left text-purple-200 hover:text-white transition-colors py-2"
                    >
                      Copy link
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}