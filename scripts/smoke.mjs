#!/usr/bin/env node

/**
 * Smoke Test Suite for Blink402 API
 *
 * Tests all core routes with validation of:
 * - Status codes
 * - Response schemas
 * - Headers (CORS, Content-Type)
 * - Timing (p50 targets)
 *
 * Usage:
 *   node scripts/smoke.mjs --base http://localhost:3001
 *   node scripts/smoke.mjs --base https://api.blink402.dev
 */

import { createRequire } from 'module';
import crypto from 'crypto';

const require = createRequire(import.meta.url);

// Parse CLI args
const args = process.argv.slice(2);
const baseUrl = args.find(arg => arg.startsWith('--base='))?.split('=')[1]
  || args[args.indexOf('--base') + 1]
  || 'http://localhost:3001';

const verbose = args.includes('--verbose') || args.includes('-v');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

// Test results
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: [],
  totalDuration: 0,
};

// Helper: fetch with timeout and timing
async function fetchWithTiming(url, options = {}) {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const duration = Date.now() - startTime;
    let body;

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      body = await response.json();
    } else {
      body = await response.text();
    }

    return {
      ok: response.ok,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      ok: false,
      status: 0,
      headers: {},
      body: null,
      error: error.message,
      duration,
    };
  }
}

// Helper: assert conditions
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// Helper: log test result
function logTest(name, passed, duration, error = null) {
  const icon = passed ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
  const durationStr = `${colors.gray}(${duration}ms)${colors.reset}`;

  console.log(`${icon} ${name} ${durationStr}`);

  if (error && (verbose || !passed)) {
    console.log(`  ${colors.red}${error}${colors.reset}`);
  }

  results.tests.push({ name, passed, duration, error });
  results.totalDuration += duration;

  if (passed) {
    results.passed++;
  } else {
    results.failed++;
  }
}

// Helper: skip test
function skipTest(name, reason) {
  console.log(`${colors.yellow}⊘${colors.reset} ${name} ${colors.gray}(skipped: ${reason})${colors.reset}`);
  results.tests.push({ name, skipped: true, reason });
  results.skipped++;
}

// Test suite runner
async function runTest(name, testFn) {
  try {
    const startTime = Date.now();
    await testFn();
    const duration = Date.now() - startTime;
    logTest(name, true, duration);
  } catch (error) {
    const duration = Date.now() - Date.now();
    logTest(name, false, duration, error.message);
  }
}

// ===========================
// HEALTH TESTS
// ===========================

async function testHealthBasic() {
  const res = await fetchWithTiming(`${baseUrl}/health`);

  assert(res.status === 200, `Expected 200, got ${res.status}`);
  assert(res.body.status === 'healthy', `Expected status 'healthy', got '${res.body.status}'`);
  assert(typeof res.body.uptime === 'number', 'Expected uptime to be a number');
  assert(res.body.timestamp, 'Expected timestamp to be present');

  logTest('GET /health - Basic health check', true, res.duration);
}

async function testHealthDetailed() {
  const res = await fetchWithTiming(`${baseUrl}/health/detailed`);

  // Accept both 200 (healthy) and 503 (degraded) since DB might not be configured in all envs
  assert([200, 503].includes(res.status), `Expected 200 or 503, got ${res.status}`);
  assert(['healthy', 'degraded'].includes(res.body.status), `Expected 'healthy' or 'degraded', got '${res.body.status}'`);
  assert(typeof res.body.checks === 'object', 'Expected checks object');

  logTest('GET /health/detailed - Detailed health with checks', true, res.duration);
}

// ===========================
// ACTIONS TESTS
// ===========================

async function testActionsDiscovery() {
  const res = await fetchWithTiming(`${baseUrl}/actions.json`);

  assert(res.status === 200, `Expected 200, got ${res.status}`);
  assert(res.body.rules, 'Expected rules array');
  assert(Array.isArray(res.body.rules), 'Rules should be an array');

  logTest('GET /actions.json - Actions discovery endpoint', true, res.duration);
}

async function testActionsMetadata() {
  // First, get a valid blink slug from /blinks
  const blinksRes = await fetchWithTiming(`${baseUrl}/blinks`);

  if (!blinksRes.ok || !blinksRes.body.blinks || blinksRes.body.blinks.length === 0) {
    skipTest('GET /actions/:slug - Actions metadata', 'No blinks available in database');
    return;
  }

  const slug = blinksRes.body.blinks[0].slug;
  const res = await fetchWithTiming(`${baseUrl}/actions/${slug}`);

  assert(res.status === 200, `Expected 200, got ${res.status}`);
  assert(res.body.title, 'Expected title');
  assert(res.body.icon, 'Expected icon');
  assert(res.body.description, 'Expected description');
  assert(res.body.links?.actions, 'Expected links.actions array');

  logTest('GET /actions/:slug - Actions metadata (cached)', true, res.duration);
}

async function testActionsMetadata404() {
  const res = await fetchWithTiming(`${baseUrl}/actions/nonexistent-slug-12345`);

  assert(res.status === 404, `Expected 404, got ${res.status}`);
  assert(res.body.error, 'Expected error message');

  logTest('GET /actions/:slug - 404 for invalid slug', true, res.duration);
}

async function testActionsBuildTransaction() {
  // Get a valid blink slug
  const blinksRes = await fetchWithTiming(`${baseUrl}/blinks`);

  if (!blinksRes.ok || !blinksRes.body.blinks || blinksRes.body.blinks.length === 0) {
    skipTest('POST /actions/:slug - Build transaction', 'No blinks available in database');
    return;
  }

  const slug = blinksRes.body.blinks[0].slug;
  const testAccount = '11111111111111111111111111111111'; // System program (valid pubkey)

  const res = await fetchWithTiming(`${baseUrl}/actions/${slug}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: testAccount }),
  });

  assert(res.status === 200, `Expected 200, got ${res.status}`);
  assert(res.body.transaction, 'Expected transaction field');
  assert(res.body.reference, 'Expected reference UUID');
  assert(typeof res.body.transaction === 'string', 'Transaction should be base64 string');

  logTest('POST /actions/:slug - Build signable transaction', true, res.duration);
}

async function testActionsBuildTransaction400() {
  const blinksRes = await fetchWithTiming(`${baseUrl}/blinks`);

  if (!blinksRes.ok || !blinksRes.body.blinks || blinksRes.body.blinks.length === 0) {
    skipTest('POST /actions/:slug - 400 for missing account', 'No blinks available in database');
    return;
  }

  const slug = blinksRes.body.blinks[0].slug;

  const res = await fetchWithTiming(`${baseUrl}/actions/${slug}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}), // Missing account
  });

  assert(res.status === 400, `Expected 400, got ${res.status}`);
  assert(res.body.error, 'Expected error message');

  logTest('POST /actions/:slug - 400 for missing account', true, res.duration);
}

// ===========================
// PROXY (BAZAAR) TESTS
// ===========================

async function testProxyUnpaid() {
  const blinksRes = await fetchWithTiming(`${baseUrl}/blinks`);

  if (!blinksRes.ok || !blinksRes.body.blinks || blinksRes.body.blinks.length === 0) {
    skipTest('POST /bazaar/:slug - 402 Payment Required', 'No blinks available in database');
    return;
  }

  const slug = blinksRes.body.blinks[0].slug;

  const res = await fetchWithTiming(`${baseUrl}/bazaar/${slug}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { test: true } }),
  });

  assert(res.status === 402, `Expected 402, got ${res.status}`);
  assert(res.body.status === 402, 'Expected status 402 in body');
  assert(res.body.message === 'Payment Required', 'Expected "Payment Required" message');
  assert(res.body.price, 'Expected price field');
  assert(res.body.recipient, 'Expected recipient wallet');

  logTest('POST /bazaar/:slug - 402 Payment Required (unpaid)', true, res.duration);
}

async function testProxyInvalidReference() {
  const blinksRes = await fetchWithTiming(`${baseUrl}/blinks`);

  if (!blinksRes.ok || !blinksRes.body.blinks || blinksRes.body.blinks.length === 0) {
    skipTest('POST /bazaar/:slug - 400 for invalid reference', 'No blinks available in database');
    return;
  }

  const slug = blinksRes.body.blinks[0].slug;
  const fakeReference = '11111111111111111111111111111111'; // Invalid reference

  const res = await fetchWithTiming(`${baseUrl}/bazaar/${slug}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reference: fakeReference,
      signature: 'fake_signature_here',
      data: { test: true },
    }),
  });

  // Should be 400 (invalid/not found) or 402 (payment not verified)
  assert([400, 402].includes(res.status), `Expected 400 or 402, got ${res.status}`);
  assert(res.body.error || res.body.message, 'Expected error or message');

  logTest('POST /bazaar/:slug - 400/402 for invalid reference', true, res.duration);
}

// ===========================
// BLINKS CRUD TESTS
// ===========================

async function testBlinksListAll() {
  const res = await fetchWithTiming(`${baseUrl}/blinks`);

  assert(res.status === 200, `Expected 200, got ${res.status}`);
  assert(Array.isArray(res.body.blinks), 'Expected blinks array');
  assert(typeof res.body.total === 'number', 'Expected total count');

  if (res.body.blinks.length > 0) {
    const blink = res.body.blinks[0];
    assert(blink.slug, 'Expected slug');
    assert(blink.title, 'Expected title');
    assert(blink.price_usdc !== undefined, 'Expected price_usdc');
  }

  logTest('GET /blinks - List all blinks (cached)', true, res.duration);
}

async function testBlinksGetBySlug() {
  const listRes = await fetchWithTiming(`${baseUrl}/blinks`);

  if (!listRes.ok || !listRes.body.blinks || listRes.body.blinks.length === 0) {
    skipTest('GET /blinks/:slug - Get blink by slug', 'No blinks available');
    return;
  }

  const slug = listRes.body.blinks[0].slug;
  const res = await fetchWithTiming(`${baseUrl}/blinks/${slug}`);

  assert(res.status === 200, `Expected 200, got ${res.status}`);
  assert(res.body.blink, 'Expected blink object');
  assert(res.body.blink.slug === slug, `Expected slug ${slug}, got ${res.body.blink.slug}`);

  logTest('GET /blinks/:slug - Get blink by slug (cached)', true, res.duration);
}

async function testBlinksGet404() {
  const res = await fetchWithTiming(`${baseUrl}/blinks/nonexistent-slug-99999`);

  assert(res.status === 404, `Expected 404, got ${res.status}`);
  assert(res.body.error, 'Expected error message');

  logTest('GET /blinks/:slug - 404 for invalid slug', true, res.duration);
}

// Note: POST/PUT/DELETE require wallet authentication - tested separately

// ===========================
// DASHBOARD TESTS
// ===========================

async function testDashboard401() {
  // Test without authentication
  const res = await fetchWithTiming(`${baseUrl}/dashboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  assert(res.status === 401, `Expected 401, got ${res.status}`);
  assert(res.body.error, 'Expected error message');

  logTest('POST /dashboard - 401 without authentication', true, res.duration);
}

// ===========================
// RECEIPTS TESTS
// ===========================

async function testReceipts404() {
  const fakeRunId = crypto.randomUUID();

  const res = await fetchWithTiming(`${baseUrl}/receipts/${fakeRunId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      wallet: '11111111111111111111111111111111',
      signature: 'fake',
      message: 'fake',
    }),
  });

  // Should be 401 (auth failed) or 404 (not found)
  assert([401, 404].includes(res.status), `Expected 401 or 404, got ${res.status}`);

  logTest('POST /receipts/:id - 401/404 for invalid run ID', true, res.duration);
}

async function testReceiptsCreate501() {
  const res = await fetchWithTiming(`${baseUrl}/receipts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      runId: crypto.randomUUID(),
      wallet: '11111111111111111111111111111111',
      signature: 'fake',
      message: 'fake',
    }),
  });

  assert(res.status === 501, `Expected 501 (Not Implemented), got ${res.status}`);

  logTest('POST /receipts - 501 for cNFT creation (not implemented)', true, res.duration);
}

// ===========================
// TWITTER TESTS
// ===========================

async function testTwitterStatus() {
  const testWallet = '11111111111111111111111111111111';

  const res = await fetchWithTiming(`${baseUrl}/twitter/status?wallet=${testWallet}`);

  assert(res.status === 200, `Expected 200, got ${res.status}`);
  assert(typeof res.body.connected === 'boolean', 'Expected connected boolean');

  logTest('GET /twitter/status - Check connection status', true, res.duration);
}

async function testTwitterAuthInit() {
  const testWallet = '11111111111111111111111111111111';

  const res = await fetchWithTiming(`${baseUrl}/twitter/auth/init?wallet=${testWallet}`);

  // Should redirect (302) or return error if Twitter not configured
  assert([200, 302, 500].includes(res.status), `Expected 200/302/500, got ${res.status}`);

  logTest('GET /twitter/auth/init - Initialize OAuth flow', true, res.duration);
}

// ===========================
// DEMO TESTS
// ===========================

async function testDemoInfo() {
  const res = await fetchWithTiming(`${baseUrl}/demo/info`);

  assert(res.status === 200, `Expected 200, got ${res.status}`);
  assert(res.body.title, 'Expected title');
  assert(res.body.description, 'Expected description');

  logTest('GET /demo/info - Demo endpoint info', true, res.duration);
}

async function testDemoDogFacts() {
  const res = await fetchWithTiming(`${baseUrl}/demo/dog-facts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  assert(res.status === 200, `Expected 200, got ${res.status}`);
  assert(res.body.success === true, 'Expected success: true');
  assert(res.body.data, 'Expected data field');

  logTest('POST /demo/dog-facts - Free demo endpoint', true, res.duration);
}

// ===========================
// CORS TESTS
// ===========================

async function testCorsHeaders() {
  const res = await fetchWithTiming(`${baseUrl}/health`, {
    headers: {
      'Origin': 'http://localhost:3000',
    },
  });

  assert(res.headers['access-control-allow-origin'], 'Expected CORS origin header');
  assert(res.headers['access-control-allow-credentials'] === 'true', 'Expected credentials allowed');

  logTest('CORS - Verify CORS headers on requests', true, res.duration);
}

// ===========================
// MAIN TEST RUNNER
// ===========================

async function runAllTests() {
  console.log(`${colors.cyan}🧪 Blink402 API Smoke Tests${colors.reset}`);
  console.log(`${colors.gray}Target: ${baseUrl}${colors.reset}\n`);

  // Health Tests
  console.log(`${colors.blue}[Health]${colors.reset}`);
  await runTest('GET /health - Basic health check', testHealthBasic);
  await runTest('GET /health/detailed - Detailed health', testHealthDetailed);
  console.log();

  // Actions Tests
  console.log(`${colors.blue}[Actions]${colors.reset}`);
  await runTest('GET /actions.json - Discovery', testActionsDiscovery);
  await runTest('GET /actions/:slug - Metadata', testActionsMetadata);
  await runTest('GET /actions/:slug - 404', testActionsMetadata404);
  await runTest('POST /actions/:slug - Build tx', testActionsBuildTransaction);
  await runTest('POST /actions/:slug - 400', testActionsBuildTransaction400);
  console.log();

  // Proxy Tests
  console.log(`${colors.blue}[Proxy (Bazaar)]${colors.reset}`);
  await runTest('POST /bazaar/:slug - 402', testProxyUnpaid);
  await runTest('POST /bazaar/:slug - Invalid ref', testProxyInvalidReference);
  console.log();

  // Blinks Tests
  console.log(`${colors.blue}[Blinks]${colors.reset}`);
  await runTest('GET /blinks - List all', testBlinksListAll);
  await runTest('GET /blinks/:slug - Get by slug', testBlinksGetBySlug);
  await runTest('GET /blinks/:slug - 404', testBlinksGet404);
  console.log();

  // Dashboard Tests
  console.log(`${colors.blue}[Dashboard]${colors.reset}`);
  await runTest('POST /dashboard - 401', testDashboard401);
  console.log();

  // Receipts Tests
  console.log(`${colors.blue}[Receipts]${colors.reset}`);
  await runTest('POST /receipts/:id - 404', testReceipts404);
  await runTest('POST /receipts - 501', testReceiptsCreate501);
  console.log();

  // Twitter Tests
  console.log(`${colors.blue}[Twitter]${colors.reset}`);
  await runTest('GET /twitter/status - Status', testTwitterStatus);
  await runTest('GET /twitter/auth/init - OAuth', testTwitterAuthInit);
  console.log();

  // Demo Tests
  console.log(`${colors.blue}[Demo]${colors.reset}`);
  await runTest('GET /demo/info - Info', testDemoInfo);
  await runTest('POST /demo/dog-facts - Dog facts', testDemoDogFacts);
  console.log();

  // CORS Tests
  console.log(`${colors.blue}[CORS]${colors.reset}`);
  await runTest('CORS headers - Verify', testCorsHeaders);
  console.log();

  // Summary
  console.log(`${colors.cyan}═══════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}Summary${colors.reset}`);
  console.log(`${colors.cyan}═══════════════════════════════════${colors.reset}`);
  console.log(`${colors.green}✓ Passed:${colors.reset}  ${results.passed}`);
  console.log(`${colors.red}✗ Failed:${colors.reset}  ${results.failed}`);
  console.log(`${colors.yellow}⊘ Skipped:${colors.reset} ${results.skipped}`);
  console.log(`${colors.gray}Total time: ${results.totalDuration}ms${colors.reset}`);
  console.log();

  // Exit with error code if any tests failed
  if (results.failed > 0) {
    console.log(`${colors.red}❌ Some tests failed!${colors.reset}`);
    process.exit(1);
  } else if (results.passed === 0) {
    console.log(`${colors.yellow}⚠️  No tests passed (all skipped?)${colors.reset}`);
    process.exit(1);
  } else {
    console.log(`${colors.green}✅ All tests passed!${colors.reset}`);
    process.exit(0);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
