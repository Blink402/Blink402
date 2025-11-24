/**
 * @blink402/database - Database Module Index
 *
 * This module provides a clean interface to all database operations.
 * All functions are organized into domain-specific modules for maintainability.
 *
 * STRUCTURE:
 * - Connection: Database pool management and health checks
 * - Creators: Creator profiles, payout wallets, and blinks
 * - Blinks: Blink CRUD, health tracking, and badges
 * - Runs: Run lifecycle, payment tracking, and execution
 * - Dashboard: Analytics and creator dashboards
 * - Rewards: Reward claim management
 * - Publishing: Catalog publishing validation
 * - Encryption: Data encryption utilities
 * - Lottery: Lottery rounds, entries, winners, and payouts
 * - Receipts: Optional cNFT receipts
 * - Refunds: Refund management and creator debt tracking
 * - Config: Platform configuration key-value store
 * - Twitter: Twitter OAuth credentials and activity logging
 * - Gallery: Payment-gated image galleries
 * - Catalog: Public blinks, featured blinks, trending blinks
 * - Referrals: Referral codes, tracking, and commissions
 * - Burns: B402 token burn tracking and statistics
 */

// ========================================
// CONNECTION MODULE
// ========================================
export {
  getPool,
  testConnection,
  closePool,
  getPoolHealth,
  getPoolMetrics,
  isPostgresError,
  type PostgresError
} from './modules/connection.js'

// ========================================
// CREATORS MODULE
// ========================================
export {
  getOrCreateCreator,
  getCreatorProfile,
  updateCreatorProfile,
  saveCreatorPayoutKey,
  getCreatorPayoutKey,
  hasCreatorPayoutKey,
  deleteCreatorPayoutKey,
  getBlinksByCreator
} from './modules/creators.js'

// ========================================
// BLINKS MODULE
// ========================================
export {
  getAllBlinks,
  getBlinkBySlug,
  getBlinkById,
  createBlink,
  updateBlink,
  deleteBlink,
  updateBlinkHealth,
  updateBlinkBadges
} from './modules/blinks.js'

// ========================================
// RUNS MODULE
// ========================================
export {
  createRun,
  getRunByReference,
  getRunBySignature,
  updateRunPayment,
  updateRunPaymentAtomic,
  markRunExecuted,
  markRunFailed,
  cleanupExpiredRuns,
  type RunData
} from './modules/runs.js'

// ========================================
// DASHBOARD MODULE
// ========================================
export {
  getDashboardData
} from './modules/dashboard.js'

// ========================================
// REWARDS MODULE
// ========================================
export {
  createRewardClaim,
  getRewardClaimCount,
  hasUserClaimedReward,
  getRewardClaimsByBlink,
  getRewardClaimByReference,
  type RewardClaimData
} from './modules/rewards.js'

// ========================================
// PUBLISHING MODULE
// ========================================
export {
  validateBlinkForPublishing,
  publishBlinkToCatalog,
  unpublishBlinkFromCatalog,
  getBlinkPublishingStatus,
  type PublishingValidationResult
} from './publishing.js'

// ========================================
// ENCRYPTION MODULE
// ========================================
export {
  encrypt,
  decrypt,
  maskSensitive,
  isValidPrivateKeyFormat
} from './encryption.js'

// ========================================
// LOTTERY MODULE
// ========================================
export {
  createLotteryRound,
  getActiveRound,
  getRoundById,
  getMaxRoundNumber,
  getRoundsEndingBefore,
  updateRoundStatus,
  updateRoundStats,
  createLotteryEntry,
  getRoundEntries,
  getUserEntriesInRound,
  getEntryByRunId,
  createWinner,
  getRoundWinners,
  getPendingPayouts,
  updatePayoutStatus,
  getLotteryStatsByBlink,
  getLotteryHistory
} from './lottery.js'

// ========================================
// RECEIPTS MODULE
// ========================================
export {
  getReceiptByRunId
} from './modules/receipts.js'

// ========================================
// REFUNDS MODULE
// ========================================
export {
  createRefund,
  markRefundIssued,
  markRefundFailed,
  getRefundByRunId,
  createCreatorDebt,
  getCreatorOutstandingDebt,
  getCreatorUnsettledDebts,
  settleCreatorDebt,
  type RefundData,
  type CreatorDebtData
} from './modules/refunds.js'

// ========================================
// CONFIG MODULE
// ========================================
export {
  getPlatformConfig,
  setPlatformConfig
} from './modules/config.js'

// ========================================
// TWITTER MODULE
// ========================================
export {
  getTwitterCredentialByCreatorId,
  getTwitterCredentialByWallet,
  upsertTwitterCredential,
  updateTwitterLastUsed,
  disconnectTwitter,
  logTwitterActivity,
  getTwitterActivityByCreator,
  type TwitterCredential,
  type TwitterActivity
} from './modules/twitter.js'

// ========================================
// GALLERY MODULE
// ========================================
export {
  uploadGalleryImage,
  getGalleryImages,
  grantGalleryAccess,
  checkGalleryAccess,
  deleteGalleryImage,
  type GalleryImage,
  type GalleryAccess
} from './modules/gallery.js'

// ========================================
// CATALOG MODULE
// ========================================
export {
  getPublicBlinks,
  getFeaturedBlinks,
  getTrendingBlinks,
  toggleBlinkPublic,
  reportBlink
} from './modules/catalog.js'

// ========================================
// REFERRALS MODULE
// ========================================
export {
  getOrCreateReferralCode,
  trackReferral,
  getReferralStats,
  getReferralLeaderboard,
  calculateReferralCommission,
  markCommissionPaid,
  getPendingCommissions
} from './modules/referrals.js'

// ========================================
// BURNS MODULE
// ========================================
export {
  recordBurn,
  getTotalBurned,
  getBurnStats,
  getRecentBurns,
  getBurnByRunId
} from './modules/burns.js'
