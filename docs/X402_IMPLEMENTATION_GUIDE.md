# ONCHAIN x402 Implementation Guide

**Last Updated**: January 11, 2025
**Status**: Production Ready ✅
**Protocol Version**: x402 v1

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Architecture](#architecture)
4. [Step-by-Step Implementation](#step-by-step-implementation)
5. [Critical Implementation Details](#critical-implementation-details)
6. [Error Handling](#error-handling)
7. [Testing](#testing)
8. [Production Deployment](#production-deployment)
9. [Troubleshooting](#troubleshooting)
10. [References](#references)

## Overview

The ONCHAIN x402 protocol enables decentralized payment-gated API calls with automatic facilitator routing. Unlike traditional Solana Actions which require server-side transaction building, x402 uses **client-side transaction building** with **on-chain settlement verification**.

### Key Benefits

- ✅ No server-side private keys or transaction building
- ✅ Multi-facilitator routing (PayAI, OctonetAI, Coinbase CDP, Daydreams)
- ✅ Average settlement time: 2.1 seconds
- ✅ Automatic failover between facilitators
- ✅ MEV protection via PayAI fee payer pattern

### What You'll Build

A complete payment flow where:
1. User connects Solana wallet
2. Client builds and signs USDC payment transaction
3. Payment is verified and settled via ONCHAIN API
4. Backend executes gated API call
5. Results returned to user

## Prerequisites

### Required Dependencies

```json
{
  "@solana/web3.js": "^1.95.3",
  "@solana/spl-token": "^0.4.8",
  "@privy-io/react-auth": "^1.88.4",
  "bignumber.js": "^9.1.2"
}
```

### Environment Variables

```bash
# Frontend (.env.local)
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_ONCHAIN_API_KEY=onchain_your_api_key_here
NEXT_PUBLIC_APP_URL=https://your-app.com

# Backend (.env)
ONCHAIN_API_KEY=onchain_your_api_key_here
ONCHAIN_API_URL=https://api.onchain.fi/v1
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
```

### ONCHAIN API Key

1. Visit [onchain.fi](https://onchain.fi)
2. Sign up for an account
3. Generate API key from dashboard
4. Add to environment variables

## Architecture

### Transaction Flow

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │
       │ 1. Connect Wallet
       ▼
┌─────────────────────────────────────┐
│  Build VersionedTransaction         │
│  - 3 instructions (exact)           │
│  - PayAI fee payer                  │
│  - User signs locally               │
└──────┬──────────────────────────────┘
       │
       │ 2. POST /api/onchain/pay
       │    (X-Payment header)
       ▼
┌─────────────────────────────────────┐
│  ONCHAIN API                        │
│  - POST /v1/verify                  │
│  - POST /v1/settle                  │
│  - Returns facilitator TX hash      │
└──────┬──────────────────────────────┘
       │
       │ 3. POST /bazaar/:slug
       │    (with payment proof)
       ▼
┌─────────────────────────────────────┐
│  Backend Proxy                      │
│  - Verify payment header            │
│  - Execute upstream API             │
│  - Return results                   │
└─────────────────────────────────────┘
```

### Component Breakdown

**Frontend**:
- `apps/web/app/checkout/page.tsx` - Main checkout flow (715 lines)
- `apps/web/components/ClientProviders.tsx` - Privy wallet connection
- `apps/web/lib/usdc-ata.ts` - USDC ATA helpers

**Backend**:
- `apps/api/src/routes/proxy-with-redis.ts` - Payment proxy (668 lines)
- `apps/web/app/api/onchain/pay/route.ts` - ONCHAIN API proxy (227 lines)
- `packages/onchain/src/index.ts` - ONCHAIN client (259 lines)

**Database**:
- `runs` table with facilitator tracking columns

## Step-by-Step Implementation

### Step 1: Frontend Transaction Building

**File**: `apps/web/app/checkout/page.tsx`

```typescript
import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
} from '@solana/web3.js'
import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
} from '@solana/spl-token'

// ⚠️ CRITICAL: This fee payer prevents Phantom Lighthouse MEV injection
const PAYAI_FEE_PAYER = new PublicKey("2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4")
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")

async function buildPaymentTransaction(
  connection: Connection,
  payer: PublicKey,
  merchant: PublicKey,
  amountUsdc: number
) {
  // 1. Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash('finalized')

  // 2. Get token accounts
  const payerATA = await getAssociatedTokenAddress(USDC_MINT, payer)
  const merchantATA = await getAssociatedTokenAddress(USDC_MINT, merchant)

  // 3. Convert USDC to atomic units (6 decimals)
  const amount = Math.floor(amountUsdc * 1_000_000)

  // 4. Build EXACTLY 3 instructions (ONCHAIN EXACT-SVM requirement)
  const instructions = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 40_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
    createTransferCheckedInstruction(
      payerATA,      // from
      USDC_MINT,     // mint
      merchantATA,   // to
      payer,         // owner
      amount,        // amount
      6              // decimals
    )
  ]

  // 5. Build VersionedTransaction with PayAI fee payer
  const messageV0 = new TransactionMessage({
    payerKey: PAYAI_FEE_PAYER,  // ⚠️ CRITICAL: Prevents Lighthouse injection
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message()

  return new VersionedTransaction(messageV0)
}
```

### Step 2: User Signs Transaction

```typescript
async function signTransaction(transaction: VersionedTransaction) {
  // Ensure wallet is connected (Phantom, Solflare, etc.)
  if (!window.solana || !window.solana.publicKey) {
    throw new Error('Wallet not connected')
  }

  // Sign transaction (user approves in wallet)
  const signedTx = await window.solana.signTransaction(transaction)

  return signedTx
}
```

### Step 3: Build x402 Payment Header

```typescript
function buildX402Header(signedTransaction: VersionedTransaction): string {
  // Build x402 payload
  const paymentPayload = {
    x402Version: 1,
    scheme: 'exact',  // EXACT-SVM scheme (exactly 3 instructions)
    network: 'solana',
    payload: {
      transaction: Buffer.from(signedTransaction.serialize()).toString('base64')
    }
  }

  // Encode as base64
  return btoa(JSON.stringify(paymentPayload))
}
```

### Step 4: Verify and Settle Payment

**File**: `apps/web/app/api/onchain/pay/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const xPaymentHeader = req.headers.get('x-payment')

  if (!xPaymentHeader) {
    return NextResponse.json(
      { error: 'Missing X-Payment header' },
      { status: 400 }
    )
  }

  const body = await req.json()
  const {
    sourceNetwork,
    destinationNetwork,
    expectedAmount,
    expectedToken,
    recipientAddress,
    priority = 'balanced'
  } = body

  const ONCHAIN_API_KEY = process.env.ONCHAIN_API_KEY
  const ONCHAIN_API_URL = process.env.ONCHAIN_API_URL || 'https://api.onchain.fi/v1'

  try {
    // Step 1: Verify payment
    const verifyResponse = await fetch(`${ONCHAIN_API_URL}/v1/verify`, {
      method: 'POST',
      headers: {
        'X-API-Key': ONCHAIN_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paymentHeader: xPaymentHeader,
        sourceNetwork,
        destinationNetwork,
        expectedAmount,
        expectedToken,
        recipientAddress,
        priority
      })
    })

    const verifyData = await verifyResponse.json()

    if (!verifyResponse.ok || !verifyData.verified) {
      return NextResponse.json(
        { error: 'Payment verification failed', details: verifyData },
        { status: 402 }
      )
    }

    // Step 2: Settle payment on-chain
    const settleResponse = await fetch(`${ONCHAIN_API_URL}/v1/settle`, {
      method: 'POST',
      headers: {
        'X-API-Key': ONCHAIN_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paymentHeader: xPaymentHeader,
        sourceNetwork,
        destinationNetwork,
        priority
      })
    })

    const settleData = await settleResponse.json()

    if (!settleResponse.ok) {
      return NextResponse.json(
        { error: 'Payment settlement failed', details: settleData },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      verified: true,
      settled: true,
      txHash: settleData.data?.txHash,
      facilitator: settleData.data?.facilitator,
      verifyData,
      settleData
    })

  } catch (error) {
    console.error('ONCHAIN payment error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### Step 5: Execute Gated API Call

**File**: `apps/api/src/routes/proxy-with-redis.ts`

```typescript
fastify.post<{ Params: { slug: string } }>('/:slug', async (request, reply) => {
  const { slug } = request.params
  const payment_header = request.headers['x-payment'] as string | undefined

  // Get blink details
  const blink = await getBlinkBySlug(slug)
  if (!blink) {
    return reply.code(404).send({ error: 'Blink not found' })
  }

  // If no payment header, return 402 with payment requirements
  if (!payment_header) {
    return reply.code(402).send({
      status: 402,
      message: 'Payment Required',
      payment: {
        recipientWallet: blink.payout_wallet,
        mint: USDC_MINT,
        amount: usdcToAtomicUnits(blink.price_usdc),
        network: 'solana',
        scheme: 'exact'
      }
    })
  }

  // Verify and settle payment via ONCHAIN
  const paymentResult = await verifyAndSettleOnchain({
    paymentHeader: payment_header,
    recipientAddress: blink.payout_wallet,
    expectedAmount: blink.price_usdc.toString(),
    expectedToken: 'USDC'
  })

  if (!paymentResult.verified || !paymentResult.settled) {
    return reply.code(402).send({
      error: 'Payment verification failed',
      details: paymentResult
    })
  }

  // Execute upstream API call
  const upstreamResponse = await fetch(blink.endpoint_url, {
    method: blink.method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request.body)
  })

  const data = await upstreamResponse.json()

  // Update database
  await markRunExecuted({
    reference: paymentResult.txHash,
    duration_ms: Date.now() - startTime,
    facilitator: paymentResult.facilitator,
    payment_method: 'x402'
  })

  return reply.code(200).send(data)
})
```

## Critical Implementation Details

### 1. PayAI Fee Payer (MOST IMPORTANT!)

```typescript
// ⚠️ THIS IS THE MAGIC ADDRESS - DO NOT CHANGE!
const PAYAI_FEE_PAYER = new PublicKey("2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4")
```

**Why this works**:
- When `payerKey !== user's wallet`, Phantom skips Lighthouse MEV protection injection
- Keeps transaction at exactly 3 instructions (ONCHAIN EXACT-SVM requirement)
- PayAI co-signs and pays network fees during settlement

**What happens without it**:
- Phantom injects 2 Lighthouse instructions (total 5 instructions)
- ONCHAIN rejects with `"invalid_exact_svm_payload_transaction_instructions_length"`
- Payment fails

### 2. Exactly 3 Instructions

```typescript
const instructions = [
  ComputeBudgetProgram.setComputeUnitLimit({ units: 40_000 }),      // Instruction 1
  ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),   // Instruction 2
  createTransferCheckedInstruction(/* ... */)                        // Instruction 3
]
```

**EXACT-SVM Scheme Requirements**:
- ✅ Exactly 2 ComputeBudget instructions
- ✅ Exactly 1 SPL Token Transfer instruction
- ❌ No additional instructions (memo, etc.)
- ❌ No extra compute budget settings

### 3. VersionedTransaction (Not Legacy Transaction)

```typescript
// ✅ CORRECT: VersionedTransaction
const messageV0 = new TransactionMessage({
  payerKey: PAYAI_FEE_PAYER,
  recentBlockhash,
  instructions,
}).compileToV0Message()

const transaction = new VersionedTransaction(messageV0)

// ❌ WRONG: Legacy Transaction
const transaction = new Transaction()
transaction.add(...instructions)
```

ONCHAIN requires VersionedTransaction format for x402 payments.

### 4. Simplified Payload

```typescript
// ✅ CORRECT: Simplified payload
const paymentPayload = {
  x402Version: 1,
  scheme: 'exact',
  network: 'solana',
  payload: {
    transaction: base64Tx  // Just the transaction
  }
}

// ❌ WRONG: Extra fields
const paymentPayload = {
  x402Version: 1,
  scheme: 'exact',
  network: 'solana',
  payload: {
    transaction: base64Tx,
    amount: '...',        // Don't include these
    recipient: '...',     // ONCHAIN extracts from TX
    meta: { ... }         // Extra metadata breaks it
  }
}
```

## Error Handling

### Common Errors

#### 1. Invalid Transaction Instructions Length

```json
{
  "error": "invalid_exact_svm_payload_transaction_instructions_length",
  "expected": 3,
  "actual": 5
}
```

**Cause**: Not using PayAI fee payer → Phantom injects Lighthouse instructions
**Solution**: Use `PAYAI_FEE_PAYER` as transaction fee payer

#### 2. Insufficient USDC Balance

```json
{
  "error": "insufficient_funds",
  "required": "10000",
  "available": "5000"
}
```

**Cause**: User doesn't have enough USDC
**Solution**: Check USDC balance before building transaction

#### 3. Missing USDC ATA

```json
{
  "error": "token_account_not_found",
  "account": "..."
}
```

**Cause**: User doesn't have a USDC associated token account
**Solution**: Create ATA first or show helpful error message

#### 4. Payment Already Settled

```json
{
  "error": "payment_already_settled",
  "txHash": "..."
}
```

**Cause**: Duplicate transaction submission
**Solution**: Implement idempotency checks using transaction hash

### Error Handling Best Practices

```typescript
try {
  // Build transaction
  const transaction = await buildPaymentTransaction(...)

  // Sign transaction
  const signedTx = await signTransaction(transaction)

  // Verify and settle
  const result = await verifyAndSettle(signedTx)

  if (!result.verified) {
    throw new Error('Payment verification failed')
  }

} catch (error) {
  if (error.message.includes('insufficient_funds')) {
    // Show "Insufficient USDC balance" error
  } else if (error.message.includes('user rejected')) {
    // User cancelled in wallet
  } else if (error.message.includes('invalid_exact_svm')) {
    // Transaction format error (check fee payer!)
  } else {
    // Generic error handling
  }
}
```

## Testing

### Test Checklist

**Frontend**:
- [ ] Wallet connection (Phantom, Solflare, Backpack)
- [ ] USDC balance display
- [ ] Transaction building (3 instructions)
- [ ] User signature flow
- [ ] x402 header construction
- [ ] Payment verification UX
- [ ] Error handling (insufficient balance, rejected signature)

**Backend**:
- [ ] 402 response without payment header
- [ ] ONCHAIN API verify call
- [ ] ONCHAIN API settle call
- [ ] Upstream API execution
- [ ] Database updates (facilitator metadata)
- [ ] Redis distributed locking
- [ ] Idempotency checks

**Integration**:
- [ ] End-to-end payment flow
- [ ] Multiple concurrent payments
- [ ] Payment failure scenarios
- [ ] Network error recovery
- [ ] Facilitator failover

### Test Payments

**Devnet**:
```bash
# Get devnet USDC from faucet
# USDC Mint (Devnet): 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
```

**Mainnet** (use small amounts):
```bash
# Test with 0.01 USDC (~$0.01)
```

### Example Test

```typescript
import { test, expect } from '@playwright/test'

test('complete checkout flow', async ({ page }) => {
  // Navigate to checkout
  await page.goto('/checkout?slug=test-blink')

  // Connect wallet (mock Phantom)
  await page.click('button:has-text("Connect Wallet")')
  await page.click('button:has-text("Phantom")')

  // Wait for balance check
  await page.waitForSelector('text=/USDC Balance/')

  // Click pay button
  await page.click('button:has-text("Pay")')

  // Wait for wallet signature prompt (simulated)
  await page.waitForSelector('text=/Sign Transaction/')
  await page.click('button:has-text("Approve")')

  // Wait for settlement
  await page.waitForSelector('text=/Payment Successful/', { timeout: 10000 })

  // Verify API execution
  const result = await page.textContent('[data-test-id="api-result"]')
  expect(result).toBeTruthy()
})
```

## Production Deployment

### Environment Setup

```bash
# Frontend (Vercel/Railway)
NEXT_PUBLIC_SOLANA_RPC_URL=<your-rpc-url>  # Use Helius/QuickNode for reliability
NEXT_PUBLIC_ONCHAIN_API_KEY=<your-key>
NEXT_PUBLIC_APP_URL=https://your-app.com

# Backend (Railway)
ONCHAIN_API_KEY=<your-key>
ONCHAIN_API_URL=https://api.onchain.fi/v1
DATABASE_URL=<postgresql-url>
REDIS_URL=<redis-url>
PORT=3001
```

### Deployment Checklist

- [ ] Environment variables configured
- [ ] Database migration applied (`010_add_x402_payment_fields.sql`)
- [ ] Redis instance connected (required for production)
- [ ] RPC endpoint configured (Helius/QuickNode recommended)
- [ ] ONCHAIN API key valid and funded
- [ ] CORS headers configured for frontend domain
- [ ] SSL/TLS certificates valid
- [ ] Logging and monitoring enabled
- [ ] Error tracking (Sentry/LogRocket)
- [ ] Rate limiting configured

### Performance Optimization

**Frontend**:
```typescript
// Pre-fetch blockhash while user reviews payment
const blockhashPromise = connection.getLatestBlockhash('finalized')

// Pre-fetch user's USDC ATA
const userAtaPromise = getAssociatedTokenAddress(USDC_MINT, user)

// Parallel fetch
const [blockhash, userAta] = await Promise.all([blockhashPromise, userAtaPromise])
```

**Backend**:
```typescript
// Use Redis for idempotency caching
const cachedResult = await redis.get(`payment:${txHash}`)
if (cachedResult) {
  return JSON.parse(cachedResult)
}

// Cache successful payments for 15 minutes
await redis.setex(`payment:${txHash}`, 900, JSON.stringify(result))
```

### Monitoring

**Key Metrics**:
- Payment success rate (target: >95%)
- Average settlement time (target: <3s)
- Facilitator distribution (PayAI, OctonetAI, etc.)
- Error rates by type
- Concurrent payment handling

**Logging**:
```typescript
logger.info('Payment initiated', {
  blink: slug,
  amount: amountUsdc,
  user: payer.toBase58()
})

logger.info('Payment settled', {
  txHash,
  facilitator,
  settlementTime: Date.now() - startTime
})

logger.error('Payment failed', {
  error: error.message,
  blink: slug,
  stage: 'verification' // or 'settlement', 'execution'
})
```

## Troubleshooting

### Issue: Phantom Injects Extra Instructions

**Symptom**: ONCHAIN returns `invalid_exact_svm_payload_transaction_instructions_length`

**Diagnosis**:
```typescript
// Log instruction count before signing
console.log('Instructions before sign:', transaction.message.compiledInstructions.length)

// After signing
console.log('Instructions after sign:', signedTx.message.compiledInstructions.length)
```

**Solution**: Use PayAI fee payer:
```typescript
const PAYAI_FEE_PAYER = new PublicKey("2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4")
```

### Issue: Transaction Expires

**Symptom**: `Transaction expired` error after 1-2 minutes

**Diagnosis**: Blockhash expired before settlement

**Solution**: Use fresh blockhash with 'finalized' commitment:
```typescript
const { blockhash } = await connection.getLatestBlockhash('finalized')
```

### Issue: Payment Verified But Not Settled

**Symptom**: `/v1/verify` succeeds but `/v1/settle` fails

**Diagnosis**: Check ONCHAIN API logs for facilitator errors

**Solution**: Retry settle call with exponential backoff:
```typescript
async function settleWithRetry(paymentHeader, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await settlePayment(paymentHeader)
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await sleep(1000 * Math.pow(2, i))
    }
  }
}
```

### Issue: High Gas Fees

**Symptom**: Users complaining about unexpected SOL fees

**Diagnosis**: Using wrong compute budget settings

**Solution**: Use minimal compute units:
```typescript
ComputeBudgetProgram.setComputeUnitLimit({ units: 40_000 }),  // Low limit
ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }) // Minimal priority
```

With PayAI fee payer, user doesn't pay network fees anyway!

## References

### Official Documentation

- [ONCHAIN API Docs](https://onchain.fi/docs)
- [x402 Protocol Spec](https://github.com/coinbase/x402)
- [Solana Web3.js Docs](https://solana-labs.github.io/solana-web3.js/)
- [SPL Token Docs](https://spl.solana.com/token)

### Code References

- Production Checkout: `apps/web/app/checkout/page.tsx`
- Test Implementation: `apps/web/app/test-onchain/page.tsx`
- Backend Proxy: `apps/api/src/routes/proxy-with-redis.ts`
- ONCHAIN Client: `packages/onchain/src/index.ts`

### Successful Transactions

- First Production TX: `5Uy4DNoVUn6EVH7GRd2kpq9vRVGcdEHoC6yzuAzMYLq372pFFN6PdnNZtDCZbNNHj4Xu5x9feq1JujZa1ji7Cuiw`
- Explorer: https://solscan.io/tx/{signature}

### Community

- ONCHAIN Discord: [Link to Discord]
- Blink402 Issues: https://github.com/yourusername/blink402/issues

---

**Last Updated**: January 11, 2025
**Maintainer**: Blink402 Team
**Status**: Production Ready ✅
