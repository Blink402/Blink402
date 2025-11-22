# 🤖 Telegram Bot Setup Guide

Complete step-by-step guide to get your Lucky Slot Machine bot running inside Telegram!

## ✅ **What You'll Get**

- Slot machine playable **100% inside Telegram** (no external browser)
- Full wallet connection and payment flow
- Native Telegram UI with inline keyboards
- Commands: `/start`, `/play`, `/stats`, `/help`

## 📋 **Step 1: Create Your Bot**

1. **Open Telegram** and search for [@BotFather](https://t.me/botfather)

2. **Send** `/newbot`

3. **Choose a name** (e.g., "Lucky Slot Machine")

4. **Choose a username** (must end in `bot`, e.g., `lucky_slot_machine_bot`)

5. **Copy your bot token** - looks like:
   ```
   7123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw
   ```

6. **Set commands** - Send `/setcommands` to @BotFather, select your bot, then paste:
   ```
   start - Start playing Lucky Slot Machine
   play - Open the slot machine
   stats - View game statistics
   help - Show help message
   ```

## 📱 **Step 2: Configure Mini App**

This makes the slot machine run INSIDE Telegram!

1. **Send** `/newapp` to @BotFather

2. **Select your bot** from the list

3. **Fill in app details:**
   - **Title:** `Lucky Slot Machine`
   - **Description:** `Spin the reels for a chance to win up to 50x your bet! Instant payouts on Solana.`
   - **Photo:** Upload a 640x360 image (screenshot of your slot machine)
   - **GIF:** (optional - skip with `/empty`)
   - **Web App URL:** `https://blink402.dev/slot-machine`

4. **Set menu button** - Send `/mybots` → select bot → Bot Settings → Menu Button
   - **Button text:** `🎰 Play Now`
   - **Web App URL:** `https://blink402.dev/slot-machine`

## 🔧 **Step 3: Configure Environment**

1. **Create `.env` file** in `apps/telegram-bot/`:
   ```bash
   cd apps/telegram-bot
   cp .env.example .env
   ```

2. **Edit `.env`** with your values:
   ```env
   # Paste your bot token from Step 1
   TELEGRAM_BOT_TOKEN=7123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw

   # Your production URL (or ngrok for testing)
   NEXT_PUBLIC_APP_URL=https://blink402.dev

   # Optional: Redis for production
   REDIS_URL=redis://localhost:6379
   ```

## 🚀 **Step 4: Run the Bot**

### Option A: Development (Local Testing)

```bash
# Terminal 1: Start web app
cd apps/web
pnpm dev

# Terminal 2: Start bot
cd apps/telegram-bot
pnpm dev
```

For local testing with Telegram, use **ngrok**:
```bash
# Terminal 3: Expose web app
ngrok http 3000

# Update NEXT_PUBLIC_APP_URL in .env with ngrok URL
# e.g., NEXT_PUBLIC_APP_URL=https://abc123.ngrok.io
```

### Option B: Production

```bash
# Build and start
cd apps/telegram-bot
pnpm build
pnpm start
```

## 🧪 **Step 5: Test Your Bot**

1. **Open Telegram** and search for your bot (e.g., `@lucky_slot_machine_bot`)

2. **Send** `/start`

3. **You should see:**
   ```
   🎰 Welcome to Lucky Slot Machine!

   Spin the reels for a chance to win up to 50x your bet!

   💰 Cost: 0.05 USDC per spin
   🎁 Max Win: 2.5 USDC
   ⚡ Instant Payouts to your wallet

   [🎰 Play Now] [📊 View Stats]
   ```

4. **Click "🎰 Play Now"**
   - Slot machine opens **INSIDE Telegram**
   - No external browser!
   - Full game experience in Telegram webview

5. **Test the flow:**
   - Connect wallet (Phantom, Solflare, etc.)
   - Approve 0.05 USDC payment
   - Spin and see results
   - All within Telegram!

## 📊 **Step 6: Verify It Works**

### Test Commands

Send these to your bot:

- `/start` → Welcome message with buttons
- `/play` → Opens slot machine
- `/stats` → Shows game statistics
- `/help` → Display help message

### Test Buttons

- "🎰 Play Now" → Opens Mini App
- "📊 View Stats" → Shows statistics

### Test Mini App

1. Click "🎰 Play Now"
2. Verify webview opens inside Telegram
3. Check wallet connection works
4. Test payment flow
5. Verify spin functionality

## 🔒 **Security Checklist**

- [ ] Bot token stored securely in `.env` (not committed to git)
- [ ] Production URL uses HTTPS (required for Mini Apps)
- [ ] CORS configured to allow Telegram domains
- [ ] Rate limiting enabled in API
- [ ] Payment verification working correctly

## 🚀 **Deployment Options**

### Railway (Recommended)

1. Create new service in Railway project
2. Link to GitHub repo
3. Set root directory: `apps/telegram-bot`
4. Add environment variables
5. Deploy

Railway will automatically:
- Install dependencies
- Build the bot
- Start it with `pnpm start`

### Docker

See `README.md` for Docker deployment instructions.

### Manual (VPS/Server)

```bash
# Clone repo
git clone <your-repo>
cd BlinkBazaar

# Install dependencies
pnpm install

# Build telegram bot
pnpm --filter "@blink402/telegram-bot" build

# Run with PM2 (process manager)
pm2 start apps/telegram-bot/dist/index.js --name telegram-bot
pm2 save
pm2 startup
```

## 🛠️ **Troubleshooting**

### Bot doesn't respond

**Check:**
- Bot token is correct in `.env`
- Bot is running: `pnpm dev` shows no errors
- Bot has been started in Telegram (send `/start`)

**Fix:**
```bash
# Check bot is running
ps aux | grep node

# Check logs
cd apps/telegram-bot
pnpm dev
# Look for "🤖 Telegram bot is running!"
```

### Mini App doesn't open

**Check:**
- Web App URL configured in @BotFather
- URL uses HTTPS (HTTP won't work)
- Web app is running and accessible

**Fix:**
1. Send `/mybots` to @BotFather
2. Select your bot → Edit Bot → Menu Button
3. Verify URL is correct and uses HTTPS

### Payments not working

**Check:**
- Solana RPC endpoint accessible
- User has USDC in wallet
- Payment verification logic in API

**Fix:**
- Check API logs: `apps/api/pnpm dev`
- Verify transaction on Solscan
- Test with small amount first

### "User is blocked" error

User has blocked your bot. They need to unblock and send `/start`.

## 📱 **Platform Support**

The bot works on:
- ✅ **Telegram iOS**
- ✅ **Telegram Android**
- ✅ **Telegram Desktop** (Windows, Mac, Linux)
- ✅ **Telegram Web**

Mini Apps are supported on all platforms!

## 🎮 **User Experience Flow**

```
1. User opens bot
   └─> Sends /start or /play

2. Bot sends message with button
   └─> "🎰 Play Now" inline button

3. User clicks button
   └─> Mini App opens INSIDE Telegram
   └─> Embedded webview (no external browser!)

4. Mini App loads
   └─> Shows slot machine interface
   └─> Full neon terminal aesthetic
   └─> Animated reels ready to spin

5. User connects wallet
   └─> Privy modal appears
   └─> Phantom/Solflare connection
   └─> Wallet address displayed

6. User pays
   └─> 0.05 USDC payment prompt
   └─> User approves in wallet
   └─> ONCHAIN x402 processes payment

7. User spins
   └─> Reels animate
   └─> Results displayed
   └─> Instant payout if win

8. User can play again
   └─> "PLAY AGAIN" button
   └─> Wallet stays connected
   └─> Seamless repeat spins

All of this happens WITHOUT leaving Telegram! 🎉
```

## 📞 **Support**

If you get stuck:

1. Check the logs: `pnpm dev` shows detailed output
2. Review @BotFather settings
3. Test with `/help` command in your bot
4. Check [Telegram Bot API docs](https://core.telegram.org/bots/api)
5. Check [Telegram Mini Apps docs](https://core.telegram.org/bots/webapps)

## 🎉 **You're Done!**

Your Lucky Slot Machine is now running **100% inside Telegram**!

Users can:
- Play without leaving Telegram
- Connect wallets seamlessly
- Make instant USDC payments
- Win up to 50x their bet
- Get instant payouts

**Share your bot:** Send users your bot link:
```
https://t.me/your_bot_username
```

Example:
```
https://t.me/lucky_slot_machine_bot
```

Have fun! 🎰✨
