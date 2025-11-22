-- Add access_duration_days field to blinks table for gallery subscriptions
ALTER TABLE blinks
ADD COLUMN access_duration_days INTEGER DEFAULT 30;

-- Add comment to explain the field
COMMENT ON COLUMN blinks.access_duration_days IS 'Number of days gallery access is granted after payment (for gallery-type blinks)';
