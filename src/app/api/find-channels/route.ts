import { NextResponse } from 'next/server'
import { google } from 'googleapis'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q') || ''
  
  if (!query) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 })
  }

  try {
    const apiKey = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY
    
    if (!apiKey) {
      return NextResponse.json({
        error: 'No YouTube API key found'
      }, { status: 500 })
    }

    const youtube = google.youtube({
      version: 'v3',
      auth: apiKey
    })

    console.log(`🔍 Searching for channels: "${query}"`)

    // Search for channels
    const searchResponse = await youtube.search.list({
      part: ['snippet'],
      q: query,
      type: 'channel',
      maxResults: 5,
      order: 'relevance'
    })

    const channels = searchResponse.data.items || []
    
    if (channels.length === 0) {
      return NextResponse.json({
        query,
        channels: [],
        message: `No channels found for "${query}"`
      })
    }

    // Get detailed channel info
    const channelIds = channels.map((ch: any) => ch.id.channelId)
    const channelsResponse = await youtube.channels.list({
      part: ['snippet', 'statistics'],
      id: channelIds.join(',')
    })

    const detailedChannels = channelsResponse.data.items || []
    
    // Sort by subscriber count
    detailedChannels.sort((a: any, b: any) => {
      const subsA = parseInt(a.statistics?.subscriberCount || '0')
      const subsB = parseInt(b.statistics?.subscriberCount || '0')
      return subsB - subsA
    })

    const results = detailedChannels.map((channel: any, index: number) => {
      const subs = parseInt(channel.statistics?.subscriberCount || '0')
      const subsFormatted = subs >= 1000000 ? `${(subs/1000000).toFixed(1)}M` : 
                           subs >= 1000 ? `${Math.floor(subs/1000)}K` : 
                           subs.toString()
      
      return {
        rank: index + 1,
        channel_id: channel.id,
        title: channel.snippet.title,
        description: (channel.snippet.description || '').substring(0, 200),
        subscriber_count: subs,
        subscriber_formatted: subsFormatted,
        thumbnail: channel.snippet.thumbnails?.default?.url || null,
        published_at: channel.snippet.publishedAt
      }
    })

    return NextResponse.json({
      query,
      channels: results,
      total_found: results.length,
      top_channel: results[0] || null
    })

  } catch (error) {
    console.error('YouTube API error:', error)
    return NextResponse.json({
      error: 'Failed to search channels',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { creators } = await request.json()
    
    if (!Array.isArray(creators)) {
      return NextResponse.json({ error: 'creators must be an array' }, { status: 400 })
    }

    const apiKey = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY
    
    if (!apiKey) {
      return NextResponse.json({
        error: 'No YouTube API key found'
      }, { status: 500 })
    }

    const youtube = google.youtube({
      version: 'v3',
      auth: apiKey
    })

    const results = []

    for (const creator of creators) {
      try {
        console.log(`🔍 Searching for "${creator}"...`)
        
        // Search for channels
        const searchResponse = await youtube.search.list({
          part: ['snippet'],
          q: creator,
          type: 'channel',
          maxResults: 3,
          order: 'relevance'
        })

        const channels = searchResponse.data.items || []
        
        if (channels.length === 0) {
          results.push({
            creator,
            status: 'not_found',
            channels: []
          })
          continue
        }

        // Get detailed channel info
        const channelIds = channels.map((ch: any) => ch.id.channelId)
        const channelsResponse = await youtube.channels.list({
          part: ['snippet', 'statistics'],
          id: channelIds.join(',')
        })

        const detailedChannels = channelsResponse.data.items || []
        
        // Sort by subscriber count
        detailedChannels.sort((a: any, b: any) => {
          const subsA = parseInt(a.statistics?.subscriberCount || '0')
          const subsB = parseInt(b.statistics?.subscriberCount || '0')
          return subsB - subsA
        })

        const channelResults = detailedChannels.map((channel: any, index: number) => {
          const subs = parseInt(channel.statistics?.subscriberCount || '0')
          const subsFormatted = subs >= 1000000 ? `${(subs/1000000).toFixed(1)}M` : 
                               subs >= 1000 ? `${Math.floor(subs/1000)}K` : 
                               subs.toString()
          
          return {
            rank: index + 1,
            channel_id: channel.id,
            title: channel.snippet.title,
            description: (channel.snippet.description || '').substring(0, 150),
            subscriber_count: subs,
            subscriber_formatted: subsFormatted
          }
        })

        results.push({
          creator,
          status: 'found',
          channels: channelResults,
          top_channel: channelResults[0] || null
        })

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500))

      } catch (error) {
        console.error(`Error searching for ${creator}:`, error)
        results.push({
          creator,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          channels: []
        })
      }
    }

    // Generate whitelist additions
    const whitelistAdditions = results
      .filter(r => r.status === 'found' && r.top_channel)
      .map(r => `  "${r.top_channel.channel_id}", // ${r.top_channel.title} - ${r.top_channel.subscriber_formatted} subs`)

    return NextResponse.json({
      results,
      summary: {
        total_searched: creators.length,
        found: results.filter(r => r.status === 'found').length,
        not_found: results.filter(r => r.status === 'not_found').length,
        errors: results.filter(r => r.status === 'error').length
      },
      whitelist_additions: whitelistAdditions
    })

  } catch (error) {
    console.error('Batch search error:', error)
    return NextResponse.json({
      error: 'Failed to search channels',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}