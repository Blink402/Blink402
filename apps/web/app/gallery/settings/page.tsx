"use client"

import { useState, useEffect } from 'react'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { useRouter } from 'next/navigation'
import { logger } from '@/lib/logger'

interface GalleryBlink {
  slug: string
  price_usdc: string
  payment_token: string
  access_duration_days: number
}

export default function GallerySettingsPage() {
  const { ready, authenticated } = usePrivy()
  const { wallets } = useWallets()
  const wallet = wallets[0]
  const publicKey = wallet?.address
  const connected = authenticated && !!wallet
  const router = useRouter()
  const [galleryBlink, setGalleryBlink] = useState<GalleryBlink | null>(null)
  const [price, setPrice] = useState('0.05')
  const [duration, setDuration] = useState('30')
  // Gallery always uses SOL (not USDC) to avoid token account issues
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    if (!connected || !publicKey) {
      setIsLoading(false)
      return
    }

    // Fetch existing gallery blink settings
    fetchGallerySettings()
  }, [connected, publicKey])

  const fetchGallerySettings = async () => {
    if (!publicKey) return

    try {
      setIsLoading(true)
      // Check if a gallery blink exists for this wallet
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/blinks`
      )

      if (response.ok) {
        const blinks = await response.json()
        const existingGalleryBlink = blinks.find(
          (b: any) =>
            b.endpoint_url?.includes(`/gallery/${publicKey}`) ||
            b.slug === `gallery-${publicKey.slice(0, 8)}`
        )

        if (existingGalleryBlink) {
          setGalleryBlink(existingGalleryBlink)
          setPrice(existingGalleryBlink.price_usdc || '0.05')
          setDuration(existingGalleryBlink.access_duration_days?.toString() || '30')
        }
      }
    } catch (error) {
      logger.error('Error fetching gallery settings:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!publicKey) return

    try {
      setIsSaving(true)
      setMessage(null)

      // Use the gallery-specific configuration endpoint
      const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/gallery/${publicKey}/configure`

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          price_usdc: price,
          payment_token: 'USDC', // Gallery uses USDC (required for PayAI x402)
          access_duration_days: parseInt(duration),
          walletAddress: publicKey // For basic validation
        }),
      })

      if (response.ok) {
        const result = await response.json()
        logger.debug('Gallery configuration result:', result)
        setMessage({ type: 'success', text: 'Gallery settings saved successfully! Your gallery is now available for purchase.' })
        // Refresh settings to show the created blink
        await fetchGallerySettings()
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save settings')
      }
    } catch (error) {
      logger.error('Error saving gallery settings:', error)
      setMessage({ type: 'error', text: 'Failed to save settings. Please try again.' })
    } finally {
      setIsSaving(false)
    }
  }

  if (!connected) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-md mx-auto border-2 border-dashed border-neon-grey p-8">
          <div className="mb-4 text-6xl">🔐</div>
          <h1 className="text-2xl font-sans font-light mb-4 text-neon-white">
            Connect Your Wallet
          </h1>
          <p className="text-neon-grey font-mono">
            Please connect your wallet to manage gallery settings
          </p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="text-neon-blue-light text-2xl animate-pulse">
          Loading settings...
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-4xl font-sans font-light mb-2 text-neon-white">
          Gallery Settings
        </h1>
        <p className="text-neon-grey font-mono text-sm">
          Configure pricing and access for your gallery
        </p>
      </div>

      {message && (
        <div className={`mb-6 p-4 border-2 ${
          message.type === 'success'
            ? 'border-neon-blue-light bg-neon-blue-light/10 text-neon-blue-light'
            : 'border-red-500 bg-red-500/10 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      <div className="space-y-6 border-2 border-dashed border-neon-grey p-6 bg-neon-dark">
        {/* Note: Gallery uses USDC for PayAI x402 */}
        <div className="p-3 bg-neon-blue-light/10 border border-neon-blue-light/30 text-neon-blue-light text-sm font-['Geist_Mono']">
          💡 Gallery access uses USDC payments via PayAI x402
        </div>

        {/* Price Input */}
        <div>
          <label className="block text-neon-white mb-2 font-['Geist_Sans']">
            Price (SOL)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full p-3 bg-neon-black border-2 border-neon-grey text-neon-white font-['Geist_Mono'] focus:border-neon-blue-light focus:outline-none"
            placeholder="0.05"
          />
          <p className="mt-1 text-sm text-neon-grey">
            Recommended: 0.05 - 0.5 SOL
          </p>
        </div>

        {/* Access Duration */}
        <div>
          <label className="block text-neon-white mb-2 font-['Geist_Sans']">
            Access Duration (days)
          </label>
          <input
            type="number"
            min="1"
            max="365"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full p-3 bg-neon-black border-2 border-neon-grey text-neon-white font-['Geist_Mono'] focus:border-neon-blue-light focus:outline-none"
            placeholder="30"
          />
          <p className="mt-1 text-sm text-neon-grey">
            How many days buyers get access to your gallery
          </p>
        </div>

        {/* Gallery Link Preview */}
        <div>
          <label className="block text-neon-white mb-2 font-['Geist_Sans']">
            Your Gallery Link
          </label>
          <div className="p-3 bg-neon-black border-2 border-neon-grey font-['Geist_Mono'] text-sm text-neon-grey break-all">
            https://blink402.dev/gallery/{publicKey}
          </div>
          {galleryBlink && (
            <a
              href={`/gallery/${publicKey}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-neon-blue-light hover:underline text-sm"
            >
              View your public gallery →
            </a>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 pt-4">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
          <button
            onClick={() => router.push('/gallery/manage')}
            className="btn-ghost flex-1"
          >
            Back to Gallery
          </button>
        </div>
      </div>

      {/* Help Text */}
      <div className="mt-8 p-6 bg-neon-dark border-2 border-dashed border-neon-grey/50">
        <h3 className="text-lg font-['Geist_Sans'] mb-3 text-neon-white">
          How Gallery Pricing Works
        </h3>
        <ul className="space-y-2 text-sm text-neon-grey font-['Geist_Mono']">
          <li>• Visitors pay once to access all your gallery images</li>
          <li>• Access expires after the duration you set</li>
          <li>• Payments go directly to your wallet</li>
          <li>• You can change prices anytime</li>
          <li>• Gallery owners always have free access</li>
        </ul>
      </div>

      {/* Sharing Instructions */}
      {galleryBlink && (
        <div className="mt-4 p-6 bg-neon-dark border-2 border-dashed border-neon-blue-light/30">
          <h3 className="text-lg font-['Geist_Sans'] mb-3 text-neon-blue-light">
            ✅ Your Gallery is Ready!
          </h3>
          <p className="text-sm text-neon-grey font-['Geist_Mono'] mb-2">
            Share your gallery link with potential buyers:
          </p>
          <div className="p-3 bg-neon-black border border-neon-blue-light/50 text-neon-blue-light font-['Geist_Mono'] text-sm break-all">
            https://blink402.dev/gallery/{publicKey}
          </div>
        </div>
      )}
    </div>
  )
}