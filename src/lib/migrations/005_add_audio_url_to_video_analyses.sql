-- Add audio_url column to video_analyses table if it doesn't exist
ALTER TABLE video_analyses 
ADD COLUMN IF NOT EXISTS audio_url VARCHAR(500);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_video_analyses_audio_url 
ON video_analyses(audio_url) 
WHERE audio_url IS NOT NULL;