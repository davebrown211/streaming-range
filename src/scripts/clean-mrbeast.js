const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:mysecretpassword@localhost/postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

async function cleanMrBeast() {
  const client = await pool.connect()
  
  try {
    console.log('Cleaning MrBeast content...')
    
    // Delete from related tables first
    await client.query(`DELETE FROM video_rankings WHERE video_id IN (SELECT id FROM youtube_videos WHERE title ILIKE '%MrBeast%')`)
    await client.query(`DELETE FROM video_view_history WHERE video_id IN (SELECT id FROM youtube_videos WHERE title ILIKE '%MrBeast%')`)
    
    // Delete the video
    const result = await client.query(`DELETE FROM youtube_videos WHERE title ILIKE '%MrBeast%'`)
    
    console.log(`Removed ${result.rowCount} MrBeast videos`)
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    client.release()
    await pool.end()
  }
}

cleanMrBeast()