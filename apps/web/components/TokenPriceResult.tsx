"use client"

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Copy, Check, ExternalLink, TrendingUp, TrendingDown } from 'lucide-react'

interface TokenPriceData {
  tokenAddress: string
  name: string
  symbol: string
  priceUsd: number
  priceNative?: number
  liquidityUsd: number
  volume24h: number
  priceChange24h: number
  dexId: string
  pairAddress: string
  url: string
  timestamp?: string
}

interface TokenPriceResultProps {
  data: TokenPriceData
  className?: string
}

export default function TokenPriceResult({ data, className }: TokenPriceResultProps) {
  const [copiedAddress, setCopiedAddress] = useState(false)
  const [copiedPair, setCopiedPair] = useState(false)

  const copyToClipboard = (text: string, type: 'address' | 'pair') => {
    navigator.clipboard.writeText(text)
    if (type === 'address') {
      setCopiedAddress(true)
      setTimeout(() => setCopiedAddress(false), 2000)
    } else {
      setCopiedPair(true)
      setTimeout(() => setCopiedPair(false), 2000)
    }
  }

  const formatUSD = (amount: number, compact: boolean = false) => {
    if (compact && amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(2)}M`
    }
    if (compact && amount >= 1000) {
      return `$${(amount / 1000).toFixed(2)}K`
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: amount < 1 ? 6 : 2,
    }).format(amount)
  }

  const formatPercent = (percent: number) => {
    const sign = percent >= 0 ? '+' : ''
    return `${sign}${percent.toFixed(2)}%`
  }

  const shortenAddress = (address: string) => {
    if (!address) return 'N/A'
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const isPositiveChange = data.priceChange24h >= 0

  return (
    <div className={cn("w-full space-y-6 font-mono", className)}>
      {/* Header */}
      <div className="p-6 bg-neon-dark border border-neon-grey/20 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-xl text-neon-white">{data.name}</h3>
            <span className="text-sm text-neon-grey bg-black/30 px-2 py-1 rounded">
              {data.symbol}
            </span>
          </div>
          <span className="text-sm text-neon-grey">
            {formatDate(data.timestamp)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-neon-grey">Token:</span>
          <code className="text-neon-blue-light bg-black/30 px-2 py-1 rounded">
            {shortenAddress(data.tokenAddress)}
          </code>
          <button
            onClick={() => copyToClipboard(data.tokenAddress, 'address')}
            className="p-1.5 hover:bg-neon-grey/10 rounded transition-colors"
            title="Copy token address"
          >
            {copiedAddress ? (
              <Check className="w-4 h-4 text-neon-blue-light" />
            ) : (
              <Copy className="w-4 h-4 text-neon-grey" />
            )}
          </button>
          <a
            href={data.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 hover:bg-neon-grey/10 rounded transition-colors"
            title="View on DexScreener"
          >
            <ExternalLink className="w-4 h-4 text-neon-grey" />
          </a>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Current Price */}
        <div className="p-4 bg-neon-dark border border-neon-grey/20 rounded-lg">
          <div className="text-sm text-neon-grey mb-1">Current Price</div>
          <div className="text-3xl text-neon-blue-light font-bold">
            {formatUSD(data.priceUsd)}
          </div>
          {data.priceNative && (
            <div className="text-xs text-neon-grey mt-1">
              {data.priceNative.toFixed(8)} SOL
            </div>
          )}
        </div>

        {/* 24h Change */}
        <div className="p-4 bg-neon-dark border border-neon-grey/20 rounded-lg">
          <div className="text-sm text-neon-grey mb-1">24h Change</div>
          <div className={cn(
            "text-3xl font-bold flex items-center gap-2",
            isPositiveChange ? "text-green-400" : "text-red-400"
          )}>
            {isPositiveChange ? (
              <TrendingUp className="w-6 h-6" />
            ) : (
              <TrendingDown className="w-6 h-6" />
            )}
            {formatPercent(data.priceChange24h)}
          </div>
          <div className="text-xs text-neon-grey mt-1">
            Price movement
          </div>
        </div>

        {/* 24h Volume */}
        <div className="p-4 bg-neon-dark border border-neon-grey/20 rounded-lg">
          <div className="text-sm text-neon-grey mb-1">24h Volume</div>
          <div className="text-2xl text-neon-white">
            {formatUSD(data.volume24h, true)}
          </div>
          <div className="text-xs text-neon-grey mt-1">
            {formatUSD(data.volume24h)}
          </div>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="p-6 bg-neon-dark border border-neon-grey/20 rounded-lg">
        <h4 className="text-lg text-neon-white mb-4">Market Details</h4>

        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-neon-grey">Liquidity (USD)</span>
            <span className="text-neon-white">
              {formatUSD(data.liquidityUsd, true)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-neon-grey">DEX</span>
            <span className="text-neon-white uppercase">{data.dexId}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-neon-grey">Pair Address</span>
            <div className="flex items-center gap-2">
              <code className="text-neon-blue-light text-xs bg-black/30 px-2 py-1 rounded">
                {shortenAddress(data.pairAddress)}
              </code>
              <button
                onClick={() => copyToClipboard(data.pairAddress, 'pair')}
                className="p-1 hover:bg-neon-grey/10 rounded transition-colors"
                title="Copy pair address"
              >
                {copiedPair ? (
                  <Check className="w-3 h-3 text-neon-blue-light" />
                ) : (
                  <Copy className="w-3 h-3 text-neon-grey" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-neon-grey">
        Data from DexScreener API • Last updated {formatDate(data.timestamp)}
      </div>
    </div>
  )
}
