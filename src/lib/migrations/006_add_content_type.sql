-- Add content_type column to distinguish between curated and discovery videos

ALTER TABLE youtube_videos 
ADD COLUMN IF NOT EXISTS content_type VARCHAR(20) DEFAULT 'curated';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_youtube_videos_content_type 
ON youtube_videos(content_type);

-- Update existing videos to be curated by default
UPDATE youtube_videos 
SET content_type = 'curated' 
WHERE content_type IS NULL;