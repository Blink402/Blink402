# Blink402

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15.5-black)](https://nextjs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5.2-black)](https://fastify.dev/)

**Monetize any API with crypto micropayments. No accounts, no API keys, just pay-per-use.**

Turn any HTTP endpoint into a clickable "Blink" that accepts payments in SOL or USDC on Solana. Share it on Twitter/X, Discord, Telegram, or embed it on websites—users pay a small amount each time they use it.

---

## 💡 What is This?

Imagine if **every button on the internet could charge a few cents** when clicked—and you got paid instantly. That's Blink402.

**In Simple Terms:**
- You have an API (weather data, AI image generator, stock alerts, etc.)
- You set a price (like $0.05 per call)
- Users click a button, pay with their crypto wallet, get the result
- You receive payment instantly on Solana (no middleman, no delays)

**No need for:**
- User accounts or passwords
- Subscription management
- Payment processor fees (Stripe, PayPal)
- API key distribution and tracking

---

## 🎯 Real-World Use Cases

### For Developers

**1. Monetize Side Project APIs**
```
Your API: Get real-time crypto prices
Price: $0.02 per request
Users: Pay instantly in USDC, get data
You earn: $0.02 each time (minus ~$0.0001 network fee)
```

**2. AI/ML Model Access**
```
Your Model: AI image generator (Stable Diffusion)
Price: $0.10 per image
Users: Click "Generate Image", pay, receive image
No subscriptions needed—pay only for what you use
```

**3. Premium Content Unlocking**
```
Your Content: Exclusive trading signals, research reports
Price: $1.00 per report
Users: Click, pay, instant access
Like a paywall, but with crypto—works anywhere
```

**4. Automated Services**
```
Your Service: PDF conversion API
Price: $0.05 per conversion
Users: Upload PDF, pay, get converted file
No account needed, instant payment
```

### For Creators

**5. Premium Twitter/X Features**
```
Your Offer: Personalized crypto wallet analysis
Price: $2.00 per analysis
Users: Click Blink in your tweet, pay, get analysis
Monetize your Twitter audience directly
```

**6. Exclusive Discord Commands**
```
Your Bot: On-demand server stats or custom reports
Price: $0.25 per command
Users: Type command, pay via Blink, get result
Easy monetization for Discord communities
```

**7. Gated Community Access**
```
Your Community: Private investment group
Price: $50 one-time or $5/month
Users: Pay via Blink, get instant Discord/Telegram invite
No manual verification needed
```

### For Businesses

**8. B2B API Billing**
```
Your API: Address verification service
Price: $0.03 per lookup
Partners: Pay per use, no monthly contracts
You: No invoicing, instant settlement
```

**9. Data Marketplace**
```
Your Data: Real-time sports scores, market data
Price: $0.10-$5.00 per query
Buyers: Pay for exactly what they need
No bulk license agreements required
```

---

## 🤔 Why Would I Use This?

### Instead of Traditional Payment Processing

| Traditional (Stripe/PayPal) | Blink402 |
|----------------------------|----------|
| Monthly subscription ($5-99/mo) | Pay per use ($0.01-10 per call) |
| 2.9% + $0.30 per transaction | ~$0.0001 network fee |
| Users need accounts | No accounts needed |
| Minimum ~$0.50 per transaction | Works for $0.01 micropayments |
| Payouts in 2-7 days | Instant settlement |
| API keys to manage | Just a shareable link |

### Instead of API Key Management

| API Keys | Blink402 |
|----------|----------|
| Generate/revoke keys | Share a link |
| Track usage manually | Automatic payment = usage |
| Trust users to pay | Payment required upfront |
| Build billing system | Built-in payment verification |

---

## 🚀 How It Works

### The 3-Second User Experience

1. **User clicks your Blink** (on Twitter, Discord, website, anywhere)
2. **Wallet pops up** asking to pay $0.05 in USDC/SOL
3. **User approves** → your API runs → result delivered
4. **You get paid** instantly (appears in your Solana wallet)

### Under the Hood

```
┌─────────────┐
│ User Clicks │
│    Blink    │
└──────┬──────┘
       │
       v
┌─────────────────┐
│ Solana Wallet   │  ← User approves $0.05 USDC payment
│ Signs Payment   │
└──────┬──────────┘
       │
       v
┌─────────────────┐
│ Payment Verified│  ← Blockchain confirms payment
│   On-Chain      │
└──────┬──────────┘
       │
       v
┌─────────────────┐
│ Your API Runs   │  ← Only runs AFTER payment confirmed
└──────┬──────────┘
       │
       v
┌─────────────────┐
│ Result Sent to  │
│     User        │
└─────────────────┘
```

**Key Features:**
- Payment happens **on Solana blockchain** (verifiable, instant, low-cost)
- Your API only runs **after payment is confirmed**
- No chargebacks, no fraud risk
- Users can't "use now, pay later"—it's pay-to-play

---

## 🎬 Quick Start

### Option 1: One-Click Deploy (Easiest)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new)

1. Click the button above
2. Connect your GitHub account
3. Set environment variables (database URL, Solana RPC)
4. Deploy in 2 minutes

### Option 2: Local Development

```bash
# 1. Clone the repo
git clone https://github.com/Blink402/Blink402.git
cd Blink402

# 2. Install dependencies
pnpm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your database and Solana settings

# 4. Run database migrations
pnpm --filter "@blink402/database" migrate

# 5. Start the development servers
pnpm dev

# 6. Open your browser
# Frontend: http://localhost:3000
# API: http://localhost:3001
# Swagger Docs: http://localhost:3001/docs
```

### Option 3: Docker Compose

```bash
# Start everything with one command
docker-compose up -d

# Run migrations
docker-compose exec api pnpm --filter "@blink402/database" migrate

# View logs
docker-compose logs -f
```

---

## 📚 Creating Your First Blink

### Step 1: You Have an API

Let's say you have a simple API that returns crypto prices:

```javascript
// Your existing API at https://yoursite.com/api/crypto-price
app.get('/api/crypto-price', (req, res) => {
  res.json({
    bitcoin: 45000,
    ethereum: 2500
  })
})
```

### Step 2: Create a Blink

Go to `http://localhost:3000/create` and fill in:

```
Title: Get Real-Time Crypto Prices
Description: Bitcoin & Ethereum prices updated every minute
API Endpoint: https://yoursite.com/api/crypto-price
Method: GET
Price: 0.02 USDC
Payment Token: USDC
Your Wallet: [Your Solana wallet address]
```

### Step 3: Share Your Blink

You get a shareable link:
```
https://yourdomain.com/blink/crypto-prices
```

Share it anywhere:
- Tweet: "Get live crypto prices! 🚀 [Your Blink Link]"
- Discord: "/crypto-price - Pay $0.02, get instant BTC/ETH prices"
- Embed on website: `<a href="https://yourdomain.com/blink/crypto-prices">Check Prices</a>`

### Step 4: Get Paid

When someone clicks:
1. They see: "Pay $0.02 USDC to get crypto prices"
2. They approve in their wallet (Phantom, Solflare, etc.)
3. Payment hits your wallet instantly
4. Your API runs and returns the prices
5. They see the result

**You just monetized your API with zero setup!**

---

## 🏗️ Architecture Overview

### What's Included

```
Blink402/
├── apps/
│   ├── web/              # Next.js marketplace frontend
│   │   ├── Create Blinks
│   │   ├── Browse catalog
│   │   └── Creator dashboard
│   └── api/              # Fastify payment proxy
│       ├── Solana payment verification
│       ├── API request proxying
│       └── x402 Payment Required standard
├── packages/
│   ├── types/            # Shared TypeScript types
│   ├── solana/           # Solana payment utilities
│   ├── database/         # PostgreSQL queries
│   └── config/           # Environment config
```

### Tech Stack

**Frontend:**
- Next.js 15 (React framework)
- Tailwind CSS (styling)
- Solana Wallet Adapter (crypto wallets)

**Backend:**
- Fastify (fast HTTP server)
- PostgreSQL (database)
- Redis (optional, for caching)

**Blockchain:**
- Solana (for payments)
- USDC or SOL (payment tokens)
- No custom smart contracts needed

---

## 💻 Development Commands

```bash
# Install dependencies
pnpm install

# Start development (frontend + API)
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test

# Type checking
pnpm typecheck

# Database migrations
pnpm --filter "@blink402/database" migrate
```

---

## 🌍 Deployment

### Railway (Recommended)

1. Create a new project at [railway.app](https://railway.app)
2. Add PostgreSQL database service
3. Add Redis service (optional)
4. Deploy API: Point to `apps/api`
5. Deploy Web: Point to `apps/web`
6. Set environment variables:
   ```
   DATABASE_URL=postgresql://...
   NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
   NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
   ```

### Vercel (Frontend Only)

```bash
cd apps/web
vercel deploy
```

### Self-Hosted (VPS/Cloud)

```bash
# Build everything
pnpm build

# Start production servers
cd apps/api && pnpm start  # Port 3001
cd apps/web && pnpm start  # Port 3000
```

---

## 🔐 Security

- **Payment Verification**: All payments verified on-chain before API execution
- **No Double Spending**: Uses Solana transaction references (idempotent)
- **Rate Limiting**: Built-in rate limiting per wallet/IP
- **SSRF Protection**: Validates URLs to prevent server-side request forgery
- **Wallet Authentication**: Optional wallet signature verification for creator actions

---

## 🤝 Contributing

We welcome contributions! Here's how:

1. **Fork this repository**
2. **Create a feature branch**: `git checkout -b feature/my-feature`
3. **Make your changes**
4. **Run tests**: `pnpm test`
5. **Commit**: `git commit -m 'Add amazing feature'`
6. **Push**: `git push origin feature/my-feature`
7. **Open a Pull Request**

**Ideas for contributions:**
- New API templates (weather, AI, data)
- UI/UX improvements
- Documentation updates
- Bug fixes
- Performance optimizations

---

## 📄 License

MIT License - feel free to use this for commercial or personal projects!

See [LICENSE](LICENSE) for details.

---

## 💬 Community & Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/Blink402/Blink402/issues)
- **Discussions**: Ask questions and share ideas
- **Twitter**: Follow for updates
- **Discord**: Join our community (coming soon)

---

## 🎯 Roadmap

- [x] Core payment proxy functionality
- [x] Solana Actions/Blinks support
- [x] Creator dashboards
- [x] SOL and USDC support
- [ ] Multi-token support (custom SPL tokens)
- [ ] Subscription Blinks (recurring payments)
- [ ] Access-gated Blinks (pay once, access for 30 days)
- [ ] Analytics dashboard
- [ ] Webhook notifications
- [ ] Developer SDK/API

---

## ❓ FAQ

**Q: Do I need to know blockchain development?**
A: No! Just deploy the platform and create Blinks through the UI.

**Q: What are the fees?**
A: Solana network fees (~$0.0001 per transaction). No platform fees in this open-source version.

**Q: Can users pay with credit cards?**
A: No, only crypto wallets (Phantom, Solflare, etc.). This keeps it simple and decentralized.

**Q: What if someone doesn't pay?**
A: Your API won't run. Payment is verified on-chain before execution.

**Q: Can I accept other tokens?**
A: Currently SOL and USDC. Custom SPL tokens coming soon.

**Q: Is this safe from fraud?**
A: Yes, payments are verified on Solana blockchain. No chargebacks, no fake payments.

**Q: Do I need a smart contract?**
A: No! Uses standard Solana token transfers. No custom contracts needed.

---

**Built with ❤️ using Next.js, Fastify, Solana, and Turborepo**

*Turn your APIs into revenue streams. Start now!*
