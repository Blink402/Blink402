/**
 * Payment Status API
 *
 * Allows clients to check the status of a payment by reference UUID
 * before attempting to pay again, reducing duplicate payment errors.
 */

import { FastifyPluginAsync } from 'fastify'
import { getRunByReference } from '@blink402/database'
import { isRedisConnected, getCacheOrFetch } from '@blink402/redis'

export const paymentsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/payments/:reference/status
   *
   * Check the status of a payment by its reference UUID.
   * Returns payment details including status, signature, payer, and timestamps.
   *
   * Responses:
   * - 200: Payment found, returns status
   * - 404: Payment not found
   * - 500: Server error
   */
  fastify.get<{
    Params: { reference: string }
    Reply: {
      success: boolean
      data?: {
        reference: string
        status: 'pending' | 'paid' | 'executed' | 'failed'
        signature: string | null
        payer: string | null
        blink_id: string
        created_at: string
        expires_at: string | null
        paid_at: string | null
        executed_at: string | null
        error_message: string | null
      }
      error?: string
    }
  }>(
    '/:reference/status',
    {
      schema: {
        description: 'Check payment status by reference UUID',
        tags: ['payments'],
        params: {
          type: 'object',
          properties: {
            reference: {
              type: 'string',
              format: 'uuid',
              description: 'Payment reference UUID'
            }
          },
          required: ['reference']
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  reference: { type: 'string' },
                  status: { type: 'string', enum: ['pending', 'paid', 'executed', 'failed'] },
                  signature: { type: ['string', 'null'] },
                  payer: { type: ['string', 'null'] },
                  blink_id: { type: 'string' },
                  created_at: { type: 'string' },
                  expires_at: { type: ['string', 'null'] },
                  paid_at: { type: ['string', 'null'] },
                  executed_at: { type: ['string', 'null'] },
                  error_message: { type: ['string', 'null'] }
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
    },
    async (request, reply) => {
      const { reference } = request.params

      try {
        // Use cache if Redis is available (5 second TTL)
        // This reduces DB load for frequently checked payments
        const run = await (isRedisConnected()
          ? getCacheOrFetch(
              `payment:status:${reference}`,
              () => getRunByReference(reference),
              5 // 5 second cache TTL
            )
          : getRunByReference(reference))

        if (!run) {
          fastify.log.debug({ reference }, 'Payment not found')
          return reply.code(404).send({
            success: false,
            error: 'Payment not found'
          })
        }

        fastify.log.info({ reference, status: run.status }, 'Payment status retrieved')

        return reply.code(200).send({
          success: true,
          data: {
            reference: run.reference,
            status: run.status,
            signature: run.signature,
            payer: run.payer,
            blink_id: run.blink_id,
            created_at: run.created_at.toISOString(),
            expires_at: run.expires_at?.toISOString() || null,
            paid_at: run.paid_at?.toISOString() || null,
            executed_at: run.executed_at?.toISOString() || null,
            error_message: null // Field doesn't exist in database schema yet
          }
        })
      } catch (error) {
        fastify.log.error({ error, reference }, 'Error fetching payment status')
        return reply.code(500).send({
          success: false,
          error: 'Failed to fetch payment status'
        })
      }
    }
  )

  /**
   * GET /api/payments/:reference/exists
   *
   * Quick check if a payment reference exists (lighter than full status)
   * Useful for client-side validation before attempting payment.
   */
  fastify.get<{
    Params: { reference: string }
    Reply: {
      success: boolean
      exists: boolean
      status?: 'pending' | 'paid' | 'executed' | 'failed'
    }
  }>(
    '/:reference/exists',
    {
      schema: {
        description: 'Check if payment reference exists',
        tags: ['payments'],
        params: {
          type: 'object',
          properties: {
            reference: {
              type: 'string',
              format: 'uuid'
            }
          }
        }
      }
    },
    async (request, reply) => {
      const { reference } = request.params

      try {
        // Use cache with 10 second TTL for existence checks
        const run = await (isRedisConnected()
          ? getCacheOrFetch(
              `payment:exists:${reference}`,
              () => getRunByReference(reference),
              10
            )
          : getRunByReference(reference))

        return reply.code(200).send({
          success: true,
          exists: !!run,
          ...(run && { status: run.status })
        })
      } catch (error) {
        fastify.log.error({ error, reference }, 'Error checking payment existence')
        return reply.code(500).send({
          success: false,
          exists: false
        })
      }
    }
  )
}
