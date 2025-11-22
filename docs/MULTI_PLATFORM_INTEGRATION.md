# Multi-Platform Blink Integration Plan

**Version**: 1.0
**Date**: 2025-01-10
**Status**: Planning Phase
**Author**: Blink402 Team

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Discord Bot Specification](#discord-bot-specification)
4. [Telegram Bot Specification](#telegram-bot-specification)
5. [Twitter/X Integration](#twitterx-integration)
6. [Database Schema Changes](#database-schema-changes)
7. [Implementation Phases](#implementation-phases)
8. [Deployment Strategy](#deployment-strategy)
9. [Testing & Quality Assurance](#testing--quality-assurance)
10. [Bot Setup Guides](#bot-setup-guides)
11. [Metrics & Analytics](#metrics--analytics)
12. [Security Considerations](#security-considerations)
13. [Future Enhancements](#future-enhancements)

---

## Executive Summary

### Objective

Enable Blink402 users to discover, share, and execute paid Blinks across **Discord**, **Telegram**, and **Twitter/X** while maintaining the existing ONCHAIN x402 payment protocol.

### Key Constraints

- ✅ **NO Solana Actions endpoints** - Keep Actions deprecated, use x402 only
- ✅ **NO breaking changes** - Existing web flow remains unchanged
- ✅ **ONCHAIN compatibility** - All payments verified via ONCHAIN facilitators
- ✅ **Custom bot approach** - Platform-specific UX instead of generic Actions

### Success Metrics

- **Distribution**: Blinks shareable in 10,000+ Discord servers and Telegram groups
- **Conversion**: ≥50% conversion rate from bot interaction to wallet signature
- **Performance**: <3s bot response time (metadata fetch + embed render)
- **Reliability**: 99.5% bot uptime across all platforms

### Timeline

- **Planning**: 2 hours (this document)
- **Implementation**: 8-10 days
  - Discord: 3 days
  - Telegram: 2-3 days
  - Twitter/X: 2 days
  - Testing: 2 days
- **Deployment**: 1 day
- **Total**: ~2 weeks from start to production

---

## Architecture Overview

### Current State (Web Only)

```
┌─────────────┐
│  Web Client │
│ (Next.js)   │
└──────┬──────┘
       │ 1. POST /bazaar/:slug (no payment)
       ↓
┌─────────────────────────────────────────┐
│         API Server (Fastify)            │
│  POST /bazaar/:slug                     │
│    ├─ Returns 402 Payment Required      │
│    └─ X-PAYMENT header with details     │
└─────────────────────────────────────────┘
       ↑
       │ 2. POST /bazaar/:slug (with payment_header)
       │
┌──────┴──────┐
│  Web Client │
│  (signed tx)│
└─────────────┘
       ↓
┌─────────────────────────────────────────┐
│    ONCHAIN Facilitator Verification     │
│    └─ 2.1s settlement time              │
└─────────────────────────────────────────┘
```

### Target State (Multi-Platform)

```
┌──────────────┐  ┌───────────────┐  ┌──────────────┐  ┌─────────────┐
│ Discord Bot  │  │ Telegram Bot  │  │ Twitter Bot  │  │ Web Client  │
└──────┬───────┘  └───────┬───────┘  └──────┬───────┘  └──────┬──────┘
       │                  │                  │                  │
       │ Metadata fetch   │                  │                  │
       └──────────────────┴──────────────────┴──────────────────┤
                                                                 │
                                                                 ↓
       ┌─────────────────────────────────────────────────────────────┐
       │              API Server (Fastify)                           │
       │  ┌─────────────────────────────────────────────────────┐   │
       │  │  Shared Metadata Service                            │   │
       │  │  └─ Query database for blink metadata               │   │
       │  └─────────────────────────────────────────────────────┘   │
       │                                                             │
       │  ┌─────────────────────────────────────────────────────┐   │
       │  │  x402 Payment Endpoint: POST /bazaar/:slug          │   │
       │  │  └─ Verifies via ONCHAIN facilitator                │   │
       │  └─────────────────────────────────────────────────────┘   │
       └─────────────────────────────────────────────────────────────┘
                                 ↓
       ┌─────────────────────────────────────────────────────────────┐
       │          Database (PostgreSQL)                               │
       │  ┌─────────────────────────────────────────────────────┐   │
       │  │  runs table                                         │   │
       │  │  └─ NEW: source column (web/discord/telegram/twitter) │ │
       │  └─────────────────────────────────────────────────────┘   │
       └─────────────────────────────────────────────────────────────┘
```

### Key Architectural Principles

1. **Single Source of Truth**: Database holds all blink metadata
2. **Protocol Unification**: All platforms use x402 for payment verification
3. **Platform Adapters**: Each bot adapts blink metadata to platform-specific UX
4. **Stateless Bots**: No bot-side payment state (API handles verification)
5. **Phantom Integration**: All platforms use Phantom Mobile deeplinks for signing

### New Components

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Discord Bot** | discord.js v14 | URL unfurling, slash commands, embeds |
| **Telegram Bot** | Telegraf v4 | Mini App WebView, inline mode |
| **Twitter Bot** | N/A (uses Dialect) | Blink preview cards (requires Actions) |
| **Metadata API** | Fastify route | Serve blink metadata for bots |
| **Platform Tracker** | PostgreSQL column | Track conversion rates per platform |

---

## Discord Bot Specification

### Overview

A Discord bot that:
1. **Auto-unfurls** Blink URLs posted in chat
2. **Renders interactive embeds** with "Pay" button
3. **Generates Phantom deeplinks** for mobile wallet signing
4. **Tracks execution** via x402 flow

### User Flow

```
1. User posts Blink URL in Discord
   Example: "Check out this wallet analyzer: https://blink402.dev/blink/wallet-analyzer"

2. Bot detects URL, fetches metadata from database
   GET /api/metadata/wallet-analyzer → { title, icon, price, description }

3. Bot posts rich embed with button
   ┌──────────────────────────────────────┐
   │  💳 Wallet Analyzer                  │
   │  Analyze your Solana wallet's stats  │
   │                                      │
   │  Price: 0.01 USDC                    │
   │  Creator: @dev_wallet                │
   │                                      │
   │  [💰 Pay with Phantom]               │
   └──────────────────────────────────────┘

4. User clicks button → Bot replies with deeplink (ephemeral message)
   "Open Phantom Mobile: phantom://browse/https://blink402.dev/checkout?slug=wallet-analyzer"

5. User approves transaction in Phantom
   Transaction includes reference UUID for tracking

6. User returns to Discord, clicks "✅ I've Paid"

7. Bot calls POST /bazaar/:slug with reference
   API verifies via ONCHAIN → Executes endpoint → Returns result

8. Bot edits embed with result
   ┌──────────────────────────────────────┐
   │  ✅ Payment Confirmed                │
   │  Result: Your wallet has 42 NFTs...  │
   │                                      │
   │  Receipt: https://blink402.dev/...   │
   └──────────────────────────────────────┘
```

### Technical Stack

**Framework**: discord.js v14

**Dependencies**:
```json
{
  "discord.js": "^14.14.1",
  "@solana/web3.js": "^1.87.6",
  "ioredis": "^5.3.2",
  "@blink402/database": "workspace:*",
  "@blink402/types": "workspace:*"
}
```

**Bot Permissions** (OAuth2):
- `applications.commands` (slash commands)
- `bot` (basic bot features)
  - `SEND_MESSAGES`
  - `EMBED_LINKS`
  - `ADD_REACTIONS`
  - `VIEW_CHANNEL`
  - `MANAGE_MESSAGES` (for editing embeds)

### Core Features

#### 1. URL Unfurling (Auto-Detection)

**Implementation**:
```typescript
// apps/discord-bot/src/handlers/messageCreate.ts

import { Message } from 'discord.js'
import { getBlinkBySlug } from '@blink402/database'

const BLINK_URL_REGEX = /https?:\/\/(?:www\.)?blink402\.(?:dev|com)\/blink\/([a-z0-9-]+)/gi

export async function handleMessageCreate(message: Message) {
  if (message.author.bot) return

  const matches = [...message.content.matchAll(BLINK_URL_REGEX)]
  if (matches.length === 0) return

  // Limit to 3 unfurls per message (prevent spam)
  const slugs = matches.slice(0, 3).map(m => m[1])

  for (const slug of slugs) {
    const blink = await getBlinkBySlug(slug)
    if (!blink || blink.status !== 'published') continue

    const embed = createBlinkEmbed(blink)
    const button = createPayButton(slug)

    await message.reply({
      embeds: [embed],
      components: [button]
    })
  }
}
```

#### 2. Slash Commands

**Commands**:

| Command | Description | Example |
|---------|-------------|---------|
| `/blink <slug>` | Display specific blink | `/blink wallet-analyzer` |
| `/search <query>` | Search blinks by keyword | `/search NFT` |
| `/featured` | Show featured blinks | `/featured` |
| `/myblinks` | Show user's created blinks (requires wallet link) | `/myblinks` |

**Example Implementation**:
```typescript
// apps/discord-bot/src/commands/blink.ts

import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'

export const data = new SlashCommandBuilder()
  .setName('blink')
  .setDescription('Display a Blink by slug')
  .addStringOption(option =>
    option.setName('slug')
      .setDescription('The blink slug (e.g., wallet-analyzer)')
      .setRequired(true)
  )

export async function execute(interaction: ChatInputCommandInteraction) {
  const slug = interaction.options.getString('slug', true)
  const blink = await getBlinkBySlug(slug)

  if (!blink) {
    return interaction.reply({
      content: `❌ Blink not found: \`${slug}\``,
      ephemeral: true
    })
  }

  const embed = createBlinkEmbed(blink)
  const button = createPayButton(slug)

  await interaction.reply({
    embeds: [embed],
    components: [button]
  })
}
```

#### 3. Interactive Embeds

**Embed Structure**:
```typescript
// apps/discord-bot/src/utils/embedBuilder.ts

import { EmbedBuilder } from 'discord.js'
import { Blink } from '@blink402/types'

export function createBlinkEmbed(blink: Blink) {
  return new EmbedBuilder()
    .setColor(0x5AB4FF) // Neon blue from design system
    .setTitle(blink.title || `Blink: ${blink.slug}`)
    .setDescription(blink.description || 'No description available')
    .setThumbnail(blink.icon_url || 'https://blink402.dev/default-icon.png')
    .addFields(
      { name: '💰 Price', value: `${blink.price_usdc} ${blink.payment_token}`, inline: true },
      { name: '📁 Category', value: blink.category || 'Uncategorized', inline: true },
      { name: '👤 Creator', value: truncateAddress(blink.payout_wallet), inline: true }
    )
    .setFooter({ text: 'Powered by Blink402 x ONCHAIN' })
    .setTimestamp()
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}
```

**Button Component**:
```typescript
// apps/discord-bot/src/utils/buttonBuilder.ts

import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'

export function createPayButton(slug: string) {
  const button = new ButtonBuilder()
    .setCustomId(`pay-${slug}`)
    .setLabel('💰 Pay with Phantom')
    .setStyle(ButtonStyle.Primary)

  return new ActionRowBuilder<ButtonBuilder>()
    .addComponents(button)
}

export function createConfirmButton(slug: string, reference: string) {
  const button = new ButtonBuilder()
    .setCustomId(`confirm-${slug}-${reference}`)
    .setLabel('✅ I\'ve Paid')
    .setStyle(ButtonStyle.Success)

  return new ActionRowBuilder<ButtonBuilder>()
    .addComponents(button)
}
```

#### 4. Phantom Mobile Deeplink

**Flow**:
```typescript
// apps/discord-bot/src/handlers/buttonClick.ts

import { ButtonInteraction } from 'discord.js'
import { generateReference } from '@blink402/solana'

export async function handlePayButton(interaction: ButtonInteraction) {
  const slug = interaction.customId.replace('pay-', '')
  const reference = generateReference()

  // Generate Phantom Mobile deeplink
  const checkoutUrl = `https://blink402.dev/checkout?slug=${slug}&ref=${reference}&platform=discord`
  const deeplink = `phantom://browse/${encodeURIComponent(checkoutUrl)}`

  // Store reference in Redis (expires in 10 minutes)
  await redis.setex(`discord:payment:${reference}`, 600, JSON.stringify({
    slug,
    userId: interaction.user.id,
    channelId: interaction.channelId,
    messageId: interaction.message.id
  }))

  // Reply with deeplink (ephemeral - only user sees it)
  await interaction.reply({
    content: `🔗 **Open Phantom Mobile to pay:**\n${deeplink}\n\n*Or scan this QR code on desktop:*`,
    ephemeral: true,
    components: [createConfirmButton(slug, reference)]
  })

  // Also send QR code (for desktop users)
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(deeplink)}`
  await interaction.followUp({
    content: qrCodeUrl,
    ephemeral: true
  })
}
```

#### 5. Payment Confirmation

**Flow**:
```typescript
// apps/discord-bot/src/handlers/confirmButton.ts

export async function handleConfirmButton(interaction: ButtonInteraction) {
  const [_, slug, reference] = interaction.customId.split('-')

  // Verify payment via x402 endpoint
  const response = await fetch(`https://blink402.dev/api/bazaar/${slug}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Platform': 'discord'
    },
    body: JSON.stringify({
      reference,
      discord_user: interaction.user.id
    })
  })

  if (response.status === 402) {
    return interaction.reply({
      content: '❌ Payment not detected yet. Please wait for blockchain confirmation (~30s).',
      ephemeral: true
    })
  }

  if (!response.ok) {
    return interaction.reply({
      content: '❌ Payment verification failed. Please contact support.',
      ephemeral: true
    })
  }

  const result = await response.json()

  // Update original embed with result
  const successEmbed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('✅ Payment Confirmed')
    .setDescription(`Result: ${truncate(result.data, 200)}`)
    .addFields(
      { name: '💳 Receipt', value: `[View Receipt](https://blink402.dev/receipt/${result.run_id})` }
    )

  await interaction.update({
    embeds: [successEmbed],
    components: [] // Remove buttons
  })

  // Clean up Redis
  await redis.del(`discord:payment:${reference}`)
}
```

### Rate Limiting & Anti-Spam

**Per-User Limits**:
- Max 10 unfurls per minute per user
- Max 5 slash commands per minute per user
- Max 3 payment attempts per 10 minutes per user

**Implementation**:
```typescript
// apps/discord-bot/src/middleware/rateLimit.ts

import { Redis } from 'ioredis'

const redis = new Redis(process.env.REDIS_URL!)

export async function checkRateLimit(userId: string, action: string): Promise<boolean> {
  const key = `ratelimit:discord:${action}:${userId}`
  const count = await redis.incr(key)

  if (count === 1) {
    await redis.expire(key, 60) // 1 minute window
  }

  const limits = {
    unfurl: 10,
    slash: 5,
    payment: 3
  }

  return count <= (limits[action as keyof typeof limits] || 10)
}
```

### File Structure

```
apps/discord-bot/
├── src/
│   ├── index.ts                 # Bot initialization
│   ├── commands/
│   │   ├── blink.ts            # /blink command
│   │   ├── search.ts           # /search command
│   │   ├── featured.ts         # /featured command
│   │   └── myblinks.ts         # /myblinks command
│   ├── handlers/
│   │   ├── messageCreate.ts    # URL unfurling
│   │   ├── buttonClick.ts      # Button interactions
│   │   └── ready.ts            # Bot ready event
│   ├── utils/
│   │   ├── embedBuilder.ts     # Embed creation
│   │   ├── buttonBuilder.ts    # Button components
│   │   └── deeplink.ts         # Phantom URL generation
│   ├── middleware/
│   │   └── rateLimit.ts        # Rate limiting
│   └── config/
│       └── env.ts              # Environment variables
├── package.json
├── tsconfig.json
└── README.md
```

### Environment Variables

```bash
# Discord Bot Configuration
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_GUILD_ID=your_test_guild_id_here  # For dev/staging

# API Configuration
API_URL=https://blink402.dev/api
APP_URL=https://blink402.dev

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Database Configuration (inherits from main API)
DATABASE_URL=postgres://...
```

---

## Telegram Bot Specification

### Overview

A Telegram bot that:
1. **Inline mode** for sharing blinks in any chat
2. **Mini App (WebView)** for seamless checkout
3. **Slash commands** for discovery
4. **Group chat support** for viral sharing

### User Flow

```
1. User types in Telegram chat
   "@Blink402Bot wallet-analyzer"

2. Inline results appear
   ┌────────────────────────────────┐
   │  💳 Wallet Analyzer            │
   │  0.01 USDC                     │
   └────────────────────────────────┘

3. User selects result → Bot posts message
   ┌────────────────────────────────┐
   │  💳 Wallet Analyzer            │
   │  Analyze your Solana wallet    │
   │                                │
   │  Price: 0.01 USDC              │
   │  [Open Blink]                  │
   └────────────────────────────────┘

4. User clicks "Open Blink" → Telegram Mini App opens
   (Full checkout page loads in WebView)

5. User clicks "Pay with Phantom" → Phantom Mobile deeplink
   phantom://browse/https://blink402.dev/checkout?slug=...

6. User approves in Phantom → Returns to Mini App

7. Mini App polls /bazaar/:slug → Detects payment → Shows result
```

### Technical Stack

**Framework**: Telegraf v4

**Dependencies**:
```json
{
  "telegraf": "^4.15.0",
  "@solana/web3.js": "^1.87.6",
  "ioredis": "^5.3.2",
  "@blink402/database": "workspace:*",
  "@blink402/types": "workspace:*"
}
```

**Bot Features**:
- Inline mode
- Web App (Mini App)
- Webhooks (for production)
- Group chat support
- Deep linking

### Core Features

#### 1. Inline Mode

**Setup**:
```typescript
// apps/telegram-bot/src/index.ts

import { Telegraf } from 'telegraf'
import { InlineQueryResult } from 'telegraf/types'

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!)

bot.on('inline_query', async (ctx) => {
  const query = ctx.inlineQuery.query.toLowerCase()

  // Search blinks by title/category/slug
  const blinks = await searchBlinks(query)

  const results: InlineQueryResult[] = blinks.map((blink, idx) => ({
    type: 'article',
    id: `${blink.id}-${idx}`,
    title: blink.title || blink.slug,
    description: `${blink.price_usdc} ${blink.payment_token} • ${blink.category}`,
    thumb_url: blink.icon_url,
    reply_markup: {
      inline_keyboard: [[
        {
          text: '🔗 Open Blink',
          web_app: { url: `https://blink402.dev/checkout?slug=${blink.slug}&platform=telegram` }
        }
      ]]
    },
    input_message_content: {
      message_text: `💳 **${blink.title}**\n\n${blink.description}\n\n💰 Price: ${blink.price_usdc} ${blink.payment_token}\n🔗 [Open Blink](https://blink402.dev/blink/${blink.slug})`
    }
  }))

  await ctx.answerInlineQuery(results, { cache_time: 60 })
})
```

#### 2. Mini App (WebView)

**How it works**:
- Telegram's WebView embeds the existing Next.js checkout page
- No code changes needed to `apps/web/app/checkout/page.tsx`
- Payment flow uses existing x402 implementation

**Mini App Configuration**:
```json
{
  "web_app_url": "https://blink402.dev/checkout",
  "supports_inline_mode": true,
  "can_join_groups": true,
  "can_read_all_group_messages": false
}
```

**Button with Mini App**:
```typescript
// apps/telegram-bot/src/utils/keyboard.ts

export function createMiniAppButton(slug: string) {
  return {
    inline_keyboard: [[
      {
        text: '🔗 Open Blink',
        web_app: {
          url: `https://blink402.dev/checkout?slug=${slug}&platform=telegram`
        }
      }
    ]]
  }
}
```

#### 3. Slash Commands

**Commands**:

| Command | Description |
|---------|-------------|
| `/start` | Welcome message + featured blinks |
| `/blink <slug>` | Display specific blink |
| `/search <query>` | Search blinks |
| `/featured` | Top 10 featured blinks |
| `/help` | Bot usage guide |

**Implementation**:
```typescript
// apps/telegram-bot/src/commands/blink.ts

bot.command('blink', async (ctx) => {
  const slug = ctx.message.text.split(' ')[1]

  if (!slug) {
    return ctx.reply('Usage: /blink <slug>\nExample: /blink wallet-analyzer')
  }

  const blink = await getBlinkBySlug(slug)

  if (!blink) {
    return ctx.reply(`❌ Blink not found: \`${slug}\``)
  }

  const caption = `💳 **${blink.title}**\n\n${blink.description}\n\n💰 Price: ${blink.price_usdc} ${blink.payment_token}`

  await ctx.replyWithPhoto(blink.icon_url, {
    caption,
    parse_mode: 'Markdown',
    reply_markup: createMiniAppButton(slug)
  })
})
```

#### 4. Group Chat Support

**Features**:
- Allow bot in groups (for viral sharing)
- Respond to mentions: `@Blink402Bot search NFT`
- Privacy mode: Bot only reads messages that mention it

**Setup**:
```typescript
// apps/telegram-bot/src/handlers/groupMessage.ts

bot.on('text', async (ctx) => {
  // Only in groups
  if (ctx.chat.type === 'private') return

  const botUsername = ctx.botInfo.username
  const message = ctx.message.text

  // Check if bot is mentioned
  if (!message.includes(`@${botUsername}`)) return

  // Extract command after mention
  const command = message.replace(`@${botUsername}`, '').trim()

  if (command.startsWith('search')) {
    const query = command.replace('search', '').trim()
    // Handle search...
  }
})
```

#### 5. Payment Webhooks (Future)

**Concept**: Bot receives webhook when payment confirms (faster than polling)

```typescript
// apps/telegram-bot/src/webhooks/payment.ts

import { FastifyPluginAsync } from 'fastify'

export const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/telegram/payment-confirmed', async (request, reply) => {
    const { run_id, telegram_chat_id, telegram_message_id } = request.body

    // Send message to user
    await bot.telegram.sendMessage(telegram_chat_id, '✅ Payment confirmed!', {
      reply_to_message_id: telegram_message_id
    })

    return reply.code(200).send({ ok: true })
  })
}
```

### File Structure

```
apps/telegram-bot/
├── src/
│   ├── index.ts                # Bot initialization
│   ├── commands/
│   │   ├── start.ts           # /start command
│   │   ├── blink.ts           # /blink command
│   │   ├── search.ts          # /search command
│   │   └── featured.ts        # /featured command
│   ├── handlers/
│   │   ├── inlineQuery.ts     # Inline mode handler
│   │   ├── groupMessage.ts    # Group chat handler
│   │   └── callbackQuery.ts   # Button callbacks
│   ├── utils/
│   │   ├── keyboard.ts        # Keyboard builders
│   │   └── formatter.ts       # Message formatting
│   └── config/
│       └── env.ts             # Environment variables
├── package.json
├── tsconfig.json
└── README.md
```

### Environment Variables

```bash
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_WEBHOOK_URL=https://blink402.dev/api/telegram/webhook  # Production only

# API Configuration
API_URL=https://blink402.dev/api
APP_URL=https://blink402.dev

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Database Configuration
DATABASE_URL=postgres://...
```

---

## Twitter/X Integration

### Challenge: No Actions = No Auto-Unfurl

**Problem**: Twitter's Blink previews rely on Dialect's Solana Actions registry. Without Actions endpoints, Twitter won't auto-unfurl Blinks.

**Current Status**:
- Actions endpoints deprecated (Jan 9, 2025)
- Dialect registry requires `GET /actions/:slug` endpoint
- Cannot use pure x402 for Twitter previews

### Solution Options

#### Option 1: Hybrid Actions for Twitter Only (Recommended)

**Architecture**:
```typescript
// apps/api/src/routes/actions.ts

// Special route ONLY for Twitter unfurling (not for payments)
fastify.get('/actions/:slug', {
  schema: {
    description: 'Solana Actions metadata for Twitter unfurling ONLY'
  }
}, async (request, reply) => {
  const { slug } = request.params
  const blink = await getBlinkBySlug(slug)

  if (!blink) {
    return reply.code(404).send({ error: 'Blink not found' })
  }

  // Return metadata ONLY (no transaction building)
  return {
    type: 'action',
    icon: blink.icon_url,
    title: blink.title,
    description: blink.description,
    label: `Pay ${blink.price_usdc} ${blink.payment_token}`,
    links: {
      actions: [{
        label: `Pay ${blink.price_usdc} ${blink.payment_token}`,
        href: `https://blink402.dev/checkout?slug=${slug}&platform=twitter`,
        parameters: []
      }]
    },
    disabled: false,
    error: null
  }
})

// POST endpoint returns 410 (still deprecated for payments)
fastify.post('/actions/:slug', async (request, reply) => {
  return reply.code(410).send({
    error: 'Use checkout page instead',
    redirect: `https://blink402.dev/checkout?slug=${request.params.slug}`
  })
})
```

**actions.json**:
```json
{
  "rules": [
    {
      "pathPattern": "/blink/*",
      "apiPath": "/api/actions/*"
    }
  ]
}
```

**Dialect Registry Submission**:
```bash
# Submit to Dialect for Twitter verification
curl -X POST https://api.dialect.to/v1/actions/register \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://blink402.dev/actions.json",
    "name": "Blink402",
    "description": "Pay-per-call API marketplace on Solana",
    "icon": "https://blink402.dev/icon.png"
  }'
```

**Pros**:
- ✅ Twitter auto-unfurling works
- ✅ Minimal code changes
- ⚠️ Actions only for metadata (not payments)

**Cons**:
- ⚠️ Maintains deprecated endpoint
- ⚠️ Confusing for developers (Actions disabled but visible)

#### Option 2: Twitter Card Fallback (No Auto-Unfurl)

**Implementation**: Use standard Twitter Card meta tags

```html
<!-- apps/web/app/blink/[slug]/page.tsx -->

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="@Blink402" />
<meta name="twitter:title" content={blink.title} />
<meta name="twitter:description" content={blink.description} />
<meta name="twitter:image" content={blink.icon_url} />
<meta name="twitter:url" content={`https://blink402.dev/blink/${slug}`} />
```

**Result**: Basic preview card (no interactive buttons)

**Pros**:
- ✅ No Actions dependencies
- ✅ Simple implementation

**Cons**:
- ❌ No interactive buttons
- ❌ No "Pay with Phantom" in Twitter
- ❌ Lower conversion rate

#### Option 3: Dedicated Twitter Bot (Polling Mentions)

**Concept**: Bot monitors Twitter for `@Blink402` mentions, replies with Blink preview

**Implementation** (using Twitter API v2):
```typescript
// apps/twitter-bot/src/index.ts

import { TwitterApi } from 'twitter-api-v2'

const client = new TwitterApi(process.env.TWITTER_BEARER_TOKEN!)

// Poll for mentions every 30s
setInterval(async () => {
  const mentions = await client.v2.mentionTimeline('me', {
    'tweet.fields': 'text,author_id'
  })

  for (const tweet of mentions.data) {
    // Extract blink slug from tweet
    const slugMatch = tweet.text.match(/blink\/([a-z0-9-]+)/)
    if (!slugMatch) continue

    const slug = slugMatch[1]
    const blink = await getBlinkBySlug(slug)

    if (!blink) continue

    // Reply with Blink preview
    await client.v2.reply(
      `💳 ${blink.title}\n\n${blink.description}\n\n💰 ${blink.price_usdc} ${blink.payment_token}\n\n🔗 Pay: https://blink402.dev/checkout?slug=${slug}`,
      tweet.id
    )
  }
}, 30000)
```

**Pros**:
- ✅ No Actions needed
- ✅ Interactive bot responses

**Cons**:
- ❌ Requires Twitter API approval
- ❌ Rate limits (100 tweets/hour)
- ❌ Manual mention required (no auto-unfurl)

### Recommended Approach: Option 1 (Hybrid Actions)

**Reasoning**:
- Twitter users expect auto-unfurling (standard for Blinks)
- Minimal effort (just metadata endpoint, no tx building)
- Compatible with x402 (payments still go through `/bazaar/:slug`)
- Can be removed later if Dialect supports x402

**Implementation Steps**:
1. Re-enable `GET /actions/:slug` (metadata only)
2. Keep `POST /actions/:slug` as 410 redirect
3. Add `actions.json` to web app
4. Submit to Dialect registry
5. Test on Twitter devnet

---

## Database Schema Changes

### New Columns for `runs` Table

**Migration**: `migrations/011_add_platform_tracking.sql`

```sql
-- Add platform tracking to runs table
ALTER TABLE runs
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS platform_metadata JSONB;

-- Add check constraint
ALTER TABLE runs
  DROP CONSTRAINT IF EXISTS runs_source_check;

ALTER TABLE runs
  ADD CONSTRAINT runs_source_check
  CHECK (source IN ('web', 'discord', 'telegram', 'twitter'));

-- Add index for analytics
CREATE INDEX IF NOT EXISTS idx_runs_source ON runs(source);

-- Add comments
COMMENT ON COLUMN runs.source IS 'Platform where payment was initiated: web, discord, telegram, twitter';
COMMENT ON COLUMN runs.platform_metadata IS 'Platform-specific metadata (e.g., Discord user ID, Telegram chat ID)';
```

### Platform Metadata Examples

**Discord**:
```json
{
  "discord_user_id": "123456789012345678",
  "discord_username": "john#1234",
  "discord_server_id": "987654321098765432",
  "discord_channel_id": "111222333444555666"
}
```

**Telegram**:
```json
{
  "telegram_user_id": "987654321",
  "telegram_username": "john_doe",
  "telegram_chat_id": "-1001234567890",
  "telegram_chat_type": "group"
}
```

**Twitter**:
```json
{
  "twitter_user_id": "1234567890",
  "twitter_username": "johndoe",
  "tweet_id": "1234567890123456789"
}
```

### Updated Database Functions

**Track run source**:
```typescript
// packages/database/src/index.ts

export async function createRun(params: {
  blink_id: string
  reference: string
  payer: string
  source?: 'web' | 'discord' | 'telegram' | 'twitter'
  platform_metadata?: Record<string, any>
}) {
  const query = `
    INSERT INTO runs (blink_id, reference, payer, status, source, platform_metadata)
    VALUES ($1, $2, $3, 'pending', $4, $5)
    RETURNING *
  `

  const values = [
    params.blink_id,
    params.reference,
    params.payer,
    params.source || 'web',
    params.platform_metadata ? JSON.stringify(params.platform_metadata) : null
  ]

  const result = await pool.query(query, values)
  return result.rows[0]
}
```

---

## Implementation Phases

### Phase 1: Database & API Updates (1 day)

**Tasks**:
- [ ] Create migration `011_add_platform_tracking.sql`
- [ ] Run migration on dev/staging database
- [ ] Update `packages/database/src/index.ts` to handle `source` param
- [ ] Update `packages/types/src/index.ts` with platform types
- [ ] Add optional `GET /api/metadata/:slug` endpoint for bots
- [ ] Test database changes with existing x402 flow

**Deliverables**:
- Platform tracking in database
- API supports platform metadata
- Backward compatible with existing web flow

---

### Phase 2: Discord Bot (3 days)

#### Day 1: Core Bot + URL Unfurling
- [ ] Create `apps/discord-bot/` package
- [ ] Setup discord.js v14 with TypeScript
- [ ] Implement URL detection regex
- [ ] Create `createBlinkEmbed()` utility
- [ ] Test unfurling in dev Discord server

#### Day 2: Interactive Buttons + Phantom Deeplinks
- [ ] Implement "Pay with Phantom" button
- [ ] Generate Phantom Mobile deeplinks
- [ ] Store payment references in Redis
- [ ] Create QR code fallback for desktop
- [ ] Test payment flow end-to-end on devnet

#### Day 3: Slash Commands + Polish
- [ ] Implement `/blink`, `/search`, `/featured` commands
- [ ] Add rate limiting middleware
- [ ] Add error handling + logging
- [ ] Write Discord bot deployment guide
- [ ] Deploy to Railway staging

**Deliverables**:
- Working Discord bot on staging
- URL unfurling + slash commands
- Payment flow integrated with x402

---

### Phase 3: Telegram Bot (2-3 days)

#### Day 1: Core Bot + Inline Mode
- [ ] Create `apps/telegram-bot/` package
- [ ] Setup Telegraf v4 with TypeScript
- [ ] Implement inline query handler
- [ ] Test inline mode in Telegram

#### Day 2: Mini App Integration
- [ ] Configure Mini App URL
- [ ] Test existing checkout page in WebView
- [ ] Add platform=telegram param to checkout
- [ ] Implement slash commands

#### Day 3: Group Support + Polish
- [ ] Enable group chat support
- [ ] Test bot mentions in groups
- [ ] Add rate limiting
- [ ] Deploy to Railway staging

**Deliverables**:
- Working Telegram bot on staging
- Inline mode + Mini App
- Group chat support

---

### Phase 4: Twitter/X Integration (2 days)

#### Day 1: Hybrid Actions Endpoint
- [ ] Re-enable `GET /actions/:slug` (metadata only)
- [ ] Add `actions.json` to `apps/web/public/`
- [ ] Test Actions metadata format
- [ ] Update CORS to allow Twitter domains

#### Day 2: Dialect Registry + Testing
- [ ] Submit to Dialect registry for verification
- [ ] Test Twitter unfurling on devnet
- [ ] Add Twitter Card fallback tags
- [ ] Document Twitter integration

**Deliverables**:
- Twitter Blink previews working
- Dialect registry approval (pending)

---

### Phase 5: Testing & QA (2 days)

#### Day 1: E2E Testing
- [ ] Test Discord: URL unfurl → Pay → Verify
- [ ] Test Telegram: Inline mode → Mini App → Pay
- [ ] Test Twitter: Tweet Blink → Unfurl → Click
- [ ] Test cross-platform analytics (source tracking)

#### Day 2: Load Testing + Bug Fixes
- [ ] Simulate 100 concurrent Discord unfurls
- [ ] Test rate limiting on all platforms
- [ ] Fix bugs discovered during testing
- [ ] Update documentation

**Deliverables**:
- All platforms tested on staging
- Bug fixes deployed
- Performance validated

---

### Phase 6: Production Deployment (1 day)

- [ ] Deploy Discord bot to Railway production
- [ ] Deploy Telegram bot to Railway production
- [ ] Enable Twitter Actions on production domain
- [ ] Run database migration on production
- [ ] Monitor logs for errors
- [ ] Announce launch on Twitter/Discord/Telegram

**Deliverables**:
- All bots live in production
- Multi-platform analytics tracking
- Public announcement

---

## Deployment Strategy

### Infrastructure Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Railway Projects                          │
├─────────────────────────────────────────────────────────────┤
│  1. blink402-web (Next.js)                                  │
│     └─ Existing web app (no changes)                        │
├─────────────────────────────────────────────────────────────┤
│  2. blink402-api (Fastify)                                  │
│     └─ Existing API + new metadata endpoint                 │
├─────────────────────────────────────────────────────────────┤
│  3. blink402-discord-bot (NEW)                              │
│     ├─ discord.js bot                                       │
│     └─ Shares DATABASE_URL, REDIS_URL                      │
├─────────────────────────────────────────────────────────────┤
│  4. blink402-telegram-bot (NEW)                             │
│     ├─ Telegraf bot                                         │
│     └─ Shares DATABASE_URL, REDIS_URL                      │
├─────────────────────────────────────────────────────────────┤
│  Shared Services                                            │
│  ├─ PostgreSQL (Railway Postgres)                          │
│  └─ Redis (Railway Redis)                                  │
└─────────────────────────────────────────────────────────────┘
```

### Railway Configuration

**Discord Bot Service**:
```yaml
# apps/discord-bot/railway.toml

[build]
builder = "nixpacks"
buildCommand = "pnpm install && pnpm --filter '@blink402/discord-bot' build"

[deploy]
startCommand = "pnpm --filter '@blink402/discord-bot' start"
restartPolicyType = "on-failure"
restartPolicyMaxRetries = 10

[[services]]
name = "discord-bot"
```

**Telegram Bot Service**:
```yaml
# apps/telegram-bot/railway.toml

[build]
builder = "nixpacks"
buildCommand = "pnpm install && pnpm --filter '@blink402/telegram-bot' build"

[deploy]
startCommand = "pnpm --filter '@blink402/telegram-bot' start"
restartPolicyType = "on-failure"
restartPolicyMaxRetries = 10

[[services]]
name = "telegram-bot"
```

### Environment Variable Sharing

**Strategy**: Use Railway's **shared variables** feature

```bash
# Shared across all services
DATABASE_URL=postgres://...       # From Railway Postgres
REDIS_URL=redis://...             # From Railway Redis
API_URL=https://api.blink402.dev
APP_URL=https://blink402.dev

# Service-specific
DISCORD_BOT_TOKEN=...             # Discord bot only
DISCORD_CLIENT_ID=...             # Discord bot only

TELEGRAM_BOT_TOKEN=...            # Telegram bot only
TELEGRAM_WEBHOOK_URL=...          # Telegram bot only
```

### Monitoring & Logging

**All services log to Railway console**:
```typescript
// Use Pino for structured logging

import pino from 'pino'

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty'
  } : undefined
})

logger.info({ platform: 'discord', action: 'unfurl', slug: 'wallet-analyzer' }, 'Unfurled blink')
```

**Railway Dashboard Metrics**:
- CPU usage
- Memory usage
- Request count
- Error rate
- Uptime

---

## Testing & Quality Assurance

### Unit Tests (Jest)

**Discord Bot Tests**:
```typescript
// apps/discord-bot/tests/embedBuilder.test.ts

import { createBlinkEmbed } from '../src/utils/embedBuilder'

describe('createBlinkEmbed', () => {
  it('should create valid Discord embed', () => {
    const blink = {
      title: 'Test Blink',
      description: 'Test description',
      price_usdc: 0.01,
      payment_token: 'USDC',
      icon_url: 'https://example.com/icon.png',
      payout_wallet: 'ABC123...XYZ789'
    }

    const embed = createBlinkEmbed(blink)

    expect(embed.data.title).toBe('Test Blink')
    expect(embed.data.color).toBe(0x5AB4FF)
    expect(embed.data.fields).toHaveLength(3)
  })
})
```

### Integration Tests (Playwright)

**Discord Payment Flow**:
```typescript
// apps/discord-bot/tests/e2e/payment.spec.ts

import { test, expect } from '@playwright/test'

test('Discord bot unfurls Blink URL', async ({ page }) => {
  // 1. Mock Discord message with Blink URL
  await page.goto('http://localhost:3000/mock-discord')
  await page.fill('#message', 'Check this out: https://blink402.dev/blink/wallet-analyzer')
  await page.click('#send')

  // 2. Verify embed appears
  await expect(page.locator('.discord-embed')).toBeVisible()
  await expect(page.locator('.discord-embed-title')).toHaveText('Wallet Analyzer')

  // 3. Click "Pay with Phantom" button
  await page.click('button:has-text("Pay with Phantom")')

  // 4. Verify deeplink appears
  await expect(page.locator('.deeplink')).toContainText('phantom://browse/')
})
```

### Manual Testing Checklist

**Discord**:
- [ ] Bot joins server successfully
- [ ] URL unfurling works for single Blink
- [ ] URL unfurling works for multiple Blinks in one message
- [ ] `/blink` command displays correct metadata
- [ ] `/search` command returns relevant results
- [ ] "Pay with Phantom" button generates deeplink
- [ ] QR code appears for desktop users
- [ ] Payment confirmation updates embed
- [ ] Rate limiting prevents spam
- [ ] Bot works in DMs
- [ ] Bot works in group channels

**Telegram**:
- [ ] Inline mode returns search results
- [ ] Selected result posts message with button
- [ ] "Open Blink" button launches Mini App
- [ ] Mini App loads checkout page
- [ ] Payment flow works in Mini App
- [ ] `/blink` command displays correct metadata
- [ ] Bot works in group chats
- [ ] Bot responds to mentions in groups

**Twitter**:
- [ ] Blink URL unfurls with preview card
- [ ] Clicking preview opens checkout page
- [ ] Actions metadata returns 200 OK
- [ ] POST to Actions returns 410 redirect

### Performance Benchmarks

**Target Metrics**:
- Discord unfurl response time: <2s
- Telegram inline query response: <1s
- Twitter Actions metadata fetch: <500ms
- Payment verification: <3s (ONCHAIN settlement)

**Load Testing** (k6):
```javascript
// apps/discord-bot/tests/load/unfurl.js

import http from 'k6/http'
import { check } from 'k6'

export let options = {
  vus: 100, // 100 virtual users
  duration: '30s'
}

export default function () {
  const res = http.get('http://localhost:3001/api/metadata/wallet-analyzer')

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500
  })
}
```

---

## Bot Setup Guides

### Discord Bot Setup (For Server Admins)

**Prerequisites**:
- Discord account
- Server with "Manage Server" permission

**Steps**:

1. **Invite Bot to Server**
   ```
   https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=274877975552&scope=bot%20applications.commands
   ```

2. **Grant Permissions**
   - View Channels
   - Send Messages
   - Embed Links
   - Add Reactions
   - Manage Messages (for editing embeds)

3. **Configure Bot Role**
   - Create "Blink402 Bot" role
   - Place above @everyone but below moderator roles
   - Enable "Display role members separately" (optional)

4. **Test Bot**
   - Post a Blink URL: `https://blink402.dev/blink/wallet-analyzer`
   - Bot should unfurl automatically
   - Try slash command: `/blink wallet-analyzer`

5. **Troubleshooting**
   - Bot not responding? Check permissions
   - Unfurling not working? Check bot role hierarchy
   - Commands not appearing? Re-invite bot with `applications.commands` scope

---

### Telegram Bot Setup (For Group Admins)

**Prerequisites**:
- Telegram account

**Steps**:

1. **Add Bot to Group**
   - Open Telegram
   - Search for `@Blink402Bot`
   - Click "Add to Group"
   - Select your group

2. **Enable Inline Mode** (Optional)
   - Type `@Blink402Bot wallet-analyzer` in any chat
   - Select result from inline suggestions

3. **Test Bot**
   - Send `/blink wallet-analyzer`
   - Bot should reply with Blink preview
   - Click "Open Blink" to test Mini App

4. **Troubleshooting**
   - Bot not responding in group? Check privacy mode settings
   - Inline mode not working? Re-add bot with inline permissions

---

## Metrics & Analytics

### Platform Conversion Tracking

**Dashboard Query** (PostgreSQL):
```sql
-- Conversion rates by platform
SELECT
  source AS platform,
  COUNT(*) AS total_runs,
  COUNT(*) FILTER (WHERE status = 'executed') AS successful_runs,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'executed') / COUNT(*), 2) AS conversion_rate,
  SUM(blinks.price_usdc) FILTER (WHERE runs.status = 'executed') AS total_revenue_usdc
FROM runs
JOIN blinks ON runs.blink_id = blinks.id
WHERE runs.created_at >= NOW() - INTERVAL '30 days'
GROUP BY source
ORDER BY total_runs DESC;
```

**Example Output**:
```
 platform  | total_runs | successful_runs | conversion_rate | total_revenue_usdc
-----------+------------+-----------------+-----------------+-------------------
 web       |       1000 |             850 |           85.00 |             42.50
 discord   |        500 |             300 |           60.00 |             15.00
 telegram  |        200 |             120 |           60.00 |              6.00
 twitter   |        100 |              50 |           50.00 |              2.50
```

### Bot-Specific Metrics

**Discord Analytics**:
```typescript
// Track unfurl events
logger.info({
  event: 'blink_unfurl',
  platform: 'discord',
  slug: blink.slug,
  server_id: message.guildId,
  channel_id: message.channelId,
  user_id: message.author.id
})

// Track payment attempts
logger.info({
  event: 'payment_attempt',
  platform: 'discord',
  reference: reference,
  user_id: interaction.user.id
})
```

**Telegram Analytics**:
```typescript
// Track inline queries
logger.info({
  event: 'inline_query',
  platform: 'telegram',
  query: ctx.inlineQuery.query,
  user_id: ctx.from.id
})

// Track Mini App opens
logger.info({
  event: 'miniapp_open',
  platform: 'telegram',
  slug: slug,
  user_id: ctx.from.id
})
```

### Weekly Report (Automated)

**Generate every Monday**:
```typescript
// scripts/weekly-report.ts

async function generateWeeklyReport() {
  const report = await pool.query(`
    SELECT
      source,
      COUNT(*) AS runs,
      COUNT(*) FILTER (WHERE status = 'executed') AS successful,
      AVG(duration_ms) AS avg_duration_ms
    FROM runs
    WHERE created_at >= NOW() - INTERVAL '7 days'
    GROUP BY source
  `)

  const markdown = `
# Blink402 Weekly Report

${report.rows.map(row => `
- **${row.source}**: ${row.runs} runs, ${row.successful} successful (${Math.round(row.successful / row.runs * 100)}%)
`).join('\n')}
  `

  // Send to Discord webhook
  await fetch(process.env.DISCORD_WEBHOOK_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: markdown })
  })
}
```

---

## Security Considerations

### Bot Token Protection

**Environment Variables**:
```bash
# NEVER commit bot tokens to git
DISCORD_BOT_TOKEN=...
TELEGRAM_BOT_TOKEN=...
```

**Railway Secrets**:
- Store tokens in Railway environment variables
- Enable "Sensitive" flag to hide from logs

### Rate Limiting (Per-User)

**Redis-based limiter**:
```typescript
// Prevent abuse across all platforms

async function checkUserRateLimit(
  platform: 'discord' | 'telegram' | 'twitter',
  userId: string,
  action: string
): Promise<boolean> {
  const key = `ratelimit:${platform}:${action}:${userId}`
  const limit = RATE_LIMITS[platform][action]

  const count = await redis.incr(key)
  if (count === 1) {
    await redis.expire(key, 60) // 1 minute window
  }

  return count <= limit
}

const RATE_LIMITS = {
  discord: {
    unfurl: 10,
    slash: 5,
    payment: 3
  },
  telegram: {
    inline: 20,
    command: 10,
    payment: 3
  }
}
```

### Input Validation

**Prevent injection attacks**:
```typescript
// Validate slug format (alphanumeric + hyphens only)
const SLUG_REGEX = /^[a-z0-9-]+$/

function isValidSlug(slug: string): boolean {
  return SLUG_REGEX.test(slug) && slug.length <= 50
}

// Sanitize user input before database queries
function sanitizeInput(input: string): string {
  return input.replace(/[^\w\s-]/g, '').slice(0, 100)
}
```

### CORS Configuration

**Allow bot user-agents**:
```typescript
// apps/api/src/index.ts

fastify.register(cors, {
  origin: [
    'https://blink402.dev',
    'https://discord.com',
    'https://telegram.org',
    'https://x.com',
    'https://twitter.com'
  ],
  exposedHeaders: ['X-PAYMENT', 'X-PAYMENT-METADATA']
})
```

### Webhook Verification (Telegram)

**Verify requests from Telegram**:
```typescript
// apps/telegram-bot/src/middleware/verifyWebhook.ts

import crypto from 'crypto'

export function verifyTelegramWebhook(request: any): boolean {
  const secret = crypto.createHash('sha256')
    .update(process.env.TELEGRAM_BOT_TOKEN!)
    .digest()

  const checkString = [
    request.body.id,
    request.body.from.id,
    request.body.chat.id
  ].join('-')

  const hash = crypto.createHmac('sha256', secret)
    .update(checkString)
    .digest('hex')

  return hash === request.headers['x-telegram-bot-api-secret-token']
}
```

---

## Future Enhancements

### Phase 2 Features (Post-Launch)

1. **Wallet Linking**
   - Users link Solana wallet to Discord/Telegram account
   - Auto-fill payer address in transactions
   - View "My Blinks" in bot

2. **Creator Dashboard in Discord**
   - `/dashboard` command shows creator earnings
   - `/analytics` shows blink performance
   - Notifications for new runs

3. **Blink Discovery**
   - `/trending` command shows top blinks by category
   - `/random` command shows random featured blink
   - Search by price range: `/search price:0-0.10`

4. **Payment Notifications**
   - Bot DMs user when payment confirms (faster than polling)
   - Webhook from API → Bot → User DM

5. **Multi-Currency Support**
   - Allow USDC or SOL payment (user choice)
   - Display prices in USD equivalent

### Phase 3 Features (6+ Months)

1. **Cross-Platform Receipts**
   - Generate cNFT receipts for Discord/Telegram payments
   - Display receipt in bot embed

2. **Subscription Blinks**
   - Monthly/yearly subscriptions via Blinks
   - Auto-renewal with wallet pre-approval

3. **Group Blink Pools**
   - Multiple users split payment for expensive blink
   - "Pool" button in Discord/Telegram

4. **Blink Marketplace**
   - In-bot browsing of all blinks
   - Pagination, filters, sorting

5. **Analytics API**
   - Expose platform metrics via public API
   - Allow creators to fetch their stats programmatically

---

## Appendix: Reference Links

### Documentation

- **Solana Actions Spec**: https://solana.com/docs/advanced/actions
- **Dialect Registry**: https://docs.dialect.to
- **ONCHAIN x402 API**: https://docs.onchain.fi/x402
- **discord.js Guide**: https://discordjs.guide
- **Telegraf Docs**: https://telegraf.js.org
- **Phantom Mobile Deeplinking**: https://docs.phantom.app/developer-powertools/deeplinking

### Tools

- **QR Code Generator API**: https://goqr.me/api/
- **Twitter Card Validator**: https://cards-dev.twitter.com/validator
- **Discord Permissions Calculator**: https://discordapi.com/permissions.html
- **Telegram BotFather**: https://t.me/BotFather

### Blink402 Internal Docs

- `docs/ONCHAIN_X402_INTEGRATION.md` - x402 migration plan
- `docs/MONOREPO_MIGRATION.md` - Turborepo architecture
- `CLAUDE.md` - Project conventions
- `prd.md` - Product requirements (if exists)

---

## Changelog

### Version 1.0 (2025-01-10)
- Initial planning document
- Discord bot specification
- Telegram bot specification
- Twitter/X integration strategy
- Database schema changes
- Implementation phases
- Deployment strategy
- Testing plans
- Bot setup guides

---

**Document Status**: ✅ Planning Complete - Ready for Implementation Approval

**Next Steps**:
1. Review plan with team
2. Approve Discord/Telegram/Twitter scope
3. Begin Phase 1 (Database updates)
4. Iterate based on feedback
