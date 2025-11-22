-- Migration: Add Twitter Integration Support
-- Allows creators to connect their Twitter accounts and monetize via blinks

-- Twitter Credentials Table
-- Stores encrypted OAuth tokens for each creator's Twitter account
CREATE TABLE IF NOT EXISTS twitter_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  twitter_user_id VARCHAR(255) NOT NULL,
  twitter_username VARCHAR(255) NOT NULL,
  access_token TEXT NOT NULL, -- OAuth 2.0 access token (encrypted in production)
  refresh_token TEXT NOT NULL, -- OAuth 2.0 refresh token (encrypted in production)
  token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(creator_id), -- One Twitter account per creator
  UNIQUE(twitter_user_id) -- One creator per Twitter account
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_twitter_credentials_creator_id ON twitter_credentials(creator_id);
CREATE INDEX IF NOT EXISTS idx_twitter_credentials_twitter_user_id ON twitter_credentials(twitter_user_id);
CREATE INDEX IF NOT EXISTS idx_twitter_credentials_is_active ON twitter_credentials(is_active);

-- Twitter Activity Log
-- Tracks all Twitter actions performed via blinks for analytics
CREATE TABLE IF NOT EXISTS twitter_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id UUID NOT NULL REFERENCES twitter_credentials(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL, -- 'post_tweet', 'reply', 'retweet', etc.
  tweet_id VARCHAR(255), -- Twitter tweet ID if action created a tweet
  tweet_text TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'success', 'failed'
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for analytics
CREATE INDEX IF NOT EXISTS idx_twitter_activity_credential_id ON twitter_activity(credential_id);
CREATE INDEX IF NOT EXISTS idx_twitter_activity_run_id ON twitter_activity(run_id);
CREATE INDEX IF NOT EXISTS idx_twitter_activity_status ON twitter_activity(status);
CREATE INDEX IF NOT EXISTS idx_twitter_activity_created_at ON twitter_activity(created_at);

-- Constraints
ALTER TABLE twitter_activity ADD CONSTRAINT twitter_activity_action_type_valid
  CHECK (action_type IN ('post_tweet', 'reply', 'retweet', 'quote_tweet', 'like', 'follow'));

ALTER TABLE twitter_activity ADD CONSTRAINT twitter_activity_status_valid
  CHECK (status IN ('pending', 'success', 'failed'));

-- Comments
COMMENT ON TABLE twitter_credentials IS 'Stores Twitter OAuth credentials for creators who want to monetize their Twitter accounts';
COMMENT ON TABLE twitter_activity IS 'Audit log of all Twitter actions performed via blinks';

COMMENT ON COLUMN twitter_credentials.access_token IS 'OAuth 2.0 access token (should be encrypted at rest in production)';
COMMENT ON COLUMN twitter_credentials.refresh_token IS 'OAuth 2.0 refresh token for obtaining new access tokens';
COMMENT ON COLUMN twitter_credentials.token_expires_at IS 'When the current access token expires';
COMMENT ON COLUMN twitter_activity.action_type IS 'Type of Twitter action: post_tweet, reply, retweet, quote_tweet, like, follow';
