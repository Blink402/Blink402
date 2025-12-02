/**
 * Tests for Upstream Response Parser
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readResponseWithLimit, parseUpstreamResponse } from '../response-parser.js'

// Mock Response implementation for testing
class MockResponse {
  private content: string
  private _headers: Map<string, string>

  constructor(content: string, contentType: string = 'text/plain') {
    this.content = content
    this._headers = new Map([['content-type', contentType]])
  }

  get body() {
    const encoder = new TextEncoder()
    const data = encoder.encode(this.content)
    let position = 0

    return {
      getReader: () => ({
        read: async () => {
          if (position >= data.length) {
            return { done: true, value: undefined }
          }
          const chunk = data.slice(position, position + 1024)
          position += chunk.length
          return { done: false, value: chunk }
        },
        releaseLock: () => {}
      })
    }
  }

  get headers() {
    return {
      get: (key: string) => this._headers.get(key) || null
    }
  }
}

describe('readResponseWithLimit', () => {
  it('should read response within size limit', async () => {
    const content = 'Hello, World!'
    const response = new MockResponse(content) as any

    const result = await readResponseWithLimit(response, 1024)
    expect(result).toBe(content)
  })

  it('should throw error when response exceeds size limit', async () => {
    const content = 'x'.repeat(2000)
    const response = new MockResponse(content) as any

    await expect(readResponseWithLimit(response, 100)).rejects.toThrow(
      'Response exceeds maximum size of 100 bytes'
    )
  })

  it('should handle empty response', async () => {
    const response = new MockResponse('') as any

    const result = await readResponseWithLimit(response, 1024)
    expect(result).toBe('')
  })

  it('should throw error if no response body', async () => {
    const response = { body: null } as any

    await expect(readResponseWithLimit(response, 1024)).rejects.toThrow(
      'No response body'
    )
  })
})

describe('parseUpstreamResponse', () => {
  it('should parse JSON response correctly', async () => {
    const data = { success: true, message: 'Hello' }
    const content = JSON.stringify(data)
    const response = new MockResponse(content, 'application/json') as any

    const result = await parseUpstreamResponse(response, 10000)
    expect(result.type).toBe('json')
    expect(result.data).toEqual(data)
    expect(result.contentType).toBe('application/json')
  })

  it('should detect HTML content type', async () => {
    const content = '<html><body>Hello</body></html>'
    const response = new MockResponse(content, 'text/html') as any

    const result = await parseUpstreamResponse(response, 10000)
    expect(result.type).toBe('html')
    expect(result.data).toBe(content)
  })

  it('should detect image content type', async () => {
    const content = 'binary-image-data'
    const response = new MockResponse(content, 'image/png') as any

    const result = await parseUpstreamResponse(response, 10000)
    expect(result.type).toBe('image')
    expect(result.data).toBe(content)
  })

  it('should handle invalid JSON gracefully', async () => {
    const content = '{ invalid json }'
    const response = new MockResponse(content, 'application/json') as any

    const result = await parseUpstreamResponse(response, 10000)
    expect(result.type).toBe('other')
    expect(result.data).toBe(content)
  })

  it('should handle missing content-type header', async () => {
    const content = 'plain text'
    const response = new MockResponse(content, '') as any
    response._headers = new Map() // Clear headers

    const result = await parseUpstreamResponse(response, 10000)
    expect(result.type).toBe('other')
    expect(result.contentType).toBe('')
  })

  it('should enforce size limit', async () => {
    const content = 'x'.repeat(2000)
    const response = new MockResponse(content, 'text/plain') as any

    await expect(parseUpstreamResponse(response, 100)).rejects.toThrow(
      'Response exceeds maximum size'
    )
  })
})
