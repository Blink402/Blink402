-- Migration: Add Creator Profile Fields
-- Date: 2025-01-07
-- Description: Extends creators table with profile information (display name, bio, avatar, social links)

-- Add new columns to creators table
ALTER TABLE creators
  ADD COLUMN IF NOT EXISTS display_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS banner_url TEXT,
  ADD COLUMN IF NOT EXISTS profile_slug VARCHAR(100) UNIQUE,
  ADD COLUMN IF NOT EXISTS social_links JSONB,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index on profile_slug for fast lookups
CREATE INDEX IF NOT EXISTS idx_creators_profile_slug ON creators(profile_slug);

-- Create trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_creators_updated_at
  BEFORE UPDATE ON creators
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON COLUMN creators.display_name IS 'Optional display name (shown instead of wallet address)';
COMMENT ON COLUMN creators.bio IS 'Creator bio/description (max ~500 characters recommended)';
COMMENT ON COLUMN creators.avatar_url IS 'Profile picture URL';
COMMENT ON COLUMN creators.banner_url IS 'Profile header banner URL';
COMMENT ON COLUMN creators.profile_slug IS 'Optional custom URL slug (e.g., "alice" for /profile/alice)';
COMMENT ON COLUMN creators.social_links IS 'JSON object with social media handles: {twitter, github, website, discord}';

-- Example social_links format:
-- {
--   "twitter": "@username",
--   "github": "username",
--   "website": "https://example.com",
--   "discord": "username#1234"
-- }
