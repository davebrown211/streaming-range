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

// Tournament patterns to exclude
const EXCLUDED_PATTERNS = [
  '%round %',
  '%r1%',
  '%r2%',
  '%r3%',
  '%r4%',
  '%mpo |%',
  '%fpo |%',
  '%klpga%',
  '%kpga%',
  '%lpga tour%',
  '%pga tour%',
  '%championship 20%',
  '%tournament highlights%',
  '%final round%',
  '%course maintenance%',
]

async function fixContentTypes() {
  const client = await pool.connect()
  
  try {
    console.log('=== Fixing Content Types ===')
    
    // First, set all videos to NULL content_type
    console.log('1. Resetting all content_type to NULL...')
    await client.query(`UPDATE youtube_videos SET content_type = NULL`)
    
    // Set whitelisted channels to 'curated'
    console.log('2. Setting whitelisted channels to curated...')
    const curatedResult = await client.query(`
      UPDATE youtube_videos 
      SET content_type = 'curated'
      WHERE channel_id = ANY($1::text[])
      RETURNING id
    `, [WHITELISTED_CHANNEL_IDS])
    console.log(`   - Marked ${curatedResult.rowCount} videos as curated`)
    
    // Mark tournament/excluded content as 'excluded'
    console.log('3. Marking tournament content as excluded...')
    for (const pattern of EXCLUDED_PATTERNS) {
      const excludeResult = await client.query(`
        UPDATE youtube_videos 
        SET content_type = 'excluded'
        WHERE LOWER(title) LIKE LOWER($1)
          AND (content_type IS NULL OR content_type != 'curated')
        RETURNING id
      `, [pattern])
      if (excludeResult.rowCount > 0) {
        console.log(`   - Pattern '${pattern}': excluded ${excludeResult.rowCount} videos`)
      }
    }
    
    // Mark remaining golf content as 'discovery'
    console.log('4. Setting remaining golf content to discovery...')
    const discoveryResult = await client.query(`
      UPDATE youtube_videos 
      SET content_type = 'discovery'
      WHERE content_type IS NULL
        AND (
          LOWER(title) LIKE '%golf%' 
          OR LOWER(description) LIKE '%golf%'
        )
      RETURNING id
    `)
    console.log(`   - Marked ${discoveryResult.rowCount} videos as discovery`)
    
    // Final stats
    console.log('\n=== Final Statistics ===')
    const stats = await client.query(`
      SELECT content_type, COUNT(*) as count
      FROM youtube_videos
      GROUP BY content_type
      ORDER BY count DESC
    `)
    stats.rows.forEach(row => {
      console.log(`${row.content_type || 'NULL'}: ${row.count} videos`)
    })
    
    // Check problematic content again
    console.log('\n=== Checking KLPGA and vr6domi ===')
    const checkResult = await client.query(`
      SELECT yv.id, yv.title, yc.title as channel, yv.content_type
      FROM youtube_videos yv
      JOIN youtube_channels yc ON yv.channel_id = yc.id
      WHERE yv.title LIKE '%KLPGA%' OR yc.title = 'vr6domi'
      LIMIT 10
    `)
    checkResult.rows.forEach(row => {
      console.log(`- ${row.title.substring(0, 50)}... (${row.channel}) - Type: ${row.content_type}`)
    })
    
    console.log('\nContent types fixed!')
    
  } catch (error) {
    console.error('Error fixing content types:', error)
  } finally {
    client.release()
    await pool.end()
  }
}

fixContentTypes()