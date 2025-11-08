import { PublicKey } from '@solana/web3.js'

// Type definitions
export interface TokenBalance {
  mint: string
  symbol: string
  name: string
  amount: number
  decimals: number
  uiAmount: number
  usdValue?: number
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
 * Get Helius API URL with key
 */
function getHeliusUrl(endpoint: string): string {
  const apiKey = process.env.HELIUS_API_KEY
  if (!apiKey) {
    throw new Error('HELIUS_API_KEY environment variable is not set')
  }
  return `https://api.helius.xyz${endpoint}?api-key=${apiKey}`
}

/**
 * Get SOL balance for a wallet
 */
async function getSolBalance(wallet: string): Promise<number> {
  try {
    const response = await fetch(getHeliusUrl('/v0/addresses/' + wallet + '/balances'))
    const data: any = await response.json()

    if (!response.ok) {
      throw new Error(`Helius API error: ${data.error || response.statusText}`)
    }

    // SOL balance is in lamports, convert to SOL
    return (data.nativeBalance || 0) / 1e9
  } catch (error) {
    console.error('Error fetching SOL balance:', error)
    return 0
  }
}

/**
 * Get SPL token balances for a wallet
 */
async function getTokenBalances(wallet: string): Promise<TokenBalance[]> {
  try {
    const response = await fetch(getHeliusUrl('/v0/addresses/' + wallet + '/balances'))
    const data: any = await response.json()

    if (!response.ok) {
      throw new Error(`Helius API error: ${data.error || response.statusText}`)
    }

    const tokens: TokenBalance[] = []

    if (data.tokens && Array.isArray(data.tokens)) {
      for (const token of data.tokens) {
        tokens.push({
          mint: token.mint || '',
          symbol: token.tokenAccount?.symbol || 'UNKNOWN',
          name: token.tokenAccount?.name || 'Unknown Token',
          amount: token.amount || 0,
          decimals: token.decimals || 0,
          uiAmount: token.amount / Math.pow(10, token.decimals || 0),
          usdValue: token.tokenAccount?.priceInfo?.price_per_token
            ? (token.amount / Math.pow(10, token.decimals || 0)) * token.tokenAccount.priceInfo.price_per_token
            : undefined
        })
      }
    }

    return tokens
  } catch (error) {
    console.error('Error fetching token balances:', error)
    return []
  }
}

/**
 * Get transaction history summary for a wallet
 */
async function getTransactionSummary(wallet: string): Promise<TransactionSummary> {
  try {
    // Get recent transactions
    const response = await fetch(getHeliusUrl('/v0/addresses/' + wallet + '/transactions'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        limit: 100,
      }),
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

    // Calculate summary
    const timestamps = transactions
      .map(tx => tx.timestamp)
      .filter(Boolean)
      .sort((a, b) => a - b)

    const firstTimestamp = timestamps[0]
    const lastTimestamp = timestamps[timestamps.length - 1]

    let avgPerDay: number | undefined
    if (firstTimestamp && lastTimestamp) {
      const daysDiff = (lastTimestamp - firstTimestamp) / (60 * 60 * 24)
      avgPerDay = daysDiff > 0 ? transactions.length / daysDiff : undefined
    }

    return {
      totalTransactions: transactions.length,
      firstTransaction: firstTimestamp ? new Date(firstTimestamp * 1000).toISOString() : undefined,
      lastTransaction: lastTimestamp ? new Date(lastTimestamp * 1000).toISOString() : undefined,
      avgTransactionsPerDay: avgPerDay,
    }
  } catch (error) {
    console.error('Error fetching transaction summary:', error)
    return {
      totalTransactions: 0,
    }
  }
}

/**
 * Find tokens created by this wallet
 * Note: This requires parsing transaction data to find token mint instructions
 */
async function getTokensCreated(wallet: string): Promise<TokenCreated[]> {
  try {
    // Get transactions and filter for token creation events
    const response = await fetch(getHeliusUrl('/v0/addresses/' + wallet + '/transactions'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        limit: 100,
      }),
    })

    const transactions = await response.json()

    if (!response.ok || !Array.isArray(transactions)) {
      return []
    }

    const tokensCreated: TokenCreated[] = []

    // Parse transactions for token creation
    for (const tx of transactions) {
      // Look for CREATE or MINT instructions in transaction type
      if (tx.type === 'CREATE' ||
          tx.type === 'TOKEN_MINT' ||
          (tx.description && tx.description.toLowerCase().includes('created'))) {

        // Extract token info from transaction
        const tokenData = tx.tokenTransfers?.find((t: any) =>
          t.fromUserAccount === wallet || t.toUserAccount === wallet
        )

        if (tokenData && tokenData.mint) {
          tokensCreated.push({
            mint: tokenData.mint,
            name: tokenData.tokenName,
            symbol: tokenData.tokenSymbol,
            createdAt: tx.timestamp ? new Date(tx.timestamp * 1000).toISOString() : undefined,
          })
        }
      }
    }

    return tokensCreated
  } catch (error) {
    console.error('Error finding tokens created:', error)
    return []
  }
}

/**
 * Get NFT count for a wallet
 */
async function getNftCount(wallet: string): Promise<number> {
  try {
    const response = await fetch(getHeliusUrl('/v0/addresses/' + wallet + '/balances'))
    const data: any = await response.json()

    if (!response.ok) {
      return 0
    }

    return data.nfts?.length || 0
  } catch (error) {
    console.error('Error fetching NFT count:', error)
    return 0
  }
}

/**
 * Analyze a Solana wallet using Helius API
 * Returns comprehensive wallet statistics including balances, transactions, and tokens created
 */
export async function analyzeWallet(walletAddress: string): Promise<WalletAnalysis> {
  // Validate wallet address
  try {
    new PublicKey(walletAddress)
  } catch (error) {
    throw new Error('Invalid Solana wallet address')
  }

  // Fetch all data in parallel for better performance
  const [solBalance, tokens, transactionSummary, tokensCreated, nftCount] = await Promise.all([
    getSolBalance(walletAddress),
    getTokenBalances(walletAddress),
    getTransactionSummary(walletAddress),
    getTokensCreated(walletAddress),
    getNftCount(walletAddress),
  ])

  // Calculate total token USD value
  const totalTokensUsdValue = tokens.reduce((sum, token) => {
    return sum + (token.usdValue || 0)
  }, 0)

  return {
    wallet: walletAddress,
    solBalance,
    tokens,
    totalTokensUsdValue: totalTokensUsdValue > 0 ? totalTokensUsdValue : undefined,
    transactionSummary,
    tokensCreated,
    nftCount: nftCount > 0 ? nftCount : undefined,
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
