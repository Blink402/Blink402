-- Migration: Add Gallery Feature Tables
-- This creates the necessary tables for the gallery feature

-- ======================
-- GALLERY_IMAGES TABLE
-- ======================
-- Stores images uploaded to creator galleries
CREATE TABLE IF NOT EXISTS gallery_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_wallet VARCHAR(44) NOT NULL,
  file_path VARCHAR(255) NOT NULL,
  caption TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups by creator
CREATE INDEX IF NOT EXISTS idx_gallery_images_creator ON gallery_images(creator_wallet);
CREATE INDEX IF NOT EXISTS idx_gallery_images_uploaded_at ON gallery_images(uploaded_at DESC);

-- ======================
-- GALLERY_ACCESS TABLE
-- ======================
-- Stores paid access records for galleries
CREATE TABLE IF NOT EXISTS gallery_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_wallet VARCHAR(44) NOT NULL,
  creator_wallet VARCHAR(44) NOT NULL,
  blink_slug VARCHAR(255) NOT NULL,
  paid_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  reference VARCHAR(44) NOT NULL UNIQUE
);

-- Indexes for access checks
CREATE INDEX IF NOT EXISTS idx_gallery_access_viewer ON gallery_access(viewer_wallet);
CREATE INDEX IF NOT EXISTS idx_gallery_access_creator ON gallery_access(creator_wallet);
CREATE INDEX IF NOT EXISTS idx_gallery_access_expires ON gallery_access(expires_at);
CREATE INDEX IF NOT EXISTS idx_gallery_access_reference ON gallery_access(reference);

-- Unique constraint to prevent duplicate active access records
CREATE UNIQUE INDEX IF NOT EXISTS idx_gallery_access_unique_active
ON gallery_access(viewer_wallet, creator_wallet)
WHERE expires_at > NOW();

-- ======================
-- ADD MISSING COLUMN TO BLINKS TABLE
-- ======================
-- Add access_duration_days column if it doesn't exist
ALTER TABLE blinks ADD COLUMN IF NOT EXISTS access_duration_days INTEGER DEFAULT 30;

-- ======================
-- CONSTRAINTS
-- ======================
-- Ensure valid wallet addresses
ALTER TABLE gallery_images ADD CONSTRAINT gallery_images_wallet_length CHECK (length(creator_wallet) = 44);
ALTER TABLE gallery_access ADD CONSTRAINT gallery_access_viewer_wallet_length CHECK (length(viewer_wallet) = 44);
ALTER TABLE gallery_access ADD CONSTRAINT gallery_access_creator_wallet_length CHECK (length(creator_wallet) = 44);
ALTER TABLE gallery_access ADD CONSTRAINT gallery_access_reference_length CHECK (length(reference) = 44);

-- ======================
-- COMMENTS (Documentation)
-- ======================
COMMENT ON TABLE gallery_images IS 'Images uploaded to creator galleries';
COMMENT ON TABLE gallery_access IS 'Paid access records for viewing galleries';

COMMENT ON COLUMN gallery_images.creator_wallet IS 'Solana wallet of the gallery owner';
COMMENT ON COLUMN gallery_images.file_path IS 'Relative path to the uploaded image file';
COMMENT ON COLUMN gallery_images.caption IS 'Optional caption for the image';

COMMENT ON COLUMN gallery_access.viewer_wallet IS 'Solana wallet that paid for access';
COMMENT ON COLUMN gallery_access.creator_wallet IS 'Solana wallet of the gallery owner';
COMMENT ON COLUMN gallery_access.blink_slug IS 'Slug of the blink used for payment';
COMMENT ON COLUMN gallery_access.expires_at IS 'When the gallery access expires';
COMMENT ON COLUMN gallery_access.reference IS 'Solana Pay reference for payment verification';

COMMENT ON COLUMN blinks.access_duration_days IS 'Number of days access is granted (for gallery blinks)';