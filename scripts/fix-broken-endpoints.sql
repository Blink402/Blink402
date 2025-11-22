-- Fix or disable broken endpoints discovered during testing

-- 1. isitup.org is broken/hijacked - replace with a working uptime checker
-- Option A: Disable it
UPDATE blinks
SET status = 'paused',
    updated_at = NOW()
WHERE slug = 'is-it-down-checker';

-- Option B: Replace with a working alternative (httpstat.us)
-- UPDATE blinks
-- SET endpoint_url = 'https://httpstat.us/200',
--     title = 'HTTP Status Test',
--     description = 'Test HTTP status codes',
--     method = 'GET',
--     updated_at = NOW()
-- WHERE slug = 'is-it-down-checker';

-- 2. CoinDesk API appears to be down - disable it
UPDATE blinks
SET status = 'paused',
    updated_at = NOW()
WHERE slug = 'sol-test-final-1762420369.130968';

-- 3. Lorem Picsum returns 302 (redirect to image) - this is actually OK
-- No change needed, 302 redirects are normal for image services

-- 4. Check Twitter/X endpoint exists (internal route)
-- This needs to be handled in the application code

-- Query to see what we disabled
SELECT slug, title, status, endpoint_url
FROM blinks
WHERE status = 'paused'
ORDER BY updated_at DESC;

-- Show remaining active blinks
SELECT slug, title, method, endpoint_url
FROM blinks
WHERE status = 'active'
ORDER BY created_at DESC;