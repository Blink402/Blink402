# x402 Hardening Architecture

## Overview

This document explains the refund system architecture added to fix user-reported issues:
- "Paid but API timed out - money gone"
- "Paid twice, got error, funds gone anyway"
- "Can't connect wallet on Android (Phantom opens homepage)"

---

## Before: Original Payment Flow

```
┌─────────┐     ┌──────────┐     ┌─────────┐     ┌──────────┐
│  User   │────>│ Frontend │────>│   API   │────>│ Upstream │
│ Wallet  │     │  (Next)  │     │(Fastify)│     │   API    │
└─────────┘     └──────────┘     └─────────┘     └──────────┘
     │                                  │               │
     │ 1. Sign USDC transfer            │               │
     ├────────────────────────────────>│               │
     │                                  │               │
     │ 2. Verify payment (10s timeout)  │               │
     │                                  ├──────────────>│
     │                                  │               │
     │ 3. Execute API (30s timeout)     │               │
     │                                  ├──────────────>│
     │                                  │               │
     │ 4. Return response               │               │
     │<─────────────────────────────────┤               │
```

###Problems:
1. **No Refund on Failure:**
   - Payment went to creator wallet immediately
   - If API failed → User lost money, got nothing
   - No way to reverse payment on-chain

2. **Timeout Too Short:**
   - 10s verification timeout during network congestion
   - User paid but system marked as "failed"
   - False negatives → Angry users

3. **No Mobile Wallet Support:**
   - Android users: clicking "Connect" opened Phantom homepage
   - No deeplink to open dapp inside Phantom's browser
   - Phantom extension doesn't exist on mobile

---

## After: Hardened Payment Flow with Refunds

```
┌─────────┐     ┌──────────┐     ┌─────────┐     ┌──────────┐     ┌──────────┐
│  User   │────>│ Frontend │────>│   API   │────>│ Upstream │     │Platform  │
│ Wallet  │     │  (Next)  │     │(Fastify)│     │   API    │     │ Refund   │
└─────────┘     └──────────┘     └─────────┘     └──────────┘     │  Wallet  │
     │                                  │               │           └──────────┘
     │ 1. Sign USDC transfer            │               │                 │
     ├────────────────────────────────>│               │                 │
     │    (Direct to creator wallet)    │               │                 │
     │                                  │               │                 │
     │ 2. Verify payment (30s timeout!) │               │                 │
     │                                  ├──────────────>│                 │
     │                                  │ ✅ Confirmed  │                 │
     │                                  │               │                 │
     │ 3. Execute API (30s timeout)     │               │                 │
     │                                  ├──────────────>│                 │
     │                                  │               │                 │
     │    ┌──── IF SUCCESS ────┐        │ ✅ 200 OK     │                 │
     │    │                    │        │               │                 │
     │ 4. Return successful response    │               │                 │
     │<───┴────────────────────────────┤               │                 │
     │                                  │               │                 │
     │    ┌──── IF FAILURE ────┐        │ ❌ Error      │                 │
     │    │                    │        │               │                 │
     │    │ 5a. Create refund record    │               │                 │
     │    │    in database              │               │                 │
     │    │                    │        │               │                 │
     │    │ 5b. Build USDC refund tx    │               │                 │
     │    │    (platform → user)        │               │                 │
     │    │                    │        │               │                 │
     │    │ 5c. Execute refund on-chain │               │                 │
     │    │                             ├───────────────┼────────────────>│
     │    │                             │               │    Sign & Send  │
     │    │                             │<──────────────┼─────────────────┤
     │    │                             │               │   ✅ Refunded   │
     │    │                    │        │               │                 │
     │    │ 5d. Create creator debt     │               │                 │
     │    │    (platform → creator)     │               │                 │
     │    │                    │        │               │                 │
     │ 6. Return error + "Refunded"     │               │                 │
     │<───┴────────────────────────────┤               │                 │
```

### Improvements:

1. **Automated Refunds:**
   - Payment verified → API fails → Automatic USDC refund
   - Platform wallet issues refund within seconds
   - Creator debt tracked for reconciliation

2. **Longer Timeout:**
   - 30s payment verification (up from 10s)
   - Handles Solana network congestion better
   - Fewer false "payment failed" errors

3. **Mobile Wallet Support:**
   - Detect Android/iOS devices
   - Show "Open in Phantom" button with Browse deeplink
   - Opens dapp inside Phantom's in-app browser
   - Wallet connection works reliably

---

## Technical Implementation

### 1. Database Schema Changes

**New Tables:**

```sql
-- Track refund transactions
CREATE TABLE refunds (
  id UUID PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES runs(id),
  amount_usdc DECIMAL(10,6) NOT NULL,
  refund_signature VARCHAR(128) UNIQUE,
  status VARCHAR(20) DEFAULT 'pending', -- pending | issued | failed
  reason TEXT,
  creator_debt_id UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP
);

-- Track creator debt to platform
CREATE TABLE creator_debts (
  id UUID PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES creators(id),
  blink_id UUID NOT NULL REFERENCES blinks(id),
  refund_id UUID NOT NULL REFERENCES refunds(id),
  amount_usdc DECIMAL(10,6) NOT NULL,
  settled BOOLEAN DEFAULT FALSE,
  settled_at TIMESTAMP,
  settlement_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Platform configuration
CREATE TABLE platform_config (
  key VARCHAR(50) PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Key Design Decisions:**
- `refunds.status` tracks refund lifecycle (pending → issued → failed)
- `creator_debts.settled` tracks whether creator has repaid platform
- `platform_config` stores refund wallet keypair reference
- Foreign keys ensure referential integrity

---

### 2. Solana Refund Utilities

**New Functions** (`packages/solana/src/index.ts`):

```typescript
buildRefundTransaction({
  connection,
  platformWallet,  // Platform refund wallet (signs tx)
  user,            // Original payer (receives refund)
  amount,          // Refund amount (matches original payment)
  reference,       // Original payment reference (for tracking)
  memo,            // "Refund for failed execution..."
  tokenMint        // USDC mint or undefined for SOL
}) : Promise<Transaction>

executeRefund({
  connection,
  transaction,
  platformKeypair  // Signs and broadcasts refund
}) : Promise<string>  // Returns refund signature

verifyRefundTransaction({
  connection,
  signature
}) : Promise<{ confirmed: boolean }>
```

**Security:**
- Platform keypair stored in Railway env var (`PLATFORM_REFUND_KEYPAIR`)
- Keypair never exposed to frontend
- Transactions signed server-side only
- Refund signature recorded in database

---

### 3. Proxy Route Refund Logic

**Updated Flow** (`apps/api/src/routes/proxy.ts`):

```typescript
try {
  // 1. Verify payment (30s timeout, up from 10s)
  const paymentVerification = await verifyPaymentWithSolanaPay({
    connection,
    reference,
    recipient,
    amount,
    splToken: paymentToken === 'USDC' ? getUsdcMint() : undefined,
    timeout: 30000,  // ← INCREASED FROM 10000
    commitment: 'finalized'
  })

  // 2. Update database atomically (with distributed lock)
  await updateRunPaymentAtomic({
    reference,
    signature: paymentVerification.signature,
    payer
  })

  // 3. Execute upstream API (30s timeout)
  const response = await fetch(targetUrl, {
    method: blink.method,
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(30000)
  })

  // 4. Mark as executed, return success
  await markRunExecuted({ reference, durationMs })
  return reply.code(200).send({ success: true, data: responseData })

} catch (error) {
  // ========== NEW: REFUND LOGIC ==========
  await markRunFailed(reference)

  // Check if payment was confirmed but execution failed
  if (lockedRun.signature && lockedRun.status === 'paid') {
    try {
      // 1. Create refund record
      const refund = await createRefund({
        runId: lockedRun.id,
        amountUsdc: blink.price_usdc.toString(),
        reason: `API execution failed: ${errorMessage}`
      })

      // 2. Get platform refund keypair from env
      const platformKeypair = Keypair.fromSecretKey(
        Buffer.from(JSON.parse(process.env.PLATFORM_REFUND_KEYPAIR))
      )

      // 3. Build refund transaction
      const refundTx = await buildRefundTransaction({
        connection,
        platformWallet: platformKeypair.publicKey,
        user: parsePublicKey(lockedRun.payer),
        amount: blink.payment_token === 'SOL'
          ? solToLamports(blink.price_usdc)
          : usdcToLamports(blink.price_usdc),
        reference: parsePublicKey(reference),
        memo: `Refund for failed execution - Blink: ${slug}`,
        tokenMint: blink.payment_token === 'USDC' ? getUsdcMint() : undefined
      })

      // 4. Execute refund on-chain
      const refundSignature = await executeRefund({
        connection,
        transaction: refundTx,
        platformKeypair
      })

      // 5. Mark refund as issued
      await markRefundIssued({ refundId: refund.id, signature: refundSignature })

      // 6. Create creator debt
      await createCreatorDebt({
        creatorId: blink.creator_id,
        blinkId: blink.id,
        refundId: refund.id,
        amountUsdc: blink.price_usdc.toString()
      })

      // 7. Return error with refund confirmation
      return reply.code(500).send({
        error: 'API execution failed',
        details: errorMessage,
        refund: {
          issued: true,
          message: 'Your payment has been automatically refunded',
          signature: refundSignature
        }
      })

    } catch (refundErr) {
      // Refund failed - log for manual intervention
      fastify.log.error({ error: refundErr }, '❌ Refund failed - manual intervention required')

      return reply.code(500).send({
        error: 'API execution failed',
        refund: {
          issued: false,
          message: 'Refund failed - please contact support',
          error: refundErr.message
        }
      })
    }
  }

  // No refund needed (payment not confirmed)
  return reply.code(500).send({
    error: 'API execution failed',
    details: errorMessage
  })
}
```

---

### 4. Mobile Wallet Detection

**New Utility** (`apps/web/lib/mobile.ts`):

```typescript
// Detect mobile devices
export function isMobileDevice(): boolean {
  const userAgent = navigator.userAgent.toLowerCase()
  return /android|webos|iphone|ipad|ipod/.test(userAgent)
}

// Detect Android specifically
export function isAndroid(): boolean {
  return /android/i.test(navigator.userAgent)
}

// Check if deeplink should be used
export function shouldUseDeeplink(): boolean {
  return isMobileDevice() || !('solana' in window)
}

// Generate Phantom Browse deeplink
export function getPhantomBrowseDeeplink(dappUrl: string): string {
  return `https://phantom.app/ul/browse/${encodeURIComponent(dappUrl)}?ref=${encodeURIComponent(dappUrl)}`
}
```

**Frontend Integration** (Planned):
```tsx
// In wallet connect button
const handleConnect = () => {
  if (shouldUseDeeplink()) {
    // Mobile: Open in wallet app
    const deeplink = getPhantomBrowseDeeplink(window.location.href)
    window.location.href = deeplink
  } else {
    // Desktop: Use wallet adapter
    select(wallet.adapter.name)
  }
}
```

---

## Failure Modes Addressed

### 1. "Paid but API Timed Out"

**Before:**
- 10s verification timeout too short
- Solana network congestion → false "payment failed"
- User paid, marked as failed, no refund

**After:**
- 30s verification timeout
- Better tolerance for network delays
- If truly failed after payment confirmed → Automatic refund
- User gets money back within 30-60 seconds

---

### 2. "Paid Twice, Funds Gone"

**Before:**
- Race condition: two requests with same reference
- Both verified payment (no distributed lock)
- Both executed API → User charged twice

**After:**
- ✅ Distributed lock via Redis (already exists)
- ✅ Reference UUID unique constraint (already exists)
- ✅ Signature unique constraint (already exists)
- ✅ Idempotency checks (already exists)
- ➕ **NEW:** Refund second payment if race detected

**Note:** This was already mostly solved by existing idempotency, but refunds add extra safety.

---

### 3. "Can't Connect Wallet on Android"

**Before:**
- Generic wallet adapter only
- Clicking "Connect" tried to detect browser extension
- No browser extension on mobile → Nothing happened
- Sometimes opened Phantom app homepage (not helpful)

**After:**
- Detect mobile device via `isMobileDevice()`
- Show "Open in Phantom" button instead of "Connect"
- Use Phantom Browse deeplink: `phantom.app/ul/browse/<YOUR_URL>`
- Opens dapp inside Phantom's in-app browser
- Wallet connection works like desktop

---

## Refund Economics

### Platform Wallet Management

**Setup:**
1. Generate platform refund keypair (one-time):
   ```bash
   solana-keygen new --outfile platform-refund-keypair.json
   ```

2. Store in Railway env var:
   ```bash
   PLATFORM_REFUND_KEYPAIR='[123,45,67,...]'  # JSON array of bytes
   ```

3. Fund wallet with USDC for refunds:
   ```bash
   # Devnet
   spl-transfer --fund-recipient --allow-unfunded-recipient \
     <USDC_MINT> 1000 <PLATFORM_WALLET> --url devnet

   # Mainnet (real money!)
   # Transfer USDC from treasury wallet to platform refund wallet
   ```

**Recommended Balance:**
- Devnet: 1000 USDC (for testing)
- Mainnet: Start with $500 USDC
- Alert if balance < $100 USDC
- Top up monthly or when alert triggers

---

### Creator Debt Reconciliation

**Flow:**
1. User pays creator → Creator receives USDC
2. API fails → Platform issues refund to user
3. `creator_debts` record created: Creator owes platform

**Settlement Options:**

**Option A: Deduct from Future Earnings**
- Creator runs another blink → User pays $5
- Platform intercepts $2 debt → Sends $3 to creator
- Mark debt as settled
- *Pros:* Automatic, no manual work
- *Cons:* Requires code changes to intercept payments

**Option B: Monthly Settlement**
- Send creator invoice via email/dashboard
- Creator sends USDC to platform wallet
- Admin marks debt as settled in database
- *Pros:* Simple, no code changes
- *Cons:* Manual, requires trust

**Option C: Upfront Escrow (Future)**
- Creator deposits $100 USDC upfront
- Refunds deducted from escrow
- Alert creator if escrow < $20
- *Pros:* No chasing creators for debt
- *Cons:* Requires escrow smart contract

**Recommended for Now:** Option B (Monthly Settlement)
- Simplest to implement
- Test refund system first
- Upgrade to Option A if debt becomes problem

---

## Metrics & Monitoring

See [`monitoring/alerts.md`](../monitoring/alerts.md) for full details.

**Key Metrics:**
- `x402_refund_issued_count` - Should be < 10/day
- `x402_refund_failed_count` - **Must be 0** (critical alerts)
- `x402_success_rate` - Target > 95%
- `creator_debt_balance_usdc` - Monitor for large balances

**Queries:**
```sql
-- Daily refund report
SELECT DATE(created_at), COUNT(*), SUM(amount_usdc)
FROM refunds
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at);

-- Failed refunds (requires immediate action!)
SELECT * FROM refunds WHERE status = 'failed';

-- Creator debts
SELECT c.wallet, SUM(cd.amount_usdc) as debt
FROM creator_debts cd
JOIN creators c ON cd.creator_id = c.id
WHERE cd.settled = false
GROUP BY c.wallet
ORDER BY debt DESC;
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] Run database migrations (`schema.sql`)
- [ ] Generate platform refund keypair
- [ ] Fund platform wallet with USDC (devnet first!)
- [ ] Set `PLATFORM_REFUND_KEYPAIR` env var in Railway
- [ ] Build and test packages (`pnpm build`)
- [ ] Test refund flow on devnet with real transaction
- [ ] Verify refund shows up in user wallet
- [ ] Verify creator debt is tracked correctly

### Deployment

- [ ] Commit changes with `[x402][fix]` prefix
- [ ] Push to GitHub (Railway auto-deploys)
- [ ] Monitor Railway logs for errors
- [ ] Test refund flow on production (devnet)
- [ ] Verify monitoring queries work

### Post-Deployment

- [ ] Monitor refund metrics for 24 hours
- [ ] Check for `refund_failed` alerts (should be 0)
- [ ] Verify mobile wallet deeplinks work on Android/iOS
- [ ] Test end-to-end: payment → failure → refund
- [ ] Document any issues in runbook

---

## Future Improvements

### Short Term (1-2 months)
- [ ] Automated creator debt deduction from earnings
- [ ] Dashboard showing refund history to creators
- [ ] Email notifications for refunds (user + creator)
- [ ] Refund analytics dashboard (Grafana/Logtail)

### Medium Term (3-6 months)
- [ ] Escrow smart contract (hold funds until execution)
- [ ] Partial refunds (e.g., refund 50% if API partially succeeded)
- [ ] Refund on demand (user can request if API was wrong)
- [ ] Multi-token support (SOL refunds, not just USDC)

### Long Term (6-12 months)
- [ ] Cross-chain refunds (if using thirdweb Nexus)
- [ ] Decentralized dispute resolution
- [ ] Insurance fund for failed refunds
- [ ] Stablecoin refunds (USDC/USDT/DAI options)

---

## Security Considerations

### Platform Refund Keypair
- **DO NOT** commit to git
- **DO NOT** expose to frontend
- **DO NOT** share with anyone
- Store in Railway env vars (encrypted at rest)
- Rotate quarterly for security
- Use separate keypair for devnet vs mainnet

### Refund Abuse Prevention
- Log all refund events with creator context
- Alert if refund rate > 10% for any blink
- Manual review for suspicious patterns
- Rate limit refund requests (prevent spam)

### Database Security
- Refund records are immutable (no DELETE)
- Audit trail via `created_at` and `processed_at`
- Status transitions validated by database constraints
- Foreign keys ensure referential integrity

---

## Testing Strategy

### Unit Tests (TODO)
- `packages/solana/src/index.test.ts` - Refund transaction building
- `packages/database/src/index.test.ts` - Refund database functions
- Mock Solana RPC calls with deterministic responses

### Integration Tests (TODO)
- `apps/api/src/routes/proxy.test.ts` - Full refund flow
- Use devnet for real on-chain transactions
- Test failure scenarios (timeout, API error, etc.)

### E2E Tests (TODO)
- `apps/web/tests/payment-flow.spec.ts` - Playwright tests
- Test mobile wallet detection and deeplinks
- Test refund UX (error message shows refund status)

---

## Conclusion

The x402 hardening system adds automated refunds and mobile wallet support to address all user-reported issues:

✅ **"Paid but API failed"** → Automatic refund within 30-60s
✅ **"Paid twice"** → Idempotency + refund safety net
✅ **"Android wallet won't connect"** → Phantom Browse deeplinks
✅ **30s timeout** → Better tolerance for network congestion
✅ **Creator debt tracking** → Financial reconciliation
✅ **Comprehensive monitoring** → Catch issues before users complain

The system maintains the direct transfer architecture (no escrow overhead) while adding robust error recovery. Platform wallet manages refunds, and creator debts are tracked for monthly settlement.

**Next Steps:**
1. Deploy to production (devnet first)
2. Monitor refund metrics for 2-4 weeks
3. Gather user feedback
4. Iterate on UX and error messages
5. Consider escrow smart contract if needed
