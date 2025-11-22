"use client"

import { useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface GalleryImage {
  id: string
  filePath: string
  thumbnailPath?: string | null
  caption: string | null
  uploadedAt: string
}

interface GalleryGridProps {
  images: GalleryImage[]
  isOwner?: boolean
  onDelete?: (id: string) => void
}

export function GalleryGrid({ images, isOwner = false, onDelete }: GalleryGridProps) {
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4">
          <Image 
            src="/oneupsol-camera-blue.svg" 
            alt="Camera icon" 
            width={96} 
            height={96} 
            className="opacity-80"
          />
        </div>
        <p className="text-neon-grey text-lg">No images yet</p>
        {isOwner && <p className="text-neon-grey text-sm mt-2">Upload your first image to get started</p>}
      </div>
    )
  }

  const openLightbox = (image: GalleryImage, index: number) => {
    setSelectedImage(image)
    setCurrentIndex(index)
  }

  const closeLightbox = () => {
    setSelectedImage(null)
  }

  const goToNext = () => {
    const nextIndex = (currentIndex + 1) % images.length
    setCurrentIndex(nextIndex)
    setSelectedImage(images[nextIndex])
  }

  const goToPrevious = () => {
    const prevIndex = (currentIndex - 1 + images.length) % images.length
    setCurrentIndex(prevIndex)
    setSelectedImage(images[prevIndex])
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this image?')) {
      onDelete?.(id)
    }
  }

  return (
    <>
      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {images.map((image, index) => (
          <div
            key={image.id}
            className="relative aspect-square overflow-hidden bg-neon-dark border-2 border-dashed border-neon-grey hover:border-neon-blue-light transition-all cursor-pointer group"
            onClick={() => openLightbox(image, index)}
          >
            <Image
              src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/uploads/${image.thumbnailPath || image.filePath}`}
              alt={image.caption || 'Gallery image'}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
            {isOwner && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(image.id)
                }}
                className="absolute top-2 right-2 bg-red-500 text-white px-3 py-1 text-sm opacity-0 group-hover:opacity-100 transition-opacity border border-red-700"
                aria-label="Delete image"
              >
                Delete
              </button>
            )}
            {image.caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-2 text-white text-sm">
                {image.caption}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-white text-4xl hover:text-neon-blue-light transition-colors"
            aria-label="Close lightbox"
          >
            ×
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation()
              goToPrevious()
            }}
            className="absolute left-4 text-white text-4xl hover:text-neon-blue-light transition-colors"
            aria-label="Previous image"
          >
            ‹
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation()
              goToNext()
            }}
            className="absolute right-4 text-white text-4xl hover:text-neon-blue-light transition-colors"
            aria-label="Next image"
          >
            ›
          </button>

          <div
            className="relative max-w-5xl max-h-[90vh] w-full h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/uploads/${selectedImage.filePath}`}
              alt={selectedImage.caption || 'Gallery image'}
              fill
              className="object-contain"
            />
            {selectedImage.caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-4 text-white text-center">
                {selectedImage.caption}
              </div>
            )}
          </div>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm">
            {currentIndex + 1} / {images.length}
          </div>
        </div>
      )}
    </>
  )
}
