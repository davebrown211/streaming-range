import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:mysecretpassword@localhost/postgres',
  ssl: process.env.DATABASE_URL?.includes('ondigitalocean.com') ? {
    rejectUnauthorized: false
  } : false,
  max: 10, // Reduce max connections
  min: 2,  // Minimum connections to keep alive
  idleTimeoutMillis: 60000, // 1 minute
  connectionTimeoutMillis: 10000, // 10 seconds
  acquireTimeoutMillis: 15000, // 15 seconds to get connection from pool
  statement_timeout: 30000, // 30 seconds for query timeout
  query_timeout: 30000, // 30 seconds for query timeout
})

export default pool

export interface YouTubeVideo {
  id: string
  title: string
  description?: string
  channel_id: string
  published_at: Date
  view_count: number
  like_count: number
  comment_count: number
  engagement_rate: number
  view_velocity: number
  duration_seconds?: number
  thumbnail_url?: string
  category?: string
  updated_at: Date
}

export interface YouTubeChannel {
  id: string
  title: string
  description?: string
  subscriber_count: number
  video_count: number
  view_count: number
  thumbnail_url?: string
  created_at: Date
  updated_at: Date
}

export interface VideoRanking {
  id: number
  video_id: string
  ranking_type: string
  rank: number
  score: number
  date: Date
}