const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:mysecretpassword@localhost/postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

async function cleanupNonGolfContent() {
  const client = await pool.connect()
  
  try {
    console.log('Starting cleanup of non-golf content...')
    
    // Remove explicit non-golf content
    const nonGolfKeywords = [
      'volleyball', 'basketball', 'football', 'soccer', 'tennis', 'baseball',
      'cycling', 'tour de france', 'swimming', 'running', 'marathon',
      'crypto', 'bitcoin', 'ethereum', 'nft', 'forex',
      'cooking', 'recipe', 'fashion', 'makeup', 'beauty',
      'car review', 'automotive', 'truck', 'motorcycle',
      'video game', 'gaming', 'twitch', 'minecraft',
      'politics', 'election', 'president', 'congress'
    ]
    
    let totalDeleted = 0
    
    for (const keyword of nonGolfKeywords) {
      // First, delete from related tables
      await client.query(`
        DELETE FROM video_rankings 
        WHERE video_id IN (
          SELECT id FROM youtube_videos 
          WHERE (title ILIKE $1 OR description ILIKE $1)
          AND title NOT ILIKE '%golf%'
          AND description NOT ILIKE '%golf%'
        )
      `, [`%${keyword}%`])
      
      await client.query(`
        DELETE FROM video_view_history 
        WHERE video_id IN (
          SELECT id FROM youtube_videos 
          WHERE (title ILIKE $1 OR description ILIKE $1)
          AND title NOT ILIKE '%golf%'
          AND description NOT ILIKE '%golf%'
        )
      `, [`%${keyword}%`])
      
      // Then delete from videos table
      const result = await client.query(`
        DELETE FROM youtube_videos 
        WHERE (title ILIKE $1 OR description ILIKE $1)
        AND title NOT ILIKE '%golf%'
        AND description NOT ILIKE '%golf%'
      `, [`%${keyword}%`])
      
      if (result.rowCount > 0) {
        console.log(`Removed ${result.rowCount} videos containing "${keyword}"`)
        totalDeleted += result.rowCount
      }
    }
    
    // Remove specific problem videos
    const problemTitles = [
      'CIGNAL vs. CREAMLINE',
      'Tour de France 2025',
      'Mr Beast',
      'MrBeast'
    ]
    
    for (const title of problemTitles) {
      // First, delete from related tables
      await client.query(`
        DELETE FROM video_rankings 
        WHERE video_id IN (
          SELECT id FROM youtube_videos WHERE title ILIKE $1
        )
      `, [`%${title}%`])
      
      await client.query(`
        DELETE FROM video_view_history 
        WHERE video_id IN (
          SELECT id FROM youtube_videos WHERE title ILIKE $1
        )
      `, [`%${title}%`])
      
      const result = await client.query(`
        DELETE FROM youtube_videos 
        WHERE title ILIKE $1
      `, [`%${title}%`])
      
      if (result.rowCount > 0) {
        console.log(`Removed ${result.rowCount} videos with title containing "${title}"`)
        totalDeleted += result.rowCount
      }
    }
    
    // Remove videos from obviously non-golf channels
    const nonGolfChannels = [
      'NBC Sports', 'ESPN', 'FOX Sports', 'CBS Sports',
      'One Sports', 'Sky Sports'
    ]
    
    for (const channel of nonGolfChannels) {
      // First, delete from related tables
      await client.query(`
        DELETE FROM video_rankings 
        WHERE video_id IN (
          SELECT yv.id FROM youtube_videos yv
          JOIN youtube_channels yc ON yv.channel_id = yc.id
          WHERE yc.title ILIKE $1
          AND yv.title NOT ILIKE '%golf%'
          AND yv.description NOT ILIKE '%golf%'
        )
      `, [`%${channel}%`])
      
      await client.query(`
        DELETE FROM video_view_history 
        WHERE video_id IN (
          SELECT yv.id FROM youtube_videos yv
          JOIN youtube_channels yc ON yv.channel_id = yc.id
          WHERE yc.title ILIKE $1
          AND yv.title NOT ILIKE '%golf%'
          AND yv.description NOT ILIKE '%golf%'
        )
      `, [`%${channel}%`])
      
      const result = await client.query(`
        DELETE FROM youtube_videos 
        WHERE channel_id IN (
          SELECT id FROM youtube_channels 
          WHERE title ILIKE $1
        )
        AND title NOT ILIKE '%golf%'
        AND description NOT ILIKE '%golf%'
      `, [`%${channel}%`])
      
      if (result.rowCount > 0) {
        console.log(`Removed ${result.rowCount} non-golf videos from "${channel}"`)
        totalDeleted += result.rowCount
      }
    }
    
    console.log(`\nCleanup complete! Removed ${totalDeleted} non-golf videos.`)
    
    // Show remaining stats
    const statsResult = await client.query(`
      SELECT COUNT(*) as total_videos,
             COUNT(DISTINCT channel_id) as total_channels
      FROM youtube_videos
    `)
    
    console.log(`Remaining: ${statsResult.rows[0].total_videos} videos from ${statsResult.rows[0].total_channels} channels`)
    
  } catch (error) {
    console.error('Cleanup failed:', error)
  } finally {
    client.release()
    await pool.end()
  }
}

cleanupNonGolfContent()