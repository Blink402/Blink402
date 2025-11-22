# Blink402 Telegram Bot

Telegram bot integration for Lucky Slot Machine - play directly in Telegram using Telegram Mini Apps!

## Features

🎰 **In-Telegram Gameplay**
- Play slot machine directly in Telegram
- Seamless wallet connection via Telegram Mini Apps
- No need to visit the website

💰 **Instant Payouts**
- 0.05 USDC per spin
- Up to 50x multiplier (2.5 USDC max win)
- Instant payouts to your Solana wallet

🔒 **Provably Fair**
- Cryptographically verifiable spins
- SHA-256 hashing
- Full transparency

## Commands

- `/start` - Welcome message and start playing
- `/play` - Open the slot machine
- `/stats` - View game statistics
- `/help` - Show help message

## Setup

### 1. Create Telegram Bot

1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot` and follow instructions
3. Copy your bot token
4. Send `/setcommands` and paste:
   ```
   start - Start playing Lucky Slot Machine
   play - Open the slot machine
   stats - View game statistics
   help - Show help message
   ```

### 2. Set up Telegram Mini App

1. Message @BotFather again
2. Send `/newapp` and select your bot
3. Enter app details:
   - **Title**: Lucky Slot Machine
   - **Description**: Spin the reels for a chance to win up to 50x your bet!
   - **Photo**: Upload a 640x360 image of the slot machine
   - **GIF**: (optional)
   - **Web App URL**: `https://blink402.dev/slot-machine`

4. Send `/mybots` → select your bot → Bot Settings → Menu Button
   - Set button text: "🎰 Play Now"
   - Set Web App URL: `https://blink402.dev/slot-machine`

### 3. Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env with your values
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
NEXT_PUBLIC_APP_URL=https://blink402.dev
```

### 4. Install Dependencies

```bash
# From monorepo root
pnpm install
```

### 5. Run Bot

```bash
# Development (with hot reload)
cd apps/telegram-bot
pnpm dev

# Production
pnpm build
pnpm start
```

## Architecture

The bot uses **Telegram Mini Apps** (formerly Telegram Web Apps) to embed the slot machine directly in Telegram:

```
┌─────────────┐
│  Telegram   │
│   Client    │
└──────┬──────┘
       │
       │ User opens bot
       │
       ▼
┌─────────────────┐
│  Telegram Bot   │
│   (telegraf)    │
└────────┬────────┘
         │
         │ Sends inline keyboard
         │ with Mini App button
         │
         ▼
┌─────────────────────┐
│  Telegram Mini App  │
│  (web/slot-machine) │
└──────────┬──────────┘
           │
           │ 1. Connect wallet (Privy)
           │ 2. Sign USDC transfer
           │ 3. Play game
           │
           ▼
┌─────────────────────┐
│   Blink402 API      │
│  (payment + game)   │
└─────────────────────┘
```

### Key Components

1. **Bot Commands** (`/start`, `/play`, `/stats`, `/help`)
   - Provide information and navigation
   - Use inline keyboards for actions

2. **Telegram Mini App Integration**
   - Opens slot machine in embedded webview
   - Full wallet connection via Privy
   - Solana USDC payments via ONCHAIN x402

3. **Inline Keyboards**
   - "Play Now" button opens Mini App
   - "View Stats" button shows statistics

## Deployment

### Railway (Recommended)

1. Add new service in Railway project
2. Connect to GitHub repo
3. Set root directory: `apps/telegram-bot`
4. Add environment variables
5. Deploy

### Docker

```dockerfile
# Use Node 20
FROM node:20-alpine

# Install pnpm
RUN npm install -g pnpm

# Copy monorepo
WORKDIR /app
COPY . .

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build telegram bot
RUN pnpm --filter "@blink402/telegram-bot" build

# Start bot
CMD ["pnpm", "--filter", "@blink402/telegram-bot", "start"]
```

### Systemd (Linux)

```ini
[Unit]
Description=Blink402 Telegram Bot
After=network.target

[Service]
Type=simple
User=blink402
WorkingDirectory=/opt/blink402/apps/telegram-bot
Environment=NODE_ENV=production
ExecStart=/usr/bin/pnpm start
Restart=always

[Install]
WantedBy=multi-user.target
```

## Testing

### Local Testing

1. Start bot locally: `pnpm dev`
2. Open Telegram
3. Search for your bot by username
4. Send `/start`

### Testing Mini App

1. Ensure web app is running: `cd apps/web && pnpm dev`
2. Use ngrok to expose locally:
   ```bash
   ngrok http 3000
   ```
3. Update Mini App URL in @BotFather
4. Test in Telegram

## Production Checklist

- [ ] Bot token secured in environment variables
- [ ] Web app URL points to production domain
- [ ] Redis configured for session storage
- [ ] Rate limiting enabled
- [ ] Error monitoring (Sentry, etc.)
- [ ] Logs configured (structured logging)
- [ ] Health check endpoint
- [ ] Graceful shutdown handling

## Troubleshooting

### Bot doesn't respond

- Check bot token is correct
- Ensure bot is running: `pnpm dev`
- Check logs for errors

### Mini App doesn't open

- Verify Web App URL in @BotFather
- Check CORS settings on web app
- Ensure HTTPS is enabled (required for Mini Apps)

### Payments not working

- Verify Solana RPC endpoint
- Check wallet has USDC
- Review payment logs in API

## Resources

- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Telegram Mini Apps](https://core.telegram.org/bots/webapps)
- [Telegraf Documentation](https://telegraf.js.org/)
- [Blink402 Documentation](../../docs)

## Support

For issues or questions:
- GitHub Issues: [github.com/yourrepo/blink402/issues](https://github.com)
- Twitter: [@Blinkx402](https://x.com/Blinkx402)
