#!/usr/bin/env node

/**
 * Find missing YouTube channel IDs using the YouTube Data API
 * This script searches for popular golf creators and returns their channel IDs
 */

const { google } = require('googleapis')

const MISSING_CREATORS = [
  'Rick Shiels Golf',
  'Peter Finch Golf', 
  'Bryson DeChambeau',
  'Mark Crossfield',
  'Golf Sidekick',
  'James Robinson Golf'
]

class ChannelIDFinder {
  constructor() {
    this.apiKey = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY || ''
    
    if (!this.apiKey) {
      console.error('❌ No YouTube API key found!')
      console.error('Set YOUTUBE_API_KEY or GOOGLE_API_KEY environment variable')
      process.exit(1)
    }

    this.youtube = google.youtube({
      version: 'v3',
      auth: this.apiKey
    })
  }

  async searchChannelByName(creatorName) {
    try {
      console.log(`🔍 Searching for "${creatorName}"...`)
      
      // Search for channels
      const searchResponse = await this.youtube.search.list({
        part: ['snippet'],
        q: creatorName,
        type: 'channel',
        maxResults: 5,
        order: 'relevance'
      })

      const channels = searchResponse.data.items || []
      
      if (channels.length === 0) {
        console.log(`   ❌ No channels found for "${creatorName}"`)
        return null
      }

      // Get detailed channel info
      const channelIds = channels.map(ch => ch.id.channelId)
      const channelsResponse = await this.youtube.channels.list({
        part: ['snippet', 'statistics'],
        id: channelIds.join(',')
      })

      const detailedChannels = channelsResponse.data.items || []
      
      // Sort by subscriber count to get the most popular
      detailedChannels.sort((a, b) => {
        const subsA = parseInt(a.statistics?.subscriberCount || '0')
        const subsB = parseInt(b.statistics?.subscriberCount || '0')
        return subsB - subsA
      })

      console.log(`   ✅ Found ${detailedChannels.length} channels:`)
      
      const results = []
      detailedChannels.forEach((channel, index) => {
        const subs = parseInt(channel.statistics?.subscriberCount || '0')
        const subsFormatted = subs >= 1000000 ? `${(subs/1000000).toFixed(1)}M` : 
                             subs >= 1000 ? `${Math.floor(subs/1000)}K` : 
                             subs.toString()
        
        const result = {
          name: creatorName,
          channel_id: channel.id,
          channel_title: channel.snippet.title,
          subscriber_count: subs,
          subscriber_formatted: subsFormatted,
          rank: index + 1
        }
        
        console.log(`     ${index + 1}. ${channel.snippet.title}`)
        console.log(`        ID: ${channel.id}`)
        console.log(`        Subscribers: ${subsFormatted}`)
        console.log(`        Description: ${(channel.snippet.description || '').substring(0, 100)}...`)
        console.log('')
        
        results.push(result)
      })
      
      return results

    } catch (error) {
      console.error(`   ❌ Error searching for "${creatorName}":`, error.message)
      return null
    }
  }

  async findAllMissingChannels() {
    console.log('🎬 Finding Missing Golf Creator Channel IDs')
    console.log('=' * 50)
    console.log('')

    const allResults = []
    
    for (const creator of MISSING_CREATORS) {
      const results = await this.searchChannelByName(creator)
      if (results) {
        allResults.push(...results)
      }
      
      // Add delay to respect API rate limits
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    console.log('📊 SUMMARY - Top Channel for Each Creator:')
    console.log('=' * 50)
    
    const topChannels = []
    for (const creator of MISSING_CREATORS) {
      const creatorResults = allResults.filter(r => r.name === creator)
      if (creatorResults.length > 0) {
        const topChannel = creatorResults[0] // Already sorted by subscriber count
        topChannels.push(topChannel)
        
        console.log(`✅ ${creator}`)
        console.log(`   Channel ID: ${topChannel.channel_id}`)
        console.log(`   Title: ${topChannel.channel_title}`)
        console.log(`   Subscribers: ${topChannel.subscriber_formatted}`)
        console.log('')
      }
    }

    console.log('📋 WHITELIST ADDITIONS (copy these to your whitelist):')
    console.log('=' * 50)
    topChannels.forEach(channel => {
      console.log(`  "${channel.channel_id}", // ${channel.channel_title} - ${channel.subscriber_formatted} subs`)
    })

    console.log('')
    console.log('🔧 JavaScript Array Format:')
    console.log('[')
    topChannels.forEach((channel, index) => {
      const comma = index < topChannels.length - 1 ? ',' : ''
      console.log(`  "${channel.channel_id}"${comma} // ${channel.channel_title}`)
    })
    console.log(']')

    return topChannels
  }
}

// Main execution
async function main() {
  try {
    const finder = new ChannelIDFinder()
    await finder.findAllMissingChannels()
    
    console.log('✅ Channel ID search complete!')
    
  } catch (error) {
    console.error('❌ Script failed:', error)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main()
}

module.exports = { ChannelIDFinder }