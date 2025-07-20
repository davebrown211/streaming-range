"use client";

import { useState, useEffect } from "react";
import { Play, ChevronLeft, ChevronRight, Clock, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { useStatsUpdates } from "@/hooks/useWebSocket";
import VideoOfTheDayCarouselMouse from "./VideoOfTheDayCarouselMouse";

interface VideoRanking {
  rank: number;
  title: string;
  channel: string;
  views: string;
  likes: string;
  engagement: string;
  published: string;
  url: string;
  thumbnail: string;
}

interface DirectoryStats {
  total_videos: number;
  total_channels: number;
  categories: Record<string, number>;
  last_updated: string;
}

interface VideoCardProps {
  video: VideoRanking;
  index: number;
}

function VideoCard({ video, index }: VideoCardProps) {
  const formatViews = (views: string) => {
    const num = parseInt(views.replace(/,/g, ""));
    return api.formatViews(num);
  };

  const getDaysAgo = (published: string) => {
    // If the date is in YYYY-MM-DD format, parse it as local date, not UTC
    const [year, month, day] = published.split("T")[0].split("-");
    const publishedDate = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day)
    );

    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    const diffTime = todayStart.getTime() - publishedDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays <= 7) return `${diffDays}d ago`;
    return `${Math.floor(diffDays / 7)}w ago`;
  };

  return (
    <div
      className="group cursor-pointer transition-all duration-300"
      style={{
        animationDelay: `${index * 100}ms`,
        animation: "fadeInUp 0.6s ease-out forwards",
      }}
    >
      {/* Video Thumbnail */}
      <div className="relative aspect-video rounded-xl overflow-hidden bg-gray-800 mb-3 group-hover:scale-[1.02] transition-transform duration-300">
        <img
          src={
            video.thumbnail ||
            "https://via.placeholder.com/480x270/1a1a1a/666666?text=No+Thumbnail"
          }
          alt={video.title}
          className="w-full h-full object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src =
              "https://via.placeholder.com/480x270/1a1a1a/666666?text=No+Thumbnail";
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
  );
}

interface CategorySectionProps {
  title: string;
  videos: VideoRanking[];
  onNext: () => void;
  onPrevious: () => void;
  onReset: () => void;
  canGoPrevious: boolean;
  isLoading?: boolean;
  currentPage?: number;
  sectionKey: string;
  refreshAnimating: string | null;
}

function CategorySection({
  title,
  videos,
  onNext,
  onPrevious,
  onReset,
  canGoPrevious,
  isLoading = false,
  currentPage = 0,
  sectionKey,
  refreshAnimating,
}: CategorySectionProps) {
  return (
    <div className="mb-16">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {title}
          </h2>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onPrevious}
            disabled={!canGoPrevious || isLoading}
            className={`p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all duration-300 backdrop-blur-sm ${
              !canGoPrevious ? "opacity-50 cursor-not-allowed" : "hover:scale-110"
            }`}
            title="Previous videos"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>

          <span className="text-white/60 text-sm px-2">
            Page {currentPage + 1}
          </span>

          <button
            onClick={onNext}
            disabled={isLoading}
            className={`p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all duration-300 backdrop-blur-sm hover:scale-110`}
            title="Next videos"
          >
            <ChevronRight className="w-5 h-5 text-white" />
          </button>

          <button
            onClick={onReset}
            disabled={currentPage === 0 || refreshAnimating === sectionKey}
            className={`p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all duration-300 backdrop-blur-sm ${
              currentPage === 0 || refreshAnimating === sectionKey ? "opacity-50 cursor-not-allowed" : "hover:scale-110"
            }`}
            title="Return to first page"
          >
            <RefreshCw className={`w-4 h-4 text-white ${refreshAnimating === sectionKey ? "refresh-spinning" : ""}`} />
          </button>
        </div>
      </div>

      {/* Video Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {videos.length > 0 ? (
          videos.map((video, index) => (
            <VideoCard
              key={`${title}-${video.url}-${index}`}
              video={video}
              index={index}
            />
          ))
        ) : (
          <div className="col-span-full text-center py-8">
            <p className="text-gray-400">No videos available</p>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-2 text-xs text-gray-500">
        {videos.length} videos displayed {isLoading && "(loading...)"}
      </div>
    </div>
  );
}

export default function HomePage() {
  const [curatedVideos, setCuratedVideos] = useState<VideoRanking[]>([]);
  const [discoveryVideos, setDiscoveryVideos] = useState<VideoRanking[]>([]);
  const [stats, setStats] = useState<DirectoryStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshingSection, setRefreshingSection] = useState<string | null>(
    null
  );
  const [includeShorts, setIncludeShorts] = useState(false);
  const [curatedOffset, setCuratedOffset] = useState(0);
  const [discoveryOffset, setDiscoveryOffset] = useState(0);
  const [refreshAnimating, setRefreshAnimating] = useState<string | null>(null);

  // Debug state changes (can be removed in production)
  useEffect(() => {
    console.log("📊 Curated videos updated:", curatedVideos.length, "videos");
  }, [curatedVideos]);

  useEffect(() => {
    console.log(
      "🔍 Discovery videos updated:",
      discoveryVideos.length,
      "videos"
    );
  }, [discoveryVideos]);

  // WebSocket hooks for real-time updates
  const { stats: liveStats } = useStatsUpdates();
  const wsConnected = false; // WebSocket connection status (disabled for now)

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if (liveStats && liveStats.total_videos) {
      setStats(liveStats);
    }
  }, [liveStats]);

  const loadAllData = async () => {
    try {
      setIsLoading(true);
      const [curatedResponse, discoveryResponse, directoryStats] =
        await Promise.all([
          fetch("/api/curated-videos"),
          fetch("/api/discovery-videos"),
          api.getStats(),
        ]);

      const curated = await curatedResponse.json();
      const discovery = await discoveryResponse.json();

      setCuratedVideos(curated.videos?.slice(0, 3) || []);
      setDiscoveryVideos(discovery.videos?.slice(0, 3) || []);
      setStats(directoryStats);
    } catch (err) {
      console.error("Error loading data:", err);
      // Set empty arrays on error
      setCuratedVideos([]);
      setDiscoveryVideos([]);
    } finally {
      setIsLoading(false);
    }
  };

  const navigateSection = async (
    section: string,
    direction: "next" | "previous" | "reset"
  ) => {
    try {
      console.log(`🔄 Refreshing ${section} section...`);
      setRefreshingSection(section);

      if (section === "curated") {
        let targetOffset = curatedOffset;

        if (direction === "next") {
          targetOffset = curatedOffset + 3;
        } else if (direction === "previous" && curatedOffset >= 3) {
          targetOffset = curatedOffset - 3;
        } else if (direction === "reset") {
          targetOffset = 0;
          setRefreshAnimating(section);
          setTimeout(() => setRefreshAnimating(null), 800);
        }

        console.log(
          `🎯 Fetching curated videos with offset ${targetOffset}...`
        );
        const response = await fetch(
          `/api/curated-videos?offset=${targetOffset}&limit=3&t=${Date.now()}`,
          {
            cache: "no-cache",
            headers: {
              "Cache-Control": "no-cache",
              Pragma: "no-cache",
            },
          }
        );
        const data = await response.json();
        console.log(
          "✅ Curated videos refreshed:",
          data.videos?.length,
          "videos available"
        );
        const newVideos = data.videos || [];

        // If no videos returned on next, reset to beginning
        if (
          newVideos.length === 0 &&
          direction === "next" &&
          targetOffset > 0
        ) {
          console.log(
            "🔄 Reached end of curated videos, looping back to beginning..."
          );
          const resetResponse = await fetch(
            `/api/curated-videos?offset=0&limit=3&t=${Date.now()}`,
            {
              cache: "no-cache",
              headers: {
                "Cache-Control": "no-cache",
                Pragma: "no-cache",
              },
            }
          );
          const resetData = await resetResponse.json();
          setCuratedVideos([...(resetData.videos || [])]);
          setCuratedOffset(0);
        } else if (newVideos.length > 0) {
          setCuratedVideos([...newVideos]); // Force new array reference
          setCuratedOffset(targetOffset);
        }
      } else if (section === "discovery") {
        let targetOffset = discoveryOffset;

        if (direction === "next") {
          targetOffset = discoveryOffset + 3;
        } else if (direction === "previous" && discoveryOffset >= 3) {
          targetOffset = discoveryOffset - 3;
        } else if (direction === "reset") {
          targetOffset = 0;
          setRefreshAnimating(section);
          setTimeout(() => setRefreshAnimating(null), 800);
        }

        console.log(
          `🔍 Fetching discovery videos with offset ${targetOffset}...`
        );
        const response = await fetch(
          `/api/discovery-videos?offset=${targetOffset}&limit=3&t=${Date.now()}`,
          {
            cache: "no-cache",
            headers: {
              "Cache-Control": "no-cache",
              Pragma: "no-cache",
            },
          }
        );
        const data = await response.json();
        console.log(
          "✅ Discovery videos refreshed:",
          data.videos?.length,
          "videos available"
        );
        const newVideos = data.videos || [];

        // If no videos returned on next, reset to beginning
        if (
          newVideos.length === 0 &&
          direction === "next" &&
          targetOffset > 0
        ) {
          console.log(
            "🔄 Reached end of discovery videos, looping back to beginning..."
          );
          const resetResponse = await fetch(
            `/api/discovery-videos?offset=0&limit=3&t=${Date.now()}`,
            {
              cache: "no-cache",
              headers: {
                "Cache-Control": "no-cache",
                Pragma: "no-cache",
              },
            }
          );
          const resetData = await resetResponse.json();
          setDiscoveryVideos([...(resetData.videos || [])]);
          setDiscoveryOffset(0);
        } else if (newVideos.length > 0) {
          setDiscoveryVideos([...newVideos]); // Force new array reference
          setDiscoveryOffset(targetOffset);
        }
      }
    } catch (err) {
      console.error(`❌ Error refreshing ${section}:`, err);
    } finally {
      console.log(`✅ Finished refreshing ${section}`);
      setRefreshingSection(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse">
            <Play className="w-10 h-10 text-white" />
          </div>
          <p className="text-white text-lg">
            Discovering fresh golf content...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">

      {/* Stats Bar */}
      {stats && (
        <div className="border-b border-white/10 bg-black/30 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between text-white">
              <div className="flex items-center justify-center space-x-8 flex-1">
                <div className="flex items-center space-x-2">
                  <Play className="w-4 h-4 text-blue-400" />
                  <span className="font-bold">
                    {stats.total_videos.toLocaleString()}
                  </span>
                  <span className="text-gray-400">videos</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-green-400" />
                  <span className="font-bold">
                    {stats.total_channels.toLocaleString()}
                  </span>
                  <span className="text-gray-400">channels</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-400">Updated</span>
                  <span className="font-bold">
                    {new Date(stats.last_updated).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              {/* Shorts Toggle */}
              <div className="flex items-center space-x-3">
                <span className="text-gray-400 text-sm">
                  {includeShorts ? "Shorts" : "Long-form"}
                </span>
                <button
                  onClick={() => setIncludeShorts(!includeShorts)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                    includeShorts ? "bg-blue-500" : "bg-gray-600"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                      includeShorts ? "translate-x-6" : "translate-x-1"
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
        <VideoOfTheDayCarouselMouse />

        {/* Curated Content from Whitelisted Creators */}
        <CategorySection
          title="Recently Uploaded"
          videos={curatedVideos}
          onNext={() => navigateSection("curated", "next")}
          onPrevious={() => navigateSection("curated", "previous")}
          onReset={() => navigateSection("curated", "reset")}
          canGoPrevious={curatedOffset > 0}
          isLoading={refreshingSection === "curated"}
          currentPage={Math.floor(curatedOffset / 3)}
          sectionKey="curated"
          refreshAnimating={refreshAnimating}
        />

        {/* Discovery Content */}
        <CategorySection
          title="title like '%golf%'"
          videos={discoveryVideos}
          onNext={() => navigateSection("discovery", "next")}
          onPrevious={() => navigateSection("discovery", "previous")}
          onReset={() => navigateSection("discovery", "reset")}
          canGoPrevious={discoveryOffset > 0}
          isLoading={refreshingSection === "discovery"}
          currentPage={Math.floor(discoveryOffset / 3)}
          sectionKey="discovery"
          refreshAnimating={refreshAnimating}
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

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .refresh-spinning {
          animation: spin 0.8s ease-in-out;
        }

        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}
