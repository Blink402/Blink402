"use client"

import { useState, useCallback } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { logger } from '@/lib/logger'

interface GalleryUploadZoneProps {
  wallet: string
  onUploadSuccess: () => void
}

export function GalleryUploadZone({ wallet, onUploadSuccess }: GalleryUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const uploadFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB')
      return
    }

    setIsUploading(true)
    setError(null)
    setUploadProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/gallery/upload?wallet=${wallet}&uploaderWallet=${wallet}`,
        {
          method: 'POST',
          headers: {
            'x-uploader-wallet': wallet
          },
          body: formData,
        }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Upload failed')
      }

      setUploadProgress(100)
      setTimeout(() => {
        onUploadSuccess()
        setUploadProgress(0)
      }, 500)
    } catch (err) {
      logger.error('Upload error:', err)
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) {
        await uploadFile(files[0])
      }
    },
    [wallet, onUploadSuccess]
  )

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      await uploadFile(files[0])
    }
  }

  return (
    <div className="mb-8">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-none p-8 text-center transition-all',
          isDragging
            ? 'border-neon-blue-light bg-neon-dark/50'
            : 'border-neon-grey hover:border-neon-blue-light',
          isUploading && 'opacity-50 pointer-events-none'
        )}
      >
        <input
          type="file"
          accept="image/*"
          onChange={handleFileInput}
          disabled={isUploading}
          className="hidden"
          id="file-upload"
        />

        {isUploading ? (
          <div className="space-y-4">
            <div className="text-neon-blue-light text-2xl font-mono">Uploading...</div>
            <div className="w-full bg-neon-dark border border-neon-grey h-2">
              <div
                className="bg-gradient-to-r from-neon-blue-light to-neon-blue-dark h-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 flex justify-center">
              <Image 
                src="/oneupsol-camera-blue.svg" 
                alt="Camera icon" 
                width={96} 
                height={96} 
                className="opacity-80"
              />
            </div>
            <p className="text-neon-white mb-2 font-mono">
              Drag & drop an image here, or
            </p>
            <label
              htmlFor="file-upload"
              className="inline-block btn-primary cursor-pointer font-mono"
            >
              Choose File
            </label>
            <p className="text-neon-grey text-sm mt-4 font-mono">
              Supports: JPG, PNG, WebP, GIF • Max size: 10MB
            </p>
          </>
        )}

        {error && (
          <div className="mt-4 p-3 border-2 border-red-500 bg-red-500/10 text-red-400 text-sm font-mono">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
