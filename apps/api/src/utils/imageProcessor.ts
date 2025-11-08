/**
 * Image Processing Utility
 *
 * Handles image optimization with Sharp:
 * - Auto-resize to max dimensions (preserves aspect ratio)
 * - Generate thumbnails for gallery grid view
 * - Convert to WebP format for better compression
 * - Maintains quality while reducing file size ~70%
 */

import sharp from 'sharp'
import { randomUUID } from 'crypto'
import { join } from 'path'
import { mkdir } from 'fs/promises'

/**
 * Configuration for image processing
 */
const IMAGE_CONFIG = {
  maxWidth: 2048,
  maxHeight: 2048,
  thumbnailSize: 300,
  webpQuality: 85, // 85% quality - good balance between size and quality
  thumbnailQuality: 80,
  uploadDir: join(process.cwd(), 'uploads', 'galleries'),
  profileUploadDir: join(process.cwd(), 'uploads', 'profiles')
} as const

/**
 * Profile-specific image dimensions
 */
const PROFILE_CONFIG = {
  avatar: {
    size: 512, // Square avatar
    quality: 90
  },
  banner: {
    maxWidth: 1500,
    maxHeight: 500,
    quality: 85
  }
} as const

/**
 * Result from processing an image
 */
export interface ProcessedImage {
  filename: string
  thumbnailFilename: string
  filePath: string
  thumbnailPath: string
  width: number
  height: number
  size: number // bytes
}

/**
 * Ensure upload directory exists
 */
async function ensureUploadDir(): Promise<void> {
  try {
    await mkdir(IMAGE_CONFIG.uploadDir, { recursive: true })
  } catch (error: any) {
    // Only ignore if directory already exists
    if (error.code !== 'EEXIST') {
      throw new Error(`Failed to create upload directory: ${error.message}`)
    }
  }
}

/**
 * Process an uploaded image:
 * 1. Resize to max dimensions (if larger)
 * 2. Convert to WebP format
 * 3. Generate thumbnail version
 *
 * @param buffer - Image buffer from multipart upload
 * @param wallet - User's wallet address (for filename)
 * @returns Processed image metadata
 */
export async function processImage(
  buffer: Buffer,
  wallet: string
): Promise<ProcessedImage> {
  await ensureUploadDir()

  const uuid = randomUUID()
  const filename = `${wallet}-${uuid}.webp`
  const thumbnailFilename = `${wallet}-${uuid}-thumb.webp`

  const fullPath = join(IMAGE_CONFIG.uploadDir, filename)
  const thumbnailPath = join(IMAGE_CONFIG.uploadDir, thumbnailFilename)

  // Create Sharp instance from buffer
  const image = sharp(buffer)
  const metadata = await image.metadata()

  // Process full-size image (resize if needed + WebP conversion)
  await image
    .resize(IMAGE_CONFIG.maxWidth, IMAGE_CONFIG.maxHeight, {
      fit: 'inside', // Preserve aspect ratio, don't enlarge
      withoutEnlargement: true
    })
    .webp({ quality: IMAGE_CONFIG.webpQuality })
    .toFile(fullPath)

  // Generate thumbnail (square crop from center)
  await sharp(buffer)
    .resize(IMAGE_CONFIG.thumbnailSize, IMAGE_CONFIG.thumbnailSize, {
      fit: 'cover', // Crop to fill square
      position: 'center'
    })
    .webp({ quality: IMAGE_CONFIG.thumbnailQuality })
    .toFile(thumbnailPath)

  // Get final file stats
  const processedMetadata = await sharp(fullPath).metadata()
  const stats = await import('fs/promises').then(fs => fs.stat(fullPath))

  return {
    filename,
    thumbnailFilename,
    filePath: `galleries/${filename}`,
    thumbnailPath: `galleries/${thumbnailFilename}`,
    width: processedMetadata.width || metadata.width || 0,
    height: processedMetadata.height || metadata.height || 0,
    size: stats.size
  }
}

/**
 * Validate image buffer
 * Checks if the buffer is a valid image format supported by Sharp
 */
export async function validateImage(buffer: Buffer): Promise<boolean> {
  try {
    const metadata = await sharp(buffer).metadata()
    // Check for valid image with dimensions
    return !!(metadata.width && metadata.height)
  } catch {
    return false
  }
}

/**
 * Get image dimensions without processing
 */
export async function getImageDimensions(
  buffer: Buffer
): Promise<{ width: number; height: number }> {
  const metadata = await sharp(buffer).metadata()
  return {
    width: metadata.width || 0,
    height: metadata.height || 0
  }
}

/**
 * Process avatar image:
 * - Resize to square 512x512
 * - Convert to WebP (unless GIF - preserves animation)
 * - High quality for profile pictures
 */
export async function processAvatar(
  buffer: Buffer,
  wallet: string
): Promise<{ filename: string; filePath: string; size: number }> {
  // Ensure profile upload directory exists
  await mkdir(IMAGE_CONFIG.profileUploadDir, { recursive: true })

  const uuid = randomUUID()
  const metadata = await sharp(buffer).metadata()
  const isGif = metadata.format === 'gif'

  // Preserve GIF format for animations
  const extension = isGif ? 'gif' : 'webp'
  const filename = `avatar-${wallet.slice(0, 8)}-${uuid}.${extension}`
  const fullPath = join(IMAGE_CONFIG.profileUploadDir, filename)

  if (isGif) {
    // For GIFs, save original without processing to preserve animation
    await import('fs/promises').then(fs => fs.writeFile(fullPath, buffer))
  } else {
    // Process non-GIF images (square crop from center)
    await sharp(buffer)
      .resize(PROFILE_CONFIG.avatar.size, PROFILE_CONFIG.avatar.size, {
        fit: 'cover',
        position: 'center'
      })
      .webp({ quality: PROFILE_CONFIG.avatar.quality })
      .toFile(fullPath)
  }

  const stats = await import('fs/promises').then(fs => fs.stat(fullPath))

  return {
    filename,
    filePath: `profiles/${filename}`,
    size: stats.size
  }
}

/**
 * Process banner image:
 * - Resize to max 1500x500 (preserves aspect ratio)
 * - Convert to WebP (unless GIF - preserves animation)
 * - Optimized for wide banner format
 */
export async function processBanner(
  buffer: Buffer,
  wallet: string
): Promise<{ filename: string; filePath: string; width: number; height: number; size: number }> {
  // Ensure profile upload directory exists
  await mkdir(IMAGE_CONFIG.profileUploadDir, { recursive: true })

  const uuid = randomUUID()
  const metadata = await sharp(buffer).metadata()
  const isGif = metadata.format === 'gif'

  // Preserve GIF format for animations
  const extension = isGif ? 'gif' : 'webp'
  const filename = `banner-${wallet.slice(0, 8)}-${uuid}.${extension}`
  const fullPath = join(IMAGE_CONFIG.profileUploadDir, filename)

  if (isGif) {
    // For GIFs, save original without processing to preserve animation
    await import('fs/promises').then(fs => fs.writeFile(fullPath, buffer))
  } else {
    // Process non-GIF images (preserve aspect ratio, don't enlarge)
    await sharp(buffer)
      .resize(PROFILE_CONFIG.banner.maxWidth, PROFILE_CONFIG.banner.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: PROFILE_CONFIG.banner.quality })
      .toFile(fullPath)
  }

  // Get final dimensions and file size
  const processedMetadata = isGif ? metadata : await sharp(fullPath).metadata()
  const stats = await import('fs/promises').then(fs => fs.stat(fullPath))

  return {
    filename,
    filePath: `profiles/${filename}`,
    width: processedMetadata.width || metadata.width || 0,
    height: processedMetadata.height || metadata.height || 0,
    size: stats.size
  }
}
