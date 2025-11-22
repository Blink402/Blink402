-- Check current blinks in database
SELECT id, slug, title, endpoint_url, method, status
FROM blinks
ORDER BY created_at DESC
LIMIT 10;
