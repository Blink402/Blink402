-- Migration: Reset Gallery Images Table
-- This clears orphaned records since original files were stored on ephemeral container filesystem
-- and have been lost during deployments.

-- Truncate gallery_images table (removes all records, resets auto-increment)
TRUNCATE TABLE gallery_images CASCADE;

-- Comment
COMMENT ON TABLE gallery_images IS 'Images uploaded to creator galleries (reset due to ephemeral storage migration to persistent volumes)';

-- NOTE: This migration is safe because:
-- 1. Original image files are already lost (stored on container filesystem)
-- 2. Database records point to non-existent files
-- 3. Users will need to re-upload images (which will now persist)
-- 4. No CASCADE issues - gallery_access table references creator_wallet, not gallery_images
