-- Migration: Add example_request and response_type fields for dynamic input support
-- Description: Allows blinks to specify request body templates and response format
-- Date: 2025-11-11

-- Add example_request column (JSON template for POST/PUT request bodies)
ALTER TABLE blinks
ADD COLUMN IF NOT EXISTS example_request TEXT;

-- Add response_type column (for rendering appropriate UI component)
ALTER TABLE blinks
ADD COLUMN IF NOT EXISTS response_type VARCHAR(50);

-- Add check constraint for valid response types
ALTER TABLE blinks
ADD CONSTRAINT blinks_response_type_valid
CHECK (response_type IS NULL OR response_type IN ('json', 'image', 'text', 'html', 'wallet-analysis', 'data'));

-- Create index on response_type for filtering
CREATE INDEX IF NOT EXISTS idx_blinks_response_type ON blinks(response_type);

-- Add helpful comments
COMMENT ON COLUMN blinks.example_request IS 'JSON template for request body (POST/PUT methods). Example: {"text": "...", "size": 300}';
COMMENT ON COLUMN blinks.response_type IS 'Expected response format for rendering: json, image, text, html, wallet-analysis, data';
