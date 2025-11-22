import { PublicKey } from '@solana/web3.js'
import {
  detectSpamToken,
  type SpamDetectionResult,
  type TokenForSpamCheck,
} from '@blink402/solana'

// Type definitions
export interface TokenBalance {
  mint: string
  symbol: string
  name: string
  amount: number
  decimals: number
  uiAmount: number
  usdValue?: number
  spamDetection?: SpamDetectionResult // Added for B402 BRONZE+ tier
}

export interface TransactionSummary {
  totalTransactions: number
  firstTransaction?: string
  lastTransaction?: string
  avgTransactionsPerDay?: number
  mostActiveDay?: string
}

export interface TokenCreated {
  mint: string
  name?: string
  symbol?: string
  createdAt?: string
  supply?: number
}

export interface WalletAnalysis {
  wallet: string
  solBalance: number
  solUsdValue?: number
  tokens: TokenBalance[]
  totalTokensUsdValue?: number
  transactionSummary: TransactionSummary
  tokensCreated: TokenCreated[]
  nftCount?: number
  analyzedAt: string
}

/**
 * Get Helius RPC URL with API key
 */
function getHeliusRpcUrl(): string {
  const apiKey = process.env.HELIUS_API_KEY
  if (!apiKey) {
    throw new Error('HELIUS_API_KEY environment variable is not set')
  }
  return `https://mainnet.helius-rpc.com/?api-key=${apiKey}`
}

/**
 * Get Helius REST API URL with API key
 */
function getHeliusRestUrl(endpoint: string): string {
  const apiKey = process.env.HELIUS_API_KEY
  if (!apiKey) {
    throw new Error('HELIUS_API_KEY environment variable is not set')
  }
  return `https://api.helius.xyz${endpoint}?api-key=${apiKey}`
}

/**
 * Call Helius DAS RPC method
 */
async function callHeliusRpc(method: string, params: any): Promise<any> {
  const response = await fetch(getHeliusRpcUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'helius-wallet-analyzer',
      method,
      params,
    }),
  })

  const data: any = await response.json()

  if (!response.ok || data.error) {
    throw new Error(`Helius RPC error: ${data.error?.message || response.statusText}`)
  }

  return data.result
}

/**
 * Get comprehensive wallet assets using DAS getAssetsByOwner
 * Returns: tokens, NFTs, and native SOL balance
 */
async function getWalletAssets(wallet: string): Promise<{
  solBalance: number
  solUsdValue?: number
  tokens: TokenBalance[]
  nftCount: number
}> {
  try {
    const result = await callHeliusRpc('getAssetsByOwner', {
      ownerAddress: wallet,
      page: 1,
      limit: 1000, // Max allowed
      displayOptions: {
        showFungible: true,      // Include SPL tokens with metadata
        showNativeBalance: true,  // Include SOL balance
        showInscription: true,    // Include inscription data
        showZeroBalance: false,   // Exclude zero balance tokens
      },
    })

    // Extract native SOL balance
    let solBalance = 0
    let solUsdValue: number | undefined

    if (result.nativeBalance) {
      solBalance = result.nativeBalance.lamports / 1e9
      if (result.nativeBalance.price_per_sol) {
        solUsdValue = solBalance * result.nativeBalance.price_per_sol
      }
    }

    // Process tokens and NFTs
    const tokens: TokenBalance[] = []
    let nftCount = 0

    if (result.items && Array.isArray(result.items)) {
      for (const asset of result.items) {
        // Check if this is an NFT or a fungible token
        const isNft = asset.interface && (
          asset.interface === 'V1_NFT' ||
          asset.interface === 'ProgrammableNFT' ||
          asset.interface === 'NonFungible' ||
          asset.interface === 'NFT' ||
          asset.interface === 'V1_PRINT' ||
          asset.interface === 'LegacyNFT'
        )

        if (isNft) {
          nftCount++
          continue
        }

        // This is a fungible token
        if (asset.token_info) {
          const tokenInfo = asset.token_info
          const balance = tokenInfo.balance || 0
          const decimals = tokenInfo.decimals || 0
          const uiAmount = balance / Math.pow(10, decimals)

          // Get USD value if price info is available
          let usdValue: number | undefined
          if (tokenInfo.price_info && tokenInfo.price_info.price_per_token) {
            usdValue = uiAmount * tokenInfo.price_info.price_per_token
          }

          tokens.push({
            mint: asset.id || '',
            symbol: tokenInfo.symbol || 'UNKNOWN',
            name: tokenInfo.name || 'Unknown Token',
            amount: balance,
            decimals,
            uiAmount,
            usdValue,
          })
        }
      }
    }

    // Sort tokens by USD value (highest first), then by balance
    tokens.sort((a, b) => {
      if (a.usdValue && b.usdValue) {
        return b.usdValue - a.usdValue
      }
      if (a.usdValue) return -1
      if (b.usdValue) return 1
      return b.uiAmount - a.uiAmount
    })

    return {
      solBalance,
      solUsdValue,
      tokens,
      nftCount,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[Helius] Error fetching wallet assets:', errorMessage)
    console.error('[Helius] Full error:', error)
    // Return empty data on error instead of failing completely
    return {
      solBalance: 0,
      tokens: [],
      nftCount: 0,
    }
  }
}

/**
 * Get transaction history summary for a wallet
 * Uses Enhanced Transactions API
 */
async function getTransactionSummary(wallet: string): Promise<TransactionSummary> {
  try {
    // Get recent transactions using enhanced transactions API
    const response = await fetch(getHeliusRestUrl(`/v0/addresses/${wallet}/transactions`), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const transactions: any = await response.json()

    if (!response.ok) {
      throw new Error(`Helius API error: ${transactions.error || response.statusText}`)
    }

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return {
        totalTransactions: 0,
      }
    }

    // Calculate summary from timestamps
    const timestamps = transactions
      .map(tx => tx.timestamp)
      .filter(Boolean)
      .sort((a, b) => a - b)

    if (timestamps.length === 0) {
      return {
        totalTransactions: transactions.length,
      }
    }

    const firstTimestamp = timestamps[0]
    const lastTimestamp = timestamps[timestamps.length - 1]

    // Fix: Calculate average per day correctly
    let avgPerDay: number | undefined
    if (firstTimestamp && lastTimestamp && firstTimestamp !== lastTimestamp) {
      const daysDiff = (lastTimestamp - firstTimestamp) / (60 * 60 * 24)
      if (daysDiff > 0) {
        avgPerDay = transactions.length / daysDiff
      }
    }

    return {
      totalTransactions: transactions.length,
      firstTransaction: firstTimestamp ? new Date(firstTimestamp * 1000).toISOString() : undefined,
      lastTransaction: lastTimestamp ? new Date(lastTimestamp * 1000).toISOString() : undefined,
      avgTransactionsPerDay: avgPerDay,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[Helius] Error fetching transaction summary:', errorMessage)
    console.error('[Helius] Full error:', error)
    return {
      totalTransactions: 0,
    }
  }
}

/**
 * Find tokens created by this wallet
 * Uses Enhanced Transactions API to detect TOKEN_MINT and NFT_MINT events
 */
async function getTokensCreated(wallet: string): Promise<TokenCreated[]> {
  try {
    // Get transactions and filter for token creation events
    const response = await fetch(getHeliusRestUrl(`/v0/addresses/${wallet}/transactions`), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const transactions = await response.json()

    if (!response.ok || !Array.isArray(transactions)) {
      return []
    }

    const tokensCreated: TokenCreated[] = []
    const seenMints = new Set<string>() // Prevent duplicates

    // Parse transactions for token creation
    for (const tx of transactions) {
      // Look for token mint/creation events
      if (tx.type === 'TOKEN_MINT' ||
          tx.type === 'NFT_MINT' ||
          tx.type === 'CREATE' ||
          (tx.description && (
            tx.description.toLowerCase().includes('created') ||
            tx.description.toLowerCase().includes('minted')
          ))) {

        // Extract token info from transaction
        if (tx.tokenTransfers && Array.isArray(tx.tokenTransfers)) {
          for (const transfer of tx.tokenTransfers) {
            // Check if this wallet was involved in minting
            if ((transfer.fromUserAccount === wallet || transfer.toUserAccount === wallet) &&
                transfer.mint &&
                !seenMints.has(transfer.mint)) {

              seenMints.add(transfer.mint)

              tokensCreated.push({
                mint: transfer.mint,
                name: transfer.tokenName,
                symbol: transfer.tokenSymbol,
                createdAt: tx.timestamp ? new Date(tx.timestamp * 1000).toISOString() : undefined,
              })
            }
          }
        }

        // Also check NFT events
        if (tx.events && tx.events.nft && tx.events.nft.nfts) {
          for (const nft of tx.events.nft.nfts) {
            if (nft.mint && !seenMints.has(nft.mint)) {
              seenMints.add(nft.mint)

              tokensCreated.push({
                mint: nft.mint,
                createdAt: tx.timestamp ? new Date(tx.timestamp * 1000).toISOString() : undefined,
              })
            }
          }
        }
      }
    }

    return tokensCreated
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[Helius] Error finding tokens created:', errorMessage)
    console.error('[Helius] Full error:', error)
    return []
  }
}

/**
 * Analyze a Solana wallet using Helius DAS API
 * Returns comprehensive wallet statistics including balances, transactions, and tokens created
 *
 * @param walletAddress - Solana wallet address to analyze
 * @param options - Optional configuration
 * @param options.includeSpamDetection - Run spam detection on tokens (requires BRONZE+ tier)
 */
export async function analyzeWallet(
  walletAddress: string,
  options?: {
    includeSpamDetection?: boolean
  }
): Promise<WalletAnalysis> {
  // Validate wallet address
  try {
    new PublicKey(walletAddress)
  } catch (error) {
    throw new Error('Invalid Solana wallet address')
  }

  // Fetch all data in parallel for better performance
  const [assets, transactionSummary, tokensCreated] = await Promise.all([
    getWalletAssets(walletAddress),
    getTransactionSummary(walletAddress),
    getTokensCreated(walletAddress),
  ])

  // Run spam detection if requested (B402 BRONZE+ feature)
  let tokensWithSpamDetection = assets.tokens
  if (options?.includeSpamDetection && assets.tokens.length > 0) {
    tokensWithSpamDetection = assets.tokens.map(token => {
      // Convert TokenBalance to TokenForSpamCheck format
      const tokenForCheck: TokenForSpamCheck = {
        mint: token.mint,
        name: token.name,
        symbol: token.symbol,
        decimals: token.decimals,
        amount: token.amount,
        uiAmount: token.uiAmount,
        usdValue: token.usdValue || null,
        // metadata will be undefined for now (we don't get freeze/mint authority from Helius)
        // This means we won't detect freeze authority spam, but other heuristics will work
      }

      const spamDetection = detectSpamToken(tokenForCheck)

      return {
        ...token,
        spamDetection,
      }
    })
  }

  // Calculate total token USD value
  const totalTokensUsdValue = tokensWithSpamDetection.reduce((sum, token) => {
    return sum + (token.usdValue || 0)
  }, 0)

  return {
    wallet: walletAddress,
    solBalance: assets.solBalance,
    solUsdValue: assets.solUsdValue,
    tokens: tokensWithSpamDetection,
    totalTokensUsdValue: totalTokensUsdValue > 0 ? totalTokensUsdValue : undefined,
    transactionSummary,
    tokensCreated,
    nftCount: assets.nftCount, // Always include nftCount (0 or positive)
    analyzedAt: new Date().toISOString(),
  }
}

/**
 * Validate if a string is a valid Solana address
 */
export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address)
    return true
  } catch {
    return false
  }
}
