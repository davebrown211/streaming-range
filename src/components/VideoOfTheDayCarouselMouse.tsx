"use client";

import { useState, useEffect, useRef } from "react";
import { Play, Eye } from "lucide-react";
import { api } from "@/lib/api";

interface VideoWithAudio {
  video_id: string;
  title: string;
  channel: string;
  views: string;
  likes: string;
  engagement: string;
  published: string;
  url: string;
  thumbnail: string;
  duration_seconds: number;
  is_short: boolean;
  days_ago: number;
  audio_url: string;
  ai_summary: string;
  is_video_of_day: boolean;
}

export default function VideoOfTheDayCarouselMouse() {
  const [videos, setVideos] = useState<VideoWithAudio[]>([]);
  const [, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadVideosWithAudio();
  }, []);

  const loadVideosWithAudio = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/videos-with-audio");
      if (!response.ok) throw new Error("Failed to load videos");

      const data = await response.json();

      // Also get the current video of the day if it doesn't have audio
      const vodResponse = await api.getVideoOfTheDay();

      // Check if VOD is already in our list
      const hasVod = data.videos.some(
        (v: VideoWithAudio) => v.video_id === vodResponse.video_id
      );

      if (!hasVod && vodResponse) {
        // Add VOD at the beginning without audio
        data.videos.unshift({
          ...vodResponse,
          audio_url: null,
          ai_summary: vodResponse.ai_summary || null,
          is_video_of_day: true,
        });
      }

      // Sort videos by creation date (most recent first) but keep video of the day first
      const sortedVideos = [...data.videos].sort((a, b) => {
        // Video of the day always comes first
        if (a.is_video_of_day && !b.is_video_of_day) return -1;
        if (!a.is_video_of_day && b.is_video_of_day) return 1;

        // For other videos, sort by published date (newest first)
        return (
          new Date(b.published).getTime() - new Date(a.published).getTime()
        );
      });

      setVideos(sortedVideos);

      // Find the video of the day index (should be 0 after sorting)
      const vodIndex = sortedVideos.findIndex(
        (v: VideoWithAudio) => v.is_video_of_day
      );
      const initialIndex = vodIndex !== -1 ? vodIndex : 0;

      setCurrentIndex(initialIndex);
      setFocusedIndex(initialIndex);
    } catch (err) {
      console.error("Error loading videos:", err);
      setError("Failed to load videos");
    } finally {
      setIsLoading(false);
    }
  };

  const formatViews = (views: string) => {
    const num = parseInt(views.replace(/,/g, ""));
    return api.formatViews(num);
  };

  const getDaysAgoText = (daysAgo: number) => {
    if (daysAgo === 0) return "Today";
    if (daysAgo === 1) return "Yesterday";
    return `${daysAgo}d ago`;
  };

  // Handle clicking on video cards to focus them
  const handleVideoClick = (e: React.MouseEvent, clickedIndex: number) => {
    e.preventDefault();
    e.stopPropagation();

    // Don't change focus if clicking on interactive elements
    const target = e.target as HTMLElement;
    const tagName = target.tagName.toLowerCase();

    if (
      tagName === "audio" ||
      tagName === "button" ||
      tagName === "a" ||
      target.closest("audio") ||
      target.closest("button") ||
      target.closest("a")
    ) {
      return;
    }

    // Focus the clicked video
    setFocusedIndex(clickedIndex);
    setCurrentIndex(clickedIndex);
  };

  if (isLoading) {
    return (
      <div className="mb-16">
        <div className="bg-gradient-to-r from-purple-900 via-purple-800 to-indigo-900 rounded-3xl p-8">
          <div className="animate-pulse">
            <div className="aspect-video bg-purple-700 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || videos.length === 0) {
    return null;
  }

  return (
    <div className="mb-16">
      {/* Carousel Container */}
      <div ref={containerRef} className="relative h-[500px] overflow-hidden">
        {/* Videos Track */}
        <div className="absolute inset-0 flex items-center justify-center">
          {videos.map((video, index) => {
            // Calculate position and scale based on focused video
            const distance = Math.abs(index - focusedIndex);

            // Scale and opacity based on distance from center - make focus more prominent
            const scale = Math.max(0.3, 1 - distance * 0.5);
            const opacity = Math.max(0.15, 1 - distance * 0.5);
            const blur = distance > 0.2 ? Math.min(6, distance * 3) : 0;

            // Position calculation for smooth flow
            const baseSpacing = 350;
            const position = (index - focusedIndex) * baseSpacing;

            const zIndex = Math.round(100 - distance * 10);
            const isActive = index === focusedIndex;

            return (
              <div
                key={video.video_id}
                className="absolute flex items-center justify-center"
                style={{
                  transform: `translateX(${position}px) scale(${scale})`,
                  opacity: opacity,
                  filter: `blur(${blur}px)`,
                  zIndex: zIndex,
                  transition: "all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)",
                  width: "750px",
                  height: "450px",
                  left: "50%",
                  top: "50%",
                  marginLeft: "-375px",
                  marginTop: "-225px",
                  pointerEvents: "auto",
                }}
              >
                {/* Video Card */}
                <div
                  className={`bg-gradient-to-r from-purple-900 via-purple-800 to-indigo-900 rounded-3xl p-6 shadow-2xl border border-purple-500/20 ${
                    isActive ? "ring-2 ring-purple-400" : ""
                  }`}
                  onClick={(e) => handleVideoClick(e, index)}
                >
                  {/* Indicator */}
                  <div className="mb-4">
                    <p className="text-purple-300 text-sm">
                      🔥{" "}
                      {video.is_video_of_day
                        ? "Video of the Day"
                        : "Featured Video"}{" "}
                      • {getDaysAgoText(video.days_ago)}
                    </p>
                  </div>

                  <div className="grid lg:grid-cols-2 gap-6 items-center">
                    {/* Video Thumbnail */}
                    <div
                      className="relative group cursor-pointer"
                      onClick={() =>
                        isActive && window.open(video.url, "_blank")
                      }
                    >
                      <div className="aspect-video rounded-xl overflow-hidden bg-gray-800">
                        <img
                          src={
                            video.thumbnail ||
                            "https://via.placeholder.com/640x360/1a1a1a/666666?text=No+Thumbnail"
                          }
                          alt={video.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src =
                              "https://via.placeholder.com/640x360/1a1a1a/666666?text=No+Thumbnail";
                          }}
                        />

                        {/* Play Button Overlay */}
                        {isActive && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/30">
                            <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
                              <Play
                                className="w-8 h-8 text-gray-900 ml-1"
                                fill="currentColor"
                              />
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
                        <p className="text-purple-200 text-sm font-medium">
                          {video.channel}
                        </p>

                        {/* View count */}
                        <div className="flex items-center space-x-2 mt-2">
                          <Eye className="w-4 h-4 text-blue-400" />
                          <span className="text-blue-300 text-sm">
                            {formatViews(video.views)} views
                          </span>
                        </div>
                      </div>

                      {/* Audio player if available and active */}
                      {isActive && video.audio_url && (
                        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 relative z-40">
                          <div className="flex items-center justify-between">
                            <p className="text-white text-sm font-medium">
                              AI Preview
                            </p>

                            <audio
                              controls
                              className="h-8 scale-90 relative z-50"
                              preload="metadata"
                              style={{
                                pointerEvents: "auto",
                                cursor: "pointer",
                              }}
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
                          onClick={() => window.open(video.url, "_blank")}
                          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg text-sm relative z-40"
                          style={{ pointerEvents: "auto", cursor: "pointer" }}
                        >
                          <Play className="w-4 h-4" fill="currentColor" />
                          <span>Watch on YouTube</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress Indicator */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          <div className="w-64 h-2 bg-white/10 rounded-full">
            <div
              className="h-full bg-purple-400 rounded-full transition-all duration-300"
              style={{
                width: `${(focusedIndex / (videos.length - 1)) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
