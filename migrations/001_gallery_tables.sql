-- Gallery feature tables
-- Add gallery_images and gallery_access tables for premium content feature

-- ======================
-- GALLERY_IMAGES TABLE
-- ======================
-- Stores images uploaded by creators for their exclusive galleries
CREATE TABLE IF NOT EXISTS gallery_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_wallet VARCHAR(44) NOT NULL,
  file_path TEXT NOT NULL,
  thumbnail_path TEXT,
  caption TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster gallery lookups by creator
CREATE INDEX IF NOT EXISTS idx_gallery_images_creator ON gallery_images(creator_wallet);
CREATE INDEX IF NOT EXISTS idx_gallery_images_uploaded_at ON gallery_images(uploaded_at);

-- ======================
-- GALLERY_ACCESS TABLE
-- ======================
-- Tracks paid access to creator galleries
CREATE TABLE IF NOT EXISTS gallery_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_wallet VARCHAR(44) NOT NULL,
  creator_wallet VARCHAR(44) NOT NULL,
  blink_slug VARCHAR(255) NOT NULL,
  paid_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  reference VARCHAR(44) NOT NULL,
  CONSTRAINT gallery_access_unique UNIQUE (viewer_wallet, creator_wallet, reference)
);

-- Indexes for access checks and analytics
CREATE INDEX IF NOT EXISTS idx_gallery_access_viewer ON gallery_access(viewer_wallet);
CREATE INDEX IF NOT EXISTS idx_gallery_access_creator ON gallery_access(creator_wallet);
CREATE INDEX IF NOT EXISTS idx_gallery_access_expires ON gallery_access(expires_at);
CREATE INDEX IF NOT EXISTS idx_gallery_access_reference ON gallery_access(reference);

-- ======================
-- TWITTER CREDENTIALS TABLE
-- ======================
-- Stores OAuth credentials for Twitter integration
CREATE TABLE IF NOT EXISTS twitter_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  twitter_user_id VARCHAR(255) NOT NULL,
  twitter_username VARCHAR(255) NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  CONSTRAINT twitter_credentials_creator_unique UNIQUE (creator_id)
);

-- Indexes for Twitter integration
CREATE INDEX IF NOT EXISTS idx_twitter_credentials_creator ON twitter_credentials(creator_id);
CREATE INDEX IF NOT EXISTS idx_twitter_credentials_user_id ON twitter_credentials(twitter_user_id);

-- ======================
-- TWITTER ACTIVITY TABLE
-- ======================
-- Logs Twitter actions performed via blinks
CREATE TABLE IF NOT EXISTS twitter_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id UUID NOT NULL REFERENCES twitter_credentials(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL,
  tweet_id VARCHAR(255),
  tweet_text TEXT,
  status VARCHAR(20) NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for Twitter activity tracking
CREATE INDEX IF NOT EXISTS idx_twitter_activity_credential ON twitter_activity(credential_id);
CREATE INDEX IF NOT EXISTS idx_twitter_activity_run ON twitter_activity(run_id);
CREATE INDEX IF NOT EXISTS idx_twitter_activity_created ON twitter_activity(created_at);

-- ======================
-- UPDATE BLINKS TABLE
-- ======================
-- Add access_duration_days column for gallery blinks
ALTER TABLE blinks ADD COLUMN IF NOT EXISTS access_duration_days INTEGER DEFAULT 30;

-- ======================
-- COMMENTS (Documentation)
-- ======================
COMMENT ON TABLE gallery_images IS 'Images uploaded by creators for their exclusive galleries';
COMMENT ON TABLE gallery_access IS 'Tracks paid access to creator galleries with expiration';
COMMENT ON TABLE twitter_credentials IS 'OAuth credentials for Twitter integration';
COMMENT ON TABLE twitter_activity IS 'Log of Twitter actions performed via blinks';

COMMENT ON COLUMN gallery_images.file_path IS 'Relative path to full-size image (e.g., galleries/wallet-uuid.webp)';
COMMENT ON COLUMN gallery_images.thumbnail_path IS 'Relative path to thumbnail image for grid display';
COMMENT ON COLUMN gallery_access.expires_at IS 'Access expires after this timestamp (based on blink access_duration_days)';
COMMENT ON COLUMN gallery_access.reference IS 'Solana Pay reference from the payment transaction';
COMMENT ON COLUMN blinks.access_duration_days IS 'Days of gallery access granted per payment (default: 30)';
