"use client"

import { useEffect, useState } from 'react'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { GalleryGrid } from '@/components/GalleryGrid'
import { GalleryPaywall } from '@/components/GalleryPaywall'
import { logger } from '@/lib/logger'

interface GalleryImage {
  id: string
  filePath: string
  caption: string | null
  uploadedAt: string
}

interface AccessInfo {
  hasAccess: boolean
  expiresAt: string | null
  paidAt?: string
}

interface BlinkInfo {
  slug: string
  price_usdc: string
  access_duration_days: number
  payment_token: string
}

export default function GalleryViewPage() {
  const { wallet: creatorWallet } = useParams<{ wallet: string }>()
  const { ready, authenticated } = usePrivy()
  const { wallets } = useWallets()
  const wallet = wallets[0]
  const publicKey = wallet?.address
  const connected = authenticated && !!wallet
  const [images, setImages] = useState<GalleryImage[]>([])
  const [accessInfo, setAccessInfo] = useState<AccessInfo | null>(null)
  const [blinkInfo, setBlinkInfo] = useState<BlinkInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isOwner = connected && publicKey === creatorWallet

  const checkAccess = async () => {
    if (!publicKey) {
      setAccessInfo({ hasAccess: false, expiresAt: null })
      return false
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/gallery/${creatorWallet}/check-access?viewer=${publicKey}`
      )

      if (!response.ok) {
        throw new Error('Failed to check access')
      }

      const data = await response.json()
      setAccessInfo(data)
      return data.hasAccess
    } catch (err) {
      logger.error('Error checking access:', err)
      return false
    }
  }

  const fetchBlinkInfo = async () => {
    try {
      // Fetch all blinks and find one that matches this creator's wallet
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/blinks`
      )

      if (!response.ok) {
        throw new Error('Failed to fetch blink info')
      }

      const data = await response.json()
      // Handle both direct array and wrapped response
      const blinks = Array.isArray(data) ? data : (data.data || data.blinks || [])
      logger.debug('Fetched blinks:', blinks)

      // Find a gallery blink for this creator - try multiple methods
      const galleryBlink = blinks.find((b: any) => {
        // Check if endpoint URL contains the gallery path
        if (b.endpoint_url?.includes(`/gallery/${creatorWallet}`)) return true
        // Also check by slug pattern
        if (b.slug === `gallery-${creatorWallet.slice(0, 8)}`) return true
        // Check if it's a gallery type for this wallet
        if (b.category === 'gallery' && b.payout_wallet === creatorWallet) return true
        return false
      })

      logger.debug('Found gallery blink:', galleryBlink)

      if (galleryBlink) {
        setBlinkInfo({
          slug: galleryBlink.slug,
          price_usdc: galleryBlink.price_usdc,
          access_duration_days: galleryBlink.access_duration_days || 30,
          payment_token: galleryBlink.payment_token || 'SOL',
        })
      } else {
        // No blink exists - gallery owner needs to set up pricing
        setBlinkInfo(null)
      }
    } catch (err) {
      logger.error('Error fetching blink info:', err)
      // Error fetching blink info - gallery might not be set up
      setBlinkInfo(null)
    }
  }

  const fetchImages = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/gallery/${creatorWallet}/images`
      )

      if (!response.ok) {
        throw new Error('Failed to fetch images')
      }

      const data = await response.json()
      setImages(data.images)
    } catch (err) {
      logger.error('Error fetching images:', err)
      setError(err instanceof Error ? err.message : 'Failed to load images')
    }
  }

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      setError(null)

      // Fetch blink info for paywall
      await fetchBlinkInfo()

      // If owner, always show images
      if (isOwner) {
        await fetchImages()
        setAccessInfo({ hasAccess: true, expiresAt: null })
        setIsLoading(false)
        return
      }

      // Check if viewer has access
      const hasAccess = await checkAccess()

      if (hasAccess) {
        await fetchImages()
      }

      setIsLoading(false)
    }

    load()
  }, [creatorWallet, publicKey, connected])

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="text-neon-blue-light text-2xl font-mono animate-pulse">
          Loading gallery...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-md mx-auto border-2 border-red-500 bg-red-500/10 p-8 text-red-400">
          <div className="mb-4 text-6xl">⚠️</div>
          <h1 className="text-2xl font-sans font-light mb-4">Error</h1>
          <p className="font-mono">{error}</p>
        </div>
      </div>
    )
  }

  // Show paywall if no access
  if (!accessInfo?.hasAccess && !isOwner) {
    // If no blink info, gallery isn't set up for payments
    if (!blinkInfo) {
      return (
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-sans font-light mb-2 text-neon-white">
              Creator Gallery
            </h1>
            <p className="text-neon-grey font-mono text-sm">
              {creatorWallet}
            </p>
          </div>
          <div className="max-w-2xl mx-auto text-center py-16">
            <div className="border-2 border-dashed border-neon-grey p-8 bg-neon-dark">
              <div className="mb-6 flex justify-center">
                <Image src="/lock.svg" alt="Locked" width={80} height={80} className="opacity-80" />
              </div>
              <h2 className="text-3xl font-sans font-light mb-4 text-neon-white">
                Gallery Not Available
              </h2>
              <p className="text-neon-grey mb-4 font-mono">
                This gallery hasn't been set up for public access yet.
              </p>
              <p className="text-neon-grey text-sm font-mono">
                The creator needs to configure pricing settings before the gallery can accept payments.
              </p>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-sans font-light mb-2 text-neon-white">
            Creator Gallery
          </h1>
          <p className="text-neon-grey font-mono text-sm">
            {creatorWallet}
          </p>
        </div>
        <GalleryPaywall
          creatorWallet={creatorWallet}
          blinkSlug={blinkInfo.slug}
          price={blinkInfo.price_usdc}
          durationDays={blinkInfo.access_duration_days}
          paymentToken={blinkInfo.payment_token}
        />
      </div>
    )
  }

  // Show gallery with access
  const daysRemaining = accessInfo?.expiresAt
    ? Math.ceil(
        (new Date(accessInfo.expiresAt).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24)
      )
    : null

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-sans font-light mb-2 text-neon-white">
          {isOwner ? 'Your Gallery' : 'Creator Gallery'}
        </h1>
        <p className="text-neon-grey font-mono text-sm mb-2">
          {creatorWallet}
        </p>
        {!isOwner && daysRemaining !== null && (
          <p className="text-neon-blue-light text-sm font-mono">
            ✓ Access expires in {daysRemaining} days
          </p>
        )}
        {isOwner && (
          <a
            href="/gallery/manage"
            className="text-neon-blue-light hover:underline text-sm font-mono inline-block"
          >
            Manage Gallery →
          </a>
        )}
      </div>

      {images.length === 0 ? (
        <div className="text-center py-16">
          <div className="mb-4 flex justify-center">
            <Image 
              src="/oneupsol-camera-blue.svg" 
              alt="Camera icon" 
              width={96} 
              height={96} 
              className="opacity-80"
            />
          </div>
          <p className="text-neon-grey text-lg font-mono">
            {isOwner
              ? 'No images yet. Upload your first image to get started!'
              : 'This gallery is empty. Check back later!'}
          </p>
          {isOwner && (
            <a
              href="/gallery/manage"
              className="inline-block mt-4 btn-primary font-mono"
            >
              Upload Images
            </a>
          )}
        </div>
      ) : (
        <GalleryGrid images={images} isOwner={false} />
      )}
    </div>
  )
}
