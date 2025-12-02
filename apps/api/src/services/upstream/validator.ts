/**
 * Upstream URL Validator
 *
 * Comprehensive SSRF (Server-Side Request Forgery) protection.
 * Validates upstream URLs to prevent attackers from accessing internal resources.
 */

/**
 * Validate upstream URL to prevent SSRF attacks
 * Implements comprehensive protection against various SSRF bypass techniques
 *
 * @param urlString - The URL to validate
 * @throws Error if URL is invalid or blocked for security reasons
 */
export async function validateUpstreamUrl(urlString: string): Promise<void> {
  let url: URL
  try {
    url = new URL(urlString)
  } catch {
    throw new Error('Invalid URL format')
  }

  // Only allow HTTP/HTTPS
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only HTTP/HTTPS protocols allowed')
  }

  const hostname = url.hostname.toLowerCase()

  // Block localhost variations (including IPv6)
  const localhostPatterns = [
    /^localhost$/i,
    /^127\./,  // 127.0.0.0/8
    /^0\.0\.0\.0$/,
    /^::1$/,   // IPv6 localhost
    /^\[::1\]$/,  // IPv6 localhost with brackets
    /^::$/,    // IPv6 any
    /^0:0:0:0:0:0:0:1$/,  // IPv6 localhost expanded
    /^\[0:0:0:0:0:0:0:1\]$/,  // IPv6 localhost expanded with brackets
  ]

  for (const pattern of localhostPatterns) {
    if (pattern.test(hostname)) {
      throw new Error('Localhost access not allowed')
    }
  }

  // Block private IP ranges (RFC 1918)
  const privateIpPatterns = [
    /^10\./,                           // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // 172.16.0.0/12
    /^192\.168\./,                     // 192.168.0.0/16
    /^169\.254\./,                     // Link-local (169.254.0.0/16)
    /^fc00:/i,                         // IPv6 private (fc00::/7)
    /^fd[0-9a-f]{2}:/i,                // IPv6 ULA
    /^fe80:/i,                         // IPv6 link-local
  ]

  for (const pattern of privateIpPatterns) {
    if (pattern.test(hostname)) {
      throw new Error('Private IP ranges not allowed')
    }
  }

  // Block cloud metadata endpoints
  const metadataPatterns = [
    /metadata\.google\.internal/i,     // Google Cloud
    /169\.254\.169\.254/,              // AWS, Azure, etc.
    /metadata\.azure\./i,               // Azure
    /metadata\.packet\./i,              // Packet/Equinix
    /metadata\.platformequinix\./i,     // Platform Equinix
  ]

  for (const pattern of metadataPatterns) {
    if (pattern.test(hostname)) {
      throw new Error('Cloud metadata endpoints not allowed')
    }
  }

  // Block decimal/octal/hex IP notation
  // e.g., http://2130706433 (127.0.0.1 in decimal)
  if (/^\d+$/.test(hostname)) {
    throw new Error('Decimal IP notation not allowed')
  }

  // Block URLs with credentials (potential for SSRF through auth)
  if (url.username || url.password) {
    throw new Error('URLs with credentials not allowed')
  }

  // Additional validation: ensure hostname has at least one dot (prevents single-word internal hostnames)
  // Exception: allow localhost-style names only if they're not blocked above
  if (!hostname.includes('.') && !hostname.includes(':')) {
    throw new Error('Invalid hostname format')
  }

  // Block common internal TLDs
  const blockedTlds = [
    '.local',
    '.internal',
    '.corp',
    '.home',
    '.lan',
    '.intranet',
  ]

  for (const tld of blockedTlds) {
    if (hostname.endsWith(tld)) {
      throw new Error('Internal TLDs not allowed')
    }
  }
}

/**
 * Check if URL points to an internal endpoint
 * @param url - URL to check
 * @returns true if URL appears to be internal/private
 */
export function isInternalEndpoint(url: string): boolean {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()

    // Check localhost
    if (hostname === 'localhost' || hostname.startsWith('127.')) {
      return true
    }

    // Check private IPs
    if (/^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\.|^192\.168\./.test(hostname)) {
      return true
    }

    // Check internal TLDs
    const internalTlds = ['.local', '.internal', '.corp', '.home', '.lan', '.intranet']
    if (internalTlds.some(tld => hostname.endsWith(tld))) {
      return true
    }

    return false
  } catch {
    return false
  }
}
