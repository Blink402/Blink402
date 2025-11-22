"use client"

import { useEffect, useState } from 'react'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { logger } from '@/lib/logger'
import { GalleryGrid } from '@/components/GalleryGrid'
import { GalleryUploadZone } from '@/components/GalleryUploadZone'

interface GalleryImage {
  id: string
  filePath: string
  caption: string | null
  uploadedAt: string
}

export default function GalleryManagePage() {
  const { ready, authenticated } = usePrivy()
  const { wallets } = useWallets()
  const wallet = wallets[0]
  const publicKey = wallet?.address
  const connected = authenticated && !!wallet
  const router = useRouter()
  const [images, setImages] = useState<GalleryImage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchImages = async () => {
    if (!publicKey) return

    try {
      setIsLoading(true)
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/gallery/${publicKey}/images`
      )

      if (!response.ok) {
        throw new Error('Failed to fetch images')
      }

      const data = await response.json()
      setImages(data.images)
    } catch (err) {
      logger.error('Error fetching images:', err)
      setError(err instanceof Error ? err.message : 'Failed to load images')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (connected && publicKey) {
      fetchImages()
    } else {
      setIsLoading(false)
    }
  }, [connected, publicKey])

  const handleDelete = async (id: string) => {
    if (!publicKey) return

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/gallery/${publicKey}/images/${id}`,
        {
          method: 'DELETE',
          headers: {
            'x-request-wallet': publicKey
          }
        }
      )

      if (!response.ok) {
        throw new Error('Failed to delete image')
      }

      // Refresh images list
      await fetchImages()
    } catch (err) {
      logger.error('Error deleting image:', err)
      alert('Failed to delete image')
    }
  }

  if (!connected) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-md mx-auto border-2 border-dashed border-neon-grey p-8">
          <div className="mb-4 flex justify-center">
            <Image src="/lock.svg" alt="Locked" width={80} height={80} className="opacity-80" />
          </div>
          <h1 className="text-2xl font-sans font-light mb-4 text-neon-white">
            Connect Your Wallet
          </h1>
          <p className="text-neon-grey font-mono">
            Please connect your wallet to manage your gallery
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-sans font-light mb-2 text-neon-white">
          Manage Your Gallery
        </h1>
        <p className="text-neon-grey font-mono text-sm">
          Wallet: {publicKey}
        </p>
        <div className="flex gap-4 mt-2">
          <a
            href={`/gallery/${publicKey}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-neon-blue-light hover:underline text-sm font-mono inline-block"
          >
            View Public Gallery →
          </a>
          <a
            href="/gallery/settings"
            className="text-neon-blue-light hover:underline text-sm font-mono inline-block"
          >
            Gallery Settings →
          </a>
        </div>
      </div>

      <GalleryUploadZone
        wallet={publicKey || ''}
        onUploadSuccess={fetchImages}
      />

      {error && (
        <div className="mb-4 p-4 border-2 border-red-500 bg-red-500/10 text-red-400">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-16">
          <div className="text-neon-blue-light text-2xl font-mono animate-pulse">
            Loading gallery...
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4 flex justify-between items-center">
            <h2 className="text-2xl font-sans font-light text-neon-white">
              Your Images ({images.length})
            </h2>
          </div>
          <GalleryGrid images={images} isOwner={true} onDelete={handleDelete} />
        </>
      )}
    </div>
  )
}
