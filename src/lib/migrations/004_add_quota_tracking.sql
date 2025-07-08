-- Create API quota usage tracking table
CREATE TABLE IF NOT EXISTS api_quota_usage (
  id SERIAL PRIMARY KEY,
  date DATE DEFAULT CURRENT_DATE,
  operation VARCHAR(50),
  units_used INTEGER,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient quota queries
CREATE INDEX IF NOT EXISTS idx_api_quota_date ON api_quota_usage(date);
CREATE INDEX IF NOT EXISTS idx_api_quota_operation ON api_quota_usage(date, operation);