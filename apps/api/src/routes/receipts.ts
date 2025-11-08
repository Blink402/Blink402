import { FastifyPluginAsync } from 'fastify'
import { getReceiptByRunId, getRunByReference, getBlinkById } from '@blink402/database'
import { verifyWalletAuth, verifyOwnership, type WalletAuthBody } from '../auth.js'

export const receiptsRoutes: FastifyPluginAsync = async (fastify) => {
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
