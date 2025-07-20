const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:mysecretpassword@localhost/postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

async function checkProblematicContent() {
  const client = await pool.connect()
  
  try {
    // Check KLPGA content
    console.log('=== KLPGA Tournament Content ===')
    const klpgaResult = await client.query(`
      SELECT yv.id, yv.title, yc.title as channel, yv.content_type, yv.published_at
      FROM youtube_videos yv
      JOIN youtube_channels yc ON yv.channel_id = yc.id
      WHERE yv.title LIKE '%KLPGA%' 
      ORDER BY yv.published_at DESC
      LIMIT 5
    `)
    console.log('KLPGA videos found:', klpgaResult.rows.length)
    klpgaResult.rows.forEach(row => {
      console.log(`- ${row.title} (${row.channel}) - Type: ${row.content_type || 'NULL'}`)
    })
    
    // Check vr6domi content
    console.log('\n=== vr6domi Content ===')
    const vr6domiResult = await client.query(`
      SELECT yv.id, yv.title, yc.title as channel, yv.content_type, yv.published_at
      FROM youtube_videos yv
      JOIN youtube_channels yc ON yv.channel_id = yc.id
      WHERE yc.title = 'vr6domi'
      ORDER BY yv.published_at DESC
      LIMIT 5
    `)
    console.log('vr6domi videos found:', vr6domiResult.rows.length)
    vr6domiResult.rows.forEach(row => {
      console.log(`- ${row.title} - Type: ${row.content_type || 'NULL'}`)
    })
    
    // Check current VOD
    console.log('\n=== Current Video of the Day ===')
    const vodResult = await client.query(`
      SELECT yv.id, yv.title, yc.title as channel, yv.content_type
      FROM youtube_videos yv
      JOIN youtube_channels yc ON yv.channel_id = yc.id
      WHERE yv.is_video_of_day = true
      LIMIT 1
    `)
    if (vodResult.rows.length > 0) {
      const vod = vodResult.rows[0]
      console.log(`Current VOD: ${vod.title} (${vod.channel}) - Type: ${vod.content_type || 'NULL'}`)
    } else {
      console.log('No video marked as Video of the Day')
    }
    
    // Check videos with NULL content_type
    console.log('\n=== Videos with NULL content_type ===')
    const nullTypeResult = await client.query(`
      SELECT COUNT(*) as count
      FROM youtube_videos
      WHERE content_type IS NULL
    `)
    console.log(`Videos with NULL content_type: ${nullTypeResult.rows[0].count}`)
    
  } catch (error) {
    console.error('Error checking content:', error)
  } finally {
    client.release()
    await pool.end()
  }
}

checkProblematicContent()