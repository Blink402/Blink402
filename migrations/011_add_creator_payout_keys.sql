-- Add encrypted payout private key column to creators table
-- This allows each creator to have their own payout wallet for slot machines or other reward-based blinks

ALTER TABLE creators
ADD COLUMN IF NOT EXISTS encrypted_payout_key TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_creators_encrypted_payout_key
ON creators(id)
WHERE encrypted_payout_key IS NOT NULL;

-- Add comment
COMMENT ON COLUMN creators.encrypted_payout_key IS 'AES-256-GCM encrypted Solana private key for payouts (base64)';
