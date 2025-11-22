// API abstraction layer for Blink402
// Now using real Next.js API routes with in-memory storage

import type { BlinkData, DashboardData } from './types'
import { logger } from './logger'
import { retryFetch } from './retry'

// API configuration - use relative URLs to leverage Next.js rewrites
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || ''

// Retry configuration for all API calls
const API_RETRY_OPTIONS = {
  maxRetries: 3,
  initialDelayMs: 500,  // Faster retry for non-payment APIs
  onRetry: (attempt: number, error: Error, delayMs: number) => {
    logger.warn(`API call retry ${attempt}/3 after ${Math.round(delayMs)}ms`, {
      error: error.message
    })
  }
}

/**
 * Fetch all blinks from the catalog
 */
export async function getBlinks(): Promise<BlinkData[]> {
  try {
    const response = await retryFetch(`${API_BASE_URL}/blinks`, {}, API_RETRY_OPTIONS)

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
    const response = await retryFetch(`${API_BASE_URL}/blinks/${slug}`, {}, API_RETRY_OPTIONS)

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

  const response = await retryFetch(
    `${API_BASE_URL}/dashboard?wallet=${encodeURIComponent(wallet)}`,
    { headers },
    API_RETRY_OPTIONS
  )
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
  const response = await retryFetch(
    `${API_BASE_URL}/blinks`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(data),
    },
    API_RETRY_OPTIONS
  )

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
  const response = await retryFetch(
    `${API_BASE_URL}/blinks/${slug}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(data),
    },
    API_RETRY_OPTIONS
  )

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
  const response = await retryFetch(
    `${API_BASE_URL}/blinks/${slug}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    },
    API_RETRY_OPTIONS
  )

  const result = await response.json()

  if (!result.success) {
    throw new Error(result.error || 'Failed to delete blink')
  }
}

/**
 * Get receipt by ID
 */
export async function getReceipt(id: string): Promise<any> {
  const response = await retryFetch(`${API_BASE_URL}/receipts/${id}`, {}, API_RETRY_OPTIONS)
  const result = await response.json()

  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch receipt')
  }

  return result.data
}

// ========== PAYMENT STATUS API ==========

export interface PaymentStatus {
  reference: string
  status: 'pending' | 'paid' | 'executed' | 'failed'
  signature: string | null
  payer: string | null
  blink_id: string
  created_at: string
  expires_at: string | null
  paid_at: string | null
  executed_at: string | null
  error_message: string | null
}

/**
 * Check payment status by reference UUID
 */
export async function getPaymentStatus(reference: string): Promise<PaymentStatus | null> {
  try {
    const response = await retryFetch(
      `${API_BASE_URL}/api/payments/${reference}/status`,
      {},
      API_RETRY_OPTIONS
    )

    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch payment status')
    }

    return result.data
  } catch (error) {
    throw error
  }
}

/**
 * Quick check if a payment reference exists
 */
export async function checkPaymentExists(reference: string): Promise<{ exists: boolean; status?: string }> {
  try {
    const response = await retryFetch(
      `${API_BASE_URL}/api/payments/${reference}/exists`,
      {},
      API_RETRY_OPTIONS
    )

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()

    if (!result.success) {
      throw new Error('Failed to check payment existence')
    }

    return {
      exists: result.exists,
      status: result.status
    }
  } catch (error) {
    throw error
  }
}

// ========== CREATOR PROFILE API ==========

import type { CreatorProfile, UpdateCreatorProfilePayload } from '@blink402/types'

/**
 * Get creator profile by wallet address or custom slug
 */
export async function getCreatorProfile(walletOrSlug: string): Promise<CreatorProfile | null> {
  try {
    const response = await retryFetch(`${API_BASE_URL}/profiles/${walletOrSlug}`, {}, API_RETRY_OPTIONS)

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
    const response = await retryFetch(
      `${API_BASE_URL}/profiles/${wallet}/blinks?limit=${limit}&offset=${offset}`,
      {},
      API_RETRY_OPTIONS
    )

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
  const response = await retryFetch(
    `${API_BASE_URL}/profiles`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(data),
    },
    API_RETRY_OPTIONS
  )

  const result = await response.json()

  if (!result.success) {
    throw new Error(result.error || 'Failed to update creator profile')
  }

  return result.data
}
