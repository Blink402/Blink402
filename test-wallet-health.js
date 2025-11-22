#!/usr/bin/env node

/**
 * Comprehensive Wallet Health Checker Test Suite
 *
 * Tests:
 * 1. Spam detection with various token patterns
 * 2. B402 tier detection and feature gating
 * 3. API response structure validation
 * 4. Edge cases (no tokens, only NFTs, etc.)
 */

const API_URL = process.env.API_URL || 'https://blink402-production.up.railway.app';

// Known mainnet wallets for testing (public addresses only)
const TEST_WALLETS = {
  // Wallet with typical spam (airdrops, dust tokens)
  SPAMMY_WALLET: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', // Random mainnet wallet likely to have spam

  // Wallet with minimal activity (likely clean)
  CLEAN_WALLET: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',

  // Known B402 holder (if available) - replace with actual holder
  B402_HOLDER: 'REPLACE_WITH_ACTUAL_B402_HOLDER', // Need to find from token holder list

  // Empty/new wallet (SOL only, no tokens)
  SOL_ONLY: 'GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7npE', // Example, may need to replace
};

// Test cases
const SPAM_PATTERNS = {
  FREEZE_AUTHORITY: {
    name: 'Freeze Authority Test',
    token: {
      mint: 'TestMint123',
      symbol: 'SCAM',
      name: 'Free Airdrop Token',
      decimals: 9,
      uiAmount: 1000000,
      usdValue: 0.005,
      metadata: {
        freezeAuthority: '11111111111111111111111111111112', // Non-null = red flag
        mintAuthority: null,
      }
    },
    expectedFlags: ['Freeze authority not removed'],
    expectedRisk: 'critical',
  },

  LOW_VALUE_SPAM: {
    name: 'Low USD Value Spam',
    token: {
      mint: 'DustToken123',
      symbol: 'DUST',
      name: 'Claim Your Prize',
      decimals: 6,
      uiAmount: 1000000,
      usdValue: 0.0001, // < $0.01
    },
    expectedFlags: ['Extremely low USD value'],
    expectedRisk: 'low',
  },

  SCAM_KEYWORDS: {
    name: 'Scam Keywords Test',
    token: {
      mint: 'ScamToken123',
      symbol: 'FREE',
      name: 'FREE AIRDROP CLAIM NOW',
      decimals: 9,
      uiAmount: 100000,
      usdValue: 0.05,
    },
    expectedFlags: ['Contains scam keywords'],
    expectedRisk: 'high',
  },

  MISSING_METADATA: {
    name: 'Missing Metadata Test',
    token: {
      mint: 'UnknownToken123',
      decimals: 9,
      uiAmount: 500,
      usdValue: 0.1,
      // No name or symbol
    },
    expectedFlags: ['Missing token metadata'],
    expectedRisk: 'medium',
  },

  SUSPICIOUS_DECIMALS: {
    name: 'Unusual Decimals Test',
    token: {
      mint: 'WeirdToken123',
      symbol: 'WEIRD',
      name: 'Weird Token',
      decimals: 18, // > 9 is unusual for Solana
      uiAmount: 1000,
      usdValue: 1.0,
    },
    expectedFlags: ['Unusual decimal count'],
    expectedRisk: 'low',
  },

  ZERO_BALANCE: {
    name: 'Zero Balance Spam',
    token: {
      mint: 'ZeroToken123',
      symbol: 'ZERO',
      name: 'Congratulations Winner',
      decimals: 9,
      uiAmount: 0, // Zero balance = dust spam
      usdValue: 0,
    },
    expectedFlags: ['Zero balance'],
    expectedRisk: 'low',
  },

  LONG_SYMBOL: {
    name: 'Long Symbol Test',
    token: {
      mint: 'LongSymbolToken123',
      symbol: 'VERYLONGSYMBOLNAME', // > 10 chars
      name: 'Suspicious Token',
      decimals: 9,
      uiAmount: 100,
      usdValue: 0.5,
    },
    expectedFlags: ['Abnormally long symbol'],
    expectedRisk: 'low',
  },

  SPECIAL_CHARS: {
    name: 'Special Characters Test',
    token: {
      mint: 'SpecialToken123',
      symbol: 'SC@M!', // Special chars
      name: 'Scam Token',
      decimals: 9,
      uiAmount: 1000,
      usdValue: 1.0,
    },
    expectedFlags: ['Symbol contains special characters'],
    expectedRisk: 'low',
  },

  LEGITIMATE_TOKEN: {
    name: 'Legitimate Token (B402)',
    token: {
      mint: 'B402Mint123',
      symbol: 'B402',
      name: 'Blink402 Token',
      decimals: 9,
      uiAmount: 10000,
      usdValue: 100.0,
    },
    expectedFlags: [],
    expectedRisk: 'low',
    expectedSpam: false,
  },
};

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(80));
  log(title, 'cyan');
  console.log('='.repeat(80) + '\n');
}

async function testSpamDetection() {
  logSection('TEST 1: Spam Detection Heuristics (Unit Tests)');

  // Import spam detector directly
  const { detectSpamToken } = require('./packages/solana/dist/spam-detector.js');

  let passed = 0;
  let failed = 0;

  for (const [key, testCase] of Object.entries(SPAM_PATTERNS)) {
    console.log(`\n${colors.blue}Testing: ${testCase.name}${colors.reset}`);
    console.log(`${colors.gray}Token: ${testCase.token.name} (${testCase.token.symbol})${colors.reset}`);

    try {
      const result = detectSpamToken(testCase.token);

      // Validate results
      const expectedSpam = testCase.expectedSpam !== undefined ? testCase.expectedSpam : true;
      const spamMatch = result.isSpam === expectedSpam;
      const riskMatch = result.riskLevel === testCase.expectedRisk || testCase.expectedRisk === undefined;

      // Check if expected flags are present
      let flagsMatch = true;
      if (testCase.expectedFlags && testCase.expectedFlags.length > 0) {
        for (const expectedFlag of testCase.expectedFlags) {
          if (!result.flags.some(f => f.includes(expectedFlag))) {
            flagsMatch = false;
            break;
          }
        }
      }

      const success = spamMatch && riskMatch && flagsMatch;

      if (success) {
        log(`✓ PASS`, 'green');
        passed++;
      } else {
        log(`✗ FAIL`, 'red');
        failed++;
      }

      // Display results
      console.log(`  isSpam: ${result.isSpam} (expected: ${expectedSpam}) ${spamMatch ? '✓' : '✗'}`);
      console.log(`  riskLevel: ${result.riskLevel} (expected: ${testCase.expectedRisk}) ${riskMatch ? '✓' : '✗'}`);
      console.log(`  confidence: ${result.confidence}%`);
      console.log(`  flags (${result.flags.length}):`);
      result.flags.forEach(flag => console.log(`    - ${flag}`));

      if (!flagsMatch) {
        log(`  ✗ Missing expected flags: ${testCase.expectedFlags.join(', ')}`, 'red');
      }

    } catch (error) {
      log(`✗ ERROR: ${error.message}`, 'red');
      failed++;
    }
  }

  console.log('\n' + '-'.repeat(80));
  log(`Unit Tests: ${passed} passed, ${failed} failed`, passed === Object.keys(SPAM_PATTERNS).length ? 'green' : 'red');
}

async function testWalletAnalysisAPI(wallet, expectedTier = 'NONE') {
  console.log(`\n${colors.blue}Testing wallet: ${wallet}${colors.reset}`);
  console.log(`${colors.gray}Expected tier: ${expectedTier}${colors.reset}`);

  const startTime = Date.now();

  try {
    const response = await fetch(`${API_URL}/wallet-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet }),
    });

    const duration = Date.now() - startTime;
    const data = await response.json();

    if (!response.ok) {
      log(`✗ API Error (${response.status}): ${data.error || data.message}`, 'red');
      return { success: false, error: data.error };
    }

    log(`✓ API Response (${duration}ms)`, 'green');

    // Validate response structure
    const required = ['success', 'data', 'duration_ms'];
    const dataRequired = ['wallet', 'solBalance', 'tokens', 'transactionSummary', 'nftCount', 'analyzedAt'];

    let structureValid = true;
    for (const field of required) {
      if (!(field in data)) {
        log(`  ✗ Missing field: ${field}`, 'red');
        structureValid = false;
      }
    }

    for (const field of dataRequired) {
      if (!(field in data.data)) {
        log(`  ✗ Missing data field: ${field}`, 'red');
        structureValid = false;
      }
    }

    if (structureValid) {
      log(`  ✓ Response structure valid`, 'green');
    }

    // Display wallet stats
    console.log(`\n  Wallet Stats:`);
    console.log(`    SOL Balance: ${data.data.solBalance?.toFixed(3)} SOL`);
    console.log(`    SOL USD Value: $${data.data.solUsdValue?.toFixed(2) || 'N/A'}`);
    console.log(`    Tokens: ${data.data.tokens?.length || 0}`);
    console.log(`    NFTs: ${data.data.nftCount}`);
    console.log(`    Transactions: ${data.data.transactionSummary?.totalTransactions || 0}`);

    // Check B402 tier
    if (data.data.b402) {
      console.log(`\n  B402 Tier:`);
      console.log(`    Tier: ${data.data.b402.tier}`);
      console.log(`    Balance: ${data.data.b402.balance.toLocaleString()} B402`);
      console.log(`    Features:`);
      console.log(`      Spam Detection: ${data.data.b402.features.spamDetection ? '✓' : '✗'}`);
      console.log(`      Portfolio Health: ${data.data.b402.features.portfolioHealth ? '✓' : '✗'}`);
      console.log(`      Rug Pull Detection: ${data.data.b402.features.rugPullDetection ? '✓' : '✗'}`);
      console.log(`      AI Insights: ${data.data.b402.features.aiInsights ? '✓' : '✗'}`);

      const tierMatch = data.data.b402.tier === expectedTier;
      if (tierMatch) {
        log(`  ✓ Tier matches expected: ${expectedTier}`, 'green');
      } else {
        log(`  ✗ Tier mismatch: got ${data.data.b402.tier}, expected ${expectedTier}`, 'yellow');
      }
    }

    // Check spam detection results
    if (data.data.tokens && data.data.tokens.length > 0) {
      const spamTokens = data.data.tokens.filter(t => t.spamDetection?.isSpam);
      console.log(`\n  Spam Detection:`);
      console.log(`    Total tokens: ${data.data.tokens.length}`);
      console.log(`    Spam tokens: ${spamTokens.length}`);

      if (spamTokens.length > 0) {
        console.log(`\n  Top 3 Spam Tokens:`);
        spamTokens.slice(0, 3).forEach((token, idx) => {
          console.log(`    ${idx + 1}. ${token.symbol || 'UNKNOWN'} - ${token.name || 'N/A'}`);
          console.log(`       Risk: ${token.spamDetection.riskLevel} (${token.spamDetection.confidence}% confidence)`);
          console.log(`       Flags: ${token.spamDetection.flags.slice(0, 2).join(', ')}`);
        });
      }

      // Check if spam detection field exists on tokens (should be present for BRONZE+)
      const hasSpamDetection = data.data.tokens.some(t => t.spamDetection !== undefined);
      const expectedSpamDetection = expectedTier !== 'NONE';

      if (hasSpamDetection === expectedSpamDetection) {
        log(`  ✓ Spam detection ${expectedSpamDetection ? 'enabled' : 'disabled'} as expected`, 'green');
      } else {
        log(`  ✗ Spam detection should be ${expectedSpamDetection ? 'enabled' : 'disabled'} for ${expectedTier} tier`, 'yellow');
      }
    } else {
      console.log(`\n  No tokens in wallet (spam detection N/A)`);
    }

    return { success: true, data: data.data };

  } catch (error) {
    log(`✗ Request failed: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function testWalletAnalysis() {
  logSection('TEST 2: Wallet Analysis API (Integration Tests)');

  // Test clean wallet (likely FREE tier)
  await testWalletAnalysisAPI(TEST_WALLETS.CLEAN_WALLET, 'NONE');

  // Test spammy wallet (likely FREE tier)
  await testWalletAnalysisAPI(TEST_WALLETS.SPAMMY_WALLET, 'NONE');

  // Test B402 holder (if address available)
  if (TEST_WALLETS.B402_HOLDER !== 'REPLACE_WITH_ACTUAL_B402_HOLDER') {
    await testWalletAnalysisAPI(TEST_WALLETS.B402_HOLDER, 'BRONZE'); // Adjust tier as needed
  } else {
    log('\nℹ B402 holder test skipped (no address configured)', 'yellow');
  }
}

async function testEdgeCases() {
  logSection('TEST 3: Edge Cases');

  // Test invalid wallet address
  console.log(`\n${colors.blue}Testing: Invalid wallet address${colors.reset}`);
  const invalidResponse = await fetch(`${API_URL}/wallet-analysis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet: 'invalid-address' }),
  });

  if (invalidResponse.status === 400) {
    log(`✓ Invalid address rejected (400)`, 'green');
  } else {
    log(`✗ Expected 400, got ${invalidResponse.status}`, 'red');
  }

  // Test missing wallet parameter
  console.log(`\n${colors.blue}Testing: Missing wallet parameter${colors.reset}`);
  const missingResponse = await fetch(`${API_URL}/wallet-analysis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  if (missingResponse.status === 400) {
    log(`✓ Missing wallet rejected (400)`, 'green');
  } else {
    log(`✗ Expected 400, got ${missingResponse.status}`, 'red');
  }
}

async function main() {
  log('\n╔══════════════════════════════════════════════════════════════════════════════╗', 'cyan');
  log('║                    Wallet Health Checker Test Suite                         ║', 'cyan');
  log('╚══════════════════════════════════════════════════════════════════════════════╝', 'cyan');

  console.log(`\nAPI URL: ${API_URL}`);
  console.log(`Node Version: ${process.version}`);
  console.log(`Platform: ${process.platform}`);

  try {
    // Run all test suites
    await testSpamDetection();
    await testWalletAnalysis();
    await testEdgeCases();

    logSection('TEST SUMMARY');
    log('All tests completed! Review results above.', 'green');
    log('\nNext Steps:', 'cyan');
    log('1. Check for any failed tests (marked with ✗)', 'gray');
    log('2. Verify spam detection is working on wallets with tokens', 'gray');
    log('3. Test with actual B402 holder wallet (update TEST_WALLETS.B402_HOLDER)', 'gray');
    log('4. Monitor production logs for spam detection hits', 'gray');

  } catch (error) {
    log(`\n✗ Test suite error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run tests
main().catch(console.error);
