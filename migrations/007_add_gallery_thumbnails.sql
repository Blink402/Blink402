-- Migration: Add Thumbnail Support to Gallery Images
-- This adds thumbnail_path column for optimized gallery grid display

-- Add thumbnail_path column to gallery_images
ALTER TABLE gallery_images ADD COLUMN IF NOT EXISTS thumbnail_path VARCHAR(255);

-- Add index for thumbnail_path lookups
CREATE INDEX IF NOT EXISTS idx_gallery_images_thumbnail ON gallery_images(thumbnail_path);

-- Comment
COMMENT ON COLUMN gallery_images.thumbnail_path IS 'Relative path to the thumbnail image file (WebP, 300x300px)';

-- NOTE: Existing records will have NULL thumbnail_path since original files are lost
-- New uploads will populate both file_path and thumbnail_path
