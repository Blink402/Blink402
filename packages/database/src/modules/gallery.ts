/**
 * @blink402/database - Gallery Module
 *
 * Functions for managing creator galleries with payment-gated access.
 * Allows creators to upload images and grant time-limited access to viewers.
 */

import { createLogger } from '@blink402/config'
import { getPool } from './connection.js'

const logger = createLogger('@blink402/database:gallery')

export interface GalleryImage {
  id: string
  creator_wallet: string
  file_path: string
  thumbnail_path: string | null
  caption: string | null
  uploaded_at: Date
}

export interface GalleryAccess {
  id: string
  viewer_wallet: string
  creator_wallet: string
  blink_slug: string
  paid_at: Date
  expires_at: Date
  reference: string
}

/**
 * Upload a new image to creator's gallery
 */
export async function uploadGalleryImage(params: {
  creatorWallet: string
  filePath: string
  thumbnailPath?: string
  caption?: string
}): Promise<GalleryImage> {
  const { creatorWallet, filePath, thumbnailPath, caption } = params

  const result = await getPool().query(
    `INSERT INTO gallery_images (id, creator_wallet, file_path, thumbnail_path, caption)
    VALUES (gen_random_uuid(), $1, $2, $3, $4)
    RETURNING id, creator_wallet, file_path, thumbnail_path, caption, uploaded_at`,
    [creatorWallet, filePath, thumbnailPath || null, caption || null]
  )

  return result.rows[0]
}

/**
 * Get all images for a creator's gallery
 */
export async function getGalleryImages(creatorWallet: string): Promise<GalleryImage[]> {
  const result = await getPool().query(
    `SELECT id, creator_wallet, file_path, thumbnail_path, caption, uploaded_at
    FROM gallery_images
    WHERE creator_wallet = $1
    ORDER BY uploaded_at DESC`,
    [creatorWallet]
  )

  return result.rows
}

/**
 * Grant gallery access to a viewer (after payment)
 */
export async function grantGalleryAccess(params: {
  viewerWallet: string
  creatorWallet: string
  blinkSlug: string
  durationDays: number
  reference: string
}): Promise<GalleryAccess> {
  const { viewerWallet, creatorWallet, blinkSlug, durationDays, reference } = params

  const result = await getPool().query(
    `INSERT INTO gallery_access (id, viewer_wallet, creator_wallet, blink_slug, expires_at, reference)
    VALUES (gen_random_uuid(), $1, $2, $3, NOW() + ($4 || ' days')::INTERVAL, $5)
    RETURNING id, viewer_wallet, creator_wallet, blink_slug, paid_at, expires_at, reference`,
    [viewerWallet, creatorWallet, blinkSlug, durationDays.toString(), reference]
  )

  return result.rows[0]
}

/**
 * Check if a viewer has active access to a creator's gallery
 */
export async function checkGalleryAccess(params: {
  viewerWallet: string
  creatorWallet: string
}): Promise<GalleryAccess | null> {
  const { viewerWallet, creatorWallet } = params

  const result = await getPool().query(
    `SELECT id, viewer_wallet, creator_wallet, blink_slug, paid_at, expires_at, reference
    FROM gallery_access
    WHERE viewer_wallet = $1
      AND creator_wallet = $2
      AND expires_at > NOW()
    ORDER BY expires_at DESC
    LIMIT 1`,
    [viewerWallet, creatorWallet]
  )

  if (result.rows.length === 0) return null
  return result.rows[0]
}

/**
 * Delete a gallery image (creator only)
 */
export async function deleteGalleryImage(params: {
  id: string
  creatorWallet: string
}): Promise<boolean> {
  const { id, creatorWallet } = params

  const result = await getPool().query(
    `DELETE FROM gallery_images
    WHERE id = $1 AND creator_wallet = $2`,
    [id, creatorWallet]
  )

  return result.rowCount !== null && result.rowCount > 0
}
