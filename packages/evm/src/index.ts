/**
 * @blink402/evm
 *
 * EVM blockchain utilities for Blink402 payment platform.
 * Supports Base chain (Ethereum L2) USDC payments with ONCHAIN x402 protocol.
 *
 * @example
 * ```typescript
 * import { sendUsdcPayment } from '@blink402/evm'
 * import { useWalletClient } from 'wagmi'
 *
 * const { data: walletClient } = useWalletClient()
 *
 * const txHash = await sendUsdcPayment({
 *   walletClient,
 *   payer: walletClient.account.address,
 *   merchant: '0x...',
 *   amountUsdc: 0.01,
 *   network: 'mainnet'
 * })
 * ```
 */

// Transaction builder exports
export {
  buildUsdcPaymentTransaction,
  sendUsdcPayment,
  getUsdcBalance,
  isValidEthAddress,
  formatAddress,
  usdcToAtomic,
  atomicToUsdc,
  type BuildUsdcPaymentTxParams,
  type SendUsdcPaymentParams
} from './transaction-builder.js'

// Chain configuration exports
export {
  CHAINS,
  getChain,
  getChainName,
  getExplorerUrl,
  type ChainNetwork
} from './chains.js'

// Constants exports
export {
  USDC_ADDRESSES,
  USDC_DECIMALS,
  ERC20_ABI
} from './constants.js'

// Re-export useful viem types
export type { Address, Hash, WalletClient, PublicClient } from 'viem'
