#!/usr/bin/env node

/**
 * Efficient script to pull new videos directly from whitelisted channels
 * Uses optimized queries with proper indexing for fast performance
 */

const { Pool } = require('pg')
// Validated channel IDs (13 channels with content in database)
const WHITELISTED_CHANNEL_IDS = [
  'UCfi-mPMOmche6WI-jkvnGXw', // Good Good (main) - 25 videos, 6 recent
  'UCbY_v56iMzSGvXK79X6f4dw', // Good Good Extra - 10 videos, 1 recent
  'UCqr4sONkmFEOPc3rfoVLEvg', // Bob Does Sports - 2 videos, 2 recent
  'UCgUueMmSpcl-aCTt5CuCKQw', // Grant Horvat Golf - 26 videos, 5 recent
  'UCJcc1x6emfrQquiV8Oe_pug', // Luke Kwon Golf - 1 video, 1 recent
  'UCsazhBmAVDUL_WYcARQEFQA', // The Lads - 3 videos, 3 recent
  'UC3jFoA7_6BTV90hsRSVHoaw', // Phil Mickelson and the HyFlyers - 10 videos, 2 recent
  'UCfdYeBYjouhibG64ep_m4Vw', // Micah Morris - 13 videos, 1 recent
  'UCjchle1bmH0acutqK15_XSA', // Brad Dalke - 10 videos, 4 recent
  'UCdCxaD8rWfAj12rloIYS6jQ', // Bryan Bros Golf - 10 videos, 3 recent
  'UCB0NRdlQ6fBYQX8W8bQyoDA', // MyTPI - 0 videos, 0 recent
  'UCyy8ULLDGSm16_EkXdIt4Gw', // Titleist - 4 videos, 4 recent
  'UClJO9jvaU5mvNuP-XTbhHGw', // TaylorMade Golf - 13 videos, 7 recent
]

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:mysecretpassword@localhost/postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

/**
 * Efficient query to get new videos from whitelisted channels
 * Optimized with proper WHERE clause ordering and LIMIT for performance
 */
async function getNewWhitelistedVideos(options = {}) {
  const {
    hours = 24,           // Look back N hours
    limit = 50,           // Maximum videos to return
    minViews = 100,       // Minimum view count threshold
    excludeShorts = true, // Exclude videos under 60 seconds
    sortBy = 'published'  // 'published', 'views', 'engagement', 'velocity'
  } = options

  const client = await pool.connect()
  
  try {
    console.log(`🔍 Searching for new videos from whitelisted channels (last ${hours}h)...`)
    
    // Build dynamic ORDER BY clause
    let orderClause
    switch (sortBy) {
      case 'views':
        orderClause = 'yv.view_count DESC, yv.published_at DESC'
        break
      case 'engagement':
        orderClause = 'yv.engagement_rate DESC, yv.published_at DESC'
        break
      case 'velocity':
        orderClause = 'yv.view_velocity DESC, yv.published_at DESC'
        break
      default:
        orderClause = 'yv.published_at DESC, yv.view_count DESC'
    }

    const query = `
      SELECT 
        yv.id,
        yv.title,
        yc.title as channel_name,
        yv.published_at,
        yv.view_count,
        yv.like_count,
        yv.engagement_rate,
        yv.view_velocity,
        yv.duration_seconds,
        yv.thumbnail_url,
        yv.updated_at,
        -- Calculate age in hours for easy filtering
        EXTRACT(EPOCH FROM (NOW() - yv.published_at))/3600 as hours_old,
        -- Calculate momentum score (recency + engagement boost)
        CASE 
          WHEN yv.published_at >= NOW() - INTERVAL '6 hours' THEN yv.view_count * 100
          WHEN yv.published_at >= NOW() - INTERVAL '12 hours' THEN yv.view_count * 50
          WHEN yv.published_at >= NOW() - INTERVAL '24 hours' THEN yv.view_count * 10
          ELSE yv.view_count
        END as momentum_score
      FROM youtube_videos yv
      JOIN youtube_channels yc ON yv.channel_id = yc.id
      WHERE 
        -- Primary filters (most selective first for performance)
        yv.channel_id = ANY($1::text[])                    -- Only whitelisted channels
        AND yv.published_at >= NOW() - INTERVAL '${hours} hours'  -- Recent videos only
        AND yv.view_count >= $2                            -- Minimum view threshold
        AND yv.thumbnail_url IS NOT NULL                   -- Must have thumbnail
        ${excludeShorts ? 'AND (yv.duration_seconds IS NULL OR yv.duration_seconds > 60)' : ''}
        -- Content quality filters
        AND yv.title !~ '[あ-ん]'                          -- Exclude Japanese hiragana
        AND yv.title !~ '[ア-ン]'                          -- Exclude Japanese katakana  
        AND yv.title !~ '[一-龯]'                          -- Exclude Chinese/Japanese kanji
        AND yv.title !~ '[À-ÿ]'                           -- Exclude accented characters
        AND yv.title NOT ILIKE '%volkswagen%'              -- Exclude VW Golf cars
        AND yv.title NOT ILIKE '%vw golf%'
        AND yv.title NOT ILIKE '%gta%'                     -- Exclude GTA games
        AND yv.title NOT ILIKE '%forza%'                   -- Exclude racing games
        AND yv.title NOT ILIKE '%golf cart%'               -- Focus on golf sport
        -- Tournament exclusions
        AND yv.title !~* '(round [0-9]|r[0-9]|mpo \\||fpo \\||klpga|kpga|championship 20|tournament highlights|final round|course maintenance)'
      ORDER BY ${orderClause}
      LIMIT $3
    `
    
    const result = await client.query(query, [WHITELISTED_CHANNEL_IDS, minViews, limit])
    
    console.log(`✅ Found ${result.rows.length} new videos from whitelisted channels\n`)
    
    if (result.rows.length === 0) {
      console.log('❌ No new videos found. This might indicate:')
      console.log('   • No recent uploads from whitelisted creators')
      console.log('   • All recent videos below view threshold')
      console.log('   • Need to expand time window or lower thresholds\n')
      return []
    }

    // Display results with rich formatting
    result.rows.forEach((video, index) => {
      const hoursOld = Math.floor(video.hours_old)
      const engagement = video.engagement_rate ? video.engagement_rate.toFixed(2) + '%' : 'N/A'
      
      console.log(`${index + 1}. ${video.title.substring(0, 60)}...`)
      console.log(`   Channel: ${video.channel_name}`)
      console.log(`   Age: ${hoursOld}h | Views: ${video.view_count.toLocaleString()} | Engagement: ${engagement}`)
      console.log(`   Velocity: ${Math.round(video.view_velocity)} views/day | Momentum: ${Math.round(video.momentum_score).toLocaleString()}`)
      console.log(`   Published: ${video.published_at.toISOString().replace('T', ' ').substring(0, 16)} UTC`)
      console.log(`   Duration: ${video.duration_seconds ? Math.floor(video.duration_seconds / 60) + 'm' + (video.duration_seconds % 60) + 's' : 'Unknown'}`)
      console.log(`   URL: https://youtube.com/watch?v=${video.id}`)
      console.log('')
    })

    return result.rows

  } catch (error) {
    console.error('❌ Error fetching new whitelisted videos:', error)
    throw error
  } finally {
    client.release()
  }
}

/**
 * Get videos by specific time periods for analysis
 */
async function getVideosByTimePeriod() {
  const client = await pool.connect()
  
  try {
    console.log('📊 Video Distribution by Time Period (Whitelisted Channels)\n')

    const timeframes = [
      { name: 'Last 6 hours', hours: 6 },
      { name: 'Last 12 hours', hours: 12 },
      { name: 'Last 24 hours', hours: 24 },
      { name: 'Last 48 hours', hours: 48 },
      { name: 'Last 7 days', hours: 168 }
    ]

    for (const timeframe of timeframes) {
      const query = `
        SELECT COUNT(*) as count, 
               AVG(view_count) as avg_views,
               MAX(view_count) as max_views
        FROM youtube_videos yv
        WHERE yv.channel_id = ANY($1::text[])
          AND yv.published_at >= NOW() - INTERVAL '${timeframe.hours} hours'
          AND yv.view_count >= 100
      `
      
      const result = await client.query(query, [WHITELISTED_CHANNEL_IDS])
      const { count, avg_views, max_views } = result.rows[0]
      
      console.log(`${timeframe.name}: ${count} videos | Avg views: ${Math.round(avg_views || 0).toLocaleString()} | Max views: ${Math.round(max_views || 0).toLocaleString()}`)
    }

  } catch (error) {
    console.error('Error getting time period analysis:', error)
  } finally {
    client.release()
  }
}

/**
 * Get top performing recent videos for benchmarking
 */
async function getTopPerformingRecent(hours = 48, limit = 10) {
  const client = await pool.connect()
  
  try {
    console.log(`\n🏆 Top ${limit} Performing Videos (Last ${hours}h)\n`)

    const query = `
      SELECT 
        yv.id,
        yv.title,
        yc.title as channel_name,
        yv.view_count,
        yv.engagement_rate,
        yv.published_at,
        EXTRACT(EPOCH FROM (NOW() - yv.published_at))/3600 as hours_old
      FROM youtube_videos yv
      JOIN youtube_channels yc ON yv.channel_id = yc.id
      WHERE yv.channel_id = ANY($1::text[])
        AND yv.published_at >= NOW() - INTERVAL '${hours} hours'
        AND yv.view_count >= 1000
      ORDER BY yv.view_count DESC
      LIMIT $2
    `
    
    const result = await client.query(query, [WHITELISTED_CHANNEL_IDS, limit])
    
    result.rows.forEach((video, index) => {
      const hoursOld = Math.floor(video.hours_old)
      const engagement = video.engagement_rate ? video.engagement_rate.toFixed(2) + '%' : 'N/A'
      
      console.log(`${index + 1}. ${video.title.substring(0, 50)}... (${video.channel_name})`)
      console.log(`   Views: ${video.view_count.toLocaleString()} | Age: ${hoursOld}h | Engagement: ${engagement}`)
      console.log(`   https://youtube.com/watch?v=${video.id}\n`)
    })

  } catch (error) {
    console.error('Error getting top performing videos:', error)
  } finally {
    client.release()
  }
}

// Main execution
async function main() {
  try {
    console.log('🎬 YouTube Golf Directory - New Video Puller\n')
    console.log(`Monitoring ${WHITELISTED_CHANNEL_IDS.length} whitelisted channels\n`)

    // 1. Get recent videos (default: last 24 hours)
    const recentVideos = await getNewWhitelistedVideos({
      hours: 24,
      limit: 20,
      sortBy: 'published'
    })

    // 2. Show time period distribution
    await getVideosByTimePeriod()

    // 3. Show top performers for context
    await getTopPerformingRecent(48, 5)

    console.log('✅ Video analysis complete!')

  } catch (error) {
    console.error('❌ Script failed:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

// Export functions for use in other scripts
module.exports = {
  getNewWhitelistedVideos,
  getVideosByTimePeriod,
  getTopPerformingRecent
}

// Run if called directly
if (require.main === module) {
  main()
}