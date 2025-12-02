/**
 * Tests for Upstream URL Validator (SSRF Protection)
 */

import { describe, it, expect } from 'vitest'
import { validateUpstreamUrl, isInternalEndpoint } from '../validator.js'

describe('validateUpstreamUrl', () => {
  describe('valid URLs', () => {
    it('should allow valid HTTPS URLs', async () => {
      await expect(validateUpstreamUrl('https://api.example.com/endpoint')).resolves.toBeUndefined()
    })

    it('should allow valid HTTP URLs', async () => {
      await expect(validateUpstreamUrl('http://api.example.com/endpoint')).resolves.toBeUndefined()
    })

    it('should allow URLs with query parameters', async () => {
      await expect(validateUpstreamUrl('https://api.example.com/endpoint?key=value')).resolves.toBeUndefined()
    })

    it('should allow URLs with paths', async () => {
      await expect(validateUpstreamUrl('https://api.example.com/v1/users/123')).resolves.toBeUndefined()
    })
  })

  describe('invalid URL formats', () => {
    it('should reject invalid URL formats', async () => {
      await expect(validateUpstreamUrl('not-a-url')).rejects.toThrow('Invalid URL format')
    })

    it('should reject non-HTTP protocols', async () => {
      await expect(validateUpstreamUrl('ftp://example.com')).rejects.toThrow('Only HTTP/HTTPS protocols allowed')
    })

    it('should reject file:// protocol', async () => {
      await expect(validateUpstreamUrl('file:///etc/passwd')).rejects.toThrow('Only HTTP/HTTPS protocols allowed')
    })

    it('should reject URLs without dots in hostname', async () => {
      await expect(validateUpstreamUrl('http://internalhost')).rejects.toThrow('Invalid hostname format')
    })
  })

  describe('localhost protection', () => {
    it('should reject localhost', async () => {
      await expect(validateUpstreamUrl('http://localhost:3000')).rejects.toThrow('Localhost access not allowed')
    })

    it('should reject 127.0.0.1', async () => {
      await expect(validateUpstreamUrl('http://127.0.0.1:3000')).rejects.toThrow('Localhost access not allowed')
    })

    it('should reject 127.x.x.x range', async () => {
      await expect(validateUpstreamUrl('http://127.1.1.1')).rejects.toThrow('Localhost access not allowed')
    })

    it('should reject 0.0.0.0', async () => {
      await expect(validateUpstreamUrl('http://0.0.0.0')).rejects.toThrow('Localhost access not allowed')
    })

    it('should reject IPv6 localhost (::1)', async () => {
      // Note: URL hostname for [::1] becomes "::1" (brackets removed by URL parser)
      // The validator needs to check the extracted hostname
      await expect(validateUpstreamUrl('http://[::1]:3000')).rejects.toThrow()
    })
  })

  describe('private IP protection', () => {
    it('should reject 10.x.x.x (Class A private)', async () => {
      await expect(validateUpstreamUrl('http://10.0.0.1')).rejects.toThrow('Private IP ranges not allowed')
    })

    it('should reject 172.16-31.x.x (Class B private)', async () => {
      await expect(validateUpstreamUrl('http://172.16.0.1')).rejects.toThrow('Private IP ranges not allowed')
      await expect(validateUpstreamUrl('http://172.31.255.255')).rejects.toThrow('Private IP ranges not allowed')
    })

    it('should reject 192.168.x.x (Class C private)', async () => {
      await expect(validateUpstreamUrl('http://192.168.1.1')).rejects.toThrow('Private IP ranges not allowed')
    })

    it('should reject link-local 169.254.x.x', async () => {
      await expect(validateUpstreamUrl('http://169.254.169.254')).rejects.toThrow('Private IP ranges not allowed')
    })
  })

  describe('cloud metadata protection', () => {
    it('should reject AWS metadata endpoint', async () => {
      await expect(validateUpstreamUrl('http://169.254.169.254/latest/meta-data')).rejects.toThrow('Private IP ranges not allowed')
    })

    it('should reject GCP metadata endpoint', async () => {
      await expect(validateUpstreamUrl('http://metadata.google.internal')).rejects.toThrow('Cloud metadata endpoints not allowed')
    })

    it('should reject Azure metadata endpoint', async () => {
      await expect(validateUpstreamUrl('http://metadata.azure.com')).rejects.toThrow('Cloud metadata endpoints not allowed')
    })
  })

  describe('advanced SSRF bypass protection', () => {
    it('should reject decimal IP notation', async () => {
      // Note: 2130706433 converts to 127.0.0.1, so it gets caught by localhost check
      await expect(validateUpstreamUrl('http://2130706433')).rejects.toThrow()
    })

    it('should reject URLs with credentials', async () => {
      await expect(validateUpstreamUrl('http://user:pass@example.com')).rejects.toThrow('URLs with credentials not allowed')
    })

    it('should reject internal TLDs (.local)', async () => {
      await expect(validateUpstreamUrl('http://server.local')).rejects.toThrow('Internal TLDs not allowed')
    })

    it('should reject internal TLDs (.internal)', async () => {
      await expect(validateUpstreamUrl('http://api.internal')).rejects.toThrow('Internal TLDs not allowed')
    })

    it('should reject internal TLDs (.corp)', async () => {
      await expect(validateUpstreamUrl('http://intranet.corp')).rejects.toThrow('Internal TLDs not allowed')
    })
  })
})

describe('isInternalEndpoint', () => {
  it('should return true for localhost', () => {
    expect(isInternalEndpoint('http://localhost:3000')).toBe(true)
  })

  it('should return true for 127.x.x.x', () => {
    expect(isInternalEndpoint('http://127.0.0.1')).toBe(true)
  })

  it('should return true for private IPs', () => {
    expect(isInternalEndpoint('http://10.0.0.1')).toBe(true)
    expect(isInternalEndpoint('http://192.168.1.1')).toBe(true)
    expect(isInternalEndpoint('http://172.16.0.1')).toBe(true)
  })

  it('should return true for internal TLDs', () => {
    expect(isInternalEndpoint('http://server.local')).toBe(true)
    expect(isInternalEndpoint('http://api.internal')).toBe(true)
  })

  it('should return false for valid external URLs', () => {
    expect(isInternalEndpoint('https://api.example.com')).toBe(false)
    expect(isInternalEndpoint('https://google.com')).toBe(false)
  })

  it('should return false for invalid URLs', () => {
    expect(isInternalEndpoint('not-a-url')).toBe(false)
  })
})
