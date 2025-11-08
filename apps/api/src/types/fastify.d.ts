/**
 * Type augmentation for Fastify
 * This extends the FastifyRequest interface to add custom properties
 */

import 'fastify'

declare module 'fastify' {
  interface FastifyRequest {
    /**
     * The authenticated wallet address from the wallet signature verification
     * This property is set by the verifyWalletAuth middleware
     */
    authenticatedWallet?: string
  }
}
