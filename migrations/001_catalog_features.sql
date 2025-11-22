-- Migration: Catalog Features
-- Date: 2025-11-10
-- Description: Add catalog functionality including public/private Blinks, badges, featured items, health tracking, and reporting

-- ======================
-- BLINKS TABLE UPDATES
-- ======================

-- Add catalog-specific fields to blinks table
ALTER TABLE blinks
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS publish_to_catalog BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS media_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS avg_latency_ms INTEGER,
ADD COLUMN IF NOT EXISTS success_rate_percent DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS badges JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS catalog_published_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reported_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS fork_of_blink_id UUID REFERENCES blinks(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_forkable BOOLEAN DEFAULT FALSE;

-- Add indexes for catalog queries
CREATE INDEX IF NOT EXISTS idx_blinks_is_public ON blinks(is_public);
CREATE INDEX IF NOT EXISTS idx_blinks_is_featured ON blinks(is_featured);
CREATE INDEX IF NOT EXISTS idx_blinks_publish_to_catalog ON blinks(publish_to_catalog);
CREATE INDEX IF NOT EXISTS idx_blinks_badges ON blinks USING GIN (badges);
CREATE INDEX IF NOT EXISTS idx_blinks_media_type ON blinks(media_type);
CREATE INDEX IF NOT EXISTS idx_blinks_catalog_published_at ON blinks(catalog_published_at);
CREATE INDEX IF NOT EXISTS idx_blinks_success_rate ON blinks(success_rate_percent);
CREATE INDEX IF NOT EXISTS idx_blinks_avg_latency ON blinks(avg_latency_ms);

-- ======================
-- CREATORS TABLE UPDATES
-- ======================

-- Add verification status to creators
ALTER TABLE creators
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS verified_by VARCHAR(255);

-- Index for verified creators
CREATE INDEX IF NOT EXISTS idx_creators_is_verified ON creators(is_verified);

-- ======================
-- BLINK REPORTS TABLE
-- ======================

-- Create table for user reports on Blinks
CREATE TABLE IF NOT EXISTS blink_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blink_id UUID NOT NULL REFERENCES blinks(id) ON DELETE CASCADE,
  reporter_wallet VARCHAR(44),
  reporter_email VARCHAR(255),
  reason VARCHAR(50) NOT NULL,
  details TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  reviewed_by VARCHAR(255),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for reports
CREATE INDEX IF NOT EXISTS idx_blink_reports_blink_id ON blink_reports(blink_id);
CREATE INDEX IF NOT EXISTS idx_blink_reports_status ON blink_reports(status);
CREATE INDEX IF NOT EXISTS idx_blink_reports_reason ON blink_reports(reason);
CREATE INDEX IF NOT EXISTS idx_blink_reports_created_at ON blink_reports(created_at);

-- Report reason validation
ALTER TABLE blink_reports ADD CONSTRAINT blink_reports_reason_valid CHECK (
  reason IN ('spam', 'scam', 'broken', 'inappropriate', 'copyright', 'other')
);

-- Report status validation
ALTER TABLE blink_reports ADD CONSTRAINT blink_reports_status_valid CHECK (
  status IN ('pending', 'reviewing', 'resolved', 'dismissed')
);

-- ======================
-- FEATURED BLINKS TABLE
-- ======================

-- Track featured Blinks with ordering and scheduling
CREATE TABLE IF NOT EXISTS featured_blinks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blink_id UUID NOT NULL REFERENCES blinks(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL,
  title_override VARCHAR(255),
  description_override TEXT,
  featured_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  featured_until TIMESTAMP WITH TIME ZONE,
  created_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure unique ordering
CREATE UNIQUE INDEX IF NOT EXISTS idx_featured_blinks_order ON featured_blinks(display_order) WHERE featured_until IS NULL OR featured_until > NOW();
CREATE INDEX IF NOT EXISTS idx_featured_blinks_blink_id ON featured_blinks(blink_id);
CREATE INDEX IF NOT EXISTS idx_featured_blinks_active ON featured_blinks(featured_from, featured_until);

-- ======================
-- TRENDING METRICS TABLE
-- ======================

-- Track trending metrics for catalog
CREATE TABLE IF NOT EXISTS blink_trending_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blink_id UUID NOT NULL REFERENCES blinks(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  runs_count INTEGER DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  total_volume_usdc DECIMAL(15,6) DEFAULT 0,
  avg_latency_ms INTEGER,
  success_rate DECIMAL(5,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(blink_id, metric_date)
);

-- Indexes for trending queries
CREATE INDEX IF NOT EXISTS idx_trending_metrics_blink_id ON blink_trending_metrics(blink_id);
CREATE INDEX IF NOT EXISTS idx_trending_metrics_date ON blink_trending_metrics(metric_date);
CREATE INDEX IF NOT EXISTS idx_trending_metrics_runs ON blink_trending_metrics(runs_count);

-- ======================
-- BADGE DEFINITIONS TABLE
-- ======================

-- Define available badges and their criteria
CREATE TABLE IF NOT EXISTS badge_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon_url TEXT,
  criteria_type VARCHAR(50) NOT NULL, -- 'manual', 'automatic'
  criteria_config JSONB, -- JSON config for automatic badge calculation
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default badge definitions
INSERT INTO badge_definitions (code, name, description, criteria_type, criteria_config, display_order)
VALUES
  ('verified', 'Verified Creator', 'Verified identity and trusted creator', 'manual', '{}', 1),
  ('fast', 'Fast', 'Average response time under 1.5 seconds', 'automatic', '{"field": "avg_latency_ms", "operator": "<", "value": 1500}', 2),
  ('reliable', 'Reliable', 'Success rate over 99%', 'automatic', '{"field": "success_rate_percent", "operator": ">", "value": 99}', 3),
  ('reverse', 'Reverse', 'Pays users instead of charging', 'automatic', '{"field": "payment_mode", "operator": "=", "value": "reward"}', 4),
  ('forkable', 'Forkable', 'Can be cloned as a template', 'automatic', '{"field": "is_forkable", "operator": "=", "value": true}', 5),
  ('trending', 'Trending', 'High usage in the last 24 hours', 'automatic', '{"period": "24h", "min_runs": 100}', 6)
ON CONFLICT (code) DO NOTHING;

-- ======================
-- URL ALLOWLIST/DENYLIST
-- ======================

-- URL filtering for safety
CREATE TABLE IF NOT EXISTS url_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url_pattern VARCHAR(500) NOT NULL,
  filter_type VARCHAR(20) NOT NULL, -- 'allow' or 'deny'
  reason TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for URL filtering
CREATE INDEX IF NOT EXISTS idx_url_filters_pattern ON url_filters(url_pattern);
CREATE INDEX IF NOT EXISTS idx_url_filters_type ON url_filters(filter_type);
CREATE INDEX IF NOT EXISTS idx_url_filters_active ON url_filters(is_active);

-- Filter type validation
ALTER TABLE url_filters ADD CONSTRAINT url_filters_type_valid CHECK (
  filter_type IN ('allow', 'deny')
);

-- ======================
-- MEDIA TYPE VALIDATION
-- ======================

-- Add media type validation to blinks
ALTER TABLE blinks ADD CONSTRAINT blinks_media_type_valid CHECK (
  media_type IS NULL OR media_type IN ('text', 'json', 'image', 'video', 'audio', 'data', 'ai', 'utility')
);

-- ======================
-- COMMENTS (Documentation)
-- ======================

-- Blinks table new columns
COMMENT ON COLUMN blinks.is_public IS 'Whether this Blink is visible in the public catalog';
COMMENT ON COLUMN blinks.is_featured IS 'Whether this Blink is featured on the homepage';
COMMENT ON COLUMN blinks.publish_to_catalog IS 'Creator opted to publish this Blink to the catalog';
COMMENT ON COLUMN blinks.media_type IS 'Type of response media: text, json, image, video, audio, data, ai, utility';
COMMENT ON COLUMN blinks.avg_latency_ms IS 'Average response time in milliseconds (for Fast badge)';
COMMENT ON COLUMN blinks.success_rate_percent IS 'Success rate percentage (for Reliable badge)';
COMMENT ON COLUMN blinks.badges IS 'Array of badge codes earned by this Blink';
COMMENT ON COLUMN blinks.catalog_published_at IS 'Timestamp when first published to catalog';
COMMENT ON COLUMN blinks.reported_count IS 'Number of user reports against this Blink';
COMMENT ON COLUMN blinks.fork_of_blink_id IS 'If this Blink was forked from another, reference to original';
COMMENT ON COLUMN blinks.is_forkable IS 'Whether this Blink can be forked by others';

-- Creators table new columns
COMMENT ON COLUMN creators.is_verified IS 'Whether this creator has been verified by platform';
COMMENT ON COLUMN creators.verified_at IS 'Timestamp when creator was verified';
COMMENT ON COLUMN creators.verified_by IS 'Admin who verified this creator';

-- New tables
COMMENT ON TABLE blink_reports IS 'User reports for problematic Blinks';
COMMENT ON TABLE featured_blinks IS 'Homepage featured Blinks with custom ordering';
COMMENT ON TABLE blink_trending_metrics IS 'Daily aggregated metrics for trending calculation';
COMMENT ON TABLE badge_definitions IS 'Available badges and their automatic calculation criteria';
COMMENT ON TABLE url_filters IS 'URL allowlist and denylist for safety filtering';

-- ======================
-- HELPER FUNCTIONS
-- ======================

-- Function to calculate badges for a Blink
CREATE OR REPLACE FUNCTION calculate_blink_badges(blink_id_param UUID)
RETURNS JSONB AS $$
DECLARE
  blink_record RECORD;
  creator_record RECORD;
  badges_array JSONB := '[]'::jsonb;
BEGIN
  -- Get blink and creator data
  SELECT b.*, c.is_verified
  INTO blink_record
  FROM blinks b
  JOIN creators c ON b.creator_id = c.id
  WHERE b.id = blink_id_param;

  -- Check verified creator
  IF creator_record.is_verified THEN
    badges_array := badges_array || '["verified"]'::jsonb;
  END IF;

  -- Check fast badge (< 1.5s)
  IF blink_record.avg_latency_ms IS NOT NULL AND blink_record.avg_latency_ms < 1500 THEN
    badges_array := badges_array || '["fast"]'::jsonb;
  END IF;

  -- Check reliable badge (> 99% success)
  IF blink_record.success_rate_percent IS NOT NULL AND blink_record.success_rate_percent > 99 THEN
    badges_array := badges_array || '["reliable"]'::jsonb;
  END IF;

  -- Check reverse badge (reward mode)
  IF blink_record.payment_mode = 'reward' THEN
    badges_array := badges_array || '["reverse"]'::jsonb;
  END IF;

  -- Check forkable badge
  IF blink_record.is_forkable THEN
    badges_array := badges_array || '["forkable"]'::jsonb;
  END IF;

  RETURN badges_array;
END;
$$ LANGUAGE plpgsql;

-- Function to update trending metrics (to be called daily)
CREATE OR REPLACE FUNCTION update_trending_metrics(metric_date_param DATE DEFAULT CURRENT_DATE - INTERVAL '1 day')
RETURNS void AS $$
BEGIN
  INSERT INTO blink_trending_metrics (
    blink_id,
    metric_date,
    runs_count,
    unique_users,
    total_volume_usdc,
    avg_latency_ms,
    success_rate
  )
  SELECT
    b.id,
    metric_date_param,
    COUNT(DISTINCT r.id) as runs_count,
    COUNT(DISTINCT r.payer) as unique_users,
    SUM(b.price_usdc) as total_volume_usdc,
    AVG(r.duration_ms)::INTEGER as avg_latency_ms,
    (COUNT(CASE WHEN r.status = 'executed' THEN 1 END)::DECIMAL / NULLIF(COUNT(*), 0) * 100) as success_rate
  FROM blinks b
  LEFT JOIN runs r ON b.id = r.blink_id
  WHERE r.created_at::DATE = metric_date_param
  GROUP BY b.id
  ON CONFLICT (blink_id, metric_date) DO UPDATE SET
    runs_count = EXCLUDED.runs_count,
    unique_users = EXCLUDED.unique_users,
    total_volume_usdc = EXCLUDED.total_volume_usdc,
    avg_latency_ms = EXCLUDED.avg_latency_ms,
    success_rate = EXCLUDED.success_rate;

  -- Update average latency and success rate on blinks table
  UPDATE blinks b
  SET
    avg_latency_ms = subq.avg_latency,
    success_rate_percent = subq.success_rate
  FROM (
    SELECT
      blink_id,
      AVG(avg_latency_ms)::INTEGER as avg_latency,
      AVG(success_rate) as success_rate
    FROM blink_trending_metrics
    WHERE metric_date >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY blink_id
  ) subq
  WHERE b.id = subq.blink_id;

  -- Update badges based on new metrics
  UPDATE blinks
  SET badges = calculate_blink_badges(id);
END;
$$ LANGUAGE plpgsql;

-- ======================
-- MIGRATION DATA
-- ======================

-- Mark existing active Blinks as public by default (can be adjusted)
-- UPDATE blinks SET is_public = TRUE WHERE status = 'active';

-- Set catalog_published_at for existing Blinks
-- UPDATE blinks SET catalog_published_at = created_at WHERE is_public = TRUE;