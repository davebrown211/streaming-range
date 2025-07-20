const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:mysecretpassword@localhost/postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

// Whitelisted channel IDs
const WHITELISTED_CHANNEL_IDS = [
  'UCq-Cy3CK3r-qmjM7fXPqTlQ', // Good Good
  'UCqr4sONkmFEOPc3rfoVLEvg', // Bob Does Sports
  'UCgUueMmSpcl-aCTt5CuCKQw', // Grant Horvat Golf
  'UCpzR85N5b5Cil_VE-P0HqWg', // Rick Shiels Golf
  'UCGhLVzjASYN8oUxYBtfBfAw', // Peter Finch Golf
  'UC5SQGzkWyQSW_fe-URgq7xw', // Bryson DeChambeau
  'UCJKDS0Kym93MJSdhFqA8HTg', // Mark Crossfield
  'UCm8OIxLBpNJFRbcnXJcXdNw', // Golf Sidekick
  'UCbNRBQptR5CL4rX7eI3SWPQ', // James Robinson Golf
  'UCRvqjQPSeaWn-uEx-w0XOIg', // Dude Perfect
]

async function checkRecentWhitelistedVideos() {
  const client = await pool.connect()
  
  try {
    console.log('=== Recent Videos from Whitelisted Creators ===')
    
    // Check videos from last 7 days
    const recentResult = await client.query(`
      SELECT 
        yv.id,
        yv.title,
        yc.title as channel,
        yv.published_at,
        yv.view_count,
        yv.engagement_rate,
        DATE_PART('day', NOW() - yv.published_at) as days_ago
      FROM youtube_videos yv
      JOIN youtube_channels yc ON yv.channel_id = yc.id
      WHERE yv.channel_id = ANY($1::text[])
        AND yv.published_at >= NOW() - INTERVAL '7 days'
        AND yv.view_count > 100
        AND yv.thumbnail_url IS NOT NULL
      ORDER BY yv.published_at DESC
      LIMIT 20
    `, [WHITELISTED_CHANNEL_IDS])
    
    console.log(`Found ${recentResult.rows.length} recent videos from whitelisted creators:\n`)
    
    recentResult.rows.forEach(video => {
      console.log(`${Math.floor(video.days_ago)}d ago - ${video.title.substring(0, 60)}... (${video.channel})`)
      console.log(`   Views: ${video.view_count.toLocaleString()}, Engagement: ${video.engagement_rate}%\n`)
    })
    
    if (recentResult.rows.length === 0) {
      console.log('❌ No recent videos found from whitelisted creators!')
      console.log('This explains why VOD is showing old content.\n')
      
      // Check if we have ANY videos from whitelisted creators
      const anyResult = await client.query(`
        SELECT COUNT(*) as count
        FROM youtube_videos yv
        WHERE yv.channel_id = ANY($1::text[])
      `, [WHITELISTED_CHANNEL_IDS])
      
      console.log(`Total videos from whitelisted creators: ${anyResult.rows[0].count}`)
    }
    
  } catch (error) {
    console.error('Error checking recent videos:', error)
  } finally {
    client.release()
    await pool.end()
  }
}

checkRecentWhitelistedVideos()