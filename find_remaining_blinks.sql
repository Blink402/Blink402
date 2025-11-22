-- Find all existing blinks to identify 2 more for featured updates
SELECT id, slug, title, endpoint_url, method, response_type
FROM blinks
ORDER BY created_at DESC;
