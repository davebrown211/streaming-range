import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:mysecretpassword@localhost/postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
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