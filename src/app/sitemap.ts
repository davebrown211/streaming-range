import { MetadataRoute } from 'next'
import pool from '@/lib/database'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://golfdiscovery.com'

  // Static pages
  const staticPages = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'hourly' as const,
      priority: 1,
    },
    {
      url: `${baseUrl}/trending`,
      lastModified: new Date(),
      changeFrequency: 'hourly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/categories`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    },
  ]

  // Dynamic video pages
  let videoPages: any[] = []
  try {
    const client = await pool.connect()
    const result = await client.query(`
      SELECT yv.id, yv.title, yv.published_at, yv.updated_at
      FROM youtube_videos yv
      WHERE yv.published_at >= NOW() - INTERVAL '30 days'
      ORDER BY yv.published_at DESC
      LIMIT 1000
    `)
    client.release()

    videoPages = result.rows.map((video) => ({
      url: `${baseUrl}/video/${video.id}`,
      lastModified: new Date(video.updated_at || video.published_at),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))
  } catch (error) {
    console.error('Error generating video sitemap entries:', error)
  }

  return [...staticPages, ...videoPages]
}