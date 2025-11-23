import { useEffect, useState } from 'react'

interface B402PriceData {
  price: number // Price in USDC
  isLoading: boolean
  error: string | null
  lastUpdated: Date | null
}

// Cache price data for 1 minute
let priceCache: { price: number; timestamp: number } | null = null
const CACHE_DURATION_MS = 60 * 1000 // 1 minute

/**
 * Hook to fetch current B402 token price from DexScreener API
 *
 * Falls back to $0.10 if API fails or B402_MINT not configured
 * Caches price for 1 minute to reduce API calls
 */
export function useB402Price(): B402PriceData {
  const [price, setPrice] = useState<number>(0.10) // Default fallback
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    const fetchPrice = async () => {
      // Check cache first
      if (priceCache && Date.now() - priceCache.timestamp < CACHE_DURATION_MS) {
        setPrice(priceCache.price)
        setIsLoading(false)
        setLastUpdated(new Date(priceCache.timestamp))
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        // Get B402 mint address from environment
        const b402Mint = process.env.NEXT_PUBLIC_B402_MINT

        if (!b402Mint || b402Mint === '11111111111111111111111111111111') {
          // Placeholder mint - use fallback price
          console.warn('B402_MINT not configured, using fallback price $0.10')
          setPrice(0.10)
          setLastUpdated(new Date())
          setIsLoading(false)
          return
        }

        // Try DexScreener API first
        try {
          const dexScreenerRes = await fetch(
            `https://api.dexscreener.com/latest/dex/tokens/${b402Mint}`,
            { next: { revalidate: 60 } } // Cache for 1 minute
          )

          if (dexScreenerRes.ok) {
            const dexData = await dexScreenerRes.json()

            if (dexData.pairs && dexData.pairs.length > 0) {
              // Get the pair with highest liquidity (most reliable price)
              const sortedPairs = dexData.pairs.sort((a: any, b: any) =>
                (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
              )

              const mainPair = sortedPairs[0]
              const fetchedPrice = parseFloat(mainPair.priceUsd)

              if (!isNaN(fetchedPrice) && fetchedPrice > 0) {
                // Update cache
                priceCache = {
                  price: fetchedPrice,
                  timestamp: Date.now()
                }

                setPrice(fetchedPrice)
                setLastUpdated(new Date())
                setIsLoading(false)
                return
              }
            }
          }
        } catch (dexError) {
          console.warn('DexScreener API failed, trying Jupiter...', dexError)
        }

        // Fallback to Jupiter Price API
        try {
          const jupiterRes = await fetch(
            `https://price.jup.ag/v4/price?ids=${b402Mint}`,
            { next: { revalidate: 60 } }
          )

          if (jupiterRes.ok) {
            const jupData = await jupiterRes.json()
            const tokenData = jupData.data?.[b402Mint]

            if (tokenData && tokenData.price) {
              const fetchedPrice = tokenData.price

              // Update cache
              priceCache = {
                price: fetchedPrice,
                timestamp: Date.now()
              }

              setPrice(fetchedPrice)
              setLastUpdated(new Date())
              setIsLoading(false)
              return
            }
          }
        } catch (jupError) {
          console.warn('Jupiter API failed, using fallback...', jupError)
        }

        // If both APIs fail, use fallback
        console.warn('All price APIs failed, using fallback price $0.10')
        setPrice(0.10)
        setLastUpdated(new Date())
        setError('Unable to fetch live price, using estimated value')

      } catch (err) {
        console.error('Error fetching B402 price:', err)
        setPrice(0.10)
        setError('Failed to fetch token price')
      } finally {
        setIsLoading(false)
      }
    }

    fetchPrice()

    // Refresh price every 1 minute
    const interval = setInterval(fetchPrice, CACHE_DURATION_MS)

    return () => clearInterval(interval)
  }, [])

  return {
    price,
    isLoading,
    error,
    lastUpdated
  }
}
