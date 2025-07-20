-- Database optimization for efficient new video queries
-- Run these commands to improve query performance for whitelisted channel video retrieval

-- ================================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- ================================================================

-- Primary index for whitelisted channel queries
-- This is the most important index for filtering by channel_id array
CREATE INDEX IF NOT EXISTS idx_youtube_videos_channel_published 
ON youtube_videos(channel_id, published_at DESC);

-- Composite index for time-based filtering with view threshold
CREATE INDEX IF NOT EXISTS idx_youtube_videos_recent_performance 
ON youtube_videos(published_at DESC, view_count DESC) 
WHERE view_count >= 100 AND thumbnail_url IS NOT NULL;

-- Index for engagement-based sorting
CREATE INDEX IF NOT EXISTS idx_youtube_videos_engagement 
ON youtube_videos(engagement_rate DESC, published_at DESC) 
WHERE engagement_rate IS NOT NULL AND engagement_rate > 0;

-- Index for view velocity sorting
CREATE INDEX IF NOT EXISTS idx_youtube_videos_velocity 
ON youtube_videos(view_velocity DESC, published_at DESC) 
WHERE view_velocity > 0;

-- Partial index for non-short videos (duration > 60 seconds)
CREATE INDEX IF NOT EXISTS idx_youtube_videos_non_shorts 
ON youtube_videos(published_at DESC, view_count DESC) 
WHERE (duration_seconds IS NULL OR duration_seconds > 60);

-- Index for channel joins (should already exist, but ensuring it's there)
CREATE INDEX IF NOT EXISTS idx_youtube_channels_id 
ON youtube_channels(id);

-- ================================================================
-- PERFORMANCE ANALYSIS QUERIES
-- ================================================================

-- Query to analyze index usage
-- Run this to see which indexes are being used
/*
EXPLAIN (ANALYZE, BUFFERS) 
SELECT yv.id, yv.title, yc.title as channel_name, yv.published_at, yv.view_count
FROM youtube_videos yv
JOIN youtube_channels yc ON yv.channel_id = yc.id
WHERE yv.channel_id = ANY(ARRAY['UCq-Cy3CK3r-qmjM7fXPqTlQ', 'UCqr4sONkmFEOPc3rfoVLEvg'])
  AND yv.published_at >= NOW() - INTERVAL '24 hours'
  AND yv.view_count >= 100
ORDER BY yv.published_at DESC
LIMIT 20;
*/

-- Query to check index sizes and usage stats
-- Uncomment to run diagnostics
/*
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE tablename IN ('youtube_videos', 'youtube_channels')
ORDER BY idx_tup_read DESC;
*/

-- ================================================================
-- QUERY OPTIMIZATION VIEWS
-- ================================================================

-- Create a view for frequently accessed whitelisted video data
-- This pre-joins tables and applies common filters
CREATE OR REPLACE VIEW whitelisted_videos_recent AS
SELECT 
  yv.id,
  yv.title,
  yc.title as channel_name,
  yc.id as channel_id,
  yv.published_at,
  yv.view_count,
  yv.like_count,
  yv.comment_count,
  yv.engagement_rate,
  yv.view_velocity,
  yv.duration_seconds,
  yv.thumbnail_url,
  yv.updated_at,
  -- Pre-calculate common metrics
  EXTRACT(EPOCH FROM (NOW() - yv.published_at))/3600 as hours_old,
  CASE WHEN yv.duration_seconds <= 60 THEN true ELSE false END as is_short,
  -- Pre-calculate momentum score
  CASE 
    WHEN yv.published_at >= NOW() - INTERVAL '6 hours' THEN yv.view_count * 100
    WHEN yv.published_at >= NOW() - INTERVAL '12 hours' THEN yv.view_count * 50
    WHEN yv.published_at >= NOW() - INTERVAL '24 hours' THEN yv.view_count * 20
    WHEN yv.published_at >= NOW() - INTERVAL '48 hours' THEN yv.view_count * 5
    ELSE yv.view_count
  END as momentum_score
FROM youtube_videos yv
JOIN youtube_channels yc ON yv.channel_id = yc.id
WHERE 
  yv.published_at >= NOW() - INTERVAL '30 days'  -- Only recent videos
  AND yv.view_count >= 50                         -- Reasonable minimum
  AND yv.thumbnail_url IS NOT NULL                -- Must have thumbnail
  -- Content quality filters (applied once in view)
  AND yv.title !~ '[あ-ん]'                       -- Exclude Japanese hiragana
  AND yv.title !~ '[ア-ン]'                       -- Exclude Japanese katakana  
  AND yv.title !~ '[一-龯]'                       -- Exclude Chinese/Japanese kanji
  AND yv.title !~ '[À-ÿ]'                        -- Exclude accented characters
  AND yv.title NOT ILIKE '%volkswagen%'           -- Exclude VW Golf cars
  AND yv.title NOT ILIKE '%vw golf%'
  AND yv.title NOT ILIKE '%gta%'                  -- Exclude GTA games
  AND yv.title NOT ILIKE '%forza%'                -- Exclude racing games
  AND yv.title NOT ILIKE '%golf cart%'            -- Focus on golf sport
  -- Tournament exclusions
  AND yv.title !~* '(round [0-9]|r[0-9]|mpo \\||fpo \\||klpga|kpga|championship 20|tournament highlights|final round|course maintenance)';

-- ================================================================
-- EFFICIENT QUERY FUNCTIONS  
-- ================================================================

-- Function to get new videos with optimal performance
-- This encapsulates the most efficient query pattern
CREATE OR REPLACE FUNCTION get_new_whitelisted_videos(
  channel_ids TEXT[],
  hours_back INTEGER DEFAULT 24,
  min_views INTEGER DEFAULT 100,
  result_limit INTEGER DEFAULT 20,
  sort_by TEXT DEFAULT 'published'
)
RETURNS TABLE(
  id VARCHAR(255),
  title VARCHAR(255),
  channel_name VARCHAR(255),
  published_at TIMESTAMP WITH TIME ZONE,
  view_count BIGINT,
  engagement_rate FLOAT,
  momentum_score BIGINT,
  hours_old FLOAT
) AS $$
DECLARE
  order_clause TEXT;
BEGIN
  -- Set sort order based on parameter
  CASE sort_by
    WHEN 'views' THEN order_clause := 'view_count DESC, published_at DESC';
    WHEN 'engagement' THEN order_clause := 'engagement_rate DESC, published_at DESC';
    WHEN 'momentum' THEN order_clause := 'momentum_score DESC, published_at DESC';
    ELSE order_clause := 'published_at DESC, view_count DESC';
  END CASE;

  -- Return optimized query results
  RETURN QUERY EXECUTE format('
    SELECT 
      wvr.id,
      wvr.title,
      wvr.channel_name,
      wvr.published_at,
      wvr.view_count,
      wvr.engagement_rate,
      wvr.momentum_score,
      wvr.hours_old
    FROM whitelisted_videos_recent wvr
    WHERE 
      wvr.channel_id = ANY($1)
      AND wvr.hours_old <= $2
      AND wvr.view_count >= $3
    ORDER BY %s
    LIMIT $4
  ', order_clause)
  USING channel_ids, hours_back, min_views, result_limit;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- MAINTENANCE COMMANDS
-- ================================================================

-- Update table statistics for better query planning
-- Run this periodically to keep the query planner optimized
ANALYZE youtube_videos;
ANALYZE youtube_channels;

-- Check for unused indexes (run periodically to clean up)
/*
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_tup_read,
  idx_tup_fetch,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes 
WHERE tablename IN ('youtube_videos', 'youtube_channels')
  AND idx_tup_read = 0
ORDER BY pg_relation_size(indexrelid) DESC;
*/

-- ================================================================
-- USAGE EXAMPLES
-- ================================================================

/*
-- Example 1: Get latest videos from whitelisted channels
SELECT * FROM get_new_whitelisted_videos(
  ARRAY['UCq-Cy3CK3r-qmjM7fXPqTlQ', 'UCqr4sONkmFEOPc3rfoVLEvg'],
  24,    -- Last 24 hours  
  100,   -- Minimum 100 views
  20,    -- Return 20 videos
  'published'  -- Sort by published date
);

-- Example 2: Get high-engagement recent videos
SELECT * FROM get_new_whitelisted_videos(
  ARRAY['UCq-Cy3CK3r-qmjM7fXPqTlQ', 'UCqr4sONkmFEOPc3rfoVLEvg'],
  48,    -- Last 48 hours
  500,   -- Minimum 500 views  
  10,    -- Return 10 videos
  'engagement'  -- Sort by engagement rate
);

-- Example 3: Simple view query for dashboard
SELECT id, title, channel_name, hours_old, momentum_score 
FROM whitelisted_videos_recent 
WHERE channel_id = ANY(ARRAY['UCq-Cy3CK3r-qmjM7fXPqTlQ'])
  AND hours_old <= 24
ORDER BY momentum_score DESC 
LIMIT 5;
*/