import pool from './database'

export interface QuotaUsage {
  date: string
  units_used: number
  operations: {
    searches: number
    video_updates: number
    channel_checks: number
  }
}

export class QuotaTracker {
  private static DAILY_LIMIT = 10000
  private static COSTS = {
    search: 100,
    videoList: 1, // Per batch of up to 50 videos
    channelList: 1,
    playlistItems: 1
  }

  async recordUsage(operation: string, units: number): Promise<void> {
    const client = await pool.connect()
    
    try {
      // Create table if not exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS api_quota_usage (
          id SERIAL PRIMARY KEY,
          date DATE DEFAULT CURRENT_DATE,
          operation VARCHAR(50),
          units_used INTEGER,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `)
      
      // Create indexes if not exists
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_api_quota_date ON api_quota_usage(date)
      `)
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_api_quota_operation ON api_quota_usage(date, operation)
      `)

      // Record usage
      await client.query(`
        INSERT INTO api_quota_usage (operation, units_used)
        VALUES ($1, $2)
      `, [operation, units])

    } finally {
      client.release()
    }
  }

  async getTodayUsage(): Promise<QuotaUsage> {
    const client = await pool.connect()
    
    try {
      // Ensure table exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS api_quota_usage (
          id SERIAL PRIMARY KEY,
          date DATE DEFAULT CURRENT_DATE,
          operation VARCHAR(50),
          units_used INTEGER,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `)
      // Get today's total usage
      const totalResult = await client.query(`
        SELECT 
          COALESCE(SUM(units_used), 0) as total_units
        FROM api_quota_usage
        WHERE date = CURRENT_DATE
      `)

      // Get breakdown by operation
      const breakdownResult = await client.query(`
        SELECT 
          operation,
          COUNT(*) as count,
          SUM(units_used) as total
        FROM api_quota_usage
        WHERE date = CURRENT_DATE
        GROUP BY operation
      `)

      const operations = {
        searches: 0,
        video_updates: 0,
        channel_checks: 0
      }

      breakdownResult.rows.forEach(row => {
        if (row.operation === 'search') operations.searches = parseInt(row.count)
        if (row.operation === 'video_update') operations.video_updates = parseInt(row.count)
        if (row.operation === 'channel_check') operations.channel_checks = parseInt(row.count)
      })

      return {
        date: new Date().toISOString().split('T')[0],
        units_used: parseInt(totalResult.rows[0].total_units),
        operations
      }

    } finally {
      client.release()
    }
  }

  async canPerformOperation(operation: string): Promise<boolean> {
    const usage = await this.getTodayUsage()
    const cost = QuotaTracker.COSTS[operation as keyof typeof QuotaTracker.COSTS] || 1
    
    return (usage.units_used + cost) <= QuotaTracker.DAILY_LIMIT
  }

  calculateBatchCost(operation: string, count: number): number {
    switch (operation) {
      case 'video_update':
        // Videos can be batched 50 at a time
        return Math.ceil(count / 50) * QuotaTracker.COSTS.videoList
      case 'search':
        return count * QuotaTracker.COSTS.search
      case 'channel_check':
        return count * QuotaTracker.COSTS.channelList
      default:
        return count
    }
  }
}

export const quotaTracker = new QuotaTracker()