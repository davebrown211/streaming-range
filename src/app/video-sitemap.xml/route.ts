import { NextResponse } from 'next/server'
import pool from '@/lib/database'

export async function GET() {
  try {
    const client = await pool.connect()
    
    // Get recent videos with thumbnails
    const result = await client.query(`
      SELECT 
        yv.id,
        yv.title,
        yv.published_at,
        yv.updated_at,
        yv.thumbnail_url,
        yv.duration_seconds,
        yc.title as channel_name,
        va.result as ai_summary
      FROM youtube_videos yv
      JOIN youtube_channels yc ON yv.channel_id = yc.id
      LEFT JOIN video_analyses va ON va.youtube_url LIKE '%' || yv.id || '%'
      WHERE yv.published_at >= NOW() - INTERVAL '30 days'
        AND yv.thumbnail_url IS NOT NULL
      ORDER BY yv.published_at DESC
      LIMIT 1000
    `)
    
    client.release()

    const baseUrl = 'https://golfdiscovery.com'
    
    const videoSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${result.rows.map((video) => {
  const description = video.ai_summary 
    ? JSON.parse(video.ai_summary).summary?.slice(0, 2048) || video.title
    : video.title
  
  return `  <url>
    <loc>${baseUrl}/video/${video.id}</loc>
    <video:video>
      <video:thumbnail_loc>${video.thumbnail_url}</video:thumbnail_loc>
      <video:title><![CDATA[${video.title}]]></video:title>
      <video:description><![CDATA[${description}]]></video:description>
      <video:content_loc>https://youtube.com/watch?v=${video.id}</video:content_loc>
      <video:duration>${video.duration_seconds}</video:duration>
      <video:publication_date>${new Date(video.published_at).toISOString()}</video:publication_date>
      <video:family_friendly>yes</video:family_friendly>
      <video:uploader info="${baseUrl}">${video.channel_name}</video:uploader>
    </video:video>
    <lastmod>${new Date(video.updated_at || video.published_at).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`
}).join('\n')}
</urlset>`

    return new NextResponse(videoSitemap, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
      }
    })
  } catch (error) {
    console.error('Error generating video sitemap:', error)
    return new NextResponse('Error generating sitemap', { status: 500 })
  }
}