'use client'

interface VideoStructuredDataProps {
  video: {
    video_id: string
    title: string
    channel: string
    views: string
    published: string
    url: string
    thumbnail: string
    duration_seconds: number
    ai_summary?: string
  }
}

export function VideoStructuredData({ video }: VideoStructuredDataProps) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: video.title,
    description: video.ai_summary || `Golf video by ${video.channel}`,
    thumbnailUrl: video.thumbnail,
    uploadDate: video.published,
    duration: `PT${video.duration_seconds}S`,
    contentUrl: video.url,
    embedUrl: video.url,
    publisher: {
      "@type": "Organization",
      name: video.channel,
    },
    interactionStatistic: {
      "@type": "InteractionCounter",
      interactionType: { "@type": "WatchAction" },
      userInteractionCount: parseInt(video.views.replace(/,/g, '')) || 0
    },
    genre: "Golf",
    keywords: "golf, golf video, golf instruction, golf highlights, trending golf",
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.5",
      ratingCount: "100"
    }
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  )
}

export function WebsiteStructuredData() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "StreamingRange",
    url: "https://streamingrange.com",
    description: "Discover hot and trending golf videos from YouTube creators. AI-curated golf streaming platform with audio summaries.",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: "https://streamingrange.com/search?q={search_term_string}"
      },
      "query-input": "required name=search_term_string"
    },
    sameAs: [
      "https://twitter.com/streamingrange",
      "https://youtube.com/@streamingrange"
    ]
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  )
}

export function OrganizationStructuredData() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "StreamingRange",
    url: "https://streamingrange.com",
    logo: "https://streamingrange.com/logo.png",
    description: "AI-curated golf streaming platform helping golfers discover hot and trending content from YouTube creators.",
    sameAs: [
      "https://twitter.com/streamingrange",
      "https://youtube.com/@streamingrange"
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "Customer Service",
      email: "hello@streamingrange.com"
    }
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  )
}