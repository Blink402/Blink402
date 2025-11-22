"use client"

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Copy, Check, ExternalLink } from 'lucide-react'

interface TokenBalance {
  mint: string
  symbol: string
  name: string
  amount: number
  decimals: number
  uiAmount: number
  usdValue?: number
}

interface TransactionSummary {
  totalTransactions: number
  firstTransaction?: string
  lastTransaction?: string
  avgTransactionsPerDay?: number
  mostActiveDay?: string
}

interface TokenCreated {
  mint: string
  name?: string
  symbol?: string
  createdAt?: string
  supply?: number
}

interface WalletAnalysis {
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

interface WalletAnalysisResultProps {
  data: WalletAnalysis
  className?: string
}

export default function WalletAnalysisResult({ data, className }: WalletAnalysisResultProps) {
  const [copiedAddress, setCopiedAddress] = useState(false)
  const [expandedTokens, setExpandedTokens] = useState(false)

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedAddress(true)
    setTimeout(() => setCopiedAddress(false), 2000)
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(num)
  }

  const formatUSD = (amount?: number) => {
    if (!amount) return '$0.00'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const shortenAddress = (address: string) => {
    if (!address) return 'N/A'
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  const topTokens = data.tokens?.slice(0, 5) || []
  const remainingTokens = data.tokens?.slice(5) || []

  return (
    <div className={cn("w-full space-y-6 font-mono max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-neon-blue-dark/60 scrollbar-track-neon-black/20", className)}>
      {/* Header */}
      <div className="p-6 bg-neon-dark border border-neon-grey/20 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl text-neon-white">Wallet Analysis Report</h3>
          <span className="text-sm text-neon-grey">
            {formatDate(data.analyzedAt)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-neon-grey">Wallet:</span>
          <code className="text-neon-blue-light bg-black/30 px-2 py-1 rounded">
            {shortenAddress(data.wallet)}
          </code>
          <button
            onClick={() => copyToClipboard(data.wallet)}
            className="p-1.5 hover:bg-neon-grey/10 rounded transition-colors"
            title="Copy full address"
          >
            {copiedAddress ? (
              <Check className="w-4 h-4 text-neon-blue-light" />
            ) : (
              <Copy className="w-4 h-4 text-neon-grey" />
            )}
          </button>
          <a
            href={`https://solscan.io/account/${data.wallet}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 hover:bg-neon-grey/10 rounded transition-colors"
            title="View on Solscan"
          >
            <ExternalLink className="w-4 h-4 text-neon-grey" />
          </a>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="p-4 bg-neon-dark border border-neon-grey/20 rounded-lg">
          <div className="text-sm text-neon-grey mb-1">SOL Balance</div>
          <div className="text-2xl text-neon-white">
            {formatNumber(data.solBalance)} SOL
          </div>
          {data.solUsdValue && (
            <div className="text-sm text-neon-blue-light mt-1">
              ≈ {formatUSD(data.solUsdValue)}
            </div>
          )}
        </div>

        <div className="p-4 bg-neon-dark border border-neon-grey/20 rounded-lg">
          <div className="text-sm text-neon-grey mb-1">Total Transactions</div>
          <div className="text-2xl text-neon-white">
            {(data.transactionSummary?.totalTransactions ?? 0).toLocaleString()}
          </div>
          {data.transactionSummary?.avgTransactionsPerDay && (
            <div className="text-sm text-neon-grey mt-1">
              ~{Math.round(data.transactionSummary.avgTransactionsPerDay)}/day
            </div>
          )}
        </div>

        <div className="p-4 bg-neon-dark border border-neon-grey/20 rounded-lg">
          <div className="text-sm text-neon-grey mb-1">NFTs Owned</div>
          <div className="text-2xl text-neon-white">
            {data.nftCount || 0}
          </div>
          <div className="text-sm text-neon-grey mt-1">
            Digital collectibles
          </div>
        </div>
      </div>

      {/* Token Holdings */}
      <div className="p-6 bg-neon-dark border border-neon-grey/20 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg text-neon-white">Token Holdings</h4>
          {data.totalTokensUsdValue && (
            <span className="text-neon-blue-light">
              Total: {formatUSD(data.totalTokensUsdValue)}
            </span>
          )}
        </div>

        {(data.tokens?.length ?? 0) > 0 ? (
          <div className="space-y-2">
            {/* Top Tokens */}
            {topTokens.map((token, index) => (
              <div
                key={token.mint}
                className="flex items-center justify-between p-3 bg-black/30 rounded"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-neon-grey">#{index + 1}</span>
                  <div>
                    <div className="text-neon-white">{token.symbol}</div>
                    <div className="text-xs text-neon-grey">{token.name}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-neon-white">{formatNumber(token.uiAmount)}</div>
                  {token.usdValue && (
                    <div className="text-xs text-neon-blue-light">
                      {formatUSD(token.usdValue)}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Show More Button */}
            {remainingTokens.length > 0 && (
              <>
                {expandedTokens && remainingTokens.map((token, index) => (
                  <div
                    key={token.mint}
                    className="flex items-center justify-between p-3 bg-black/30 rounded"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-neon-grey">#{topTokens.length + index + 1}</span>
                      <div>
                        <div className="text-neon-white">{token.symbol}</div>
                        <div className="text-xs text-neon-grey">{token.name}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-neon-white">{formatNumber(token.uiAmount)}</div>
                      {token.usdValue && (
                        <div className="text-xs text-neon-blue-light">
                          {formatUSD(token.usdValue)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => setExpandedTokens(!expandedTokens)}
                  className="w-full py-2 text-sm text-neon-blue-light hover:text-neon-blue-dark transition-colors"
                >
                  {expandedTokens
                    ? 'Show Less'
                    : `Show ${remainingTokens.length} More Token${remainingTokens.length > 1 ? 's' : ''}`
                  }
                </button>
              </>
            )}
          </div>
        ) : (
          <p className="text-neon-grey text-center py-4">No SPL tokens found</p>
        )}
      </div>

      {/* Transaction History */}
      <div className="p-6 bg-neon-dark border border-neon-grey/20 rounded-lg">
        <h4 className="text-lg text-neon-white mb-4">Transaction History</h4>

        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-neon-grey">First Transaction</span>
            <span className="text-neon-white">
              {formatDate(data.transactionSummary?.firstTransaction)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-neon-grey">Last Transaction</span>
            <span className="text-neon-white">
              {formatDate(data.transactionSummary?.lastTransaction)}
            </span>
          </div>
          {data.transactionSummary?.avgTransactionsPerDay && (
            <div className="flex justify-between">
              <span className="text-neon-grey">Average Per Day</span>
              <span className="text-neon-white">
                ~{Math.round(data.transactionSummary.avgTransactionsPerDay)} txns
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tokens Created */}
      {(data.tokensCreated?.length ?? 0) > 0 && (
        <div className="p-6 bg-neon-dark border border-neon-grey/20 rounded-lg">
          <h4 className="text-lg text-neon-white mb-4">
            Tokens Created ({data.tokensCreated?.length ?? 0})
          </h4>

          <div className="space-y-2">
            {data.tokensCreated?.map((token) => (
              <div
                key={token.mint}
                className="flex items-center justify-between p-3 bg-black/30 rounded"
              >
                <div>
                  <div className="text-neon-white">
                    {token.symbol || 'Unknown Token'}
                  </div>
                  {token.name && (
                    <div className="text-xs text-neon-grey">{token.name}</div>
                  )}
                </div>
                <div className="text-right">
                  <a
                    href={`https://solscan.io/token/${token.mint}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-neon-blue-light hover:text-neon-blue-dark"
                  >
                    View Token
                  </a>
                  {token.createdAt && (
                    <div className="text-xs text-neon-grey mt-1">
                      {formatDate(token.createdAt)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-xs text-neon-grey">
        Data provided by Helius API • Analysis performed at {formatDate(data.analyzedAt)}
      </div>
    </div>
  )
}