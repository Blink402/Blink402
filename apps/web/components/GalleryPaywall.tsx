"use client"

import { useState } from 'react'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { useOnchainPay } from '@onchainfi/connect'
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
  const { ready, authenticated, login } = usePrivy()
  const { wallets } = useWallets()
  const wallet = wallets[0]
  const publicKey = wallet?.address
  const connected = authenticated && !!wallet

  const { pay, isPaying } = useOnchainPay({
    apiKey: process.env.NEXT_PUBLIC_ONCHAIN_API_KEY || '',
    autoVerify: true,
    autoSettle: true,
  })

  const [error, setError] = useState<string | null>(null)

  const handlePay = async () => {
    if (!connected || !publicKey) {
      setError('Please connect your wallet first')
      login()
      return
    }

    setError(null)

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

      // Step 1: Pay using ONCHAIN Connect SDK
      logger.debug('Starting gallery payment:', { price, creatorWallet, blinkSlug })

      const paymentResult = await pay({
        to: creatorWallet,
        amount: price,
        sourceNetwork: "solana",
        destinationNetwork: "solana",
        priority: "balanced",
      })

      if (!paymentResult.success) {
        throw new Error(paymentResult.error || 'Payment failed')
      }

      logger.debug('Payment successful:', paymentResult)

      // Step 2: Call unlock endpoint with payment confirmation
      const unlockResponse = await fetch(`${API_URL}/api/gallery/${creatorWallet}/unlock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment-Tx': paymentResult.txHash || '',
        },
        body: JSON.stringify({
          paymentTx: paymentResult.txHash,
          viewerWallet: publicKey,
          blinkSlug,
        }),
      })

      if (!unlockResponse.ok) {
        const errorData = await unlockResponse.json()
        throw new Error(errorData.error || 'Failed to unlock gallery access')
      }

      logger.debug('Gallery unlocked successfully')

      // Reload page to show gallery
      window.location.reload()
    } catch (err) {
      logger.error('Payment error:', err)
      setError(err instanceof Error ? err.message : 'Payment failed')
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
          <div className="text-5xl font-mono text-neon-blue-light mb-2">
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
            disabled={isPaying}
            className="btn-primary px-8 py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPaying ? 'Processing payment...' : `Pay ${price} ${paymentToken}`}
          </button>
        ) : (
          <button
            onClick={() => login()}
            className="btn-primary px-8 py-4 text-lg"
          >
            Connect Wallet to Purchase
          </button>
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
