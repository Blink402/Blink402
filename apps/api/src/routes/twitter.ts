import { FastifyPluginAsync } from 'fastify'
import crypto from 'crypto'
import {
  getTwitterCredentialByWallet,
  upsertTwitterCredential,
  disconnectTwitter,
  logTwitterActivity,
  updateTwitterLastUsed,
  getTwitterActivityByCreator,
  getOrCreateCreator,
  TwitterCredential,
} from '@blink402/database'
import { getRunByReference } from '@blink402/database'
import { setSession, getSession, deleteSession } from '@blink402/redis'

// PKCE state stored in Redis (previously in-memory Map)
interface PKCEState {
  verifier: string
  expiresAt: number
}

// Generate PKCE code verifier (random string)
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url')
}

// Generate PKCE code challenge from verifier (SHA256 hash)
function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url')
}

// Refresh an expired Twitter OAuth2 access token using the refresh token
async function refreshTwitterToken(
  credential: TwitterCredential,
  clientId: string,
  clientSecret: string,
  fastify: any
): Promise<TwitterCredential> {
  try {
    // Prepare Basic Auth header
    const authHeader = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`

    // Call Twitter OAuth2 token endpoint with refresh_token
    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: authHeader,
      },
      body: new URLSearchParams({
        refresh_token: credential.refresh_token,
        grant_type: 'refresh_token',
        client_id: clientId,
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      fastify.log.error({ error: errorText, credentialId: credential.id }, 'Failed to refresh Twitter token')
      throw new Error(`Token refresh failed: ${errorText}`)
    }

    const tokenData: any = await tokenResponse.json()
    const { access_token, refresh_token, expires_in } = tokenData

    // Calculate new expiration time
    const expiresAt = new Date(Date.now() + expires_in * 1000)

    // Update credential in database with new tokens
    await upsertTwitterCredential({
      creatorId: credential.creator_id,
      twitterUserId: credential.twitter_user_id,
      twitterUsername: credential.twitter_username,
      accessToken: access_token,
      refreshToken: refresh_token || credential.refresh_token, // Use new token if provided, otherwise keep old one
      expiresAt,
    })

    fastify.log.info({ credentialId: credential.id, twitterUsername: credential.twitter_username }, 'Twitter token refreshed successfully')

    // Return updated credential (preserve unchanged fields)
    return {
      ...credential,
      access_token,
      refresh_token: refresh_token || credential.refresh_token,
      token_expires_at: expiresAt,
    }
  } catch (error) {
    fastify.log.error({ error, credentialId: credential.id }, 'Error refreshing Twitter token')
    throw error
  }
}

// Store PKCE verifier with expiration (10 minutes) in Redis
async function storePKCEVerifier(state: string, verifier: string): Promise<void> {
  const expiresAt = Date.now() + 10 * 60 * 1000 // 10 minutes
  const pkceState: PKCEState = { verifier, expiresAt }

  // Store in Redis with 10 minute TTL
  // Key: `pkce:{state}` - automatically expires after 10 minutes
  await setSession(`pkce:${state}`, pkceState, 600) // 600 seconds = 10 minutes
}

// Retrieve and delete PKCE verifier from Redis
async function retrievePKCEVerifier(state: string): Promise<string | null> {
  const entry = await getSession<PKCEState>(`pkce:${state}`)
  if (!entry) return null

  // Check if expired (double-check even though Redis TTL should handle it)
  if (entry.expiresAt < Date.now()) {
    await deleteSession(`pkce:${state}`)
    return null
  }

  // Delete after retrieval (one-time use)
  await deleteSession(`pkce:${state}`)
  return entry.verifier
}

export const twitterRoutes: FastifyPluginAsync = async (fastify) => {
  // Twitter OAuth Configuration with validation
  const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID
  const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET
  const TWITTER_REDIRECT_URI = process.env.TWITTER_REDIRECT_URI || 'http://localhost:3001/twitter/callback'
  const FRONTEND_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  // Validate Twitter OAuth configuration if any Twitter env vars are set
  const isTwitterConfigured = TWITTER_CLIENT_ID || TWITTER_CLIENT_SECRET
  if (isTwitterConfigured && (!TWITTER_CLIENT_ID || !TWITTER_CLIENT_SECRET)) {
    fastify.log.error('Twitter OAuth partially configured. Both TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET are required.')
    // Don't throw error, just log warning - Twitter features will be disabled
  }

  const hasValidTwitterConfig = !!(TWITTER_CLIENT_ID && TWITTER_CLIENT_SECRET)
  if (hasValidTwitterConfig) {
    fastify.log.info('Twitter OAuth configured successfully')
  } else {
    fastify.log.warn('Twitter OAuth not configured. Twitter features will be disabled.')
  }

  // ========== OAuth Flow Endpoints ==========

  // GET /twitter/auth/init - Start Twitter OAuth flow
  fastify.get<{
    Querystring: { wallet: string; state?: string }
  }>('/auth/init', async (request, reply) => {
    const { wallet, state } = request.query

    if (!wallet) {
      return reply.code(400).send({ error: 'Wallet address required' })
    }

    if (!TWITTER_CLIENT_ID) {
      return reply.code(500).send({ error: 'Twitter OAuth not configured. Set TWITTER_CLIENT_ID environment variable.' })
    }

    // Generate OAuth state for CSRF protection
    const oauthState = state || `${wallet}:${Date.now()}:${Math.random().toString(36).substring(7)}`

    // Generate PKCE code verifier and challenge
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)

    // Store verifier for callback verification in Redis
    await storePKCEVerifier(oauthState, codeVerifier)

    // Twitter OAuth 2.0 authorization URL
    const authUrl = new URL('https://twitter.com/i/oauth2/authorize')
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', TWITTER_CLIENT_ID!)
    authUrl.searchParams.set('redirect_uri', TWITTER_REDIRECT_URI)
    authUrl.searchParams.set('scope', 'tweet.read tweet.write users.read offline.access')
    authUrl.searchParams.set('state', oauthState)
    authUrl.searchParams.set('code_challenge', codeChallenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')

    return reply.code(200).send({
      success: true,
      authUrl: authUrl.toString(),
      state: oauthState,
    })
  })

  // GET /twitter/callback - OAuth callback handler
  fastify.get<{
    Querystring: { code?: string; state?: string; error?: string }
  }>('/callback', async (request, reply) => {
    const { code, state, error } = request.query

    // Handle OAuth error
    if (error) {
      fastify.log.error({ error }, 'Twitter OAuth error')
      return reply.redirect(`${FRONTEND_URL}/dashboard?twitter_error=${encodeURIComponent(error)}`)
    }

    if (!code || !state) {
      return reply.redirect(`${FRONTEND_URL}/dashboard?twitter_error=missing_params`)
    }

    try {
      // Extract wallet from state
      const wallet = state.split(':')[0]

      // Retrieve PKCE verifier from Redis
      const codeVerifier = await retrievePKCEVerifier(state)
      if (!codeVerifier) {
        fastify.log.error({ state }, 'PKCE verifier not found or expired')
        return reply.redirect(`${FRONTEND_URL}/dashboard?twitter_error=invalid_state`)
      }

      // Prepare Basic Auth header (don't log the actual value)
      const authHeader = `Basic ${Buffer.from(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`).toString('base64')}`

      // Exchange code for access token
      const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: authHeader,
        },
        body: new URLSearchParams({
          code,
          grant_type: 'authorization_code',
          client_id: TWITTER_CLIENT_ID!,
          redirect_uri: TWITTER_REDIRECT_URI,
          code_verifier: codeVerifier,
        }),
      })

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text()
        fastify.log.error({ error: errorText }, 'Failed to exchange OAuth code')
        return reply.redirect(`${FRONTEND_URL}/dashboard?twitter_error=token_exchange_failed`)
      }

      const tokenData: any = await tokenResponse.json()
      const { access_token, refresh_token, expires_in } = tokenData

      // Get Twitter user info
      const userResponse = await fetch('https://api.twitter.com/2/users/me', {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      })

      if (!userResponse.ok) {
        fastify.log.error('Failed to fetch Twitter user info')
        return reply.redirect(`${FRONTEND_URL}/dashboard?twitter_error=user_fetch_failed`)
      }

      const userData: any = await userResponse.json()
      const twitterUser = userData.data

      // Get or create creator
      const creatorId = await getOrCreateCreator(wallet)

      // Save Twitter credentials
      const expiresAt = new Date(Date.now() + expires_in * 1000)
      await upsertTwitterCredential({
        creatorId,
        twitterUserId: twitterUser.id,
        twitterUsername: twitterUser.username,
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt,
      })

      fastify.log.info({ wallet, twitterUsername: twitterUser.username }, 'Twitter connected successfully')

      // Redirect back to dashboard with success
      return reply.redirect(`${FRONTEND_URL}/dashboard?twitter_connected=${twitterUser.username}`)
    } catch (error) {
      fastify.log.error({ error }, 'Error in Twitter OAuth callback')
      return reply.redirect(`${FRONTEND_URL}/dashboard?twitter_error=unexpected_error`)
    }
  })

  // GET /twitter/status - Check if wallet has Twitter connected
  fastify.get<{
    Querystring: { wallet: string }
  }>('/status', async (request, reply) => {
    const { wallet } = request.query

    if (!wallet) {
      return reply.code(400).send({ error: 'Wallet address required' })
    }

    try {
      const credential = await getTwitterCredentialByWallet(wallet)

      if (!credential) {
        return reply.code(200).send({
          success: true,
          connected: false,
        })
      }

      return reply.code(200).send({
        success: true,
        connected: true,
        username: credential.twitter_username,
        connectedAt: credential.connected_at,
        lastUsedAt: credential.last_used_at,
      })
    } catch (error) {
      fastify.log.error({ error, wallet }, 'Error checking Twitter status')
      return reply.code(500).send({ error: 'Failed to check Twitter status' })
    }
  })

  // POST /twitter/disconnect - Disconnect Twitter account
  fastify.post<{
    Body: { wallet: string }
  }>('/disconnect', async (request, reply) => {
    // Validate request body exists
    if (!request.body) {
      return reply.code(400).send({ error: 'Request body required' })
    }

    const { wallet } = request.body

    if (!wallet) {
      return reply.code(400).send({ error: 'Wallet address required' })
    }

    try {
      const credential = await getTwitterCredentialByWallet(wallet)

      if (!credential) {
        return reply.code(404).send({ error: 'No Twitter connection found' })
      }

      await disconnectTwitter(credential.creator_id)

      return reply.code(200).send({
        success: true,
        message: 'Twitter account disconnected',
      })
    } catch (error) {
      fastify.log.error({ error, wallet }, 'Error disconnecting Twitter')
      return reply.code(500).send({ error: 'Failed to disconnect Twitter' })
    }
  })

  // ========== Twitter Proxy Endpoints ==========

  // POST /twitter/x - Post a tweet (called by blinks)
  fastify.post<{
    Body: {
      reference: string // Run reference for payment verification
      signature: string // Transaction signature
      tweet: string // Tweet text to post
    }
  }>('/x', async (request, reply) => {
    const { reference, signature, tweet } = request.body

    // Validate inputs
    if (!reference || !tweet) {
      return reply.code(400).send({ error: 'Missing required fields: reference, tweet' })
    }

    if (tweet.length > 280) {
      return reply.code(400).send({ error: 'Tweet exceeds 280 characters' })
    }

    try {
      // Get run to verify payment
      const run = await getRunByReference(reference)

      if (!run) {
        return reply.code(400).send({ error: 'Invalid reference' })
      }

      if (run.status !== 'paid' && run.status !== 'executed') {
        return reply.code(402).send({ error: 'Payment not verified' })
      }

      // Get Twitter credentials for the blink creator
      // We need to get the blink first to find the creator
      const { getBlinkById } = await import('@blink402/database')
      const blink = await getBlinkById(run.blink_id)

      if (!blink) {
        return reply.code(404).send({ error: 'Blink not found' })
      }

      let credential = await getTwitterCredentialByWallet(blink.creator.wallet)

      if (!credential) {
        return reply.code(404).send({
          error: 'Creator has not connected their Twitter account',
        })
      }

      // Check if token is expired and refresh if needed
      const now = new Date()
      if (credential.token_expires_at < now) {
        try {
          fastify.log.info({ credentialId: credential.id, twitterUsername: credential.twitter_username }, 'Twitter token expired, attempting refresh')
          credential = await refreshTwitterToken(credential, TWITTER_CLIENT_ID!, TWITTER_CLIENT_SECRET!, fastify)
        } catch (error) {
          fastify.log.error({ error, credentialId: credential.id }, 'Token refresh failed')
          return reply.code(401).send({
            error: 'Twitter token expired and refresh failed. Creator needs to reconnect their Twitter account.',
          })
        }
      }

      // Post tweet to Twitter API
      const twitterResponse = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${credential.access_token}`,
        },
        body: JSON.stringify({ text: tweet }),
      })

      if (!twitterResponse.ok) {
        const errorData = await twitterResponse.json()
        fastify.log.error({ error: errorData }, 'Twitter API error')

        // Log failed activity
        await logTwitterActivity({
          credentialId: credential.id,
          runId: run.id,
          actionType: 'post_tweet',
          tweetText: tweet,
          status: 'failed',
          errorMessage: JSON.stringify(errorData),
        })

        return reply.code(500).send({
          error: 'Failed to post tweet',
          details: errorData,
        })
      }

      const tweetData: any = await twitterResponse.json()
      const tweetId = tweetData.data.id

      // Update last used timestamp
      await updateTwitterLastUsed(credential.id)

      // Log successful activity
      await logTwitterActivity({
        credentialId: credential.id,
        runId: run.id,
        actionType: 'post_tweet',
        tweetId,
        tweetText: tweet,
        status: 'success',
      })

      return reply.code(200).send({
        success: true,
        tweetId,
        tweetUrl: `https://twitter.com/${credential.twitter_username}/status/${tweetId}`,
        message: 'Tweet posted successfully',
      })
    } catch (error) {
      fastify.log.error({ error, reference }, 'Error posting tweet')
      return reply.code(500).send({
        error: 'Failed to post tweet',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  // GET /twitter/activity - Get Twitter activity for a wallet
  fastify.get<{
    Querystring: { wallet: string; limit?: string }
  }>('/activity', async (request, reply) => {
    const { wallet, limit = '50' } = request.query

    if (!wallet) {
      return reply.code(400).send({ error: 'Wallet address required' })
    }

    try {
      const credential = await getTwitterCredentialByWallet(wallet)

      if (!credential) {
        return reply.code(404).send({ error: 'No Twitter connection found' })
      }

      const activity = await getTwitterActivityByCreator(credential.creator_id, parseInt(limit))

      return reply.code(200).send({
        success: true,
        data: activity,
      })
    } catch (error) {
      fastify.log.error({ error, wallet }, 'Error fetching Twitter activity')
      return reply.code(500).send({ error: 'Failed to fetch activity' })
    }
  })
}
