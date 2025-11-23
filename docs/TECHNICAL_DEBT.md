# Technical Debt & TODO Tracking

**Last Updated:** November 23, 2025
**Total TODOs:** 29 (from comprehensive codebase analysis)

## 🔴 Priority P0 - Critical (Security & Functionality)

### ✅ RESOLVED
1. **Authentication for Blink Status Toggle** - FIXED
   - File: `apps/api/src/routes/catalog.ts:161`
   - Status: ✅ Added wallet authentication + ownership verification
   - Commit: [Current session]

2. **Internal API Key Security** - FIXED
   - Files: `apps/api/src/routes/catalog.ts:319,352`
   - Status: ✅ Added X-Internal-API-Key middleware
   - Commit: [Current session]

### ⏳ PENDING
None currently critical.

---

## 🟡 Priority P1 - High (Feature Completion)

### 1. Creator Notifications
**Location:** `apps/api/src/routes/proxy-with-redis.ts` (analysis line 15459)
**Issue:** Creators are not notified when their blinks are used

**Current Code:**
```typescript
// TODO: Notify creator via email/webhook when their blink is executed
```

**Required Action:**
- Implement webhook system for creator notifications
- Add email notification service (optional)
- Store notification preferences in database

**Impact:**
- Creators have no visibility into blink usage
- Reduces platform engagement

**Proposed Solution:**
1. Add `creator_notifications` table with preferences
2. Implement webhook endpoint in proxy route
3. Add email service integration (SendGrid/Resend)

**Acceptance Criteria:**
- [ ] Creators can configure notification preferences
- [ ] Webhooks fire on successful blink execution
- [ ] Email notifications (optional) sent for important events
- [ ] Rate limiting to prevent notification spam

---

### 2. Manual Refund Script
**Location:** Database utilities (analysis line 60138)
**Issue:** No manual refund mechanism for failed transactions

**Current Code:**
```typescript
// TODO: create script for manual refunds
```

**Required Action:**
- Create admin script to process refunds
- Add refund tracking to database
- Implement transaction reversal logic

**Impact:**
- Cannot handle edge cases where users need refunds
- Poor customer support experience

**Proposed Solution:**
1. Create `scripts/admin/process-refund.ts`
2. Add `refunds` table to track refund history
3. Implement Solana transaction reversal
4. Add admin authentication requirement

**Acceptance Criteria:**
- [ ] Script accepts transaction signature + reason
- [ ] Verifies original payment before refunding
- [ ] Records refund in database
- [ ] Sends refund confirmation

---

### 3. Raydium Pool ID Configuration
**Location:** Backend route (analysis line 11626)
**Issue:** Hardcoded pool ID needs dynamic configuration

**Current Code:**
```typescript
// TODO: Get actual pool ID from configuration
const poolId = "PLACEHOLDER"
```

**Required Action:**
- Add `RAYDIUM_POOL_ID` to environment variables
- Update config package
- Fetch pool ID dynamically if possible

**Impact:**
- Feature incomplete (Raydium swaps)
- Cannot use in production

**Proposed Solution:**
1. Add to `packages/config/src/index.ts`
2. Update `.env.example`
3. Document in deployment guide

**Acceptance Criteria:**
- [ ] Pool ID configurable via env var
- [ ] Fallback to API lookup if available
- [ ] Error handling if not configured

---

## 🟢 Priority P2 - Medium (Code Quality)

### 4. Database Modularization
**Location:** `packages/database/src/index.ts:62753`
**Issue:** 900-line file needs to be split into domain modules

**Current Code:**
```typescript
// TODO: Modularize these functions into domain modules
// (e.g., blinks.ts, runs.ts, receipts.ts, creators.ts)
```

**Required Action:**
- Split into modules: `blinks.ts`, `runs.ts`, `receipts.ts`, `creators.ts`, `lottery.ts`
- Create barrel export from `index.ts`
- Update imports across codebase

**Impact:**
- Hard to maintain large file
- Slows down development

**Proposed Solution:**
```
packages/database/src/
├── modules/
│   ├── blinks.ts (already exists - migrate remaining functions)
│   ├── creators.ts (already exists - migrate remaining functions)
│   ├── dashboard.ts (already exists)
│   ├── runs.ts (already exists - migrate remaining functions)
│   ├── rewards.ts (already exists)
│   └── receipts.ts (new - extract receipt functions)
├── index.ts (barrel export)
└── connection.ts (pool management)
```

**Acceptance Criteria:**
- [ ] All functions categorized by domain
- [ ] Barrel export maintains backward compatibility
- [ ] No breaking changes to consumers
- [ ] File sizes < 300 lines each

---

### 5. Test Infrastructure
**Location:** Multiple test placeholders (analysis lines 57530-57540)
**Issue:** Comprehensive test suite not yet implemented

**Current Code:**
```markdown
### Unit Tests (TODO)
### Integration Tests (TODO)
### E2E Tests (TODO)
```

**Required Action:**
- Set up Vitest for unit tests
- Enhance Playwright E2E tests
- Add integration tests for payment flows

**Impact:**
- Higher risk of regressions
- Harder to refactor safely

**Proposed Solution:**
This is part of the planned Phase 5 testing infrastructure:
1. Vitest for shared packages (unit tests)
2. Playwright for critical user flows (already started)
3. k6/Artillery for load testing (Phase 8)

**Acceptance Criteria:**
- [ ] Unit test coverage > 70% for critical packages
- [ ] E2E tests for: catalog, create, checkout, payment flows
- [ ] Load tests for proxy routes
- [ ] CI/CD integration

---

## ⚪ Priority P3 - Low (Documentation & Polish)

### 6. Missing Lottie Animation Files
**Location:** Frontend lottie README (analysis lines 52251-52258)
**Issue:** Documentation references missing animation files

**Required Action:**
- Verify which animations are actually used
- Remove references to unused files
- Update documentation

**Impact:**
- Confusing documentation
- Minor - no functional impact

---

### 7. Database Schema Export
**Location:** Database docs (analysis line 54463)
**Issue:** Need pg_dump v17+ for full schema export

**Current Code:**
```sql
-- TODO: Export full schema with pg_dump v17+
```

**Required Action:**
- Upgrade PostgreSQL to v17 (or use compatible dump tool)
- Generate `schema.sql` from production
- Add to version control

**Impact:**
- Harder to replicate database structure
- Schema drift risk

---

### 8. B402 Token Configuration
**Location:** Multiple placeholders (analysis lines 69878, 69888)
**Issue:** B402 token mint address and decimals need configuration

**Required Action:**
- Add `B402_MINT` to environment variables
- Update config package
- Document in deployment guide

**Impact:**
- B402 token features incomplete

---

## 📊 Statistics

**By Priority:**
- 🔴 P0 (Critical): 2 (both resolved ✅)
- 🟡 P1 (High): 3
- 🟢 P2 (Medium): 2
- ⚪ P3 (Low): 3

**By Category:**
- Security: 2 (both resolved ✅)
- Features: 3
- Code Quality: 2
- Documentation: 3
- Testing: 1

**By Status:**
- ✅ Resolved: 2
- ⏳ In Progress: 0
- 📋 Planned: 8

---

## Next Steps

### Immediate (This Week)
1. Create GitHub issues for P1 items (creator notifications, refunds, Raydium config)
2. Complete Phase 2 refactoring (large file breakdown)

### Short Term (This Month)
1. Implement creator notification system
2. Create manual refund script
3. Database modularization

### Long Term (Next Quarter)
1. Comprehensive test coverage (Phase 5)
2. Performance optimization
3. Documentation updates

---

## How to Contribute

1. Pick a TODO from this list
2. Create a GitHub issue using the TODO template
3. Reference this document in the issue
4. Submit a PR when complete
5. Update this document to mark as resolved

**Issue Template:** `.github/ISSUE_TEMPLATE/todo-tracking.md`
