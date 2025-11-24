# B402 Auto-Burn System Setup Guide

## Overview

The B402 auto-burn system implements deflationary tokenomics by permanently removing B402 tokens from circulation with every blink execution. This document explains how to set up and configure the system.

## How It Works

1. **User executes a blink** → Payment verified → API called
2. **Backend triggers burn** → Burns X B402 tokens (default: 100)
3. **Transaction recorded** → Stored in database with Solana tx signature
4. **Homepage updates** → Live burn counter shows total burned

## Initial Setup

### Step 1: Generate Burner Wallet

The burner wallet holds B402 tokens that will be permanently burned. You need to generate a new Solana keypair:

**Option A: Using Solana CLI** (Recommended)
```bash
# Install Solana CLI if not already installed
# https://docs.solana.com/cli/install-solana-cli-tools

# Generate new keypair
solana-keygen new --outfile burner-keypair.json

# Display public key
solana-keygen pubkey burner-keypair.json

# Display private key (JSON array format)
cat burner-keypair.json
```

**Option B: Using Node.js Script**
```bash
# Use the included script
cd /path/to/blink402
node -e "
const { Keypair } = require('@solana/web3.js');
const fs = require('fs');

const keypair = Keypair.generate();
const secretArray = Array.from(keypair.secretKey);

console.log('Public Key:', keypair.publicKey.toBase58());
console.log('Private Key (JSON):', JSON.stringify(secretArray));

// Optionally save to file
fs.writeFileSync('burner-keypair.json', JSON.stringify(secretArray));
console.log('Saved to burner-keypair.json');
"
```

### Step 2: Configure Environment Variables

Add the following to your `.env` file:

```bash
# ================================
# B402 Auto-Burn System
# ================================

# Burner wallet private key (JSON array format from keypair.json)
BURNER_WALLET_PRIVATE_KEY=[31,174,117,179,...]

# Burner wallet public key (for transparency display)
BURNER_WALLET_PUBLIC_KEY=YourPublicKeyHere...

# Amount of B402 to burn per blink execution
B402_BURN_AMOUNT=100

# Enable/disable auto-burn feature
B402_BURN_ENABLED=true
```

### Step 3: Fund the Burner Wallet

The burner wallet needs:

1. **SOL for transaction fees**
   - Send at least 0.1 SOL (~$20 USD)
   - This covers ~20,000 burn transactions
   - Each burn costs ~0.000005 SOL

2. **B402 tokens to burn**
   - Send B402 tokens you want to burn
   - Example: 100,000 B402 = 1,000 blinks (at 100 B402/burn)
   - Refill periodically as needed

**Funding Commands:**
```bash
# Fund with SOL (mainnet)
solana transfer YOUR_BURNER_WALLET_ADDRESS 0.1 --url mainnet-beta

# Transfer B402 tokens (use your preferred wallet or CLI)
spl-transfer B402_MINT_ADDRESS 100000 YOUR_BURNER_WALLET_ADDRESS --url mainnet-beta
```

### Step 4: Run Database Migration

Apply the burns table migration:

```bash
# Connect to your PostgreSQL database
psql $DATABASE_URL

# Run the migration
\i migrations/021_add_burns_table.sql

# Verify table was created
\dt burns
\d burns
```

**Manual SQL (if needed):**
```sql
-- Create burns table
CREATE TABLE IF NOT EXISTS burns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  amount_b402 BIGINT NOT NULL CHECK (amount_b402 > 0),
  tx_signature TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_burns_run_id ON burns(run_id);
CREATE INDEX IF NOT EXISTS idx_burns_created_at ON burns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_burns_tx_signature ON burns(tx_signature);
```

### Step 5: Deploy and Test

1. **Build packages:**
```bash
pnpm build
```

2. **Start development server:**
```bash
pnpm dev
```

3. **Test burn system:**
   - Execute a test blink
   - Check logs for "B402 burn completed successfully"
   - View burn on Solscan: `https://solscan.io/tx/<burn_signature>`
   - Check homepage for updated burn counter

## Monitoring

### Check Burn Statistics

```bash
# Via API
curl http://localhost:3001/burns/stats

# Expected response:
{
  "success": true,
  "data": {
    "totalBurned": "1234.56",
    "burned24h": "100.00",
    "burned7d": "700.00",
    "burned30d": "3000.00",
    "burnCount": 123,
    "burnCount24h": 10,
    "lastBurnAt": "2025-11-24T12:34:56.789Z",
    "burnRate": "100.00"
  }
}
```

### Check Burner Wallet Balance

```bash
# Via API
curl http://localhost:3001/burns/wallet

# Check SOL balance
solana balance YOUR_BURNER_WALLET_ADDRESS --url mainnet-beta

# Check B402 balance
spl-token balance B402_MINT_ADDRESS --owner YOUR_BURNER_WALLET_ADDRESS --url mainnet-beta
```

### View Recent Burns

```bash
# Via API
curl http://localhost:3001/burns/recent?limit=10

# Via Database
psql $DATABASE_URL -c "SELECT * FROM burns ORDER BY created_at DESC LIMIT 10;"
```

## Troubleshooting

### Burn Failures

**Error**: "Insufficient B402 balance in burner wallet"
- **Solution**: Refill burner wallet with more B402 tokens

**Error**: "Insufficient SOL for transaction fees"
- **Solution**: Send more SOL to burner wallet (0.1 SOL recommended)

**Error**: "BURNER_WALLET_PRIVATE_KEY not configured"
- **Solution**: Add private key to `.env` file

**Error**: "Invalid BURNER_WALLET_PRIVATE_KEY format"
- **Solution**: Ensure private key is in JSON array format: `[31,174,117,...]`

### Burns Disabled

Check if burns are enabled:
```bash
# Via API
curl http://localhost:3001/burns/health

# Check environment variable
echo $B402_BURN_ENABLED
```

If disabled, set `B402_BURN_ENABLED=true` in `.env` and restart server.

### Database Issues

**Error**: "relation "burns" does not exist"
- **Solution**: Run database migration (Step 4)

**Error**: "duplicate key value violates unique constraint"
- **Solution**: This is normal (idempotency) - burn already recorded

## Cost Analysis

### Transaction Costs

- **SOL cost per burn**: ~0.000005 SOL (~$0.001 USD)
- **At 100 blinks/day**: $0.10/day = $3/month
- **At 1000 blinks/day**: $1/day = $30/month

### Burn Economics

With default settings (100 B402/blink):
- **1,000 blinks** = 100,000 B402 burned
- **10,000 blinks** = 1,000,000 B402 burned
- **100,000 blinks** = 10,000,000 B402 burned

Adjust `B402_BURN_AMOUNT` based on:
- Token supply
- Blink volume
- Desired burn rate
- Tokenomics strategy

## Security

1. **Private Key Storage**
   - Store `BURNER_WALLET_PRIVATE_KEY` securely
   - Use environment variables (never commit to git)
   - Rotate keys if compromised

2. **Wallet Separation**
   - Use dedicated wallet for burns only
   - Don't mix with treasury or platform wallets
   - Limits risk if key is compromised

3. **Monitoring**
   - Monitor burner wallet balance daily
   - Set up alerts for low SOL/B402 balance
   - Track burn transaction signatures

## Frontend Display

The burn stats are displayed on the homepage at `/`:

- **Total Burned**: Large animated counter
- **24h Stats**: Burn rate and recent activity
- **7d/30d Stats**: Historical burn data
- **Transparency**: Link to burner wallet on Solscan

Auto-refreshes every 30 seconds to show latest data.

## API Endpoints

- `GET /burns/stats` - Get burn statistics
- `GET /burns/recent?limit=10` - Get recent burns
- `GET /burns/wallet` - Get burner wallet address
- `GET /burns/health` - Check if burn system is configured

## Support

For issues or questions:
1. Check logs: `tail -f logs/api.log`
2. Review this guide
3. Open GitHub issue with:
   - Error message
   - Burn transaction signature (if available)
   - Environment (devnet/mainnet)
   - Steps to reproduce

## Future Enhancements

Potential improvements:
- **Batch burns**: Hourly/daily batches for cost efficiency
- **Dynamic burn amounts**: Based on blink price or token price
- **Burn multipliers**: Higher burns for premium blinks
- **Leaderboard**: Top contributors to total burns
- **Analytics**: Burn rate charts and projections
