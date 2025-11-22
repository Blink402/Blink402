import { FastifyPluginAsync } from 'fastify'
import { getReceiptByRunId, getRunByReference, getBlinkById, getPool } from '@blink402/database'
import { verifyWalletAuth, verifyOwnership, type WalletAuthBody } from '../auth.js'
import { isRedisConnected, getCacheOrFetch } from '@blink402/redis'

/**
 * Receipt Viewer Endpoint - Fix Pack 4
 *
 * Comprehensive receipt viewing for transaction verification and transparency.
 * Includes public endpoints (no auth required) for sharing receipts.
 */
export const receiptsRoutes: FastifyPluginAsync = async (fastify) => {
  // ========== PUBLIC RECEIPT VIEWER ENDPOINTS (NO AUTH REQUIRED) ==========

  /**
   * GET /receipts/tx/:signature - Public receipt viewer by transaction signature
   * Returns comprehensive receipt data including transaction details, blink info, and creator
   */
  fastify.get<{
    Params: { signature: string }
  }>('/tx/:signature', {
    schema: {
      description: 'Get receipt by transaction signature (public)',
      tags: ['receipts'],
      params: {
        type: 'object',
        properties: {
          signature: {
            type: 'string',
            description: 'Solana transaction signature (base58)'
          }
        },
        required: ['signature']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                // Transaction details
                signature: { type: 'string' },
                reference: { type: 'string' },
                payer: { type: 'string' },
                status: { type: 'string', enum: ['pending', 'paid', 'executed', 'failed'] },
                duration_ms: { type: ['number', 'null'] },
                // Timestamps
                created_at: { type: 'string' },
                paid_at: { type: ['string', 'null'] },
                executed_at: { type: ['string', 'null'] },
                expires_at: { type: 'string' },
                // Blink details
                blink: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    slug: { type: 'string' },
                    title: { type: 'string' },
                    description: { type: ['string', 'null'] },
                    price_usdc: { type: 'string' },
                    payment_token: { type: 'string' },
                    icon_url: { type: ['string', 'null'] },
                    category: { type: ['string', 'null'] }
                  }
                },
                // Creator details
                creator: {
                  type: 'object',
                  properties: {
                    wallet: { type: 'string' },
                    display_name: { type: ['string', 'null'] },
                    avatar_url: { type: ['string', 'null'] }
                  }
                },
                // Explorer links
                explorer_url: { type: 'string' }
              }
            }
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { signature } = request.params

    try {
      // Use cache if Redis is available (30 second TTL for receipts)
      const fetchReceipt = async () => {
        const result = await getPool().query(`
          SELECT
            r.id, r.reference, r.signature, r.payer, r.status, r.duration_ms,
            r.created_at, r.paid_at, r.executed_at, r.expires_at,
            r.metadata, r.response_preview,
            b.id as blink_id, b.slug, b.title, b.description, b.price_usdc,
            b.payment_token, b.icon_url, b.category,
            c.wallet as creator_wallet, c.display_name, c.avatar_url
          FROM runs r
          JOIN blinks b ON r.blink_id = b.id
          JOIN creators c ON b.creator_id = c.id
          WHERE r.signature = $1
        `, [signature])

        return result.rows[0] || null
      }

      const receipt = await (isRedisConnected()
        ? getCacheOrFetch(`receipt:tx:${signature}`, fetchReceipt, 30)
        : fetchReceipt())

      if (!receipt) {
        return reply.code(404).send({
          success: false,
          error: 'Receipt not found'
        })
      }

      // Determine Solana explorer URL based on environment
      const network = process.env.SOLANA_NETWORK || 'devnet'
      const explorerUrl = network === 'mainnet-beta'
        ? `https://solscan.io/tx/${signature}`
        : `https://solscan.io/tx/${signature}?cluster=devnet`

      return reply.code(200).send({
        success: true,
        data: {
          signature: receipt.signature,
          reference: receipt.reference,
          payer: receipt.payer,
          status: receipt.status,
          duration_ms: receipt.duration_ms,
          created_at: receipt.created_at.toISOString(),
          paid_at: receipt.paid_at?.toISOString() || null,
          executed_at: receipt.executed_at?.toISOString() || null,
          expires_at: receipt.expires_at.toISOString(),
          blink: {
            id: receipt.blink_id,
            slug: receipt.slug,
            title: receipt.title,
            description: receipt.description,
            price_usdc: receipt.price_usdc,
            payment_token: receipt.payment_token,
            icon_url: receipt.icon_url,
            category: receipt.category
          },
          creator: {
            wallet: receipt.creator_wallet,
            display_name: receipt.display_name,
            avatar_url: receipt.avatar_url
          },
          explorer_url: explorerUrl,
          // Include API response data if available
          response_data: receipt.metadata?.response || null
        }
      })
    } catch (error) {
      fastify.log.error({ error, signature }, 'Error fetching receipt by signature')
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch receipt'
      })
    }
  })

  /**
   * GET /receipts/ref/:reference - Public receipt viewer by reference UUID
   * Returns comprehensive receipt data (same as /tx/:signature but by reference)
   */
  fastify.get<{
    Params: { reference: string }
  }>('/ref/:reference', {
    schema: {
      description: 'Get receipt by reference (public)',
      tags: ['receipts'],
      params: {
        type: 'object',
        properties: {
          reference: {
            type: 'string',
            description: 'Payment reference (Solana PublicKey base58 or UUID)'
          }
        },
        required: ['reference']
      }
    }
  }, async (request, reply) => {
    const { reference } = request.params

    try {
      const fetchReceipt = async () => {
        const result = await getPool().query(`
          SELECT
            r.id, r.reference, r.signature, r.payer, r.status, r.duration_ms,
            r.created_at, r.paid_at, r.executed_at, r.expires_at,
            r.metadata, r.response_preview,
            b.id as blink_id, b.slug, b.title, b.description, b.price_usdc,
            b.payment_token, b.icon_url, b.category,
            c.wallet as creator_wallet, c.display_name, c.avatar_url
          FROM runs r
          JOIN blinks b ON r.blink_id = b.id
          JOIN creators c ON b.creator_id = c.id
          WHERE r.reference = $1
        `, [reference])

        return result.rows[0] || null
      }

      const receipt = await (isRedisConnected()
        ? getCacheOrFetch(`receipt:ref:${reference}`, fetchReceipt, 30)
        : fetchReceipt())

      if (!receipt) {
        return reply.code(404).send({
          success: false,
          error: 'Receipt not found'
        })
      }

      const network = process.env.SOLANA_NETWORK || 'devnet'
      const explorerUrl = receipt.signature
        ? (network === 'mainnet-beta'
            ? `https://solscan.io/tx/${receipt.signature}`
            : `https://solscan.io/tx/${receipt.signature}?cluster=devnet`)
        : null

      return reply.code(200).send({
        success: true,
        data: {
          signature: receipt.signature,
          reference: receipt.reference,
          payer: receipt.payer,
          status: receipt.status,
          duration_ms: receipt.duration_ms,
          created_at: receipt.created_at.toISOString(),
          paid_at: receipt.paid_at?.toISOString() || null,
          executed_at: receipt.executed_at?.toISOString() || null,
          expires_at: receipt.expires_at.toISOString(),
          blink: {
            id: receipt.blink_id,
            slug: receipt.slug,
            title: receipt.title,
            description: receipt.description,
            price_usdc: receipt.price_usdc,
            payment_token: receipt.payment_token,
            icon_url: receipt.icon_url,
            category: receipt.category
          },
          creator: {
            wallet: receipt.creator_wallet,
            display_name: receipt.display_name,
            avatar_url: receipt.avatar_url
          },
          explorer_url: explorerUrl,
          // Include API response data if available
          response_data: receipt.metadata?.response || null
        }
      })
    } catch (error) {
      fastify.log.error({ error, reference }, 'Error fetching receipt by reference')
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch receipt'
      })
    }
  })

  /**
   * GET /receipts/wallet/:wallet - List all receipts for a wallet (paginated)
   * Returns list of receipts where the wallet was the payer
   */
  fastify.get<{
    Params: { wallet: string }
    Querystring: { limit?: number; offset?: number; status?: string }
  }>('/wallet/:wallet', {
    schema: {
      description: 'List receipts by payer wallet (public, paginated)',
      tags: ['receipts'],
      params: {
        type: 'object',
        properties: {
          wallet: {
            type: 'string',
            description: 'Solana wallet address (44 chars base58)'
          }
        },
        required: ['wallet']
      },
      querystring: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            minimum: 1,
            maximum: 100,
            default: 20,
            description: 'Number of receipts to return'
          },
          offset: {
            type: 'number',
            minimum: 0,
            default: 0,
            description: 'Number of receipts to skip'
          },
          status: {
            type: 'string',
            enum: ['pending', 'paid', 'executed', 'failed'],
            description: 'Filter by status'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  signature: { type: ['string', 'null'] },
                  reference: { type: 'string' },
                  status: { type: 'string' },
                  paid_at: { type: ['string', 'null'] },
                  executed_at: { type: ['string', 'null'] },
                  blink_slug: { type: 'string' },
                  blink_title: { type: 'string' },
                  price_usdc: { type: 'string' },
                  payment_token: { type: 'string' }
                }
              }
            },
            pagination: {
              type: 'object',
              properties: {
                total: { type: 'number' },
                limit: { type: 'number' },
                offset: { type: 'number' },
                has_more: { type: 'boolean' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { wallet } = request.params
    const { limit = 20, offset = 0, status } = request.query

    try {
      // Count query
      const countQuery = status
        ? 'SELECT COUNT(*) FROM runs WHERE payer = $1 AND status = $2'
        : 'SELECT COUNT(*) FROM runs WHERE payer = $1'
      const countParams = status ? [wallet, status] : [wallet]
      const countResult = await getPool().query(countQuery, countParams)
      const total = parseInt(countResult.rows[0].count)

      // Data query
      const dataQuery = status
        ? `SELECT
            r.signature, r.reference, r.status, r.paid_at, r.executed_at,
            b.slug as blink_slug, b.title as blink_title, b.price_usdc, b.payment_token
          FROM runs r
          JOIN blinks b ON r.blink_id = b.id
          WHERE r.payer = $1 AND r.status = $2
          ORDER BY r.created_at DESC
          LIMIT $3 OFFSET $4`
        : `SELECT
            r.signature, r.reference, r.status, r.paid_at, r.executed_at,
            b.slug as blink_slug, b.title as blink_title, b.price_usdc, b.payment_token
          FROM runs r
          JOIN blinks b ON r.blink_id = b.id
          WHERE r.payer = $1
          ORDER BY r.created_at DESC
          LIMIT $2 OFFSET $3`
      const dataParams = status ? [wallet, status, limit, offset] : [wallet, limit, offset]
      const dataResult = await getPool().query(dataQuery, dataParams)

      const receipts = dataResult.rows.map(row => ({
        signature: row.signature,
        reference: row.reference,
        status: row.status,
        paid_at: row.paid_at?.toISOString() || null,
        executed_at: row.executed_at?.toISOString() || null,
        blink_slug: row.blink_slug,
        blink_title: row.blink_title,
        price_usdc: row.price_usdc,
        payment_token: row.payment_token
      }))

      return reply.code(200).send({
        success: true,
        data: receipts,
        pagination: {
          total,
          limit,
          offset,
          has_more: offset + limit < total
        }
      })
    } catch (error) {
      fastify.log.error({ error, wallet }, 'Error fetching receipts by wallet')
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch receipts'
      })
    }
  })

  /**
   * GET /receipts/blink/:slug - List all receipts for a blink (paginated)
   * Returns list of all transactions for a specific blink
   */
  fastify.get<{
    Params: { slug: string }
    Querystring: { limit?: number; offset?: number; status?: string }
  }>('/blink/:slug', {
    schema: {
      description: 'List receipts by blink slug (public, paginated)',
      tags: ['receipts'],
      params: {
        type: 'object',
        properties: {
          slug: {
            type: 'string',
            description: 'Blink slug'
          }
        },
        required: ['slug']
      },
      querystring: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            minimum: 1,
            maximum: 100,
            default: 20
          },
          offset: {
            type: 'number',
            minimum: 0,
            default: 0
          },
          status: {
            type: 'string',
            enum: ['pending', 'paid', 'executed', 'failed']
          }
        }
      }
    }
  }, async (request, reply) => {
    const { slug } = request.params
    const { limit = 20, offset = 0, status } = request.query

    try {
      // Count query
      const countQuery = status
        ? 'SELECT COUNT(*) FROM runs r JOIN blinks b ON r.blink_id = b.id WHERE b.slug = $1 AND r.status = $2'
        : 'SELECT COUNT(*) FROM runs r JOIN blinks b ON r.blink_id = b.id WHERE b.slug = $1'
      const countParams = status ? [slug, status] : [slug]
      const countResult = await getPool().query(countQuery, countParams)
      const total = parseInt(countResult.rows[0].count)

      // Data query
      const dataQuery = status
        ? `SELECT
            r.signature, r.reference, r.payer, r.status, r.paid_at, r.executed_at, r.duration_ms
          FROM runs r
          JOIN blinks b ON r.blink_id = b.id
          WHERE b.slug = $1 AND r.status = $2
          ORDER BY r.created_at DESC
          LIMIT $3 OFFSET $4`
        : `SELECT
            r.signature, r.reference, r.payer, r.status, r.paid_at, r.executed_at, r.duration_ms
          FROM runs r
          JOIN blinks b ON r.blink_id = b.id
          WHERE b.slug = $1
          ORDER BY r.created_at DESC
          LIMIT $2 OFFSET $3`
      const dataParams = status ? [slug, status, limit, offset] : [slug, limit, offset]
      const dataResult = await getPool().query(dataQuery, dataParams)

      const receipts = dataResult.rows.map(row => ({
        signature: row.signature,
        reference: row.reference,
        payer: row.payer,
        status: row.status,
        paid_at: row.paid_at?.toISOString() || null,
        executed_at: row.executed_at?.toISOString() || null,
        duration_ms: row.duration_ms
      }))

      return reply.code(200).send({
        success: true,
        data: receipts,
        pagination: {
          total,
          limit,
          offset,
          has_more: offset + limit < total
        }
      })
    } catch (error) {
      fastify.log.error({ error, slug }, 'Error fetching receipts by blink')
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch receipts'
      })
    }
  })

  // ========== AUTHENTICATED ENDPOINTS (EXISTING) ==========

  // POST /receipts/:id - Get receipt by run ID (requires authentication)
  // Users can only view receipts for their own blinks or runs they paid for
  // Changed to POST to support wallet authentication in body
  fastify.post<{
    Params: { id: string }
    Body: WalletAuthBody
  }>('/:id', {
    preHandler: verifyWalletAuth,
  }, async (request, reply) => {
    const { id } = request.params
    // Get authenticated wallet (guaranteed by verifyWalletAuth preHandler)
    const authenticatedWallet = request.authenticatedWallet!

    try {
      const receipt = await getReceiptByRunId(id)

      if (!receipt) {
        return reply.code(404).send({
          success: false,
          error: 'Receipt not found'
        })
      }

      // Get the run to verify ownership
      const run = await getRunByReference(receipt.run_id)
      if (!run) {
        return reply.code(404).send({
          success: false,
          error: 'Associated run not found'
        })
      }

      // Get the blink to check if user is the creator
      const blink = await getBlinkById(run.blink_id)
      if (!blink) {
        return reply.code(404).send({
          success: false,
          error: 'Associated blink not found'
        })
      }

      // Check if user is either the blink creator or the payer
      const isCreator = verifyOwnership(authenticatedWallet, blink.creator.wallet)
      const isPayer = run.payer && verifyOwnership(authenticatedWallet, run.payer)

      if (!isCreator && !isPayer) {
        return reply.code(403).send({
          success: false,
          error: 'Forbidden: You can only view receipts for blinks you created or runs you paid for'
        })
      }

      return reply.code(200).send({
        success: true,
        data: receipt
      })
    } catch (error) {
      fastify.log.error({ error, id }, 'Error fetching receipt')
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch receipt',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  // POST /receipts - Create cNFT receipt (optional feature, requires authentication)
  // Only the blink creator can mint receipts for their runs
  fastify.post<{
    Body: WalletAuthBody & { run_id: string; tree: string; leaf: string }
  }>('/', {
    preHandler: verifyWalletAuth,
  }, async (request, reply) => {
    const { run_id, tree, leaf } = request.body
    // Get authenticated wallet (guaranteed by verifyWalletAuth preHandler)
    const authenticatedWallet = request.authenticatedWallet!

    if (!run_id || !tree || !leaf) {
      return reply.code(400).send({
        success: false,
        error: 'Missing required fields: run_id, tree, leaf'
      })
    }

    try {
      // Get the run to verify it exists
      const run = await getRunByReference(run_id)
      if (!run) {
        return reply.code(404).send({
          success: false,
          error: 'Run not found'
        })
      }

      // Get the blink to verify creator ownership
      const blink = await getBlinkById(run.blink_id)
      if (!blink) {
        return reply.code(404).send({
          success: false,
          error: 'Associated blink not found'
        })
      }

      // Only the blink creator can mint receipts
      if (!verifyOwnership(authenticatedWallet, blink.creator.wallet)) {
        return reply.code(403).send({
          success: false,
          error: 'Forbidden: Only the blink creator can mint receipts'
        })
      }

      // Here you would implement the cNFT minting logic
      // For now, just acknowledge the request
      return reply.code(501).send({
        success: false,
        error: 'Receipt minting not implemented',
        message: 'cNFT receipt feature is optional and not yet implemented',
      })
    } catch (error) {
      fastify.log.error({ error, run_id }, 'Error creating receipt')
      return reply.code(500).send({
        success: false,
        error: 'Failed to create receipt',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })
}
