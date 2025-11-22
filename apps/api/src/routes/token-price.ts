/**
 * Token Price Lookup API
 * Fetches real-time token price data from DexScreener
 */

import { FastifyPluginAsync } from 'fastify'

export const tokenPriceRoutes: FastifyPluginAsync = async (fastify) => {
  // GET handler - helpful documentation
  fastify.get('/', async (request, reply) => {
    return reply.code(200).send({
      success: true,
      message: 'Token Price Lookup API',
      description: 'Fetches real-time token prices from DexScreener',
      usage: {
        method: 'POST',
        endpoint: '/token-price',
        body: {
          tokenAddress: 'Required: Solana token mint address (32-44 base58 characters)',
          wallet: 'Alternative parameter name for tokenAddress',
        },
        example: {
          tokenAddress: 'So11111111111111111111111111111111111111112',
        },
      },
      documentation: 'https://blink402.dev/docs/api/token-price',
    })
  })

  fastify.post<{
    Body: {
      tokenAddress?: string
      wallet?: string // Alternative parameter name
      reference?: string
      signature?: string
      payer?: string
    }
  }>('/', async (request, reply) => {
    const { tokenAddress, wallet, reference, signature, payer } = request.body

    try {
      // Accept either tokenAddress or wallet parameter
      const address = tokenAddress || wallet

      if (!address) {
        return reply.code(400).send({
          success: false,
          error: 'Missing token address parameter',
          message: 'Please provide a Solana token mint address',
        })
      }

      // Validate Solana address format (basic check)
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid token address',
          message: 'Please provide a valid Solana address (32-44 base58 characters)',
        })
      }

      fastify.log.info({ tokenAddress: address, reference, payer }, 'Fetching token price from DexScreener')

      // Call DexScreener API
      const dexScreenerUrl = `https://api.dexscreener.com/latest/dex/tokens/${address}`
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

      const response = await fetch(dexScreenerUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Blink402/1.0',
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        fastify.log.error({
          tokenAddress: address,
          status: response.status,
          error: errorText,
        }, 'DexScreener API error')

        return reply.code(502).send({
          success: false,
          error: 'DexScreener API error',
          message: `Failed to fetch token data (HTTP ${response.status})`,
          details: errorText.substring(0, 200),
        })
      }

      const data = await response.json() as {
        schemaVersion: string
        pairs: Array<{
          chainId: string
          dexId: string
          url: string
          pairAddress: string
          baseToken: {
            address: string
            name: string
            symbol: string
          }
          quoteToken: {
            address: string
            name: string
            symbol: string
          }
          priceNative: string
          priceUsd: string
          liquidity: {
            usd: number
            base: number
            quote: number
          }
          volume: {
            h24: number
            h6: number
            h1: number
          }
          priceChange: {
            h24: number
            h6: number
            h1: number
          }
        }>
      }

      if (!data.pairs || data.pairs.length === 0) {
        return reply.code(404).send({
          success: false,
          error: 'Token not found',
          message: 'No trading pairs found for this token address on DexScreener',
          tokenAddress: address,
        })
      }

      // Get the pair with highest liquidity (most reliable price)
      const primaryPair = data.pairs.reduce((max, pair) =>
        pair.liquidity.usd > max.liquidity.usd ? pair : max
      , data.pairs[0])

      // Format response
      const result = {
        success: true,
        data: {
          tokenAddress: address,
          name: primaryPair.baseToken.name,
          symbol: primaryPair.baseToken.symbol,
          priceUsd: parseFloat(primaryPair.priceUsd),
          priceNative: parseFloat(primaryPair.priceNative),
          liquidityUsd: primaryPair.liquidity.usd,
          volume24h: primaryPair.volume.h24,
          priceChange24h: primaryPair.priceChange.h24,
          dexId: primaryPair.dexId,
          pairAddress: primaryPair.pairAddress,
          url: primaryPair.url,
        },
        // Include reference and signature for receipt tracking
        ...(reference ? { reference } : {}),
        ...(signature ? { signature } : {}),
        timestamp: new Date().toISOString(),
      }

      fastify.log.info({
        tokenAddress: address,
        symbol: result.data.symbol,
        priceUsd: result.data.priceUsd,
        volume24h: result.data.volume24h,
      }, 'Token price lookup successful')

      return reply.code(200).send(result)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        fastify.log.error({ tokenAddress, error }, 'DexScreener API timeout')
        return reply.code(504).send({
          success: false,
          error: 'Request timeout',
          message: 'DexScreener API took too long to respond',
        })
      }

      fastify.log.error({ error, tokenAddress }, 'Token price lookup failed')
      return reply.code(500).send({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred while fetching token price',
        details: error instanceof Error ? error.message : String(error),
      })
    }
  })
}
