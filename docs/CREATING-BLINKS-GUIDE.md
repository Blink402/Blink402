# Creating Blinks - Quick Start Guide

## What are Blinks?

**Blinks** (Blockchain Links) are pay-per-call API endpoints wrapped as Solana Actions. Users click a Blink, pay with USDC via their Solana wallet, and get instant access to the API response—no accounts or API keys needed.

## Two Ways to Create Blinks

### 1. Using the Web UI (Recommended for Testing)

1. **Navigate to Create Page**
   - Go to `https://blink402.dev/create` (or `http://localhost:3000/create` locally)
   - Connect your Solana wallet

2. **Fill Out the Form** (3-step process)

   **Step 1: Endpoint Configuration**
   - **Endpoint URL**: The API endpoint you want to wrap (e.g., `https://api.example.com/v1/analyze`)
   - **HTTP Method**: GET, POST, PUT, or DELETE
   - **Title**: Short, catchy name (e.g., "AI Text Analyzer")
   - **Description**: What does this API do? (10-200 characters)
   - **Category**: Choose from AI/ML, Utilities, Data, API Tools, or Web3

   **Step 2: Pricing & Wallet**
   - **Price (USDC)**: How much per call? (e.g., 0.01 = 1 cent)
   - **Payout Wallet**: Your Solana wallet address to receive payments

   **Step 3: Optional Fields**
   - **Icon URL**: Link to an icon image (PNG, JPG, SVG)
   - **Example Request**: Sample JSON body for POST requests

3. **Submit & Test**
   - Click "Create Blink"
   - Your Blink will get a unique slug (e.g., `text-analyzer`)
   - Visit `/blink/your-slug` to preview and test

### 2. Using SQL (For Demo/Sample Data)

Run the `sample-blinks.sql` script to populate your database with 10 example Blinks:

```bash
# Connect to your PostgreSQL database
psql $DATABASE_URL -f sample-blinks.sql
```

Or via Railway CLI:
```bash
railway run psql $DATABASE_URL -f sample-blinks.sql
```

## Sample Blinks Included

The `sample-blinks.sql` script creates these examples:

### AI/ML (3 Blinks)
- **GPT Text Generator** - Generate text with OpenAI ($0.05)
- **AI Vision Analyzer** - Analyze images with AI ($0.08)
- **Sentiment Analyzer** - Analyze text sentiment ($0.02)

### Data (2 Blinks)
- **Weather Lookup** - Get current weather data ($0.01)
- **Stock Price Check** - Real-time stock prices ($0.03)

### Web3 (2 Blinks)
- **NFT Metadata Fetcher** - Fetch Solana NFT data ($0.02)
- **Crypto Price Checker** - Jupiter DEX prices ($0.01)

### Utilities (2 Blinks)
- **URL Shortener** - Shorten long URLs ($0.005)
- **QR Code Generator** - Generate QR codes ($0.01)

### API Tools (1 Blink)
- **JSON Validator** - Validate JSON data ($0.005)

## How to Use a Blink

Once created, users can interact with your Blink:

1. **Share the Link**
   - Direct link: `https://blink402.dev/blink/your-slug`
   - Works on X/Twitter, Discord, Telegram, etc.

2. **User Flow**
   ```
   User clicks → Wallet opens → Approves USDC payment → API executes → Response shown
   ```

3. **Payment Verification**
   - All payments are verified on-chain using Solana Pay
   - Idempotent (duplicate payments prevented via reference UUID)
   - Creator receives USDC directly to their payout wallet

## Testing Your Blink Locally

1. **Start the development server**
   ```bash
   pnpm dev
   ```

2. **Navigate to your Blink**
   ```
   http://localhost:3000/blink/your-slug
   ```

3. **Test the payment flow**
   - Connect a devnet wallet (use Phantom in devnet mode)
   - You'll need devnet USDC for testing
   - Use Solana Faucet: https://faucet.solana.com/

## API Endpoints for Blinks

Your backend provides these endpoints:

- `GET /blinks` - List all Blinks
- `GET /blinks/:slug` - Get Blink details
- `POST /blinks` - Create new Blink
- `PUT /blinks/:slug` - Update Blink
- `DELETE /blinks/:slug` - Delete Blink
- `GET /actions/:slug` - Solana Actions metadata (for wallets)
- `POST /actions/:slug` - Build payment transaction
- `POST /bazaar/:slug` - Execute paid API call (402 proxy)

## Pro Tips

### Pricing Strategy
- **Microtransactions work best**: $0.005 - $0.10 per call
- Price below traditional API costs to drive adoption
- Consider your upstream API costs + desired margin

### Icon Selection
- Use **512x512px** or larger for best quality
- Free icon sources:
  - https://flaticon.com (search "api", "ai", "data")
  - https://icons8.com
  - https://heroicons.com

### Category Guidelines
- **AI/ML**: GPT, image gen, NLP, sentiment analysis
- **Utilities**: URL shorteners, QR codes, converters
- **Data**: Weather, stocks, sports scores, news
- **API Tools**: JSON validators, formatters, parsers
- **Web3**: NFT data, token prices, wallet info

### Slug Best Practices
- Auto-generated from title (kebab-case)
- Keep it short and memorable
- Use hyphens, not underscores
- Examples: `gpt-text`, `weather-api`, `nft-lookup`

## Troubleshooting

### "Wallet not connected"
- Make sure you've installed a Solana wallet (Phantom, Solflare, etc.)
- Click "Connect Wallet" in the navigation
- Approve the connection in your wallet

### "Payment verification failed"
- Check that you're using the correct Solana network (devnet/mainnet)
- Ensure you have enough USDC + SOL for gas
- Wait ~1-2 seconds for transaction confirmation

### "API call failed"
- Verify your upstream API endpoint is reachable
- Check if the API requires authentication (headers/API keys)
- Some APIs need specific Content-Type headers

### "Invalid wallet address"
- Solana addresses are 32-44 characters (base58)
- Must start with a letter/number (not special chars)
- Example: `GjJyeC1r5RjHNyZ8pqFqH9TQvYbT8K7sWxK4P5aH7wXw`

## Next Steps

1. **Create your first Blink** using the web UI
2. **Test it** with devnet USDC
3. **Share it** on X/Twitter to get feedback
4. **Monitor analytics** in the dashboard (`/dashboard?wallet=YOUR_WALLET`)
5. **Scale up** once you validate demand

## Need Help?

- **Docs**: See `CLAUDE.md` for full architecture
- **API Reference**: Check `apps/api/src/routes/` for endpoint details
- **Database Schema**: `schema.sql` has the complete data model
- **Issues**: Open a GitHub issue if you find bugs

---

**Happy Blinking! 🚀**

Turn any API into a pay-per-call Blink in minutes.
