/**
 * Type declarations for Solana web3.js internal APIs
 * Used when we need to bypass standard web3.js validation
 */

import { Connection } from '@solana/web3.js'

declare module '@solana/web3.js' {
  interface Connection {
    /**
     * Internal RPC request method
     * Used to make raw RPC calls bypassing web3.js validation
     *
     * @private This is an internal API and may change in future versions
     * @param method - RPC method name (e.g., 'getTransaction')
     * @param args - Array of arguments for the RPC method
     */
    _rpcRequest(method: string, args: any[]): Promise<any>
  }
}
