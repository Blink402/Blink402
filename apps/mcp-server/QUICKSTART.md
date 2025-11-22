# Blink402 MCP Server - Quick Start Guide

## What This Does

The Blink402 MCP Server enables Claude Desktop (and other AI assistants) to:

1. **Check B402 tier** → See token balance and discount eligibility
2. **Browse blinks** → Discover payment-gated APIs with tier-adjusted prices
3. **Execute blinks** → Get payment instructions for API calls (with automatic discounts)
4. **Buy B402** → Purchase tokens to unlock tier benefits
5. **Get recommendations** → AI suggests buying B402 when it saves money

## Installation for Claude Desktop

### Step 1: Locate Your Config File

**macOS:**
```bash
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows:**
```bash
%APPDATA%\Claude\claude_desktop_config.json
```

**Linux:**
```bash
~/.config/Claude/claude_desktop_config.json
```

### Step 2: Add Blink402 MCP Server

Open the config file and add:

```json
{
  "mcpServers": {
    "blink402": {
      "command": "node",
      "args": [
        "/Users/shillshady/Work/Crypto/blink402/apps/mcp-server/dist/index.js"
      ],
      "env": {
        "BLINK402_API_URL": "https://blink402.dev/api"
      }
    }
  }
}
```

**Important:** Replace the path with the absolute path to your local MCP server build.

### Step 3: Restart Claude Desktop

Quit and reopen Claude Desktop. The MCP server will connect automatically.

## Testing It Works

Try these prompts in Claude Desktop:

### 1. Check B402 Tier
```
Check my B402 tier for wallet: YOUR_WALLET_ADDRESS
```

Expected response:
- Tier level (NONE, BRONZE, SILVER, GOLD, DIAMOND)
- Token balance
- Discount percentage
- Tier thresholds

### 2. Browse Available Blinks
```
Show me available blinks for wallet: YOUR_WALLET_ADDRESS
```

Expected response:
- List of blinks with titles and descriptions
- Base prices vs. your tier-adjusted prices
- Savings amount per blink

### 3. Execute a Blink (Payment Required)
```
Analyze Solana wallet abc123... using the wallet-analyzer blink
My wallet: YOUR_WALLET_ADDRESS
```

Expected response:
- Payment instructions
- Checkout URL
- Amount to pay (with tier discount applied)
- Step-by-step execution guide

### 4. Buy B402 Tokens
```
I want to buy B402 tokens. I'll spend 0.5 SOL.
My wallet: YOUR_WALLET_ADDRESS
```

Expected response:
- Purchase instructions
- Estimated tokens received
- New tier projection
- ROI calculation

### 5. Get Purchase Recommendation
```
I plan to spend $50/month on blinks. Should I buy B402 tokens?
My wallet: YOUR_WALLET_ADDRESS
```

Expected response:
- ROI analysis per tier
- Breakeven timeline
- Recommended tier to target
- Cost vs. savings comparison

## Example Conversation Flow

```
User: Check my B402 tier for wallet FooBar123...

Claude: I'll check your B402 tier.

[Calls check_b402_tier tool]

Your B402 Status:
- Tier: NONE
- Balance: 0 B402
- Current Discount: 0%

Tier Thresholds:
- BRONZE (1,000 B402) → 10% discount
- SILVER (10,000 B402) → 20% discount
- GOLD (50,000 B402) → 30% discount
- DIAMOND (100,000 B402) → 50% discount

Would you like to see available blinks or purchase B402 tokens?

---

User: Show me available blinks

Claude: I'll fetch available blinks with your tier-adjusted pricing.

[Calls list_blinks tool]

Available Blinks (showing top 5):

1. Wallet Analyzer
   - Base: $0.05 → Your Price: $0.05 (no discount)
   - Category: Data
   - Analyze Solana wallet stats

2. Token Price Lookup
   - Base: $0.03 → Your Price: $0.03
   - Category: Data
   - Real-time token prices

[...]

💡 TIP: With SILVER tier (10,000 B402), you'd save 20% on all blinks!

---

User: I want to analyze 50 wallets this month. Should I buy B402?

Claude: Let me analyze if buying B402 tokens makes sense for your usage.

[Calls recommend_b402_purchase with expected_monthly_spend: 2.50]

ROI Analysis:

Expected monthly spend: $2.50 (50 × $0.05)

Recommendations:
✅ BRONZE Tier (1,000 B402 ≈ $5)
   - Monthly savings: $0.25 (10% discount)
   - Breakeven: 20 months
   - NOT RECOMMENDED (too slow ROI)

✅ SILVER Tier (10,000 B402 ≈ $50)
   - Monthly savings: $0.50 (20% discount)
   - Breakeven: 100 months
   - NOT RECOMMENDED

❌ Current usage doesn't justify B402 purchase yet.

RECOMMENDATION: Continue using at current rate. Revisit when monthly spend reaches $10+.

---

User: Actually, I'll be analyzing 500 wallets/month

Claude: That changes things! Let me recalculate.

Expected monthly spend: $25 (500 × $0.05)

✅ BEST OPTION: SILVER Tier (10,000 B402 ≈ $50)
   - Monthly savings: $5 (20% discount)
   - Breakeven: 10 months
   - RECOMMENDED ✨

After 1 year: Save $60, net profit $10

Would you like me to help you buy B402 tokens?
```

## Troubleshooting

### Server Not Connecting

1. **Check build exists:**
   ```bash
   ls apps/mcp-server/dist/index.js
   ```

2. **Rebuild if missing:**
   ```bash
   cd apps/mcp-server && pnpm build
   ```

3. **Check logs** (Claude Desktop menu → View → Developer → Server Logs)

### API Errors

- **Error: "API error (404)"**
  - The API endpoint might not exist yet
  - Check BLINK402_API_URL is correct
  - Verify backend is running

- **Error: "Invalid wallet address"**
  - Ensure wallet address is valid Solana base58 format
  - Example: `FooBar123ABC...` (32-44 characters)

### Tools Not Showing

1. Restart Claude Desktop completely
2. Check config file syntax (must be valid JSON)
3. Verify absolute path to `dist/index.js`

## Advanced Usage

### Custom API URL (Local Development)

```json
{
  "mcpServers": {
    "blink402": {
      "command": "node",
      "args": ["/path/to/blink402/apps/mcp-server/dist/index.js"],
      "env": {
        "BLINK402_API_URL": "http://localhost:3001"
      }
    }
  }
}
```

### Run in Development Mode

For debugging:
```bash
cd apps/mcp-server
pnpm dev
```

### Test MCP Inspector

Use the official MCP inspector to test tools:
```bash
npx @modelcontextprotocol/inspector node apps/mcp-server/dist/index.js
```

## Next Steps

1. ✅ Get MCP server running
2. ✅ Test with sample wallet
3. ✅ Browse available blinks
4. ✅ Try executing a low-cost blink
5. ✅ Check B402 tier and purchase if beneficial
6. 🚀 Build autonomous AI workflows!

## Support

- **GitHub**: https://github.com/blink402/blink402
- **Discord**: https://discord.gg/blink402
- **Docs**: https://docs.blink402.dev

## Example Prompts to Try

Copy-paste these into Claude Desktop:

```
Check B402 tier for wallet: FooBar123...
```

```
Show me all AI/ML blinks with my tier pricing (wallet: FooBar123...)
```

```
I need to analyze 100 Solana wallets. Should I buy B402 tokens first? My wallet: FooBar123...
```

```
Execute wallet-analyzer for target wallet abc123... using my wallet FooBar123...
```

```
Buy 0.5 SOL worth of B402 tokens for wallet FooBar123...
```

Happy building! 🚀
