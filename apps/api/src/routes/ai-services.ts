import { FastifyPluginAsync } from 'fastify'
import { isValidSolanaAddress } from '@blink402/helius'

/**
 * AI Services Routes - Premium demo Blinks
 *
 * Provides 5 polished demo Blinks showcasing different use cases:
 * 1. Image Colorization (B/W → Color)
 * 2. Tweet Punch-Up (AI text rewriting)
 * 3. Wallet 24h Snapshot (Solana analytics)
 * 4. URL Screenshot (Above-the-fold capture)
 * 5. Reverse Blink - Label This Image (pay users for labels)
 */

// ========== HELPER FUNCTIONS ==========

/**
 * Validate URL format
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Call DeepAI Colorization API
 * Free tier: 5 requests/day per IP
 * Fallback: Returns mock response if API key not available
 */
async function colorizeImage(imageUrl: string, apiKey?: string): Promise<{ output_url: string; processing_time_ms: number }> {
  if (!apiKey) {
    // Mock response for demo purposes
    return {
      output_url: imageUrl, // Return original image as fallback
      processing_time_ms: 1200,
    }
  }

  try {
    const formData = new FormData()
    formData.append('image', imageUrl)

    const response = await fetch('https://api.deepai.org/api/colorizer', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
      },
      body: formData,
      signal: AbortSignal.timeout(30000), // 30 second timeout
    })

    if (!response.ok) {
      throw new Error(`DeepAI API returned ${response.status}`)
    }

    const data = await response.json() as any
    return {
      output_url: data.output_url || imageUrl,
      processing_time_ms: data.processing_time_ms || 0,
    }
  } catch (error) {
    throw new Error('Image colorization failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
  }
}

/**
 * Enhance tweet text using simple rules
 * In production, this would call OpenAI/Claude API
 * For demo: Uses text enhancement heuristics
 */
function punchUpTweet(text: string): { enhanced: string; changes: string[] } {
  let enhanced = text.trim()
  const changes: string[] = []

  // Remove excessive punctuation
  if (enhanced.includes('...')) {
    enhanced = enhanced.replace(/\.{3,}/g, '…')
    changes.push('Replaced "..." with proper ellipsis')
  }

  // Capitalize first letter
  if (enhanced.length > 0 && enhanced[0] === enhanced[0].toLowerCase()) {
    enhanced = enhanced[0].toUpperCase() + enhanced.slice(1)
    changes.push('Capitalized first letter')
  }

  // Add period if missing
  if (enhanced.length > 0 && !enhanced.match(/[.!?]$/)) {
    enhanced += '.'
    changes.push('Added ending punctuation')
  }

  // Remove double spaces
  if (enhanced.includes('  ')) {
    enhanced = enhanced.replace(/\s{2,}/g, ' ')
    changes.push('Removed extra spaces')
  }

  // Ensure under 280 characters
  if (enhanced.length > 280) {
    enhanced = enhanced.slice(0, 277) + '...'
    changes.push('Truncated to 280 characters')
  }

  return { enhanced, changes }
}

/**
 * Take screenshot of URL using ScreenshotAPI
 * Fallback: Returns placeholder image if API key not available
 */
async function captureScreenshot(
  url: string,
  viewport: { width: number; height: number },
  apiKey?: string
): Promise<{ screenshot_url: string; viewport: { width: number; height: number } }> {
  if (!apiKey) {
    // Mock response for demo purposes
    return {
      screenshot_url: `https://via.placeholder.com/${viewport.width}x${viewport.height}/171717/5AB4FF?text=Screenshot+Demo`,
      viewport,
    }
  }

  try {
    const screenshotUrl = `https://shot.screenshotapi.net/screenshot?token=${apiKey}&url=${encodeURIComponent(url)}&width=${viewport.width}&height=${viewport.height}&output=image&file_type=png&wait_for_event=load`

    // For production: Actually fetch and return the screenshot
    // For demo: Return the API URL directly
    return {
      screenshot_url: screenshotUrl,
      viewport,
    }
  } catch (error) {
    throw new Error('Screenshot capture failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
  }
}

/**
 * Generate mock image labels
 * In production, this would call Google Vision API or similar
 */
function generateImageLabels(imageUrl: string): { labels: Array<{ name: string; confidence: number }> } {
  // Mock labels for demo purposes
  const possibleLabels = [
    'person', 'animal', 'landscape', 'building', 'food',
    'vehicle', 'nature', 'technology', 'art', 'indoor',
    'outdoor', 'sky', 'water', 'mountain', 'city',
  ]

  // Generate 5-8 random labels with confidence scores
  const numLabels = Math.floor(Math.random() * 4) + 5
  const labels = possibleLabels
    .sort(() => Math.random() - 0.5)
    .slice(0, numLabels)
    .map((name) => ({
      name,
      confidence: Math.random() * 0.5 + 0.5, // 0.5-1.0
    }))
    .sort((a, b) => b.confidence - a.confidence)

  return { labels }
}

// ========== ROUTES ==========

export const aiServicesRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /ai-services/colorize
   *
   * Demo Blink #1: Image Colorization (B/W → Color)
   * Price: $0.03 USDC
   * Input: image_url (string)
   * Output: colorized image URL + metadata
   */
  fastify.post<{
    Body: {
      image_url?: string
      image?: string // Alternative param name
      reference?: string
      signature?: string
      payer?: string
    }
  }>('/colorize', async (request, reply) => {
    const { image_url, image, reference, signature, payer } = request.body

    // Get image URL from either parameter
    const imageUrl = image_url || image

    if (!imageUrl) {
      return reply.code(400).send({
        success: false,
        error: 'Missing image_url parameter',
        message: 'Please provide an image_url to colorize',
      })
    }

    if (!isValidUrl(imageUrl)) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid image URL',
        message: 'The provided image_url is not a valid URL',
      })
    }

    try {
      fastify.log.info({ imageUrl, reference }, 'Colorizing image')

      const startTime = Date.now()
      const apiKey = process.env.DEEPAI_API_KEY
      const result = await colorizeImage(imageUrl, apiKey)
      const duration = Date.now() - startTime

      fastify.log.info({ imageUrl, duration }, 'Image colorization completed')

      return reply.code(200).send({
        success: true,
        data: {
          original_url: imageUrl,
          colorized_url: result.output_url,
          processing_time_ms: result.processing_time_ms,
          metadata: {
            reference,
            signature,
            payer,
            duration_ms: duration,
            timestamp: new Date().toISOString(),
            demo_mode: !apiKey,
          },
        },
      })
    } catch (error) {
      fastify.log.error({ error, imageUrl }, 'Image colorization failed')

      return reply.code(500).send({
        success: false,
        error: 'Colorization failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  /**
   * POST /ai-services/punchup
   *
   * Demo Blink #2: Tweet Punch-Up (AI text rewriting)
   * Price: $0.01 USDC
   * Input: text (string, ≤280 chars)
   * Output: enhanced text + list of changes
   */
  fastify.post<{
    Body: {
      text?: string
      reference?: string
      signature?: string
      payer?: string
    }
  }>('/punchup', async (request, reply) => {
    const { text, reference, signature, payer } = request.body

    if (!text) {
      return reply.code(400).send({
        success: false,
        error: 'Missing text parameter',
        message: 'Please provide text to enhance',
      })
    }

    if (text.length > 500) {
      return reply.code(400).send({
        success: false,
        error: 'Text too long',
        message: 'Maximum text length is 500 characters',
      })
    }

    try {
      fastify.log.info({ textLength: text.length, reference }, 'Enhancing tweet')

      const startTime = Date.now()
      const result = punchUpTweet(text)
      const duration = Date.now() - startTime

      fastify.log.info({ changes: result.changes.length, duration }, 'Tweet enhancement completed')

      return reply.code(200).send({
        success: true,
        data: {
          original: text,
          enhanced: result.enhanced,
          changes: result.changes,
          character_count: result.enhanced.length,
          metadata: {
            reference,
            signature,
            payer,
            duration_ms: duration,
            timestamp: new Date().toISOString(),
          },
        },
      })
    } catch (error) {
      fastify.log.error({ error }, 'Tweet enhancement failed')

      return reply.code(500).send({
        success: false,
        error: 'Enhancement failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  /**
   * POST /ai-services/wallet24h
   *
   * Demo Blink #3: Wallet 24h Snapshot (Solana analytics)
   * Price: $0.02 USDC
   * Input: wallet (string, Solana address)
   * Output: Wallet analytics (PnL, txs, tokens)
   *
   * NOTE: This leverages the existing wallet-analysis endpoint
   */
  fastify.post<{
    Body: {
      wallet?: string
      target_wallet?: string
      reference?: string
      signature?: string
      payer?: string
    }
  }>('/wallet24h', async (request, reply) => {
    const { wallet, target_wallet, reference, signature, payer } = request.body

    // Priority: target_wallet > wallet > payer
    const walletAddress = target_wallet || wallet || payer

    if (!walletAddress) {
      return reply.code(400).send({
        success: false,
        error: 'Missing wallet parameter',
        message: 'Please provide a wallet address to analyze',
      })
    }

    if (!isValidSolanaAddress(walletAddress)) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid wallet address',
        message: 'The provided address is not a valid Solana wallet',
      })
    }

    try {
      fastify.log.info({ walletAddress, reference }, 'Analyzing wallet (24h snapshot)')

      // Forward to existing wallet-analysis endpoint
      const analysisResponse = await fastify.inject({
        method: 'POST',
        url: '/wallet-analysis',
        payload: {
          wallet: walletAddress,
          target_wallet: walletAddress,
          reference,
          signature,
          payer,
        },
      })

      const analysisData = JSON.parse(analysisResponse.body)

      if (!analysisResponse.statusCode || analysisResponse.statusCode >= 400) {
        throw new Error(analysisData.message || 'Wallet analysis failed')
      }

      // Return the analysis data with 24h branding
      return reply.code(200).send({
        success: true,
        data: {
          wallet: walletAddress,
          snapshot_type: '24h',
          analysis: analysisData.data,
          metadata: {
            reference,
            signature,
            payer,
            duration_ms: analysisData.duration_ms,
            timestamp: new Date().toISOString(),
          },
        },
      })
    } catch (error) {
      fastify.log.error({ error, walletAddress }, 'Wallet 24h snapshot failed')

      return reply.code(500).send({
        success: false,
        error: 'Wallet analysis failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  /**
   * POST /ai-services/snapshot
   *
   * Demo Blink #4: URL Screenshot (Above-the-fold capture)
   * Price: $0.02 USDC
   * Input: url (string), viewport (optional, "mobile" | "tablet" | "desktop")
   * Output: Screenshot image URL + metadata
   */
  fastify.post<{
    Body: {
      url?: string
      viewport?: string | 'mobile' | 'tablet' | 'desktop'
      reference?: string
      signature?: string
      payer?: string
    }
  }>('/snapshot', async (request, reply) => {
    const { url, viewport = 'desktop', reference, signature, payer } = request.body

    if (!url) {
      return reply.code(400).send({
        success: false,
        error: 'Missing url parameter',
        message: 'Please provide a URL to capture',
      })
    }

    if (!isValidUrl(url)) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid URL',
        message: 'The provided URL is not valid',
      })
    }

    // Determine viewport dimensions
    const viewportSizes: Record<string, { width: number; height: number }> = {
      mobile: { width: 375, height: 667 },
      tablet: { width: 768, height: 1024 },
      desktop: { width: 1920, height: 1080 },
    }

    const viewportConfig = viewportSizes[viewport] || viewportSizes.desktop

    try {
      fastify.log.info({ url, viewport: viewportConfig, reference }, 'Capturing screenshot')

      const startTime = Date.now()
      const apiKey = process.env.SCREENSHOT_API_KEY
      const result = await captureScreenshot(url, viewportConfig, apiKey)
      const duration = Date.now() - startTime

      fastify.log.info({ url, duration }, 'Screenshot capture completed')

      return reply.code(200).send({
        success: true,
        data: {
          original_url: url,
          screenshot_url: result.screenshot_url,
          viewport: result.viewport,
          metadata: {
            reference,
            signature,
            payer,
            duration_ms: duration,
            timestamp: new Date().toISOString(),
            demo_mode: !apiKey,
          },
        },
      })
    } catch (error) {
      fastify.log.error({ error, url }, 'Screenshot capture failed')

      return reply.code(500).send({
        success: false,
        error: 'Screenshot failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  /**
   * POST /ai-services/label
   *
   * Demo Blink #5: Reverse Blink - Label This Image
   * Price: -$0.02 USDC (user gets paid!)
   * Input: image_url (string), label (string)
   * Output: Accepted label + confirmation (simulated reward)
   *
   * NOTE: This is a "reward" mode Blink that pays users for providing labels.
   * For demo purposes, this simulates the reward flow without actual payments.
   */
  fastify.post<{
    Body: {
      image_url?: string
      image?: string
      label?: string
      reference?: string
      signature?: string
      payer?: string
    }
  }>('/label', async (request, reply) => {
    const { image_url, image, label, reference, signature, payer } = request.body

    const imageUrl = image_url || image

    if (!imageUrl) {
      return reply.code(400).send({
        success: false,
        error: 'Missing image_url parameter',
        message: 'Please provide an image_url to label',
      })
    }

    if (!isValidUrl(imageUrl)) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid image URL',
        message: 'The provided image_url is not a valid URL',
      })
    }

    if (!label || label.trim().length === 0) {
      return reply.code(400).send({
        success: false,
        error: 'Missing label parameter',
        message: 'Please provide a label for the image',
      })
    }

    if (label.length > 100) {
      return reply.code(400).send({
        success: false,
        error: 'Label too long',
        message: 'Maximum label length is 100 characters',
      })
    }

    try {
      fastify.log.info({ imageUrl, label: label.trim(), payer, reference }, 'Processing image label submission')

      const startTime = Date.now()

      // Generate suggested labels for comparison
      const suggestedLabels = generateImageLabels(imageUrl)

      // Check if user's label matches any suggested labels (case-insensitive)
      const userLabel = label.trim().toLowerCase()
      const isMatch = suggestedLabels.labels.some((l) => l.name.toLowerCase() === userLabel)

      const duration = Date.now() - startTime

      fastify.log.info({ imageUrl, label, isMatch, duration }, 'Label submission processed')

      // Simulate reward (in production, this would trigger actual SOL/USDC transfer)
      return reply.code(200).send({
        success: true,
        data: {
          image_url: imageUrl,
          submitted_label: label.trim(),
          label_accepted: true,
          confidence_match: isMatch ? 0.85 : 0.65,
          suggested_labels: suggestedLabels.labels.slice(0, 5), // Top 5 labels
          reward: {
            amount: '0.02',
            token: 'USDC',
            recipient: payer || 'unknown',
            status: 'simulated', // In production: 'pending' | 'completed'
            message: 'Demo mode: Reward simulation only. In production, $0.02 USDC would be sent to your wallet.',
          },
          metadata: {
            reference,
            signature,
            payer,
            duration_ms: duration,
            timestamp: new Date().toISOString(),
          },
        },
      })
    } catch (error) {
      fastify.log.error({ error, imageUrl, label }, 'Label submission failed')

      return reply.code(500).send({
        success: false,
        error: 'Label submission failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })
}
