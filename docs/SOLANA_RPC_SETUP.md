# Solana RPC Setup Guide

## Problem: 403 Forbidden Errors

The public Solana RPC endpoint `api.mainnet-beta.solana.com` has strict rate limits and often returns `403 Forbidden` errors. This is expected behavior as the public endpoint is not meant for production applications.

## Solution: Use a Dedicated RPC Provider

### Quick Fix: Ankr (No API Key Required)

We've configured the app to use Ankr's free RPC endpoint:
```
https://rpc.ankr.com/solana
```

This works immediately but has rate limits. For production use, get a dedicated API key.

### Recommended: Helius (Best Free Tier)

Helius offers the best free tier for Solana RPC access:

**Free Tier Features:**
- 1,000,000 credits/month
- 10 requests per second
- All core features included
- WebSocket support
- Higher transaction landing rates (staked connections)

**How to Get a Free Helius API Key:**

1. **Sign Up**
   - Visit https://www.helius.dev
   - Click "Get Started" or "Sign Up"
   - Create a free account

2. **Get Your API Key**
   - After login, go to your dashboard
   - Copy your API key from the dashboard

3. **Update Environment Variables**

   In your `.env.local` file, replace the Ankr endpoint with:
   ```bash
   NEXT_PUBLIC_SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY_HERE
   SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY_HERE
   ```

4. **Update Railway Environment Variables**

   In your Railway dashboard:
   - Go to your project settings
   - Navigate to "Variables" tab
   - Add/update these environment variables:
     - `NEXT_PUBLIC_SOLANA_RPC_URL` = `https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY`
     - `SOLANA_RPC_URL` = `https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY`
   - Redeploy your application

5. **Restart Your Application**
   ```bash
   # Local development
   pnpm dev

   # Railway will auto-deploy after variable changes
   git push
   ```

## Other Free RPC Providers

### Alchemy
- **Website:** https://www.alchemy.com/solana
- **Free Tier:** 300M compute units/month
- **Setup:** Sign up, get API key, use endpoint format:
  ```
  https://solana-mainnet.g.alchemy.com/v2/YOUR_API_KEY
  ```

### QuickNode
- **Website:** https://www.quicknode.com/chains/sol
- **Free Tier:** 500k API calls/month
- **Setup:** Sign up, create endpoint, copy URL

### Chainstack
- **Website:** https://chainstack.com/build-better-with-solana/
- **Free Tier:** 3M calls/month
- **Setup:** Sign up, create node, get endpoint URL

### PublicNode (No API Key)
- **Endpoint:** `https://solana-rpc.publicnode.com`
- **Pros:** No signup required
- **Cons:** Shared rate limits, less reliable

## Production Best Practices

1. **Use Dedicated RPC Provider:** Don't rely on public endpoints
2. **Monitor Usage:** Track your API usage in provider dashboard
3. **Implement Retry Logic:** Handle rate limits gracefully
4. **Use Commitment Levels:** Configure appropriate confirmation levels
5. **Cache When Possible:** Reduce unnecessary RPC calls
6. **Fallback Endpoints:** Consider multiple providers for redundancy

## Troubleshooting

### Still Getting 403 Errors?
- Check that environment variables are set correctly
- Verify API key is valid and not expired
- Check your usage limits in provider dashboard
- Ensure you've restarted the application after changes

### WebSocket Connections Failing?
For Helius WebSocket connections, use:
```
wss://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY
```

### Rate Limits?
- Upgrade to paid tier if needed
- Implement request caching
- Use multiple providers with load balancing

## Environment Variable Reference

```bash
# Network (mainnet-beta or devnet)
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta

# RPC Endpoints (use same provider for both)
NEXT_PUBLIC_SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY

# USDC Mint Address
NEXT_PUBLIC_USDC_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
```

## Cost Comparison

| Provider | Free Tier | Paid Starting At |
|----------|-----------|------------------|
| Helius | 1M credits/month | $10/month |
| Alchemy | 300M compute units/month | $49/month |
| QuickNode | 500k calls/month | $29/month |
| Chainstack | 3M calls/month | $69/month |
| Ankr | Rate limited | $100/month |

*As of January 2025*

## Additional Resources

- [Helius Documentation](https://docs.helius.dev)
- [Solana Official RPC Docs](https://solana.com/docs/rpc)
- [Best Solana RPC Providers 2025](https://chainstack.com/best-solana-rpc-providers-2025/)
