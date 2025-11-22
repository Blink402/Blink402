-- Migration: Update buy-b402 to use Jupiter instead of PumpPortal
-- Date: 2025-01-12
-- Purpose: Switch from PumpPortal to Jupiter for more reliable swaps

UPDATE blinks
SET endpoint_url = '/api/jupiter/buy-b402'
WHERE slug = 'buy-b402';
