"use client"

import { useState } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { Transaction, VersionedTransaction } from '@solana/web3.js'
import Image from 'next/image'
import { logger } from '@/lib/logger'

interface GalleryPaywallProps {
  creatorWallet: string
  blinkSlug: string
  price: string
  durationDays: number
  paymentToken: string
}

export function GalleryPaywall({
  creatorWallet,
  blinkSlug,
  price,
  durationDays,
  paymentToken,
}: GalleryPaywallProps) {
  const { publicKey, connected, signTransaction, sendTransaction } = useWallet()
  const { connection } = useConnection()
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePay = async () => {
    if (!connected || !publicKey || !signTransaction) {
      setError('Please connect your wallet first')
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      // 1. Call POST /actions/:slug to get the transaction
      const actionsResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/actions/${blinkSlug}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            account: publicKey.toBase58(),
          }),
        }
      )

      if (!actionsResponse.ok) {
        throw new Error('Failed to create payment transaction')
      }

      const actionsData = await actionsResponse.json()
      const { transaction: txBase64, reference } = actionsData

      // 2. Deserialize and sign the transaction
      const txBuffer = Buffer.from(txBase64, 'base64')
      let transaction: Transaction | VersionedTransaction

      try {
        transaction = VersionedTransaction.deserialize(txBuffer)
      } catch {
        transaction = Transaction.from(txBuffer)
      }

      // Sign the transaction
      const signedTx = await signTransaction(transaction)

      // 3. Send transaction to Solana
      let signature: string
      if (signedTx instanceof VersionedTransaction) {
        signature = await connection.sendTransaction(signedTx)
      } else {
        signature = await connection.sendTransaction(signedTx, [])
      }

      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed')

      // 4. Call POST /api/gallery/:wallet/unlock to grant access
      const unlockResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/gallery/${creatorWallet}/unlock`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reference,
            viewerWallet: publicKey.toBase58(),
            blinkSlug,
          }),
        }
      )

      if (!unlockResponse.ok) {
        throw new Error('Failed to unlock gallery access')
      }

      // 5. Reload page to show gallery
      window.location.reload()
    } catch (err) {
      logger.error('Payment error:', err)
      setError(err instanceof Error ? err.message : 'Payment failed')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto text-center py-16">
      <div className="border-2 border-dashed border-neon-grey p-8 bg-neon-dark">
        <div className="mb-6 flex justify-center">
          <Image src="/lock.svg" alt="Locked" width={80} height={80} className="opacity-80" />
        </div>
        <h2 className="text-3xl font-sans font-light mb-4 text-neon-white">
          Premium Gallery Access
        </h2>
        <p className="text-neon-grey mb-8 font-mono">
          Get exclusive access to this creator's full gallery for {durationDays} days
        </p>

        <div className="mb-8 p-6 bg-neon-black border-2 border-neon-grey">
          <div className="text-5xl font-mono text-neon-green-light mb-2">
            {price} {paymentToken}
          </div>
          <div className="text-neon-grey text-sm font-mono">
            {durationDays} days access • All images • New uploads included
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 border-2 border-red-500 bg-red-500/10 text-red-400 text-sm">
            {error}
          </div>
        )}

        {connected ? (
          <button
            onClick={handlePay}
            disabled={isProcessing}
            className="btn-primary px-8 py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? 'Processing...' : `Pay ${price} ${paymentToken}`}
          </button>
        ) : (
          <div className="text-neon-grey font-mono">
            <p className="mb-4">Connect your wallet to purchase access</p>
            <p className="text-sm">Use the wallet button in the navigation</p>
          </div>
        )}

        <div className="mt-8 pt-8 border-t border-neon-grey text-left text-sm text-neon-grey font-mono space-y-2">
          <p>✓ Instant access after payment</p>
          <p>✓ Access all current and future uploads</p>
          <p>✓ Secure on-chain payment verification</p>
          <p>✓ {durationDays} days of unlimited viewing</p>
        </div>
      </div>
    </div>
  )
}
