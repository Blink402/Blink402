/**
 * Upstream Response Parser
 *
 * Utilities for safely parsing upstream API responses with size limits
 * and DoS protection.
 */

/**
 * Read response with size limit (prevents DoS attacks)
 * @param response - Fetch Response object
 * @param maxSize - Maximum allowed response size in bytes
 * @returns Decoded response text
 * @throws Error if response exceeds maxSize
 */
export async function readResponseWithLimit(
  response: Response,
  maxSize: number
): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const chunks: Uint8Array[] = []
  let totalSize = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      totalSize += value.length
      if (totalSize > maxSize) {
        throw new Error(`Response exceeds maximum size of ${maxSize} bytes`)
      }

      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const allChunks = new Uint8Array(totalSize)
  let position = 0
  for (const chunk of chunks) {
    allChunks.set(chunk, position)
    position += chunk.length
  }

  return new TextDecoder().decode(allChunks)
}

/**
 * Parse upstream response into structured data
 * @param response - Fetch Response object
 * @param maxSize - Maximum allowed response size
 * @returns Parsed response data with content type
 */
export async function parseUpstreamResponse(
  response: Response,
  maxSize: number
): Promise<{
  data: unknown
  contentType: string
  type: 'json' | 'html' | 'image' | 'other'
}> {
  const contentType = response.headers.get('content-type') || ''

  // Determine response type
  let type: 'json' | 'html' | 'image' | 'other' = 'other'
  if (contentType.includes('application/json')) {
    type = 'json'
  } else if (contentType.includes('text/html')) {
    type = 'html'
  } else if (contentType.startsWith('image/')) {
    type = 'image'
  }

  // Read response with size limit
  const text = await readResponseWithLimit(response, maxSize)

  // Parse JSON responses
  let data: unknown = text
  if (type === 'json') {
    try {
      data = JSON.parse(text)
    } catch (error) {
      // If JSON parsing fails, return as text
      type = 'other'
    }
  }

  return { data, contentType, type }
}
