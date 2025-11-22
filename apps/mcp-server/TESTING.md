# MCP Server Testing Guide

## Pre-Launch Checklist

### ✅ Build & Installation
- [x] Package builds successfully (`pnpm build`)
- [x] Dependencies installed correctly
- [x] TypeScript compiles without errors
- [ ] Package can be run via `node dist/index.js`
- [ ] MCP server connects to stdio transport

### 🔌 MCP Protocol Compliance
- [ ] Server responds to `list_tools` request
- [ ] All 5 tools are registered and visible
- [ ] Tool schemas are valid JSON Schema
- [ ] `call_tool` requests are handled correctly
- [ ] Error responses include `isError: true`

### 🔧 Tool Testing

#### 1. check_b402_tier
```json
Input:
{
  "wallet": "REAL_SOLANA_WALLET_ADDRESS"
}

Expected Output:
{
  "tier": "NONE" | "BRONZE" | "SILVER" | "GOLD" | "DIAMOND",
  "balance": number,
  "benefits": { ... },
  "savings_preview": string,
  "tier_thresholds": { ... }
}

Test Cases:
- [ ] Valid wallet with 0 B402 (tier: NONE)
- [ ] Valid wallet with 1,000 B402 (tier: BRONZE)
- [ ] Valid wallet with 15,000 B402 (tier: SILVER)
- [ ] Invalid wallet address (error response)
- [ ] API timeout handling
```

#### 2. list_blinks
```json
Input:
{
  "wallet": "WALLET_ADDRESS",
  "category": "Data",  // optional
  "limit": 10          // optional
}

Expected Output:
{
  "blinks": [
    {
      "slug": string,
      "title": string,
      "description": string,
      "category": string,
      "base_price": number,
      "your_price": number,
      "savings": number,
      "discount_percent": number,
      "icon_url": string | null,
      "performance": {
        "success_rate": number | null,
        "avg_latency_ms": number | null
      }
    }
  ],
  "your_tier": string,
  "total_available": number,
  "filter_applied": string
}

Test Cases:
- [ ] List all blinks (no filter)
- [ ] Filter by category "AI/ML"
- [ ] Filter by category "Data"
- [ ] Limit to 5 blinks
- [ ] Wallet with SILVER tier shows 20% discount
- [ ] Wallet with NONE tier shows 0% discount
```

#### 3. execute_blink
```json
Input:
{
  "slug": "wallet-analyzer",
  "wallet": "WALLET_ADDRESS",
  "params": {
    "targetWallet": "TARGET_WALLET_ADDRESS"
  }
}

Expected Output:
{
  "step": "PAYMENT_REQUIRED",
  "message": string,
  "blink_url": "https://blink402.dev/checkout/wallet-analyzer",
  "payment_details": {
    "amount": number,
    "original_price": number,
    "savings": number,
    "tier": string,
    "payment_method": "USDC on Solana"
  },
  "instructions": [string[]],
  "note": string
}

Test Cases:
- [ ] Execute wallet-analyzer blink
- [ ] Execute token-price blink
- [ ] Execute with SILVER tier (20% discount applied)
- [ ] Execute with NONE tier (no discount)
- [ ] Invalid blink slug (error response)
- [ ] Missing required params (error response)
```

#### 4. buy_b402
```json
Input:
{
  "amount_sol": 0.5,
  "wallet": "WALLET_ADDRESS"
}

Expected Output:
{
  "step": "PAYMENT_REQUIRED",
  "message": string,
  "purchase_url": "https://blink402.dev/checkout/buy-b402",
  "purchase_details": {
    "amount_sol": number,
    "estimated_tokens": number,
    "current_tier": string,
    "estimated_new_tier": string,
    "tier_upgrade": boolean
  },
  "instructions": [string[]],
  "projected_benefits": string,
  "roi_estimate": string
}

Test Cases:
- [ ] Buy 0.1 SOL worth (BRONZE tier estimate)
- [ ] Buy 0.5 SOL worth (SILVER tier estimate)
- [ ] Buy 1.0 SOL worth (GOLD tier estimate)
- [ ] Amount too low (< 0.01 SOL)
- [ ] Amount too high (> 100 SOL)
```

#### 5. recommend_b402_purchase
```json
Input:
{
  "wallet": "WALLET_ADDRESS",
  "expected_monthly_spend": 25
}

Expected Output:
{
  "current_tier": string,
  "current_balance": number,
  "expected_monthly_spend": number,
  "recommendations": [
    {
      "tier": string,
      "required_tokens": number,
      "estimated_cost_usd": number,
      "monthly_savings": number,
      "months_to_breakeven": number,
      "recommended": boolean
    }
  ],
  "best_option": object | { message: string },
  "note": string
}

Test Cases:
- [ ] Low spend ($2/month) → No recommendation
- [ ] Medium spend ($25/month) → SILVER recommendation
- [ ] High spend ($100/month) → GOLD recommendation
- [ ] Current BRONZE tier + $50/month spend → SILVER upgrade
```

### 🌐 API Integration Testing

#### Backend Endpoints
- [ ] `/token/holder-info?wallet=X` returns tier info
- [ ] `/token/discount?wallet=X&basePrice=Y&gameType=blinks` returns discount
- [ ] `/blinks` returns list of blinks
- [ ] `/blinks/:slug` returns specific blink
- [ ] Error handling for invalid wallet addresses
- [ ] Error handling for non-existent blinks
- [ ] API timeout scenarios (30s limit)

### 🖥️ Claude Desktop Integration

#### Installation
- [ ] Config file created at correct path
- [ ] JSON syntax is valid
- [ ] Absolute path to `dist/index.js` is correct
- [ ] Environment variable `BLINK402_API_URL` is set

#### Runtime
- [ ] MCP server appears in Claude Desktop
- [ ] Tools are visible in tool palette
- [ ] Logs appear in Developer → Server Logs
- [ ] No connection errors in logs

#### User Experience
- [ ] Prompt: "Check B402 tier for wallet X"
  - [ ] Claude calls check_b402_tier tool
  - [ ] Response is formatted nicely
  - [ ] Tier thresholds are displayed

- [ ] Prompt: "Show me available blinks"
  - [ ] Claude calls list_blinks tool
  - [ ] Blinks are listed with prices
  - [ ] Tier-adjusted prices are shown
  - [ ] Savings are highlighted

- [ ] Prompt: "Analyze wallet X using wallet-analyzer"
  - [ ] Claude calls execute_blink tool
  - [ ] Payment instructions are clear
  - [ ] Checkout URL is provided
  - [ ] Tier discount is mentioned

- [ ] Prompt: "I spend $50/month on blinks. Should I buy B402?"
  - [ ] Claude calls recommend_b402_purchase
  - [ ] ROI analysis is presented
  - [ ] Best tier is recommended
  - [ ] Breakeven is calculated

### 🐛 Error Scenarios

#### Network Errors
- [ ] API server is down → Graceful error message
- [ ] API timeout (30s+) → Clear timeout error
- [ ] Invalid API URL → Connection refused error
- [ ] Rate limiting from API → Appropriate error message

#### Invalid Inputs
- [ ] Malformed wallet address → Validation error
- [ ] Negative SOL amount → Validation error
- [ ] Invalid category filter → Ignored or error
- [ ] Missing required params → Clear error message

#### Edge Cases
- [ ] Wallet with exactly 1,000 B402 → BRONZE tier
- [ ] Wallet with exactly 10,000 B402 → SILVER tier
- [ ] Expected monthly spend = 0 → No recommendations
- [ ] Blink with price = 0 → No discount calculation

### 📊 Performance Testing

- [ ] Tool response time < 2s (with API call)
- [ ] Tool response time < 500ms (cached tier info)
- [ ] Memory usage < 50MB
- [ ] No memory leaks after 100 tool calls
- [ ] Graceful handling of concurrent requests

### 🔒 Security Testing

- [ ] No API keys exposed in logs
- [ ] No wallet private keys ever handled
- [ ] HTTPS used for all API calls
- [ ] Input sanitization (XSS prevention)
- [ ] No command injection via wallet addresses

---

## Manual Testing Script

### Test 1: Basic Tier Check
```
Open Claude Desktop
Type: "Check my B402 tier for wallet FooBar123ABC..."
Expected: Tier info displayed (likely NONE for test wallet)
```

### Test 2: Browse Blinks
```
Type: "Show me all available blinks for wallet FooBar123ABC..."
Expected: List of 5-10 blinks with prices
```

### Test 3: Execute Blink
```
Type: "I want to analyze wallet abc123... using the wallet-analyzer blink. My wallet is FooBar123ABC..."
Expected: Payment instructions with checkout URL
```

### Test 4: Buy B402
```
Type: "I want to buy 0.5 SOL worth of B402 tokens. My wallet is FooBar123ABC..."
Expected: Purchase instructions with tier upgrade estimate
```

### Test 5: ROI Recommendation
```
Type: "I spend about $25 per month on blinks. Should I buy B402 tokens? My wallet is FooBar123ABC..."
Expected: ROI analysis with tier recommendations
```

---

## Automated Testing (Future)

```typescript
// Example test suite (to be implemented)
import { Blink402Client } from './api-client'
import { describe, it, expect } from 'vitest'

describe('Blink402Client', () => {
  it('should get B402 tier info', async () => {
    const client = new Blink402Client('https://blink402.dev/api')
    const tier = await client.getB402Tier('VALID_WALLET')
    expect(tier.tier).toBeDefined()
    expect(['NONE', 'BRONZE', 'SILVER', 'GOLD', 'DIAMOND']).toContain(tier.tier)
  })

  it('should list blinks', async () => {
    const client = new Blink402Client()
    const blinks = await client.listBlinks()
    expect(blinks.length).toBeGreaterThan(0)
    expect(blinks[0]).toHaveProperty('slug')
    expect(blinks[0]).toHaveProperty('price_usdc')
  })

  // ... more tests
})
```

---

## Debugging Tips

### Server Won't Start
```bash
# Check if dist/ folder exists
ls apps/mcp-server/dist/

# Rebuild if missing
cd apps/mcp-server && pnpm build

# Test manually
node apps/mcp-server/dist/index.js
```

### Tools Not Showing in Claude
1. Check Claude Desktop logs (View → Developer → Server Logs)
2. Look for connection errors
3. Verify config file JSON syntax
4. Restart Claude Desktop completely

### API Errors
```bash
# Test API directly
curl https://blink402.dev/api/blinks

# Check if specific endpoint exists
curl https://blink402.dev/api/token/holder-info?wallet=WALLET
```

### TypeError in Responses
- Ensure API responses match TypeScript interfaces
- Check for missing properties
- Verify `as any` casts in api-client.ts

---

## Pre-Launch Validation

Before announcing publicly:

- [ ] All 5 tools tested in Claude Desktop
- [ ] At least 3 different wallet addresses tested
- [ ] Both NONE tier and SILVER tier scenarios tested
- [ ] Error scenarios handled gracefully
- [ ] Documentation is clear and accurate
- [ ] Demo video recorded
- [ ] Social media posts drafted
- [ ] Community feedback collected (3+ testers)

---

## Post-Launch Monitoring

### Week 1 Metrics
- Number of unique installations
- Number of tool invocations
- Most popular tool
- Error rate per tool
- Average response time
- User feedback/issues

### Analytics to Add
- Track tool usage via Blink402 API
- Log successful vs. failed tool calls
- Monitor API endpoint performance
- Collect user feedback in Discord

---

## Known Issues & Limitations

1. **Payment Execution**
   - MCP server can't directly sign transactions
   - Users must complete payments manually via checkout page
   - Future: Integrate wallet signing plugins

2. **Tier Caching**
   - Tier info fetched on every call (not cached)
   - Could add 1-minute cache to reduce API calls

3. **Error Messages**
   - Some API errors are generic
   - Could improve error formatting for Claude

4. **Tool Discovery**
   - No resources/prompts defined yet
   - Could add resources for blink catalog

---

## Success Criteria

### MVP Launch (Week 1)
- ✅ MCP server builds and runs
- ✅ All 5 tools implemented
- ✅ Claude Desktop integration working
- ✅ At least 10 community members tested it
- ✅ No critical bugs reported

### Production Ready (Month 1)
- ✅ 100+ active users
- ✅ <1% error rate
- ✅ Average response time <2s
- ✅ Documentation complete
- ✅ Community demos created
- ✅ First B402 purchase driven by AI recommendation

🚀 Let's ship it!
