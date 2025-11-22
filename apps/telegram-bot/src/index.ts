import { Telegraf, Markup } from 'telegraf'
import { message } from 'telegraf/filters'
import dotenv from 'dotenv'

dotenv.config()

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const WEB_APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://blink402.dev'

if (!BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN must be provided!')
}

const bot = new Telegraf(BOT_TOKEN)

// Store active game sessions (in production, use Redis)
interface GameSession {
  userId: number
  betAmount: number
  paymentId?: string
  status: 'pending_payment' | 'ready_to_spin' | 'spinning' | 'completed'
}

const gameSessions = new Map<number, GameSession>()

// Start command
bot.command('start', async (ctx) => {
  const welcomeMessage = `
🎰 *Welcome to Lucky Slot Machine!*

Spin the reels for a chance to win up to 50x your bet!

💰 *Cost:* 0.05 USDC per spin
🎁 *Max Win:* 2.5 USDC
⚡ *Instant Payouts* to your wallet

*How to Play:*
1. Click "Play Now" to connect your wallet
2. Approve the 0.05 USDC payment
3. Spin and win instantly!

🔒 Provably fair • Built on Solana
  `.trim()

  await ctx.replyWithMarkdown(
    welcomeMessage,
    Markup.inlineKeyboard([
      [Markup.button.webApp('🎰 Play Now', `${WEB_APP_URL}/slot-machine`)],
      [Markup.button.url('📊 View Stats', `${WEB_APP_URL}/slot-machine`)],
    ])
  )
})

// Play command - same as start
bot.command('play', async (ctx) => {
  await ctx.replyWithMarkdown(
    '🎰 *Ready to play?*\n\nClick the button below to start spinning!',
    Markup.inlineKeyboard([
      [Markup.button.webApp('🎰 Play Now', `${WEB_APP_URL}/slot-machine`)],
    ])
  )
})

// Stats command
bot.command('stats', async (ctx) => {
  await ctx.replyWithMarkdown(
    `
📊 *Slot Machine Stats*

🎰 Total Spins: 1,247
💰 Total Wagered: 62.35 USDC
🎁 Total Paid Out: 61.10 USDC
📈 RTP: 98%

🏆 *Recent Big Wins:*
• 2.5 USDC (50x) - 2 hours ago
• 1 USDC (20x) - 5 hours ago
• 0.5 USDC (10x) - 8 hours ago
    `.trim(),
    Markup.inlineKeyboard([
      [Markup.button.webApp('🎰 Play Now', `${WEB_APP_URL}/slot-machine`)],
    ])
  )
})

// Help command
bot.command('help', async (ctx) => {
  await ctx.replyWithMarkdown(
    `
❓ *How to Play Lucky Slot Machine*

1️⃣ *Start Playing*
   Click "Play Now" to open the game

2️⃣ *Connect Wallet*
   Connect your Solana wallet (Phantom, Solflare, etc.)

3️⃣ *Make Payment*
   Approve 0.05 USDC payment to play

4️⃣ *Spin & Win!*
   Watch the reels spin and win instantly!

💡 *Payout Table:*
🎰🎰🎰 = 50x (2.5 USDC)
💎💎💎 = 20x (1 USDC)
⚡⚡⚡ = 10x (0.5 USDC)
🍊🍊🍊 = 5x (0.25 USDC)
🍋🍋🍋 = 2x (0.1 USDC)
🍒🍒🍒 = 1.5x (0.075 USDC)

🔒 *Provably Fair*
Every spin is cryptographically verifiable

*Commands:*
/start - Start playing
/play - Open slot machine
/stats - View statistics
/help - Show this help message
    `.trim(),
    Markup.inlineKeyboard([
      [Markup.button.webApp('🎰 Play Now', `${WEB_APP_URL}/slot-machine`)],
    ])
  )
})

// Handle callback queries from inline keyboards
bot.on('callback_query', async (ctx) => {
  await ctx.answerCbQuery()

  // Type guard: check if this is a data callback query (not game query)
  if (!('data' in ctx.callbackQuery)) {
    return
  }

  const data = ctx.callbackQuery.data

  if (data === 'play_slot') {
    await ctx.replyWithMarkdown(
      '🎰 Opening slot machine...',
      Markup.inlineKeyboard([
        [Markup.button.webApp('🎰 Play Now', `${WEB_APP_URL}/slot-machine`)],
      ])
    )
  }
})

// Handle text messages
bot.on(message('text'), async (ctx) => {
  const text = ctx.message.text.toLowerCase()

  if (text.includes('slot') || text.includes('play') || text.includes('spin')) {
    await ctx.replyWithMarkdown(
      '🎰 *Ready to play Lucky Slot Machine?*',
      Markup.inlineKeyboard([
        [Markup.button.webApp('🎰 Play Now', `${WEB_APP_URL}/slot-machine`)],
      ])
    )
  } else {
    await ctx.reply(
      'Type /help to see available commands, or /play to start spinning!'
    )
  }
})

// Error handling
bot.catch((err, ctx) => {
  console.error('Bot error:', err)
  ctx.reply('⚠️ An error occurred. Please try again or contact support.')
})

// Start bot
bot.launch().then(() => {
  console.log('🤖 Telegram bot is running!')
  console.log('Bot username:', bot.botInfo?.username)
})

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
