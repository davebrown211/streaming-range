import pool from './database'
import { isWhitelistedCreator } from './content-whitelist'

export interface QualityScore {
  overall: number
  factors: {
    engagement: number
    freshness: number
    whitelisted: number
    velocity: number
    duration: number
  }
  reasoning: string[]
}

export class ContentQualityScorer {
  
  /**
   * Calculate a comprehensive quality score for a video (0-100)
   */
  async calculateQualityScore(video: {
    id: string
    title: string
    channel_name: string
    channel_id: string
    view_count: number
    like_count: number
    comment_count: number
    published_at: Date
    duration_seconds: number
    view_velocity?: number
    view_acceleration?: number
  }): Promise<QualityScore> {
    
    const factors = {
      engagement: this.calculateEngagementScore(video),
      freshness: this.calculateFreshnessScore(video.published_at),
      whitelisted: this.calculateWhitelistScore(video.channel_name, video.channel_id),
      velocity: this.calculateVelocityScore(video.view_velocity || 0, video.view_acceleration || 0),
      duration: this.calculateDurationScore(video.duration_seconds)
    }

    // Weighted scoring
    const weights = {
      engagement: 0.3,
      freshness: 0.2,
      whitelisted: 0.25,
      velocity: 0.15,
      duration: 0.1
    }

    const overall = Math.round(
      factors.engagement * weights.engagement +
      factors.freshness * weights.freshness +
      factors.whitelisted * weights.whitelisted +
      factors.velocity * weights.velocity +
      factors.duration * weights.duration
    )

    const reasoning = this.generateReasoning(factors, video)

    return {
      overall: Math.min(100, Math.max(0, overall)),
      factors,
      reasoning
    }
  }

  private calculateEngagementScore(video: any): number {
    if (video.view_count === 0) return 0

    const engagementRate = ((video.like_count + video.comment_count) / video.view_count) * 100
    
    // Score based on engagement rate benchmarks
    if (engagementRate >= 8) return 100
    if (engagementRate >= 5) return 85
    if (engagementRate >= 3) return 70
    if (engagementRate >= 2) return 55
    if (engagementRate >= 1) return 40
    if (engagementRate >= 0.5) return 25
    return 10
  }

  private calculateFreshnessScore(publishedAt: Date): number {
    const hoursAgo = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60)
    
    // Fresher content scores higher
    if (hoursAgo <= 1) return 100
    if (hoursAgo <= 6) return 90
    if (hoursAgo <= 24) return 80
    if (hoursAgo <= 72) return 65
    if (hoursAgo <= 168) return 50  // 1 week
    if (hoursAgo <= 720) return 30  // 1 month
    return 10
  }

  private calculateWhitelistScore(channelName: string, channelId?: string): number {
    return isWhitelistedCreator(channelName, channelId) ? 100 : 20
  }

  private calculateVelocityScore(velocity: number, acceleration: number): number {
    // Combine velocity and acceleration for momentum scoring
    const velocityScore = Math.min(100, Math.max(0, velocity * 10))
    const accelerationBonus = acceleration > 0 ? Math.min(20, acceleration * 5) : 0
    
    return Math.min(100, velocityScore + accelerationBonus)
  }

  private calculateDurationScore(durationSeconds: number): number {
    const minutes = durationSeconds / 60
    
    // Optimal duration for golf content (5-20 minutes)
    if (minutes >= 5 && minutes <= 20) return 100
    if (minutes >= 3 && minutes <= 30) return 80
    if (minutes >= 1 && minutes <= 45) return 60
    if (minutes >= 0.5 && minutes <= 60) return 40
    return 20
  }

  private generateReasoning(factors: any, video: any): string[] {
    const reasoning: string[] = []

    if (factors.whitelisted >= 80) {
      reasoning.push('✅ From trusted golf creator')
    } else {
      reasoning.push('⚠️ Not from whitelisted creator')
    }

    if (factors.engagement >= 70) {
      reasoning.push('📈 High engagement rate')
    } else if (factors.engagement >= 40) {
      reasoning.push('📊 Moderate engagement')
    } else {
      reasoning.push('📉 Low engagement rate')
    }

    if (factors.freshness >= 80) {
      reasoning.push('🆕 Very recent content')
    } else if (factors.freshness >= 50) {
      reasoning.push('⏰ Recent content')
    } else {
      reasoning.push('📅 Older content')
    }

    if (factors.velocity >= 70) {
      reasoning.push('🚀 Trending rapidly')
    } else if (factors.velocity >= 40) {
      reasoning.push('📈 Gaining momentum')
    }

    if (factors.duration >= 80) {
      reasoning.push('⏱️ Optimal duration')
    }

    return reasoning
  }

  /**
   * Batch update quality scores for multiple videos
   */
  async updateQualityScores(limit: number = 100): Promise<number> {
    const client = await pool.connect()
    
    try {
      // Get videos that need quality scoring
      const result = await client.query(`
        SELECT 
          yv.id, yv.title, yc.title as channel_name, yv.channel_id,
          yv.view_count, yv.like_count, yv.comment_count, yv.published_at,
          yv.duration_seconds, yv.view_velocity, yv.view_acceleration
        FROM youtube_videos yv
        JOIN youtube_channels yc ON yv.channel_id = yc.id
        WHERE yv.quality_score IS NULL 
           OR yv.quality_updated_at < NOW() - INTERVAL '6 hours'
        ORDER BY yv.published_at DESC
        LIMIT $1
      `, [limit])

      let updated = 0

      for (const video of result.rows) {
        try {
          const qualityScore = await this.calculateQualityScore(video)
          
          await client.query(`
            UPDATE youtube_videos 
            SET quality_score = $1, 
                quality_factors = $2,
                quality_reasoning = $3,
                quality_updated_at = NOW()
            WHERE id = $1
          `, [
            qualityScore.overall,
            JSON.stringify(qualityScore.factors),
            JSON.stringify(qualityScore.reasoning),
            video.id
          ])
          
          updated++
        } catch (error) {
          console.error(`Quality scoring error for video ${video.id}:`, error)
        }
      }

      return updated

    } finally {
      client.release()
    }
  }

  /**
   * Get top quality videos for promotion
   */
  async getTopQualityVideos(limit: number = 20): Promise<any[]> {
    const client = await pool.connect()
    
    try {
      const result = await client.query(`
        SELECT 
          yv.id, yv.title, yc.title as channel, yv.view_count,
          yv.quality_score, yv.quality_reasoning, yv.published_at,
          yv.thumbnail_url
        FROM youtube_videos yv
        JOIN youtube_channels yc ON yv.channel_id = yc.id
        WHERE yv.quality_score IS NOT NULL
          AND yv.published_at >= NOW() - INTERVAL '7 days'
        ORDER BY yv.quality_score DESC, yv.view_count DESC
        LIMIT $1
      `, [limit])

      return result.rows

    } finally {
      client.release()
    }
  }
}

export const contentQualityScorer = new ContentQualityScorer()