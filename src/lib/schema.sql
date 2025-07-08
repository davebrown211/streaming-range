-- Add acceleration column to youtube_videos table first
ALTER TABLE youtube_videos 
ADD COLUMN IF NOT EXISTS view_acceleration FLOAT DEFAULT 0.0;

-- Table to track historical view count snapshots for acceleration calculation
CREATE TABLE IF NOT EXISTS video_view_history (
    id SERIAL PRIMARY KEY,
    video_id VARCHAR(255) NOT NULL REFERENCES youtube_videos(id),
    view_count BIGINT NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance (after tables exist)
CREATE INDEX IF NOT EXISTS idx_video_acceleration ON youtube_videos(view_acceleration);
CREATE INDEX IF NOT EXISTS idx_view_history_video_time ON video_view_history(video_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_view_history_recorded ON video_view_history(recorded_at);