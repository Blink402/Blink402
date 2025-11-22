# x402 Monitoring & Alerts

## Overview

This document defines metrics, logs, and alerts for monitoring the x402 payment pipeline health, particularly focusing on refund operations and payment reliability.

---

## Key Metrics to Track

### 1. Payment Verification Metrics

```
x402_verify_duration_ms
├── p50: Target < 5000ms (5 seconds)
├── p95: Target < 15000ms (15 seconds)
└── p99: Target < 25000ms (25 seconds)
```

**Source:** `apps/api/src/routes/proxy.ts` logs `verifyStartTime` → `Date.now()`

**Alert:** ⚠️ WARNING if p95 > 20s for 5+ minutes
- Indicates Solana RPC congestion or network issues
- May cause timeout errors for users

---

### 2. API Execution Metrics

```
x402_execute_duration_ms
├── p50: Varies by upstream API
├── p95: Target < 25000ms (25 seconds)
└── p99: Target < 30000ms (30 seconds, our timeout)
```

**Source:** `apps/api/src/routes/proxy.ts` logs `executionDuration`

**Alert:** ⚠️ WARNING if p95 > 28s
- Upstream APIs are slow, may hit timeout

---

### 3. Refund Metrics (CRITICAL)

```
x402_refund_issued_count
├── Daily total
└── Per-blink breakdown
```

**Source:** Logs with `event: 'refund_issued'`

**Alert:** 🚨 CRITICAL if daily count > 10
- High refund rate indicates systemic issues
- Check upstream API reliability

```
x402_refund_failed_count
├── Must be 0 in production
└── Per-error-type breakdown
```

**Source:** Logs with `❌ Refund failed`

**Alert:** 🚨 CRITICAL if count > 0
- **Immediate manual intervention required**
- User paid but refund failed - financial impact
- Check platform wallet balance and keypair config

```
x402_refund_duration_ms
├── p50: Target < 3000ms
└── p95: Target < 8000ms
```

**Source:** Logs `refundDurationMs`

**Alert:** ⚠️ WARNING if p95 > 10s
- Refund transactions taking too long
- May indicate Solana network congestion

---

### 4. Success Rate Metrics

```
x402_success_rate
├── Formula: (executed_runs / paid_runs) * 100
├── Target: > 95%
└── Per-blink breakdown
```

**Source:** Query `runs` table
```sql
SELECT
  COUNT(CASE WHEN status = 'executed' THEN 1 END)::float /
  COUNT(CASE WHEN status IN ('paid', 'executed') THEN 1 END) * 100
  as success_rate
FROM runs
WHERE created_at > NOW() - INTERVAL '24 hours'
```

**Alert:** ⚠️ WARNING if < 90% for any blink
- Indicates unreliable upstream API
- May need to pause blink or contact creator

---

### 5. Integrity Checks

```
settle_before_execute_count
├── Must ALWAYS be 0
└── Indicates payment flow bug
```

**Source:** Check for runs where `paid_at` is NOT NULL but `executed_at` IS NULL and status = 'executed'

**Alert:** 🚨 CRITICAL if count > 0
- **Data integrity violation**
- Payment recorded before execution completed
- May indicate race condition or logic bug

```
creator_debt_balance_usdc
├── Sum of unsettled creator debts
├── Per-creator breakdown
└── Monitor for large balances
```

**Source:** Query `creator_debts` table
```sql
SELECT
  c.wallet,
  c.display_name,
  SUM(cd.amount_usdc) as total_debt,
  COUNT(*) as debt_count
FROM creator_debts cd
JOIN creators c ON cd.creator_id = c.id
WHERE cd.settled = false
GROUP BY c.id
ORDER BY total_debt DESC
```

**Alert:** ⚠️ WARNING if any creator debt > $100
- Schedule debt settlement discussion with creator

**Alert:** 🚨 CRITICAL if total platform debt > $1000
- Significant financial exposure
- Prioritize debt collection

---

## Log Patterns to Monitor

### Critical Logs (Always Alert)

```
❌ Refund failed - manual intervention required
```
- **Action:** Immediately check refund status, issue manual refund if needed
- **Context:** Run ID, payer address, error message in logs

```
🚨 CRITICAL: Payment verified on-chain but database update failed
```
- **Action:** Manual reconciliation required
- **Context:** Reference, signature, payer in logs
- **Fix:** Update `runs` table manually with payment details

---

### Warning Logs (Monitor Frequency)

```
Payment verification failed
```
- **Expected:** Occasional failures (user cancelled, insufficient funds)
- **Alert if:** > 20% failure rate
- **Action:** Check if issue is systemic (RPC down, wrong amounts, etc.)

```
API execution failed
```
- **Expected:** Some failures (upstream API down)
- **Alert if:** > 10% failure rate for a blink
- **Action:** Contact creator, may need to pause blink

---

### Info Logs (Track Trends)

```
✅ Refund issued successfully
```
- Track refund frequency per blink
- Identify problematic APIs

```
event: 'x402_execution_failed'
```
- Aggregated execution failures
- Useful for identifying patterns

---

## Recommended Monitoring Stack

### Option 1: Minimal (Free)

**Railway Logs + Manual Checks:**
1. Railway dashboard → Logs tab
2. Filter by: `refund`, `CRITICAL`, `failed`
3. Daily manual check of refund counts
4. Weekly SQL query for creator debts

**Pros:** Zero cost, no setup
**Cons:** Manual, no real-time alerts

---

### Option 2: Intermediate (Low Cost)

**Logtail + SQL Queries:**
1. Stream Railway logs to Logtail (free tier: 1GB/mo)
2. Set up Logtail alerts for:
   - `refund_failed` → Slack/email
   - `CRITICAL` → Slack/email
3. Daily cron job to check creator debts
4. Manual Grafana or Logtail dashboards

**Cost:** Free - $20/month
**Effort:** 2-4 hours setup

---

### Option 3: Production-Grade

**Datadog + PostgreSQL Monitoring:**
1. APM tracing for request latency
2. Log ingestion with pattern matching
3. PostgreSQL query performance monitoring
4. Custom dashboards for x402 metrics
5. PagerDuty integration for critical alerts
6. Anomaly detection for refund spikes

**Cost:** $15-$50/month (startup tier)
**Effort:** 1-2 days setup

---

## Alert Configuration

### Railway Environment Variables

Add these for alert thresholds:
```bash
ALERT_REFUND_FAILED_THRESHOLD=0       # Alert if > 0
ALERT_REFUND_DAILY_THRESHOLD=10       # Alert if > 10/day
ALERT_SUCCESS_RATE_THRESHOLD=90       # Alert if < 90%
ALERT_CREATOR_DEBT_THRESHOLD=100      # Alert if > $100
ALERT_PLATFORM_DEBT_THRESHOLD=1000    # Alert if > $1000
```

---

## Sample Queries for Monitoring

### Daily Refund Report
```sql
SELECT
  DATE(r.created_at) as date,
  COUNT(*) as total_refunds,
  SUM(r.amount_usdc) as total_amount_usdc,
  COUNT(CASE WHEN r.status = 'issued' THEN 1 END) as successful,
  COUNT(CASE WHEN r.status = 'failed' THEN 1 END) as failed,
  COUNT(CASE WHEN r.status = 'pending' THEN 1 END) as pending
FROM refunds r
WHERE r.created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(r.created_at)
ORDER BY date DESC;
```

### Blink Success Rates (Last 24h)
```sql
SELECT
  b.slug,
  b.title,
  COUNT(CASE WHEN r.status = 'executed' THEN 1 END) as executed,
  COUNT(CASE WHEN r.status = 'failed' THEN 1 END) as failed,
  COUNT(CASE WHEN r.status IN ('paid', 'executed', 'failed') THEN 1 END) as total_paid,
  ROUND(
    COUNT(CASE WHEN r.status = 'executed' THEN 1 END)::numeric /
    NULLIF(COUNT(CASE WHEN r.status IN ('paid', 'executed', 'failed') THEN 1 END), 0) * 100,
    2
  ) as success_rate_pct
FROM blinks b
LEFT JOIN runs r ON b.id = r.blink_id AND r.created_at > NOW() - INTERVAL '24 hours'
GROUP BY b.id
HAVING COUNT(CASE WHEN r.status IN ('paid', 'executed', 'failed') THEN 1 END) > 0
ORDER BY success_rate_pct ASC;
```

### Creator Debt Summary
```sql
SELECT
  c.wallet,
  c.display_name,
  COUNT(cd.id) as debt_count,
  SUM(cd.amount_usdc) as total_debt_usdc,
  MIN(cd.created_at) as oldest_debt,
  MAX(cd.created_at) as newest_debt
FROM creator_debts cd
JOIN creators c ON cd.creator_id = c.id
WHERE cd.settled = false
GROUP BY c.id
ORDER BY total_debt_usdc DESC;
```

### Failed Refunds (Requires Immediate Action)
```sql
SELECT
  r.id as refund_id,
  r.run_id,
  run.reference,
  run.signature,
  run.payer,
  r.amount_usdc,
  r.reason,
  r.created_at,
  b.slug as blink_slug
FROM refunds r
JOIN runs run ON r.run_id = run.id
JOIN blinks b ON run.blink_id = b.id
WHERE r.status = 'failed'
ORDER BY r.created_at DESC;
```

---

## Runbook Reference

For operational procedures (how to handle alerts), see:
- [`docs/runbook.md`](../docs/runbook.md) - Step-by-step recovery procedures
- [`docs/x402-hardening.md`](../docs/x402-hardening.md) - Architecture and failure modes

---

## Monitoring Checklist

### Daily (Automated or Manual)
- [ ] Check refund counts (should be < 5/day ideally)
- [ ] Verify no failed refunds (must be 0)
- [ ] Review error logs for patterns
- [ ] Check platform wallet USDC balance (>$500 recommended)

### Weekly
- [ ] Run creator debt summary query
- [ ] Review blink success rates
- [ ] Analyze refund reasons (categorize by error type)
- [ ] Check for any integrity violations (settle_before_execute)

### Monthly
- [ ] Settle creator debts with balances > $50
- [ ] Review overall x402 success rate trends
- [ ] Audit platform wallet transaction history
- [ ] Update refund alert thresholds based on volume

---

## Contact & Escalation

**Critical Issues (Refund Failures):**
1. Check Railway logs immediately
2. Run failed refunds query
3. Issue manual refund via `pnpm refund:manual <run_id>` (TODO: create script)
4. Update `refunds` table status
5. Notify affected user if possible

**Platform Wallet Issues:**
1. Check USDC balance: `solana balance <PLATFORM_WALLET_ADDRESS>`
2. If low, transfer funds from treasury wallet
3. Verify keypair is correct in Railway env vars
4. Test refund transaction on devnet first

**Database Issues:**
1. Check Railway PostgreSQL metrics
2. Review slow query log
3. Check connection pool utilization
4. Scale database if needed (Railway auto-scaling)
