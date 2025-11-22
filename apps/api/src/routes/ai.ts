import { FastifyPluginAsync } from 'fastify'
import { getOpenAIConfig } from '@blink402/config'
import type { AISuggestionRequest, AISuggestionResponse, EndpointSuggestion } from '@blink402/types'
import { searchKnowledgeBase, API_KNOWLEDGE_BASE } from '../data/api-knowledge-base.js'
import { validateEndpoint } from '../utils/endpoint-health.js'

/**
 * Validates an array of endpoint suggestions
 * Filters out endpoints that fail validation
 */
async function validateSuggestions(
  suggestions: EndpointSuggestion[],
  logger: any
): Promise<EndpointSuggestion[]> {
  const validatedSuggestions: EndpointSuggestion[] = []

  for (const suggestion of suggestions) {
    try {
      // Quick validation with 5 second timeout
      const result = await validateEndpoint(suggestion.endpoint_url, suggestion.method, logger)

      if (result.valid) {
        validatedSuggestions.push(suggestion)
      } else {
        logger.info({
          endpoint: suggestion.endpoint_url,
          method: suggestion.method,
          reason: result.error
        }, 'Filtered out invalid AI suggestion')
      }
    } catch (error) {
      // If validation throws, log and skip this suggestion
      logger.warn({ endpoint: suggestion.endpoint_url, error }, 'Validation error for AI suggestion')
    }
  }

  return validatedSuggestions
}

export const aiRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /ai/suggest-endpoints
   * Generate API endpoint suggestions based on natural language query
   *
   * Strategy:
   * 1. First search curated knowledge base (fast, accurate)
   * 2. If good matches found (score > 60), return immediately
   * 3. Otherwise, use OpenAI for discovery of niche APIs
   * 4. Pre-validate all suggestions before returning to user
   */
  fastify.post<{
    Body: AISuggestionRequest
  }>('/suggest-endpoints', async (request, reply) => {
    const startTime = Date.now()
    const { query, limit = 5 } = request.body

    // Validate query
    if (!query || query.trim().length < 10) {
      return reply.code(400).send({
        error: 'Query must be at least 10 characters long'
      })
    }

    if (query.length > 500) {
      return reply.code(400).send({
        error: 'Query must be less than 500 characters'
      })
    }

    try {
      // STEP 1: Search curated knowledge base first
      const knowledgeBaseResults = searchKnowledgeBase(query, limit)

      // If we have good matches (score > 60), return immediately
      const hasGoodMatches = knowledgeBaseResults.length > 0 &&
                             knowledgeBaseResults[0].match_score >= 60

      if (hasGoodMatches) {
        // Validate suggestions before returning
        const validatedSuggestions = await validateSuggestions(knowledgeBaseResults, fastify.log)

        const processingTime = Date.now() - startTime
        fastify.log.info({
          query,
          originalCount: knowledgeBaseResults.length,
          validCount: validatedSuggestions.length,
          topScore: knowledgeBaseResults[0].match_score,
          processingTime,
          source: 'knowledge_base'
        }, 'AI suggestions from knowledge base (validated)')

        return reply.code(200).send({
          suggestions: validatedSuggestions,
          query,
          processing_time_ms: processingTime
        })
      }

      // STEP 2: If no good matches, try OpenAI for discovery
      fastify.log.info({ query, kbResults: knowledgeBaseResults.length }, 'No strong knowledge base matches, trying OpenAI')

      const openaiConfig = getOpenAIConfig()

      // Check if OpenAI API key is configured
      if (!openaiConfig.apiKey) {
        // Fall back to knowledge base results even if scores are low
        if (knowledgeBaseResults.length > 0) {
          fastify.log.warn('OpenAI not available, using best knowledge base results')
          return reply.code(200).send({
            suggestions: knowledgeBaseResults,
            query,
            processing_time_ms: Date.now() - startTime
          })
        }
        // Last resort: mock data
        fastify.log.warn('OpenAI API key not configured, returning mock data')
        return reply.code(200).send(getMockSuggestions(query, limit))
      }

      // Call OpenAI API with timeout (increased for GPT-4o)
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000) // 15s timeout for GPT-4o

      // Prepare example APIs from knowledge base to guide OpenAI
      const exampleAPIs = API_KNOWLEDGE_BASE.slice(0, 3).map(api => ({
        name: api.name,
        description: api.description,
        endpoint_url: api.endpoint_url,
        method: api.method,
        category: api.category,
        match_score: api.match_score,
        pricing_tier: api.pricing_tier,
        setup_steps: api.setup_steps,
        example_request: api.example_request,
        auth_required: api.auth_required,
        auth_type: api.auth_type,
        docs_url: api.docs_url,
        provider: api.provider
      }))

      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiConfig.apiKey}`
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are an expert API discovery assistant. Your job is to find ONLY APIs that EXACTLY match what the user asks for.

🚨 CRITICAL RULES - FOLLOW EXACTLY OR YOUR SUGGESTIONS WILL BE REJECTED:

1. **RELEVANCE IS EVERYTHING**: Only suggest APIs that DIRECTLY match the user's query
   - If user asks for weather, ONLY suggest weather APIs
   - If user asks for crypto prices, ONLY suggest crypto/token price APIs
   - If user asks for email, ONLY suggest email APIs
   - DO NOT suggest random unrelated APIs to fill the list

2. **QUALITY OVER QUANTITY**: Better to return 1-2 perfect matches than 5 mediocre ones
   - If you can't find 5 perfect matches, return fewer suggestions
   - Empty array is better than irrelevant suggestions

3. **ONLY REAL, WORKING APIs**:
   - Must be publicly available in 2024-2025
   - Must have a real, working endpoint URL (not placeholder)
   - Must be well-documented with active support

4. **STRICT VALIDATION CHECKLIST** - Ask yourself BEFORE suggesting each API:
   ✓ Does this API do EXACTLY what the user asked for?
   ✓ Is this the BEST match available?
   ✓ Would a developer be satisfied with this suggestion?
   ✓ Is the endpoint URL real and working?
   ✓ Are the setup steps accurate?

🚫 NEVER SUGGEST:
- Generic testing APIs (JSONPlaceholder, httpbin) unless user explicitly asks for testing
- Unrelated APIs just to fill the response
- APIs from different categories (e.g., don't suggest weather API for crypto query)
- Deprecated or discontinued APIs
- APIs with placeholder URLs like example.com

Return ONLY valid JSON with this exact structure:
{
  "suggestions": [{
    "name": "Exact Official API Name",
    "description": "Clear, specific description of what it does. Focus on practical use cases.",
    "endpoint_url": "https://api.example.com/v1/endpoint",
    "method": "GET|POST|PUT|DELETE",
    "category": "AI/ML|Utilities|Data|API Tools|Web3",
    "match_score": 95,
    "pricing_tier": "free|freemium|paid",
    "setup_steps": ["Specific, actionable step 1", "Specific, actionable step 2", "Specific, actionable step 3"],
    "example_request": "For GET/DELETE: undefined. For POST/PUT: Valid JSON string with actual field names (e.g., '{\"prompt\": \"A cat\", \"size\": \"512x512\"}', NOT '{\"input\": \"data\"}')",
    "auth_required": true,
    "auth_type": "api_key|bearer|oauth|none",
    "docs_url": "https://actual.docs.url",
    "provider": "Official Provider/Company Name"
  }]
}

REAL EXAMPLES TO LEARN FROM:
${JSON.stringify(exampleAPIs, null, 2)}

CATEGORY DEFINITIONS:
- AI/ML: GPT, Claude, Stable Diffusion, image/video generation, NLP, embeddings
- Utilities: Email (SendGrid), SMS (Twilio), QR codes, URL shorteners, file conversion
- Data: Weather (OpenWeather), news, countries, stocks, sports scores
- API Tools: JSONPlaceholder, httpbin, ReqRes - for testing/prototyping
- Web3: Solana (Helius, Metaplex), Ethereum, DexScreener, token prices, NFTs, DEXes

MATCH SCORE RUBRIC (be strict):
- 95-100: Perfect match - exactly what they asked for, no better option exists
- 85-94: Excellent match - fits their use case very well
- 75-84: Good match - will work but might need adaptation
- 60-74: Partial match - related but not ideal
- Below 60: Don't suggest it

SPECIAL INSTRUCTIONS FOR COMMON QUERIES:

Weather: OpenWeatherMap, WeatherAPI.com
Crypto prices: DexScreener, CoinGecko, Jupiter
AI images: Stability AI, Replicate, OpenAI DALL-E
Email: SendGrid, Resend
Meme coins/launch: Pump.fun, Metaplex, Raydium
Testing/mock: JSONPlaceholder, httpbin, ReqRes
Random fun: Dog CEO, Cat Facts, Bored API

📋 EXAMPLES OF GOOD VS BAD SUGGESTIONS:

QUERY: "I need weather data"
✅ GOOD: OpenWeatherMap, WeatherAPI.com (both are weather APIs)
❌ BAD: DexScreener, SendGrid, JSONPlaceholder (not weather related!)

QUERY: "Get crypto token prices"
✅ GOOD: DexScreener, CoinGecko, Jupiter (all crypto price APIs)
❌ BAD: OpenWeather, Giphy, Dog CEO (not crypto related!)

QUERY: "Launch a meme coin on Solana"
✅ GOOD: Pump.fun, Metaplex, Raydium (token creation/DEX)
❌ BAD: Weather APIs, Email APIs, Testing APIs (completely unrelated!)

QUERY: "Send emails to users"
✅ GOOD: SendGrid, Resend (email APIs)
❌ BAD: Weather, crypto, random testing APIs

REMEMBER:
- Quality > Quantity
- Return ONLY relevant suggestions
- 1 perfect match > 5 mediocre matches
- Empty array if you can't find good matches`
            },
            {
              role: 'user',
              content: `Find up to ${limit} REAL API endpoints for: "${query}"\n\nBe extremely specific and accurate. Only suggest APIs that PERFECTLY match this query. If you're not 100% confident an API exists, don't suggest it.`
            }
          ],
          max_tokens: 2000,
          temperature: 0.1,
          response_format: { type: 'json_object' }
        })
      })

      clearTimeout(timeout)

      if (!openaiResponse.ok) {
        const errorData = await openaiResponse.text()
        fastify.log.error({ error: errorData, status: openaiResponse.status }, 'OpenAI API error')

        // Fall back to knowledge base results if available
        if (knowledgeBaseResults.length > 0) {
          fastify.log.warn('OpenAI failed, using knowledge base results')
          return reply.code(200).send({
            suggestions: knowledgeBaseResults,
            query,
            processing_time_ms: Date.now() - startTime
          })
        }

        // Last resort: mock data
        fastify.log.warn('No knowledge base results, returning mock data')
        return reply.code(200).send(getMockSuggestions(query, limit))
      }

      const openaiData = await openaiResponse.json() as any
      const content = openaiData.choices[0]?.message?.content

      if (!content) {
        throw new Error('No response from OpenAI')
      }

      // Parse JSON response
      const aiResponse = JSON.parse(content)

      // Validate and sanitize suggestions with strict quality checks
      const suggestions: EndpointSuggestion[] = (aiResponse.suggestions || [])
        .slice(0, limit)
        .filter((s: any) => {
          // Filter out obviously invalid suggestions
          if (!s.endpoint_url || !s.endpoint_url.startsWith('http')) {
            fastify.log.warn({ suggestion: s }, 'Filtered: Invalid endpoint URL')
            return false
          }
          if (!s.name || s.name === 'Unknown API') {
            fastify.log.warn({ suggestion: s }, 'Filtered: Missing API name')
            return false
          }
          if (s.match_score < 70) {
            fastify.log.warn({ suggestion: s, score: s.match_score }, 'Filtered: Match score too low (minimum 70)')
            return false
          }
          // Filter out placeholder/example URLs
          if (s.endpoint_url.includes('example.com') || s.endpoint_url.includes('your-api')) {
            fastify.log.warn({ url: s.endpoint_url }, 'Filtered: Placeholder URL detected')
            return false
          }

          // Semantic relevance check - filter out obviously unrelated suggestions
          const queryLower = query.toLowerCase()
          const nameLower = s.name.toLowerCase()
          const descLower = (s.description || '').toLowerCase()
          const categoryLower = (s.category || '').toLowerCase()

          // Define query intent keywords
          const weatherKeywords = ['weather', 'forecast', 'temperature', 'climate', 'rain', 'snow']
          const cryptoKeywords = ['crypto', 'token', 'coin', 'price', 'blockchain', 'solana', 'ethereum', 'dex', 'meme']
          const emailKeywords = ['email', 'mail', 'smtp', 'send', 'notification']
          const aiKeywords = ['ai', 'image', 'generate', 'gpt', 'llm', 'ml', 'machine learning']
          const testingKeywords = ['test', 'mock', 'fake', 'placeholder', 'debug']

          // Check if query is about weather
          if (weatherKeywords.some(kw => queryLower.includes(kw))) {
            if (!weatherKeywords.some(kw => nameLower.includes(kw) || descLower.includes(kw))) {
              fastify.log.warn({ name: s.name, query }, 'Filtered: Weather query but non-weather API')
              return false
            }
          }

          // Check if query is about crypto
          if (cryptoKeywords.some(kw => queryLower.includes(kw))) {
            if (!cryptoKeywords.some(kw => nameLower.includes(kw) || descLower.includes(kw) || categoryLower.includes('web3'))) {
              fastify.log.warn({ name: s.name, query }, 'Filtered: Crypto query but non-crypto API')
              return false
            }
          }

          // Check if query is about email
          if (emailKeywords.some(kw => queryLower.includes(kw))) {
            if (!emailKeywords.some(kw => nameLower.includes(kw) || descLower.includes(kw))) {
              fastify.log.warn({ name: s.name, query }, 'Filtered: Email query but non-email API')
              return false
            }
          }

          // Check if query is about AI
          if (aiKeywords.some(kw => queryLower.includes(kw))) {
            if (!aiKeywords.some(kw => nameLower.includes(kw) || descLower.includes(kw) || categoryLower.includes('ai'))) {
              fastify.log.warn({ name: s.name, query }, 'Filtered: AI query but non-AI API')
              return false
            }
          }

          // Filter out testing APIs unless explicitly requested
          if (!testingKeywords.some(kw => queryLower.includes(kw))) {
            if (testingKeywords.some(kw => nameLower.includes(kw))) {
              fastify.log.warn({ name: s.name, query }, 'Filtered: Testing API suggested for non-testing query')
              return false
            }
          }

          return true
        })
        .map((s: any) => ({
          name: s.name,
          description: s.description || 'No description provided',
          endpoint_url: s.endpoint_url,
          method: s.method || 'GET',
          category: s.category || 'API Tools',
          match_score: Math.min(100, Math.max(60, s.match_score || 70)),
          pricing_tier: s.pricing_tier || 'freemium',
          setup_steps: Array.isArray(s.setup_steps) && s.setup_steps.length > 0
            ? s.setup_steps
            : ['Visit API provider website', 'Sign up for an account', 'Get API key from dashboard'],
          example_request: s.example_request || undefined,
          auth_required: s.auth_required !== false,
          auth_type: s.auth_type || 'api_key',
          docs_url: s.docs_url || undefined,
          provider: s.provider || undefined
        }))

      // Validate OpenAI suggestions before returning
      const validatedSuggestions = await validateSuggestions(suggestions, fastify.log)

      // If validation filtered out all suggestions, fall back to knowledge base
      if (validatedSuggestions.length === 0) {
        fastify.log.warn({ query, originalCount: suggestions.length }, 'OpenAI suggestions all filtered out, falling back to knowledge base')

        if (knowledgeBaseResults.length > 0) {
          return reply.code(200).send({
            suggestions: knowledgeBaseResults,
            query,
            processing_time_ms: Date.now() - startTime
          })
        }

        // Last resort: mock data
        return reply.code(200).send(getMockSuggestions(query, limit))
      }

      const processingTime = Date.now() - startTime

      const response: AISuggestionResponse = {
        suggestions: validatedSuggestions,
        query,
        processing_time_ms: processingTime
      }

      fastify.log.info({
        query,
        originalCount: suggestions.length,
        validCount: validatedSuggestions.length,
        topScore: validatedSuggestions[0]?.match_score,
        processingTime,
        source: 'openai'
      }, 'AI suggestions generated from OpenAI (validated)')

      return reply.code(200).send(response)

    } catch (error: any) {
      // Handle timeout or other errors
      if (error.name === 'AbortError') {
        fastify.log.warn({ query }, 'OpenAI request timed out')
      } else {
        fastify.log.error({ error, query }, 'Error generating AI suggestions')
      }

      // Try knowledge base results first
      const knowledgeBaseResults = searchKnowledgeBase(query, limit)
      if (knowledgeBaseResults.length > 0) {
        fastify.log.warn('Using knowledge base results due to OpenAI error')
        return reply.code(200).send({
          suggestions: knowledgeBaseResults,
          query,
          processing_time_ms: Date.now() - startTime
        })
      }

      // Last resort: mock data
      fastify.log.warn('No knowledge base results, returning mock data')
      return reply.code(200).send(getMockSuggestions(query, limit))
    }
  })
}

/**
 * Generate mock suggestions when OpenAI is not available
 * Useful for development and fallback scenarios
 */
function getMockSuggestions(query: string, limit: number): AISuggestionResponse {
  const mockSuggestions: EndpointSuggestion[] = [
    {
      name: 'OpenWeather API',
      description: 'Get current weather data, forecasts, and historical weather information for any location worldwide.',
      endpoint_url: 'https://api.openweathermap.org/data/2.5/weather',
      method: 'GET',
      category: 'Data',
      match_score: 85,
      pricing_tier: 'freemium',
      setup_steps: [
        'Sign up at openweathermap.org',
        'Get your free API key from the dashboard',
        'Add query parameter: ?q={city}&appid={api_key}'
      ],
      auth_required: true,
      auth_type: 'api_key',
      docs_url: 'https://openweathermap.org/api',
      provider: 'OpenWeather'
    },
    {
      name: 'DexScreener API',
      description: 'Real-time cryptocurrency and token price data from decentralized exchanges. Get OHLCV charts, volume, and liquidity.',
      endpoint_url: 'https://api.dexscreener.com/latest/dex/tokens/{tokenAddress}',
      method: 'GET',
      category: 'Web3',
      match_score: 90,
      pricing_tier: 'free',
      setup_steps: [
        'No API key required - completely free',
        'Replace {tokenAddress} with Solana token mint address',
        'Returns price, volume, and liquidity data'
      ],
      auth_required: false,
      auth_type: 'none',
      docs_url: 'https://docs.dexscreener.com',
      provider: 'DexScreener'
    },
    {
      name: 'JSONPlaceholder',
      description: 'Free fake REST API for testing and prototyping. Get placeholder users, posts, comments, and todos.',
      endpoint_url: 'https://jsonplaceholder.typicode.com/posts',
      method: 'GET',
      category: 'Utilities',
      match_score: 75,
      pricing_tier: 'free',
      setup_steps: [
        'No setup required - completely free',
        'Choose endpoint: /posts, /users, /comments, /todos',
        'Supports GET, POST, PUT, PATCH, DELETE'
      ],
      auth_required: false,
      auth_type: 'none',
      docs_url: 'https://jsonplaceholder.typicode.com',
      provider: 'JSONPlaceholder'
    }
  ]

  return {
    suggestions: mockSuggestions.slice(0, limit),
    query,
    processing_time_ms: 50
  }
}
