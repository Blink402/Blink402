// API abstraction layer for Blink402
// Now using real Next.js API routes with in-memory storage

import type { BlinkData, DashboardData } from './types'
import { logger } from './logger'

// API configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

/**
 * Fetch all blinks from the catalog
 */
export async function getBlinks(): Promise<BlinkData[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/blinks`)

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch blinks')
    }

    return result.data
  } catch (error) {
    // Error will be logged by the caller
    throw error
  }
}

/**
 * Fetch a single blink by slug
 */
export async function getBlinkBySlug(slug: string): Promise<BlinkData | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/blinks/${slug}`)

    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()

    if (!result.success) {
      if (response.status === 404) {
        return null
      }
      throw new Error(result.error || 'Failed to fetch blink')
    }

    return result.data
  } catch (error) {
    // Error will be logged by the caller
    throw error
  }
}

/**
 * Fetch dashboard data for the authenticated wallet
 */
export async function getDashboardData(wallet: string, authToken?: string): Promise<DashboardData> {
  const headers: HeadersInit = {}

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`
  }

  const response = await fetch(`${API_BASE_URL}/dashboard?wallet=${encodeURIComponent(wallet)}`, { headers })
  const result = await response.json()

  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch dashboard data')
  }

  return result.data
}

/**
 * Create a new blink (requires authentication)
 */
export async function createBlink(data: Partial<BlinkData>, authToken: string): Promise<BlinkData> {
  const response = await fetch(`${API_BASE_URL}/blinks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify(data),
  })

  const result = await response.json()

  if (!result.success) {
    throw new Error(result.error || 'Failed to create blink')
  }

  return result.data
}

/**
 * Update an existing blink (requires authentication)
 */
export async function updateBlink(slug: string, data: Partial<BlinkData>, authToken: string): Promise<BlinkData> {
  const response = await fetch(`${API_BASE_URL}/blinks/${slug}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify(data),
  })

  const result = await response.json()

  if (!result.success) {
    throw new Error(result.error || 'Failed to update blink')
  }

  return result.data
}

/**
 * Delete a blink (requires authentication)
 */
export async function deleteBlink(slug: string, authToken: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/blinks/${slug}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${authToken}`,
    },
  })

  const result = await response.json()

  if (!result.success) {
    throw new Error(result.error || 'Failed to delete blink')
  }
}

/**
 * Get receipt by ID
 */
export async function getReceipt(id: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/receipts/${id}`)
  const result = await response.json()

  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch receipt')
  }

  return result.data
}

// ========== CREATOR PROFILE API ==========

import type { CreatorProfile, UpdateCreatorProfilePayload } from '@blink402/types'

/**
 * Get creator profile by wallet address or custom slug
 */
export async function getCreatorProfile(walletOrSlug: string): Promise<CreatorProfile | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/profiles/${walletOrSlug}`)

    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch creator profile')
    }

    return result.data
  } catch (error) {
    throw error
  }
}

/**
 * Get all blinks by a creator
 */
export async function getCreatorBlinks(wallet: string, limit: number = 20, offset: number = 0): Promise<BlinkData[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/profiles/${wallet}/blinks?limit=${limit}&offset=${offset}`)

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch creator blinks')
    }

    return result.data
  } catch (error) {
    throw error
  }
}

/**
 * Update creator profile (requires authentication)
 */
export async function updateCreatorProfile(
  data: UpdateCreatorProfilePayload,
  authToken: string
): Promise<CreatorProfile> {
  const response = await fetch(`${API_BASE_URL}/profiles`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify(data),
  })

  const result = await response.json()

  if (!result.success) {
    throw new Error(result.error || 'Failed to update creator profile')
  }

  return result.data
}
