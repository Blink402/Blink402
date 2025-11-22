/**
 * EVM Transaction Builder for Base Chain USDC Payments
 *
 * Provides functions to build and send ERC-20 USDC transfer transactions
 * on Base chain (Ethereum L2) compatible with ONCHAIN x402 protocol.
 *
 * Key differences from Solana:
 * - Uses viem instead of @solana/web3.js
 * - ERC-20 token transfers instead of SPL tokens
 * - Gas estimation instead of compute units
 * - Transaction hash (0x...) instead of full transaction bytes
 */

import {
  createPublicClient,
  http,
  parseUnits,
  formatUnits,
  encodeFunctionData,
  type Address,
  type Hash,
  type WalletClient,
  type PublicClient
} from 'viem'
import { getChain, type ChainNetwork } from './chains.js'
import { USDC_ADDRESSES, USDC_DECIMALS, ERC20_ABI } from './constants.js'
import { createLogger } from '@blink402/config'

const logger = createLogger('@blink402/evm-transaction-builder')

/**
 * Parameters for building a USDC payment transaction
 */
export interface BuildUsdcPaymentTxParams {
  /** User's Ethereum address (the payer) */
  payer: Address
  /** Merchant's Ethereum address (the recipient) */
  merchant: Address
  /** Amount in USDC (e.g., 0.01 for $0.01) */
  amountUsdc: number
  /** Network to use (mainnet = Base, testnet = Base Sepolia) */
  network?: ChainNetwork
  /** Optional RPC URL (defaults to public RPC) */
  rpcUrl?: string
}

/**
 * Parameters for sending a USDC payment transaction
 */
export interface SendUsdcPaymentParams extends BuildUsdcPaymentTxParams {
  /** Viem wallet client for signing transactions */
  walletClient: WalletClient
}

/**
 * Build a USDC payment transaction for Base chain
 *
 * Creates an ERC-20 transfer transaction that transfers USDC from payer to merchant.
 * Unlike Solana's VersionedTransaction, this returns transaction parameters that
 * can be passed to wallet.sendTransaction().
 *
 * @param params - Transaction building parameters
 * @returns Transaction request object ready for signing
 * @throws Error if payer has insufficient USDC balance
 *
 * @example
 * ```typescript
 * const txRequest = await buildUsdcPaymentTransaction({
 *   payer: '0x1234...',
 *   merchant: '0x5678...',
 *   amountUsdc: 0.01,
 *   network: 'mainnet'
 * })
 * ```
 */
export async function buildUsdcPaymentTransaction(
  params: BuildUsdcPaymentTxParams
): Promise<{
  to: Address
  data: `0x${string}`
  value: bigint
  chainId: number
}> {
  const { payer, merchant, amountUsdc, network = 'mainnet', rpcUrl } = params

  logger.info('Building Base USDC transaction', {
    payer,
    merchant,
    amountUsdc,
    network
  })

  // Get chain configuration
  const chain = getChain(network)
  const usdcAddress = USDC_ADDRESSES[network]

  // Create public client for reading blockchain data
  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl)
  })

  // Convert USDC amount to atomic units (6 decimals)
  const amount = parseUnits(amountUsdc.toString(), USDC_DECIMALS)

  logger.info('Checking USDC balance...', { payer })

  // Check payer's USDC balance
  const balance = (await publicClient.readContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [payer]
  } as any)) as bigint

  const balanceUsdc = Number(formatUnits(balance, USDC_DECIMALS))
  logger.info(`USDC balance: ${balanceUsdc} USDC`)

  if (balance < amount) {
    throw new Error(
      `Insufficient USDC balance. You have ${balanceUsdc} USDC but need ${amountUsdc} USDC.`
    )
  }

  // Encode ERC-20 transfer function data
  const data = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [merchant, amount]
  })

  logger.info('Transaction built successfully', {
    to: usdcAddress,
    data: data.substring(0, 20) + '...',
    value: '0',
    chainId: chain.id
  })

  return {
    to: usdcAddress,
    data,
    value: 0n, // No ETH value for ERC-20 transfer
    chainId: chain.id
  }
}

/**
 * Send a USDC payment transaction on Base chain
 *
 * Builds, signs, and broadcasts an ERC-20 USDC transfer transaction.
 * This is the complete payment flow that returns a transaction hash
 * which can be used with ONCHAIN x402 protocol.
 *
 * @param params - Payment parameters including wallet client
 * @returns Transaction hash (0x-prefixed hex string)
 * @throws Error if transaction fails or insufficient balance
 *
 * @example
 * ```typescript
 * import { useWalletClient } from 'wagmi'
 *
 * const { data: walletClient } = useWalletClient()
 * const txHash = await sendUsdcPayment({
 *   walletClient,
 *   payer: walletClient.account.address,
 *   merchant: '0x5678...',
 *   amountUsdc: 0.01,
 *   network: 'mainnet'
 * })
 *
 * console.log('Transaction hash:', txHash)
 * // Use txHash for ONCHAIN x402 verification
 * ```
 */
export async function sendUsdcPayment(
  params: SendUsdcPaymentParams
): Promise<Hash> {
  const { walletClient, payer, network = 'mainnet' } = params

  // Verify wallet is connected to correct network
  const chain = getChain(network)
  if (walletClient.chain?.id !== chain.id) {
    logger.warn('Wallet on wrong network', {
      expected: chain.id,
      actual: walletClient.chain?.id
    })
    throw new Error(
      `Please switch your wallet to ${chain.name} (Chain ID: ${chain.id})`
    )
  }

  // Build transaction request
  const txRequest = await buildUsdcPaymentTransaction(params)

  logger.info('Estimating gas...')

  // Create public client for gas estimation
  const publicClient = createPublicClient({
    chain,
    transport: http(params.rpcUrl)
  })

  // Estimate gas for the transaction
  const gasEstimate = await publicClient.estimateGas({
    account: payer,
    ...txRequest
  })

  logger.info('Gas estimated', {
    gasLimit: gasEstimate.toString(),
    estimatedCostETH: formatUnits(gasEstimate * 1000000000n, 18) // Rough estimate
  })

  logger.info('Sending transaction...')

  // Send transaction
  const hash = await walletClient.sendTransaction({
    account: payer,
    to: txRequest.to,
    data: txRequest.data,
    value: txRequest.value,
    chain,
    gas: gasEstimate
  })

  logger.info('Transaction sent successfully', {
    hash,
    network,
    payer,
    merchant: params.merchant,
    amountUsdc: params.amountUsdc
  })

  return hash
}

/**
 * Get current USDC balance for an address
 *
 * @param address - Ethereum address to check
 * @param network - Network to check on
 * @param rpcUrl - Optional RPC URL
 * @returns Balance in USDC (decimal format, e.g., 10.50)
 */
export async function getUsdcBalance(
  address: Address,
  network: ChainNetwork = 'mainnet',
  rpcUrl?: string
): Promise<number> {
  const chain = getChain(network)
  const usdcAddress = USDC_ADDRESSES[network]

  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl)
  })

  const balance = (await publicClient.readContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address]
  } as any)) as bigint

  return Number(formatUnits(balance, USDC_DECIMALS))
}

/**
 * Validate an Ethereum address
 *
 * @param address - Address to validate
 * @returns true if valid Ethereum address
 */
export function isValidEthAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

/**
 * Format an Ethereum address for display (shortened)
 *
 * @param address - Full address
 * @param chars - Number of characters to show on each end (default: 6)
 * @returns Formatted address (e.g., "0x1234...5678")
 */
export function formatAddress(address: string, chars: number = 6): string {
  if (!address || address.length < chars * 2) return address
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

/**
 * Convert USDC amount to atomic units (with 6 decimals)
 *
 * @param amountUsdc - Amount in USDC (e.g., 0.01)
 * @returns Amount in atomic units (e.g., 10000)
 */
export function usdcToAtomic(amountUsdc: number): bigint {
  return parseUnits(amountUsdc.toString(), USDC_DECIMALS)
}

/**
 * Convert atomic units to USDC amount
 *
 * @param amountAtomic - Amount in atomic units
 * @returns Amount in USDC (decimal format)
 */
export function atomicToUsdc(amountAtomic: bigint): number {
  return Number(formatUnits(amountAtomic, USDC_DECIMALS))
}
