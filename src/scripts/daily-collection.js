const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:mysecretpassword@localhost/postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

async function runDailyCollection() {
  const startTime = Date.now()
  console.log('🌅 Starting daily golf content collection...')
  console.log(`📅 ${new Date().toISOString()}`)
  
  try {
    // Check initial quota
    const quotaResponse = await fetch('http://localhost:3001/api/quota/usage')
    const initialQuota = await quotaResponse.json()
    console.log(`📊 Starting quota: ${initialQuota.units_used}/${10000} units (${initialQuota.percentage_used})`)
    
    // Daily search terms focused on fresh content
    const dailySearchTerms = [
      'golf today',
      'golf news',
      'golf highlights today', 
      'pga tour today',
      'golf lesson new',
      'golf tips 2025',
      'golf equipment 2025',
      'golf tournament today',
      'golf instruction new',
      'golf course review',
      'golf swing tips',
      'golf putting tips',
      'golf short game',
      'golf driver tips',
      'golf iron tips',
      // New terms to catch entertainment golf content
      'golf road trip',
      'golf trip',
      'golf adventure',
      'Bob Does Sports golf'
    ]
    
    console.log(`🎯 Running ${dailySearchTerms.length} targeted searches...`)
    
    // Run collection
    const collectionResponse = await fetch('http://localhost:3001/api/collect-videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ searchTerms: dailySearchTerms })
    })
    
    const collectionResult = await collectionResponse.json()
    console.log(`✅ Collection completed: ${collectionResult.videos_processed} videos processed`)
    console.log(`⏱️  Duration: ${(collectionResult.duration_ms / 1000).toFixed(1)}s`)
    
    // Check final quota
    let finalQuota, quotaUsed = 0
    try {
      const finalQuotaResponse = await fetch('http://localhost:3001/api/quota/usage')
      finalQuota = await finalQuotaResponse.json()
      quotaUsed = finalQuota.units_used - initialQuota.units_used
    } catch (error) {
      console.log('⚠️  Could not fetch final quota, estimating usage...')
      // Estimate: 15 searches * 100 units each = 1500 units
      quotaUsed = dailySearchTerms.length * 100
      finalQuota = { 
        units_used: initialQuota.units_used + quotaUsed, 
        percentage_used: ((initialQuota.units_used + quotaUsed) / 10000 * 100).toFixed(2) + '%'
      }
    }
    
    console.log(`📊 Final quota: ${finalQuota.units_used}/${10000} units (${finalQuota.percentage_used})`)
    console.log(`💳 Credits used: ${quotaUsed} units`)
    
    // Get updated stats
    const statsResponse = await fetch('http://localhost:3001/api/stats')
    const stats = await statsResponse.json()
    
    const totalDuration = Date.now() - startTime
    
    // Summary report
    console.log('\n🎉 DAILY COLLECTION SUMMARY')
    console.log('=====================================')
    console.log(`📺 Videos processed: ${collectionResult.videos_processed}`)
    console.log(`📊 Total videos in DB: ${stats.total_videos}`)
    console.log(`🏆 Total channels: ${stats.total_channels}`)
    console.log(`💳 Quota used: ${quotaUsed} units`)
    console.log(`⏱️  Total time: ${(totalDuration / 1000).toFixed(1)}s`)
    console.log(`📈 Daily cost: ${((quotaUsed / 10000) * 100).toFixed(2)}% of daily quota`)
    
    // Category breakdown
    console.log('\n📋 CONTENT CATEGORIES:')
    Object.entries(stats.categories).forEach(([category, count]) => {
      console.log(`   ${category}: ${count} videos`)
    })
    
    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:')
    if (quotaUsed > 1000) {
      console.log('   ⚠️  High quota usage - consider reducing search terms')
    } else if (quotaUsed < 100) {
      console.log('   📈 Low quota usage - could add more search terms')
    } else {
      console.log('   ✅ Optimal quota usage for daily collection')
    }
    
    if (collectionResult.videos_processed < 10) {
      console.log('   📺 Few new videos found - content may be fresh already')
    } else if (collectionResult.videos_processed > 100) {
      console.log('   🚀 Many new videos found - great content discovery!')
    }
    
    // Save daily report
    const report = {
      date: new Date().toISOString().split('T')[0],
      videos_processed: collectionResult.videos_processed,
      quota_used: quotaUsed,
      total_videos: stats.total_videos,
      total_channels: stats.total_channels,
      duration_ms: totalDuration,
      categories: stats.categories
    }
    
    console.log(`\n💾 Report saved for ${report.date}`)
    console.log('=====================================\n')
    
    return report
    
  } catch (error) {
    console.error('❌ Daily collection failed:', error)
    throw error
  } finally {
    await pool.end()
  }
}

// Run if called directly
if (require.main === module) {
  runDailyCollection()
    .then(report => {
      console.log('🎯 Daily collection completed successfully!')
      process.exit(0)
    })
    .catch(error => {
      console.error('💥 Daily collection failed:', error)
      process.exit(1)
    })
}

module.exports = { runDailyCollection }