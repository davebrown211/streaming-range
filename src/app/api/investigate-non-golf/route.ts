import { NextResponse } from 'next/server'
import pool from '@/lib/database'

export async function GET() {
  try {
    const client = await pool.connect()
    
    try {
      const results: any = {}
      
      // 1. Find non-golf channels
      const nonGolfChannelKeywords = [
        'Benjamin Cowen', 'Unisport', 'Crypto', 'Bitcoin', 
        'Soccer', 'Football', 'NBA', 'NFL', 'MLB', 'Cooking',
        'Gaming', 'Music', 'Fashion', 'Beauty'
      ]
      
      const nonGolfChannels: any[] = []
      
      for (const keyword of nonGolfChannelKeywords) {
        const channelResult = await client.query(`
          SELECT DISTINCT yc.id, yc.title, COUNT(yv.id) as video_count
          FROM youtube_channels yc
          JOIN youtube_videos yv ON yc.id = yv.channel_id
          WHERE LOWER(yc.title) LIKE LOWER($1)
          GROUP BY yc.id, yc.title
          ORDER BY video_count DESC
        `, [`%${keyword}%`])
        
        if (channelResult.rows.length > 0) {
          nonGolfChannels.push(...channelResult.rows.map(row => ({
            ...row,
            matched_keyword: keyword
          })))
        }
      }
      
      results.nonGolfChannels = nonGolfChannels
      
      // 2. Find non-golf videos by title
      const nonGolfVideoKeywords = [
        'crypto', 'bitcoin', 'ethereum', 'soccer', 'football', 
        'basketball', 'nba', 'nfl', 'cooking', 'recipe', 
        'gaming', 'music', 'fashion', 'makeup'
      ]
      
      const nonGolfVideos: any[] = []
      
      for (const keyword of nonGolfVideoKeywords) {
        const videoResult = await client.query(`
          SELECT yv.id, yv.title, yc.title as channel_title, yv.view_count, yv.category
          FROM youtube_videos yv
          JOIN youtube_channels yc ON yv.channel_id = yc.id
          WHERE LOWER(yv.title) LIKE LOWER($1)
             AND LOWER(yv.title) NOT LIKE '%golf%'
          ORDER BY yv.view_count DESC
          LIMIT 5
        `, [`%${keyword}%`])
        
        if (videoResult.rows.length > 0) {
          nonGolfVideos.push(...videoResult.rows.map(row => ({
            ...row,
            matched_keyword: keyword
          })))
        }
      }
      
      results.nonGolfVideos = nonGolfVideos
      
      // 3. Analyze channels that might have brought in non-golf content
      const suspiciousChannelPatterns = await client.query(`
        SELECT yc.id, yc.title, 
               COUNT(yv.id) as total_videos,
               COUNT(CASE WHEN LOWER(yv.title) LIKE '%golf%' THEN 1 END) as golf_videos,
               COUNT(CASE WHEN LOWER(yv.title) NOT LIKE '%golf%' THEN 1 END) as non_golf_videos
        FROM youtube_channels yc
        JOIN youtube_videos yv ON yc.id = yv.channel_id
        GROUP BY yc.id, yc.title
        HAVING COUNT(CASE WHEN LOWER(yv.title) NOT LIKE '%golf%' THEN 1 END) > 0
           AND COUNT(CASE WHEN LOWER(yv.title) LIKE '%golf%' THEN 1 END) = 0
        ORDER BY total_videos DESC
        LIMIT 20
      `)
      
      results.suspiciousChannels = suspiciousChannelPatterns.rows
      
      // 4. Check for problematic search terms
      const searchTermAnalysis = []
      const broadTerms = ['good', 'perfect', 'best', 'amazing']
      
      for (const term of broadTerms) {
        const termResult = await client.query(`
          SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN LOWER(yv.title) LIKE '%golf%' OR LOWER(yc.title) LIKE '%golf%' THEN 1 END) as golf_related,
            COUNT(CASE WHEN LOWER(yv.title) NOT LIKE '%golf%' AND LOWER(yc.title) NOT LIKE '%golf%' THEN 1 END) as non_golf
          FROM youtube_videos yv
          JOIN youtube_channels yc ON yv.channel_id = yc.id
          WHERE LOWER(yv.title) LIKE LOWER($1)
        `, [`%${term}%`])
        
        if (termResult.rows[0].total > 0) {
          searchTermAnalysis.push({
            term,
            ...termResult.rows[0],
            non_golf_percentage: (termResult.rows[0].non_golf / termResult.rows[0].total * 100).toFixed(1)
          })
        }
      }
      
      results.searchTermAnalysis = searchTermAnalysis
      
      // 5. Summary statistics
      const totalStats = await client.query(`
        SELECT 
          (SELECT COUNT(*) FROM youtube_videos) as total_videos,
          (SELECT COUNT(*) FROM youtube_channels) as total_channels,
          (SELECT COUNT(DISTINCT channel_id) FROM youtube_videos 
           WHERE channel_id IN (
             SELECT yc.id FROM youtube_channels yc
             WHERE LOWER(yc.title) LIKE '%benjamin cowen%'
                OR LOWER(yc.title) LIKE '%unisport%'
                OR LOWER(yc.title) LIKE '%crypto%'
                OR LOWER(yc.title) LIKE '%bitcoin%'
                OR LOWER(yc.title) LIKE '%soccer%'
                OR LOWER(yc.title) LIKE '%football%'
                OR LOWER(yc.title) LIKE '%nba%'
           )) as non_golf_channel_count
      `)
      
      results.summary = totalStats.rows[0]
      
      // 6. Get specific examples from known non-golf channels
      const specificExamples = await client.query(`
        SELECT yv.id, yv.title, yc.title as channel_title, yv.view_count, yv.published_at
        FROM youtube_videos yv
        JOIN youtube_channels yc ON yv.channel_id = yc.id
        WHERE LOWER(yc.title) LIKE '%benjamin cowen%'
           OR LOWER(yc.title) LIKE '%unisport%'
        ORDER BY yv.view_count DESC
        LIMIT 20
      `)
      
      results.specificExamples = specificExamples.rows
      
      return NextResponse.json(results)
      
    } finally {
      client.release()
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Investigation failed', message: (error as Error).message },
      { status: 500 }
    )
  }
}