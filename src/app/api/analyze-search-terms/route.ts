import { NextResponse } from 'next/server'
import pool from '@/lib/database'

export async function GET() {
  try {
    const client = await pool.connect()
    
    try {
      const results: any = {}
      
      // Analyze videos that might have come from problematic search terms
      const problematicTerms = [
        'Good Good',      // This could match "Good Good" (golf channel) but also general "good" content
        'Dude Perfect',   // They do golf content but also many other sports
        'perfect',        // Too broad
        'good',          // Too broad
        'best'           // Too broad
      ]
      
      for (const term of problematicTerms) {
        const analysis = await client.query(`
          SELECT 
            yv.id,
            yv.title,
            yc.title as channel_title,
            yv.view_count,
            yv.category,
            CASE 
              WHEN LOWER(yv.title) LIKE '%golf%' OR LOWER(yc.title) LIKE '%golf%' THEN 'Golf Related'
              WHEN LOWER(yc.title) LIKE '%benjamin cowen%' THEN 'Crypto Content'
              WHEN LOWER(yc.title) LIKE '%unisport%' THEN 'Soccer Content'
              WHEN LOWER(yv.title) LIKE '%crypto%' OR LOWER(yv.title) LIKE '%bitcoin%' THEN 'Crypto Content'
              WHEN LOWER(yv.title) LIKE '%soccer%' OR LOWER(yv.title) LIKE '%football%' THEN 'Soccer/Football Content'
              WHEN LOWER(yv.title) LIKE '%basketball%' OR LOWER(yv.title) LIKE '%nba%' THEN 'Basketball Content'
              ELSE 'Other Non-Golf'
            END as content_type
          FROM youtube_videos yv
          JOIN youtube_channels yc ON yv.channel_id = yc.id
          WHERE LOWER(yv.title) LIKE LOWER($1) OR LOWER(yc.title) LIKE LOWER($1)
          ORDER BY yv.view_count DESC
          LIMIT 20
        `, [`%${term}%`])
        
        const termAnalysis = {
          term,
          total_matches: analysis.rows.length,
          content_breakdown: {} as any
        }
        
        // Count by content type
        for (const row of analysis.rows) {
          if (!termAnalysis.content_breakdown[row.content_type]) {
            termAnalysis.content_breakdown[row.content_type] = {
              count: 0,
              examples: []
            }
          }
          termAnalysis.content_breakdown[row.content_type].count++
          
          if (termAnalysis.content_breakdown[row.content_type].examples.length < 3) {
            termAnalysis.content_breakdown[row.content_type].examples.push({
              title: row.title,
              channel: row.channel_title,
              views: row.view_count
            })
          }
        }
        
        results[term] = termAnalysis
      }
      
      // Check Dude Perfect specifically
      const dudePerferctAnalysis = await client.query(`
        SELECT 
          yv.id,
          yv.title,
          yv.view_count,
          yv.category,
          CASE 
            WHEN LOWER(yv.title) LIKE '%golf%' THEN 'Golf Content'
            WHEN LOWER(yv.title) LIKE '%football%' OR LOWER(yv.title) LIKE '%nfl%' THEN 'Football Content'
            WHEN LOWER(yv.title) LIKE '%basketball%' OR LOWER(yv.title) LIKE '%nba%' THEN 'Basketball Content'
            ELSE 'Other Sports/Entertainment'
          END as content_type
        FROM youtube_videos yv
        JOIN youtube_channels yc ON yv.channel_id = yc.id
        WHERE yc.title = 'Dude Perfect'
        ORDER BY yv.view_count DESC
      `)
      
      results['Dude Perfect Channel Analysis'] = {
        total_videos: dudePerferctAnalysis.rows.length,
        content_types: {} as any
      }
      
      for (const row of dudePerferctAnalysis.rows) {
        if (!results['Dude Perfect Channel Analysis'].content_types[row.content_type]) {
          results['Dude Perfect Channel Analysis'].content_types[row.content_type] = {
            count: 0,
            videos: []
          }
        }
        results['Dude Perfect Channel Analysis'].content_types[row.content_type].count++
        results['Dude Perfect Channel Analysis'].content_types[row.content_type].videos.push({
          title: row.title,
          views: row.view_count,
          category: row.category
        })
      }
      
      return NextResponse.json(results)
      
    } finally {
      client.release()
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Analysis failed', message: (error as Error).message },
      { status: 500 }
    )
  }
}