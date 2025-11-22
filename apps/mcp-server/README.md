# Blink402 MCP Server

Model Context Protocol (MCP) server for Blink402 - enables AI assistants like Claude to discover, execute, and pay for Solana Blinks with automatic B402 token tier discounts.

## Features

- 🤖 **AI-Native API Payments**: Claude can autonomously execute paid API calls via x402 protocol
- 💎 **B402 Token Integration**: Automatic tier detection and discount application (10-50% off)
- 🧠 **Smart Recommendations**: AI suggests buying B402 when it saves money
- 🔗 **Blink Discovery**: Browse trending blinks and filter by category
- 🎯 **One-Click Execution**: Pay with USDC and get instant results

## Installation

### For Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "blink402": {
      "command": "npx",
      "args": ["-y", "@blink402/mcp-server"],
      "env": {
        "BLINK402_API_URL": "https://blink402.dev/api"
      }
    }
  }
}
```

### For Other MCP Clients

```bash
npm install -g @blink402/mcp-server
blink402-mcp
```

## Tools

### `check_b402_tier`
Check B402 token holdings and tier benefits for a wallet.

**Input:**
```json
{
  "wallet": "SOLANA_WALLET_ADDRESS"
}
```

**Output:**
```json
{
  "tier": "SILVER",
  "balance": 15000,
  "benefits": {
    "blinks": {
      "discountPercent": 20,
      "priorityExecution": false,
      "customBranding": true
    }
  },
  "savings_preview": "Save 20% on all blink executions"
}
```

### `list_blinks`
Browse available blinks with tier-adjusted prices.

**Input:**
```json
{
  "category": "AI/ML",  // Optional
  "limit": 10           // Optional
}
```

**Output:**
```json
{
  "blinks": [
    {
      "slug": "wallet-analyzer",
      "title": "Solana Wallet Analyzer",
      "description": "Get detailed wallet analytics",
      "base_price": 0.05,
      "your_price": 0.04,
      "savings": 0.01,
      "category": "Data"
    }
  ],
  "your_tier": "SILVER"
}
```

### `execute_blink`
Execute a blink with automatic payment and B402 discount.

**Input:**
```json
{
  "slug": "wallet-analyzer",
  "wallet": "USER_WALLET_ADDRESS",
  "params": {
    "targetWallet": "WALLET_TO_ANALYZE"
  }
}
```

**Output:**
```json
{
  "success": true,
  "data": {
    "solBalance": 36.978,
    "usdcBalance": 1234.56,
    "tokens": [...],
    "nfts": [...]
  },
  "payment": {
    "amount_paid": 0.04,
    "original_price": 0.05,
    "tier": "SILVER",
    "savings": 0.01,
    "signature": "TX_SIGNATURE..."
  },
  "message": "✅ Executed wallet-analyzer (SILVER tier: saved $0.01)"
}
```

### `buy_b402`
Purchase B402 tokens to unlock tier benefits.

**Input:**
```json
{
  "amount_sol": 0.5,
  "wallet": "USER_WALLET_ADDRESS"
}
```

**Output:**
```json
{
  "success": true,
  "tokens_received": 12345.67,
  "new_tier": "BRONZE",
  "signature": "TX_SIGNATURE...",
  "projected_savings": "Save 10% on all future blinks"
}
```

## B402 Token Tiers

| Tier | B402 Required | Discount | Benefits |
|------|---------------|----------|----------|
| BRONZE | 1,000 | 10% | Priority support |
| SILVER | 10,000 | 20% | Custom branding |
| GOLD | 50,000 | 30% | Priority execution queue |
| DIAMOND | 100,000 | 50% | VIP features |

**Token Address**: `2mESiwuVdfft9PxG7x36rvDvex6ccyY8m8BKCWJqpump`

## Example Usage

```
User: "Analyze my Solana wallet abc123..."

Claude: "I'll use the wallet-analyzer blink.
Checking your B402 tier... You have 15,000 B402 (SILVER tier).
Base price: 0.05 USDC → Your price: 0.04 USDC (20% off)

Executing... ✅

Results:
- SOL Balance: 36.978
- USDC Balance: 1,234.56
- NFTs: 42 items
- Recent transactions: 1,234

You saved $0.01 with your SILVER tier!"
```

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run in development mode
pnpm dev

# Type check
pnpm typecheck
```

## Architecture

```
Claude Desktop / MCP Client
        ↓
   MCP Server (this package)
        ↓
   Blink402 API
        ↓
   PayAI x402 Facilitator
        ↓
   Solana Blockchain
```

## Environment Variables

- `BLINK402_API_URL` - API base URL (default: https://blink402.dev/api)
- `SOLANA_NETWORK` - Network to use (default: mainnet-beta)

## Links

- **Website**: https://blink402.dev
- **Documentation**: https://docs.blink402.dev
- **GitHub**: https://github.com/blink402/blink402
- **Token**: https://pump.fun/2mESiwuVdfft9PxG7x36rvDvex6ccyY8m8BKCWJqpump

## License

MIT
