import type { EndpointSuggestion } from '@blink402/types'

/**
 * Curated API Knowledge Base
 * Real, publicly available APIs organized by category
 * Updated regularly to ensure accuracy
 */

export interface APIKnowledgeEntry extends EndpointSuggestion {
  keywords: string[] // For semantic matching
  use_cases: string[] // Common use cases
}

export const API_KNOWLEDGE_BASE: APIKnowledgeEntry[] = [
  // ===== WEATHER & ENVIRONMENT =====
  {
    name: 'OpenWeatherMap Current Weather',
    description: 'Real-time weather data for any location worldwide. Get temperature, humidity, wind, and conditions.',
    endpoint_url: 'https://api.openweathermap.org/data/2.5/weather',
    method: 'GET',
    category: 'Data',
    match_score: 95,
    pricing_tier: 'freemium',
    setup_steps: [
      'Sign up at openweathermap.org',
      'Get free API key from dashboard',
      'Add query params: ?q={city}&appid={YOUR_API_KEY}&units=metric'
    ],
    example_request: undefined,
    auth_required: true,
    auth_type: 'api_key',
    docs_url: 'https://openweathermap.org/current',
    provider: 'OpenWeather',
    keywords: ['weather', 'temperature', 'forecast', 'climate', 'rain', 'snow', 'humidity', 'wind'],
    use_cases: ['Weather dashboards', 'Location-based services', 'Travel apps', 'Agriculture monitoring']
  },
  {
    name: 'OpenWeatherMap 5-Day Forecast',
    description: '5-day weather forecast with 3-hour intervals. Plan ahead with accurate predictions.',
    endpoint_url: 'https://api.openweathermap.org/data/2.5/forecast',
    method: 'GET',
    category: 'Data',
    match_score: 95,
    pricing_tier: 'freemium',
    setup_steps: [
      'Sign up at openweathermap.org',
      'Use same API key as current weather',
      'Add query params: ?q={city}&appid={YOUR_API_KEY}&units=metric'
    ],
    example_request: undefined,
    auth_required: true,
    auth_type: 'api_key',
    docs_url: 'https://openweathermap.org/forecast5',
    provider: 'OpenWeather',
    keywords: ['weather', 'forecast', 'prediction', 'future', '5-day', 'weekly'],
    use_cases: ['Weather apps', 'Event planning', 'Travel scheduling', 'Outdoor activity planning']
  },
  {
    name: 'WeatherAPI.com',
    description: 'Weather data with astronomy, air quality, and sports info. More comprehensive than basic weather APIs.',
    endpoint_url: 'https://api.weatherapi.com/v1/current.json',
    method: 'GET',
    category: 'Data',
    match_score: 92,
    pricing_tier: 'freemium',
    setup_steps: [
      'Sign up at weatherapi.com',
      'Get free API key (1M calls/month)',
      'Add query params: ?key={YOUR_API_KEY}&q={location}&aqi=yes'
    ],
    example_request: undefined,
    auth_required: true,
    auth_type: 'api_key',
    docs_url: 'https://www.weatherapi.com/docs/',
    provider: 'WeatherAPI',
    keywords: ['weather', 'air quality', 'astronomy', 'sports', 'forecast', 'realtime'],
    use_cases: ['Weather dashboards', 'Air quality monitoring', 'Sports scheduling', 'Astronomy apps']
  },

  // ===== CRYPTOCURRENCY & WEB3 =====
  {
    name: 'DexScreener Token Data',
    description: 'Real-time crypto token prices from DEXes. Get price, volume, liquidity for Solana, Ethereum, and more.',
    endpoint_url: 'https://api.dexscreener.com/latest/dex/tokens/{tokenAddress}',
    method: 'GET',
    category: 'Web3',
    match_score: 98,
    pricing_tier: 'free',
    setup_steps: [
      'No API key required - completely free',
      'Replace {tokenAddress} with token mint address',
      'Supports Solana, Ethereum, BSC, and 50+ chains'
    ],
    example_request: undefined,
    auth_required: false,
    auth_type: 'none',
    docs_url: 'https://docs.dexscreener.com',
    provider: 'DexScreener',
    keywords: ['crypto', 'token', 'price', 'dex', 'solana', 'ethereum', 'trading', 'liquidity', 'volume', 'meme coin', 'market data'],
    use_cases: ['Crypto price tracking', 'Trading bots', 'Portfolio apps', 'DeFi dashboards', 'Meme coin tracking']
  },
  {
    name: 'CoinGecko Price API',
    description: 'Comprehensive crypto price data for 10,000+ coins. Historical data, market cap, volume.',
    endpoint_url: 'https://api.coingecko.com/api/v3/simple/price',
    method: 'GET',
    category: 'Web3',
    match_score: 95,
    pricing_tier: 'freemium',
    setup_steps: [
      'Free tier: 10-50 calls/minute (no key required)',
      'Add query params: ?ids={coin_id}&vs_currencies=usd',
      'Pro tier available for higher limits'
    ],
    example_request: undefined,
    auth_required: false,
    auth_type: 'none',
    docs_url: 'https://www.coingecko.com/en/api/documentation',
    provider: 'CoinGecko',
    keywords: ['crypto', 'cryptocurrency', 'bitcoin', 'ethereum', 'price', 'market cap', 'volume'],
    use_cases: ['Crypto trackers', 'Portfolio management', 'Price alerts', 'Market analysis']
  },
  {
    name: 'Helius Solana RPC',
    description: 'High-performance Solana RPC with webhooks. Get account data, transactions, and NFT metadata.',
    endpoint_url: 'https://mainnet.helius-rpc.com/?api-key={YOUR_API_KEY}',
    method: 'POST',
    category: 'Web3',
    match_score: 90,
    pricing_tier: 'freemium',
    setup_steps: [
      'Sign up at helius.dev',
      'Get free API key (100k credits/month)',
      'Use standard Solana JSON-RPC methods'
    ],
    example_request: '{"jsonrpc":"2.0","id":1,"method":"getBalance","params":["PUBLIC_KEY"]}',
    auth_required: true,
    auth_type: 'api_key',
    docs_url: 'https://docs.helius.dev',
    provider: 'Helius',
    keywords: ['solana', 'blockchain', 'rpc', 'nft', 'transaction', 'web3', 'wallet', 'token', 'meme coin', 'spl', 'mint'],
    use_cases: ['Solana dApps', 'NFT platforms', 'Wallet services', 'Blockchain analytics', 'Token creation']
  },
  {
    name: 'Metaplex Token Metadata',
    description: 'Create and manage SPL tokens and NFTs on Solana. Mint tokens, add metadata, and manage collections.',
    endpoint_url: 'https://api.metaplex.com/v1/tokens',
    method: 'POST',
    category: 'Web3',
    match_score: 96,
    pricing_tier: 'free',
    setup_steps: [
      'Install @metaplex-foundation/js SDK',
      'Connect to Solana with wallet keypair',
      'Use createMint() to create new token',
      'Use createMetadata() to add token metadata (name, symbol, image)'
    ],
    example_request: '{"name":"My Meme Coin","symbol":"MEME","decimals":9,"uri":"https://metadata.json"}',
    auth_required: true,
    auth_type: 'bearer',
    docs_url: 'https://docs.metaplex.com',
    provider: 'Metaplex',
    keywords: ['solana', 'token', 'mint', 'create', 'spl', 'meme coin', 'cryptocurrency', 'launch', 'deploy', 'nft', 'metadata'],
    use_cases: ['Token creation', 'Meme coin launches', 'NFT collections', 'SPL token minting']
  },
  {
    name: 'Pump.fun API',
    description: 'Launch meme coins on Solana with bonding curves. No code needed - instant token creation and trading.',
    endpoint_url: 'https://pumpportal.fun/api/trade',
    method: 'POST',
    category: 'Web3',
    match_score: 98,
    pricing_tier: 'free',
    setup_steps: [
      'No signup required - permissionless',
      'Create token with bonding curve parameters',
      'Token auto-lists on DEXes when threshold hit',
      'Add metadata: name, symbol, image, description'
    ],
    example_request: '{"action":"create","tokenName":"My Meme","ticker":"MEME","description":"Best meme coin","imageUrl":"https://image.png"}',
    auth_required: false,
    auth_type: 'none',
    docs_url: 'https://pumpportal.fun/trading-api',
    provider: 'Pump.fun',
    keywords: ['meme coin', 'token', 'launch', 'create', 'solana', 'bonding curve', 'pump', 'deploy', 'fair launch', 'liquidity'],
    use_cases: ['Meme coin creation', 'Fair launches', 'Community tokens', 'Quick token deployment']
  },
  {
    name: 'Jupiter Token List',
    description: 'Get comprehensive token data from Jupiter aggregator. Prices, liquidity, and trading pairs for all Solana tokens.',
    endpoint_url: 'https://token.jup.ag/all',
    method: 'GET',
    category: 'Web3',
    match_score: 92,
    pricing_tier: 'free',
    setup_steps: [
      'No API key required',
      'Returns full token list with metadata',
      'Filter by verified/community tokens',
      'Includes logos and social links'
    ],
    example_request: undefined,
    auth_required: false,
    auth_type: 'none',
    docs_url: 'https://station.jup.ag/docs/token-list/token-list-api',
    provider: 'Jupiter',
    keywords: ['solana', 'token', 'list', 'dex', 'trading', 'swap', 'price', 'metadata', 'meme coin', 'verified'],
    use_cases: ['Token discovery', 'Price tracking', 'Wallet integrations', 'DEX aggregation']
  },
  {
    name: 'Raydium Pool Creation',
    description: 'Create liquidity pools on Raydium DEX. Add liquidity and enable trading for your token.',
    endpoint_url: 'https://api.raydium.io/v2/main/create-pool',
    method: 'POST',
    category: 'Web3',
    match_score: 94,
    pricing_tier: 'free',
    setup_steps: [
      'Create SPL token first via Metaplex',
      'Prepare base token (SOL/USDC) and quote token',
      'Set initial liquidity amounts',
      'Sign transaction with wallet to create pool'
    ],
    example_request: '{"baseMint":"TOKEN_ADDRESS","quoteMint":"So11111111111111111111111111111111111111112","baseAmount":1000000,"quoteAmount":100}',
    auth_required: true,
    auth_type: 'bearer',
    docs_url: 'https://docs.raydium.io',
    provider: 'Raydium',
    keywords: ['solana', 'dex', 'liquidity', 'pool', 'token', 'launch', 'trading', 'amm', 'swap', 'meme coin'],
    use_cases: ['Token launches', 'Liquidity provision', 'DEX trading', 'Market making']
  },

  // ===== AI & MACHINE LEARNING =====
  {
    name: 'Stability AI Image Generation',
    description: 'Generate high-quality images from text prompts using Stable Diffusion. Multiple models available.',
    endpoint_url: 'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image',
    method: 'POST',
    category: 'AI/ML',
    match_score: 96,
    pricing_tier: 'paid',
    setup_steps: [
      'Sign up at stability.ai',
      'Purchase credits ($10 = 1000 images)',
      'Add Authorization header: Bearer {YOUR_API_KEY}',
      'Send JSON body with text_prompts array'
    ],
    example_request: '{"text_prompts":[{"text":"A lighthouse on a cliff"}],"cfg_scale":7,"steps":30}',
    auth_required: true,
    auth_type: 'bearer',
    docs_url: 'https://platform.stability.ai/docs/api-reference',
    provider: 'Stability AI',
    keywords: ['ai', 'image', 'generation', 'stable diffusion', 'text-to-image', 'art', 'creative'],
    use_cases: ['AI art generation', 'Content creation', 'Marketing materials', 'Game assets']
  },
  {
    name: 'Replicate AI Models',
    description: 'Run thousands of AI models via API: image gen, video, audio, LLMs. Pay per second of compute.',
    endpoint_url: 'https://api.replicate.com/v1/predictions',
    method: 'POST',
    category: 'AI/ML',
    match_score: 94,
    pricing_tier: 'paid',
    setup_steps: [
      'Sign up at replicate.com',
      'Get API token from account settings',
      'Add Authorization header: Token {YOUR_API_KEY}',
      'Specify model version and inputs in JSON body'
    ],
    example_request: '{"version":"MODEL_VERSION","input":{"prompt":"A cat"}}',
    auth_required: true,
    auth_type: 'bearer',
    docs_url: 'https://replicate.com/docs/reference/http',
    provider: 'Replicate',
    keywords: ['ai', 'ml', 'machine learning', 'image', 'video', 'audio', 'llm', 'models'],
    use_cases: ['AI prototyping', 'Content generation', 'Video processing', 'Audio synthesis']
  },
  {
    name: 'OpenAI GPT-4 Chat',
    description: 'State-of-the-art language model for chat, Q&A, and text generation. GPT-4 and GPT-3.5 available.',
    endpoint_url: 'https://api.openai.com/v1/chat/completions',
    method: 'POST',
    category: 'AI/ML',
    match_score: 97,
    pricing_tier: 'paid',
    setup_steps: [
      'Sign up at platform.openai.com',
      'Add payment method and get API key',
      'Add Authorization header: Bearer {YOUR_API_KEY}',
      'Send messages array with user prompts'
    ],
    example_request: '{"model":"gpt-4","messages":[{"role":"user","content":"Hello!"}]}',
    auth_required: true,
    auth_type: 'bearer',
    docs_url: 'https://platform.openai.com/docs/api-reference/chat',
    provider: 'OpenAI',
    keywords: ['ai', 'gpt', 'chatbot', 'language model', 'text generation', 'nlp', 'assistant'],
    use_cases: ['Chatbots', 'Content writing', 'Code generation', 'Q&A systems']
  },

  // ===== UTILITIES & TOOLS =====
  {
    name: 'QR Code Generator',
    description: 'Generate QR codes from text, URLs, or data. Customize size, color, and error correction.',
    endpoint_url: 'https://api.qrserver.com/v1/create-qr-code/',
    method: 'GET',
    category: 'Utilities',
    match_score: 98,
    pricing_tier: 'free',
    setup_steps: [
      'No API key required - completely free',
      'Add query params: ?data={YOUR_DATA}&size=300x300',
      'Returns PNG image directly'
    ],
    example_request: undefined,
    auth_required: false,
    auth_type: 'none',
    docs_url: 'https://goqr.me/api/',
    provider: 'QR Server',
    keywords: ['qr code', 'barcode', 'generator', 'image', 'encode', 'url shortener'],
    use_cases: ['Event tickets', 'Contact cards', 'URL sharing', 'Product labels']
  },
  {
    name: 'Abstract IP Geolocation',
    description: 'Get location, timezone, and ISP data from IP addresses. Supports IPv4 and IPv6.',
    endpoint_url: 'https://ipgeolocation.abstractapi.com/v1/',
    method: 'GET',
    category: 'Utilities',
    match_score: 92,
    pricing_tier: 'freemium',
    setup_steps: [
      'Sign up at abstractapi.com',
      'Get free API key (20k requests/month)',
      'Add query params: ?api_key={YOUR_API_KEY}&ip_address={IP}'
    ],
    example_request: undefined,
    auth_required: true,
    auth_type: 'api_key',
    docs_url: 'https://www.abstractapi.com/ip-geolocation-api',
    provider: 'Abstract API',
    keywords: ['ip', 'geolocation', 'location', 'timezone', 'country', 'city', 'isp'],
    use_cases: ['User analytics', 'Fraud detection', 'Localization', 'Content filtering']
  },
  {
    name: 'URL Shortener (TinyURL)',
    description: 'Shorten long URLs into tiny, shareable links. Track clicks and analytics.',
    endpoint_url: 'https://api.tinyurl.com/create',
    method: 'POST',
    category: 'Utilities',
    match_score: 95,
    pricing_tier: 'freemium',
    setup_steps: [
      'Sign up at tinyurl.com/app',
      'Get free API key from developer dashboard',
      'Add Authorization header: Bearer {YOUR_API_KEY}',
      'Send JSON body with url field'
    ],
    example_request: '{"url":"https://example.com/very/long/url","domain":"tinyurl.com"}',
    auth_required: true,
    auth_type: 'bearer',
    docs_url: 'https://tinyurl.com/app/dev',
    provider: 'TinyURL',
    keywords: ['url', 'shortener', 'link', 'redirect', 'analytics', 'tracking'],
    use_cases: ['Social media', 'Marketing campaigns', 'Link tracking', 'SMS messages']
  },
  {
    name: 'SendGrid Email API',
    description: 'Send transactional and marketing emails at scale. Templates, analytics, and deliverability tools.',
    endpoint_url: 'https://api.sendgrid.com/v3/mail/send',
    method: 'POST',
    category: 'Utilities',
    match_score: 93,
    pricing_tier: 'freemium',
    setup_steps: [
      'Sign up at sendgrid.com (free: 100 emails/day)',
      'Create API key in Settings > API Keys',
      'Add Authorization header: Bearer {YOUR_API_KEY}',
      'Send JSON with personalizations, from, subject, content'
    ],
    example_request: '{"personalizations":[{"to":[{"email":"user@example.com"}]}],"from":{"email":"noreply@yourdomain.com"},"subject":"Hello","content":[{"type":"text/plain","value":"Email body"}]}',
    auth_required: true,
    auth_type: 'bearer',
    docs_url: 'https://docs.sendgrid.com/api-reference/mail-send/mail-send',
    provider: 'SendGrid',
    keywords: ['email', 'mail', 'smtp', 'transactional', 'newsletter', 'notifications'],
    use_cases: ['User notifications', 'Password resets', 'Newsletters', 'Order confirmations']
  },

  // ===== DATA & INFORMATION =====
  {
    name: 'REST Countries',
    description: 'Get detailed information about countries: population, capital, languages, currencies, flags.',
    endpoint_url: 'https://restcountries.com/v3.1/all',
    method: 'GET',
    category: 'Data',
    match_score: 94,
    pricing_tier: 'free',
    setup_steps: [
      'No API key required - completely free',
      'Query by name: /v3.1/name/{country}',
      'Query by code: /v3.1/alpha/{code}',
      'Filter fields: ?fields=name,capital,population'
    ],
    example_request: undefined,
    auth_required: false,
    auth_type: 'none',
    docs_url: 'https://restcountries.com',
    provider: 'REST Countries',
    keywords: ['countries', 'geography', 'population', 'flags', 'languages', 'currencies', 'data'],
    use_cases: ['Travel apps', 'Educational tools', 'Forms/dropdowns', 'Geography quizzes']
  },
  {
    name: 'NewsAPI Headlines',
    description: 'Breaking news headlines from 80,000+ sources worldwide. Filter by category, country, language.',
    endpoint_url: 'https://newsapi.org/v2/top-headlines',
    method: 'GET',
    category: 'Data',
    match_score: 92,
    pricing_tier: 'freemium',
    setup_steps: [
      'Sign up at newsapi.org',
      'Get free API key (developer plan)',
      'Add header: X-Api-Key: {YOUR_API_KEY}',
      'Add query params: ?country=us&category=technology'
    ],
    example_request: undefined,
    auth_required: true,
    auth_type: 'api_key',
    docs_url: 'https://newsapi.org/docs',
    provider: 'NewsAPI',
    keywords: ['news', 'headlines', 'articles', 'media', 'journalism', 'current events'],
    use_cases: ['News aggregators', 'Content curation', 'Research tools', 'Market intelligence']
  },
  {
    name: 'NASA APOD (Astronomy Picture)',
    description: 'NASA\'s Astronomy Picture of the Day with HD images, explanations, and dates back to 1995.',
    endpoint_url: 'https://api.nasa.gov/planetary/apod',
    method: 'GET',
    category: 'Data',
    match_score: 95,
    pricing_tier: 'free',
    setup_steps: [
      'Sign up at api.nasa.gov (instant approval)',
      'Get free API key (1000 requests/hour)',
      'Add query param: ?api_key={YOUR_API_KEY}',
      'Optional: ?date=YYYY-MM-DD for specific date'
    ],
    example_request: undefined,
    auth_required: true,
    auth_type: 'api_key',
    docs_url: 'https://api.nasa.gov',
    provider: 'NASA',
    keywords: ['space', 'astronomy', 'nasa', 'images', 'science', 'pictures', 'cosmos'],
    use_cases: ['Educational apps', 'Space enthusiast sites', 'Daily wallpapers', 'Science blogs']
  },

  // ===== TESTING & DEVELOPMENT =====
  {
    name: 'JSONPlaceholder Posts',
    description: 'Free fake REST API for testing and prototyping. Get placeholder posts, users, comments, todos.',
    endpoint_url: 'https://jsonplaceholder.typicode.com/posts',
    method: 'GET',
    category: 'API Tools',
    match_score: 90,
    pricing_tier: 'free',
    setup_steps: [
      'No setup required - completely free',
      'Endpoints: /posts, /users, /comments, /albums, /photos, /todos',
      'Supports all HTTP methods (GET, POST, PUT, PATCH, DELETE)'
    ],
    example_request: undefined,
    auth_required: false,
    auth_type: 'none',
    docs_url: 'https://jsonplaceholder.typicode.com',
    provider: 'JSONPlaceholder',
    keywords: ['testing', 'placeholder', 'fake', 'mock', 'development', 'prototype', 'api'],
    use_cases: ['API testing', 'Prototyping', 'Learning REST', 'Demo applications']
  },
  {
    name: 'httpbin Testing Utilities',
    description: 'HTTP request and response testing service. Test headers, methods, status codes, redirects.',
    endpoint_url: 'https://httpbin.org/get',
    method: 'GET',
    category: 'API Tools',
    match_score: 88,
    pricing_tier: 'free',
    setup_steps: [
      'No setup required - completely free',
      'Test endpoints: /get, /post, /put, /delete, /status/{code}',
      'Returns request details in JSON format'
    ],
    example_request: undefined,
    auth_required: false,
    auth_type: 'none',
    docs_url: 'https://httpbin.org',
    provider: 'httpbin',
    keywords: ['testing', 'http', 'debugging', 'headers', 'requests', 'development'],
    use_cases: ['API testing', 'HTTP debugging', 'Request inspection', 'Developer tools']
  },
  {
    name: 'ReqRes Fake User Data',
    description: 'Beginner-friendly fake user API perfect for testing. Returns realistic user data with avatars.',
    endpoint_url: 'https://reqres.in/api/users',
    method: 'GET',
    category: 'API Tools',
    match_score: 92,
    pricing_tier: 'free',
    setup_steps: [
      'No setup needed - completely free and instant',
      'Perfect for beginners learning API integration',
      'Endpoints: /users, /users/{id}, supports POST/PUT/DELETE too'
    ],
    example_request: undefined,
    auth_required: false,
    auth_type: 'none',
    docs_url: 'https://reqres.in',
    provider: 'ReqRes',
    keywords: ['testing', 'users', 'fake', 'mock', 'beginner', 'learning', 'simple', 'free'],
    use_cases: ['Learning APIs', 'Testing user interfaces', 'Prototyping', 'Demo applications']
  },
  {
    name: 'Dog CEO Random Dog Pictures',
    description: 'Get random dog pictures instantly. Fun, simple API perfect for beginners. No signup required!',
    endpoint_url: 'https://dog.ceo/api/breeds/image/random',
    method: 'GET',
    category: 'Utilities',
    match_score: 85,
    pricing_tier: 'free',
    setup_steps: [
      'Instant access - no API key needed',
      'Returns random dog image URL in JSON',
      'Also supports specific breeds: /breed/{breed}/images/random'
    ],
    example_request: undefined,
    auth_required: false,
    auth_type: 'none',
    docs_url: 'https://dog.ceo/dog-api/',
    provider: 'Dog CEO',
    keywords: ['dog', 'pictures', 'images', 'random', 'fun', 'beginner', 'simple', 'free', 'no auth'],
    use_cases: ['Fun projects', 'Learning API calls', 'Random content generators', 'Beginner tutorials']
  },
  {
    name: 'Bored API Activity Suggestions',
    description: 'Get random activity suggestions to fight boredom. Simple, fun API great for beginners.',
    endpoint_url: 'https://www.boredapi.com/api/activity',
    method: 'GET',
    category: 'Utilities',
    match_score: 83,
    pricing_tier: 'free',
    setup_steps: [
      'No setup required - instant access',
      'Returns activity suggestions with type and participants',
      'Filter by type: ?type=education or ?participants=1'
    ],
    example_request: undefined,
    auth_required: false,
    auth_type: 'none',
    docs_url: 'https://www.boredapi.com/documentation',
    provider: 'Bored API',
    keywords: ['activity', 'suggestions', 'bored', 'fun', 'random', 'beginner', 'simple', 'free'],
    use_cases: ['Activity generators', 'Beginner projects', 'Fun apps', 'Learning API integration']
  },
  {
    name: 'Cat Facts Random Facts',
    description: 'Random cat facts API. Perfect beginner-friendly API with instant access and no authentication.',
    endpoint_url: 'https://catfact.ninja/fact',
    method: 'GET',
    category: 'Utilities',
    match_score: 80,
    pricing_tier: 'free',
    setup_steps: [
      'No setup required - completely free',
      'Returns random cat fact instantly',
      'Perfect for testing API integration'
    ],
    example_request: undefined,
    auth_required: false,
    auth_type: 'none',
    docs_url: 'https://catfact.ninja',
    provider: 'Cat Facts',
    keywords: ['cat', 'facts', 'random', 'fun', 'beginner', 'simple', 'free', 'learning'],
    use_cases: ['Beginner API tutorials', 'Fun facts apps', 'Testing API calls', 'Learning projects']
  },

  // ===== SOCIAL & MEDIA =====
  {
    name: 'Giphy Search GIFs',
    description: 'Search and retrieve GIFs from Giphy\'s massive library. Trending, random, and search endpoints.',
    endpoint_url: 'https://api.giphy.com/v1/gifs/search',
    method: 'GET',
    category: 'Utilities',
    match_score: 94,
    pricing_tier: 'free',
    setup_steps: [
      'Sign up at developers.giphy.com',
      'Get free API key instantly',
      'Add query params: ?api_key={YOUR_API_KEY}&q={search_term}&limit=10'
    ],
    example_request: undefined,
    auth_required: true,
    auth_type: 'api_key',
    docs_url: 'https://developers.giphy.com/docs/api',
    provider: 'Giphy',
    keywords: ['gif', 'animation', 'images', 'memes', 'social', 'media'],
    use_cases: ['Chat apps', 'Social media', 'Content creation', 'Messaging platforms']
  },
  {
    name: 'Unsplash Random Photos',
    description: 'High-quality free stock photos from Unsplash. Search, random, and curated collections.',
    endpoint_url: 'https://api.unsplash.com/photos/random',
    method: 'GET',
    category: 'Utilities',
    match_score: 93,
    pricing_tier: 'free',
    setup_steps: [
      'Sign up at unsplash.com/developers',
      'Create app and get Access Key (50 requests/hour)',
      'Add Authorization header: Client-ID {YOUR_ACCESS_KEY}',
      'Optional query: ?query=nature&orientation=landscape'
    ],
    example_request: undefined,
    auth_required: true,
    auth_type: 'bearer',
    docs_url: 'https://unsplash.com/documentation',
    provider: 'Unsplash',
    keywords: ['photos', 'images', 'stock', 'photography', 'free', 'high quality'],
    use_cases: ['Placeholder images', 'Content creation', 'Design mockups', 'Blog headers']
  },

  // ===== FINANCE & PAYMENTS =====
  {
    name: 'Exchange Rates API',
    description: 'Real-time and historical foreign exchange rates for 170+ currencies. Updated daily.',
    endpoint_url: 'https://api.exchangerate-api.com/v4/latest/USD',
    method: 'GET',
    category: 'Data',
    match_score: 96,
    pricing_tier: 'free',
    setup_steps: [
      'No API key required for basic usage',
      'Replace USD with any currency code (EUR, GBP, JPY, etc.)',
      'Returns all exchange rates relative to base currency'
    ],
    example_request: undefined,
    auth_required: false,
    auth_type: 'none',
    docs_url: 'https://www.exchangerate-api.com/docs/overview',
    provider: 'ExchangeRate-API',
    keywords: ['currency', 'exchange', 'forex', 'money', 'conversion', 'rates', 'finance'],
    use_cases: ['Currency converters', 'E-commerce', 'Financial apps', 'Travel tools']
  }
]

/**
 * Concept mapping for semantic understanding
 * Maps user intent to relevant technical keywords
 */
const CONCEPT_MAP: Record<string, string[]> = {
  // Crypto & Web3 concepts
  'meme': ['meme coin', 'token', 'crypto', 'launch', 'pump', 'solana'],
  'launch': ['create', 'deploy', 'mint', 'start', 'build'],
  'coin': ['token', 'crypto', 'cryptocurrency', 'meme coin'],
  'crypto': ['token', 'coin', 'blockchain', 'web3', 'dex', 'defi'],
  'nft': ['token', 'metadata', 'metaplex', 'mint', 'collection'],

  // AI & ML concepts
  'ai': ['artificial intelligence', 'machine learning', 'ml', 'gpt', 'llm'],
  'image': ['photo', 'picture', 'visual', 'art', 'generation'],
  'generate': ['create', 'make', 'build', 'produce'],

  // Email & messaging
  'email': ['mail', 'smtp', 'send', 'transactional', 'notification'],
  'message': ['sms', 'notification', 'email', 'text'],

  // Weather & location
  'weather': ['forecast', 'temperature', 'climate', 'rain', 'humidity'],
  'location': ['geolocation', 'gps', 'address', 'city', 'country'],

  // General concepts
  'data': ['information', 'api', 'database', 'query'],
  'price': ['cost', 'rate', 'value', 'exchange', 'market'],
}

/**
 * Expand query with related concepts
 */
function expandQuery(query: string): string[] {
  const words = query.toLowerCase().split(/\s+/)
  const expandedTerms = new Set(words)

  words.forEach(word => {
    // Add related concepts from map
    if (CONCEPT_MAP[word]) {
      CONCEPT_MAP[word].forEach(term => expandedTerms.add(term))
    }

    // Add partial matches (e.g., "launching" → "launch")
    Object.keys(CONCEPT_MAP).forEach(key => {
      if (word.includes(key) || key.includes(word)) {
        CONCEPT_MAP[key].forEach(term => expandedTerms.add(term))
      }
    })
  })

  return Array.from(expandedTerms)
}

/**
 * Search the knowledge base using semantic matching with concept expansion
 */
export function searchKnowledgeBase(query: string, limit: number = 5): APIKnowledgeEntry[] {
  const normalizedQuery = query.toLowerCase().trim()
  const expandedTerms = expandQuery(normalizedQuery)

  // Calculate relevance scores
  const scoredAPIs = API_KNOWLEDGE_BASE.map(api => {
    let score = 0

    // Exact keyword matching (highest weight)
    api.keywords.forEach(keyword => {
      const keywordLower = keyword.toLowerCase()

      // Exact match in query
      if (normalizedQuery.includes(keywordLower)) {
        score += 35
      }

      // Match with expanded terms
      expandedTerms.forEach(term => {
        if (keywordLower.includes(term) || term.includes(keywordLower)) {
          score += 20
        }
      })
    })

    // Use case matching
    api.use_cases.forEach(useCase => {
      const useCaseLower = useCase.toLowerCase()
      if (normalizedQuery.includes(useCaseLower)) {
        score += 25
      }
      expandedTerms.forEach(term => {
        if (useCaseLower.includes(term)) {
          score += 15
        }
      })
    })

    // Name matching
    const nameLower = api.name.toLowerCase()
    if (normalizedQuery.includes(nameLower)) {
      score += 30
    }

    // Description matching
    const descWords = api.description.toLowerCase().split(' ')
    expandedTerms.forEach(term => {
      if (term.length > 3 && descWords.some(dWord => dWord.includes(term))) {
        score += 8
      }
    })

    // Category matching
    if (normalizedQuery.includes(api.category.toLowerCase())) {
      score += 18
    }

    // Provider matching
    if (api.provider && normalizedQuery.includes(api.provider.toLowerCase())) {
      score += 15
    }

    return {
      ...api,
      match_score: Math.min(100, score)
    }
  })

  // Sort by score and return top results
  return scoredAPIs
    .filter(api => api.match_score > 20) // Minimum threshold
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, limit)
}
