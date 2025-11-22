// Publishing validation and quality control for blinks
import { Pool } from 'pg'
import type { BlinkData } from '@blink402/types'
import { createLogger } from '@blink402/config'

const logger = createLogger('@blink402/database:publishing')

export interface PublishingValidationResult {
  canPublish: boolean
  errors: string[]
  warnings: string[]
  metrics: {
    hasTitle: boolean
    hasDescription: boolean
    hasIcon: boolean
    avgLatency: number | null
    successRate: number | null
    totalRuns: number
    recentRuns: number
    healthStatus: string
  }
}

/**
 * Validate if a blink meets the requirements for publishing to catalog
 * Requirements:
 * - Must have complete metadata (title, description, icon)
 * - Must have stable performance (if it has been used)
 * - Must pass basic health checks
 * - Should have at least a few successful test runs
 */
export async function validateBlinkForPublishing(
  pool: Pool,
  blinkId: string
): Promise<PublishingValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []

  try {
    // Get blink data with performance metrics
    const result = await pool.query(
      `SELECT
        b.id,
        b.slug,
        b.title,
        b.description,
        b.icon_url,
        b.endpoint_url,
        b.status,
        b.health_status,
        b.avg_latency_ms,
        b.success_rate_percent,
        b.reported_count,
        COUNT(DISTINCT r.id) as total_runs,
        COUNT(DISTINCT CASE WHEN r.created_at > NOW() - INTERVAL '7 days' THEN r.id END) as recent_runs,
        COUNT(DISTINCT CASE WHEN r.status = 'executed' THEN r.id END) as successful_runs,
        COUNT(DISTINCT CASE WHEN r.status = 'failed' THEN r.id END) as failed_runs
      FROM blinks b
      LEFT JOIN runs r ON b.id = r.blink_id
      WHERE b.id = $1
      GROUP BY b.id`,
      [blinkId]
    )

    if (result.rows.length === 0) {
      return {
        canPublish: false,
        errors: ['Blink not found'],
        warnings: [],
        metrics: {
          hasTitle: false,
          hasDescription: false,
          hasIcon: false,
          avgLatency: null,
          successRate: null,
          totalRuns: 0,
          recentRuns: 0,
          healthStatus: 'unknown'
        }
      }
    }

    const blink = result.rows[0]

    // Build metrics
    const metrics = {
      hasTitle: !!blink.title && blink.title.trim().length > 0,
      hasDescription: !!blink.description && blink.description.trim().length >= 20,
      hasIcon: !!blink.icon_url && blink.icon_url.trim().length > 0,
      avgLatency: blink.avg_latency_ms,
      successRate: blink.success_rate_percent ? parseFloat(blink.success_rate_percent) : null,
      totalRuns: parseInt(blink.total_runs),
      recentRuns: parseInt(blink.recent_runs),
      healthStatus: blink.health_status || 'unknown'
    }

    // Check required metadata
    if (!metrics.hasTitle) {
      errors.push('Title is required and must not be empty')
    }

    if (!metrics.hasDescription) {
      errors.push('Description is required and must be at least 20 characters')
    }

    if (!metrics.hasIcon) {
      warnings.push('Icon URL is recommended for better catalog appearance')
    }

    // Check if endpoint URL is valid
    if (!blink.endpoint_url || !isValidUrl(blink.endpoint_url)) {
      errors.push('Valid endpoint URL is required')
    }

    // Check blink status
    if (blink.status !== 'active') {
      errors.push(`Blink must be active to publish (current status: ${blink.status})`)
    }

    // Check health status
    if (blink.health_status === 'unhealthy') {
      errors.push('Blink is marked as unhealthy and cannot be published')
    } else if (blink.health_status === 'degraded') {
      warnings.push('Blink is showing degraded performance')
    }

    // Check performance metrics (if blink has been used)
    if (metrics.totalRuns >= 10) {
      // Only check performance if there's enough data
      if (metrics.successRate !== null && metrics.successRate < 80) {
        errors.push(`Success rate is too low (${metrics.successRate.toFixed(1)}%). Must be at least 80%`)
      }

      if (metrics.avgLatency && metrics.avgLatency > 5000) {
        warnings.push(`Response time is high (${metrics.avgLatency}ms). Consider optimizing your endpoint`)
      }
    } else if (metrics.totalRuns > 0 && metrics.totalRuns < 3) {
      warnings.push('Consider testing your blink more thoroughly before publishing (at least 3 successful runs recommended)')
    }

    // Check for reports
    if (blink.reported_count > 5) {
      errors.push('This blink has been reported multiple times and needs review before publishing')
    } else if (blink.reported_count > 0) {
      warnings.push(`This blink has ${blink.reported_count} report(s). Please ensure it meets community standards`)
    }

    // Check if there have been recent runs (activity)
    if (metrics.totalRuns > 0 && metrics.recentRuns === 0) {
      warnings.push('No recent activity in the last 7 days. Test your blink to ensure it still works')
    }

    const canPublish = errors.length === 0

    return {
      canPublish,
      errors,
      warnings,
      metrics
    }
  } catch (error) {
    logger.error('Error validating blink for publishing', error, { blinkId })
    return {
      canPublish: false,
      errors: ['Failed to validate blink'],
      warnings: [],
      metrics: {
        hasTitle: false,
        hasDescription: false,
        hasIcon: false,
        avgLatency: null,
        successRate: null,
        totalRuns: 0,
        recentRuns: 0,
        healthStatus: 'unknown'
      }
    }
  }
}

/**
 * Publish a validated blink to the catalog
 */
export async function publishBlinkToCatalog(
  pool: Pool,
  slug: string
): Promise<{ success: boolean; error?: string }> {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // Get blink ID
    const blinkResult = await client.query(
      'SELECT id FROM blinks WHERE slug = $1',
      [slug]
    )

    if (blinkResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return { success: false, error: 'Blink not found' }
    }

    const blinkId = blinkResult.rows[0].id

    // Validate before publishing
    const validation = await validateBlinkForPublishing(pool, blinkId)

    if (!validation.canPublish) {
      await client.query('ROLLBACK')
      return {
        success: false,
        error: `Cannot publish: ${validation.errors.join(', ')}`
      }
    }

    // Update blink to be public
    await client.query(
      `UPDATE blinks
      SET
        is_public = true,
        publish_to_catalog = true,
        catalog_published_at = CASE
          WHEN catalog_published_at IS NULL THEN NOW()
          ELSE catalog_published_at
        END,
        last_health_check = NOW()
      WHERE slug = $1`,
      [slug]
    )

    // Update performance metrics
    await client.query(
      `UPDATE blinks b
      SET
        avg_latency_ms = subq.avg_latency,
        success_rate_percent = subq.success_rate
      FROM (
        SELECT
          blink_id,
          AVG(duration_ms)::INTEGER as avg_latency,
          (COUNT(CASE WHEN status = 'executed' THEN 1 END)::DECIMAL / NULLIF(COUNT(*), 0) * 100) as success_rate
        FROM runs
        WHERE blink_id = $1
          AND created_at > NOW() - INTERVAL '30 days'
        GROUP BY blink_id
      ) subq
      WHERE b.id = subq.blink_id`,
      [blinkId]
    )

    // Update badges
    await client.query(
      'UPDATE blinks SET badges = calculate_blink_badges(id) WHERE id = $1',
      [blinkId]
    )

    await client.query('COMMIT')

    return { success: true }
  } catch (error) {
    await client.query('ROLLBACK')
    logger.error('Error publishing blink', error, { slug })
    return {
      success: false,
      error: 'Failed to publish blink'
    }
  } finally {
    client.release()
  }
}

/**
 * Unpublish a blink from the catalog (make it private)
 */
export async function unpublishBlinkFromCatalog(
  pool: Pool,
  slug: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await pool.query(
      `UPDATE blinks
      SET
        is_public = false,
        publish_to_catalog = false
      WHERE slug = $1`,
      [slug]
    )

    if ((result.rowCount ?? 0) === 0) {
      return { success: false, error: 'Blink not found' }
    }

    return { success: true }
  } catch (error) {
    logger.error('Error unpublishing blink', error, { slug })
    return {
      success: false,
      error: 'Failed to unpublish blink'
    }
  }
}

/**
 * Get publishing status and validation for a blink
 */
export async function getBlinkPublishingStatus(
  pool: Pool,
  slug: string
): Promise<{
  isPublished: boolean
  validation: PublishingValidationResult | null
}> {
  try {
    const result = await pool.query(
      'SELECT id, is_public, publish_to_catalog FROM blinks WHERE slug = $1',
      [slug]
    )

    if (result.rows.length === 0) {
      return {
        isPublished: false,
        validation: null
      }
    }

    const blink = result.rows[0]
    const validation = await validateBlinkForPublishing(pool, blink.id)

    return {
      isPublished: blink.is_public && blink.publish_to_catalog,
      validation
    }
  } catch (error) {
    logger.error('Error getting publishing status', error, { slug })
    return {
      isPublished: false,
      validation: null
    }
  }
}

// Helper function to validate URL
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}