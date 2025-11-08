import { BlinkTemplate } from "@blink402/types"

/**
 * Pre-built Blink templates for the no-code builder
 * All templates are configured for simplicity and ease of use
 */

export const BLINK_TEMPLATES: BlinkTemplate[] = [
  {
    id: "qr-code-generator",
    name: "QR Code Generator",
    description: "Generate QR codes from any text or URL instantly",
    category: "utilities",
    difficulty: "easy",
    icon_url: "/lottie/Success-Checkmark-Green.lottie",
    config: {
      title: "QR Code Generator",
      description: "Generate a QR code from any text or URL. Perfect for sharing links!",
      endpoint_url: "https://api.qrserver.com/v1/create-qr-code/",
      method: "GET",
      category: "Utilities",
      price_usdc: "0.001",
    },
    customizable_fields: [
      {
        field: "title",
        label: "Blink Title",
        placeholder: "QR Code Generator",
        helpText: "What should people call your Blink?",
        required: true,
      },
      {
        field: "description",
        label: "Description",
        placeholder: "Generate QR codes instantly...",
        helpText: "Explain what your Blink does",
        required: true,
      },
      {
        field: "price_usdc",
        label: "Price per Use (SOL)",
        placeholder: "0.001",
        helpText: "How much to charge per QR code generation",
        required: true,
      },
    ],
    tags: ["qr", "generator", "utility", "code"],
    is_popular: true,
    estimated_setup_time: "30 seconds",
  },
  {
    id: "random-dad-joke",
    name: "Random Dad Joke",
    description: "Get a random dad joke delivered instantly",
    category: "fun",
    difficulty: "easy",
    icon_url: "/lottie/Success-Checkmark-Green.lottie",
    config: {
      title: "Dad Joke Generator",
      description: "Get a random dad joke to brighten your day!",
      endpoint_url: "https://icanhazdadjoke.com/",
      method: "GET",
      category: "Utilities",
      price_usdc: "0.0005",
    },
    customizable_fields: [
      {
        field: "title",
        label: "Blink Title",
        placeholder: "Dad Joke Generator",
        helpText: "What should people call your Blink?",
        required: true,
      },
      {
        field: "description",
        label: "Description",
        placeholder: "Get hilarious dad jokes...",
        helpText: "Explain what your Blink does",
        required: true,
      },
      {
        field: "price_usdc",
        label: "Price per Use (SOL)",
        placeholder: "0.0005",
        helpText: "How much to charge per joke",
        required: true,
      },
    ],
    tags: ["joke", "fun", "random", "humor"],
    is_popular: true,
    estimated_setup_time: "20 seconds",
  },
  {
    id: "random-quote",
    name: "Random Quote",
    description: "Get inspirational quotes on demand",
    category: "fun",
    difficulty: "easy",
    icon_url: "/lottie/Success-Checkmark-Green.lottie",
    config: {
      title: "Inspirational Quote Generator",
      description: "Get random inspirational quotes to motivate your day",
      endpoint_url: "https://api.quotable.io/random",
      method: "GET",
      category: "Utilities",
      price_usdc: "0.0005",
    },
    customizable_fields: [
      {
        field: "title",
        label: "Blink Title",
        placeholder: "Inspirational Quote Generator",
        helpText: "What should people call your Blink?",
        required: true,
      },
      {
        field: "description",
        label: "Description",
        placeholder: "Get inspired with random quotes...",
        helpText: "Explain what your Blink does",
        required: true,
      },
      {
        field: "price_usdc",
        label: "Price per Use (SOL)",
        placeholder: "0.0005",
        helpText: "How much to charge per quote",
        required: true,
      },
    ],
    tags: ["quote", "inspiration", "motivation", "random"],
    is_popular: false,
    estimated_setup_time: "20 seconds",
  },
  {
    id: "crypto-price",
    name: "Crypto Price Checker",
    description: "Check real-time cryptocurrency prices",
    category: "web3",
    difficulty: "easy",
    icon_url: "/lottie/Success-Checkmark-Green.lottie",
    config: {
      title: "Crypto Price Checker",
      description: "Check real-time prices for Bitcoin, Ethereum, Solana, and more",
      endpoint_url: "https://api.coingecko.com/api/v3/simple/price",
      method: "GET",
      category: "Web3",
      price_usdc: "0.001",
    },
    customizable_fields: [
      {
        field: "title",
        label: "Blink Title",
        placeholder: "Crypto Price Checker",
        helpText: "What should people call your Blink?",
        required: true,
      },
      {
        field: "description",
        label: "Description",
        placeholder: "Get real-time crypto prices...",
        helpText: "Explain what your Blink does",
        required: true,
      },
      {
        field: "price_usdc",
        label: "Price per Use (SOL)",
        placeholder: "0.001",
        helpText: "How much to charge per price check",
        required: true,
      },
    ],
    tags: ["crypto", "price", "web3", "bitcoin", "ethereum"],
    is_popular: true,
    estimated_setup_time: "30 seconds",
  },
  {
    id: "cat-fact",
    name: "Random Cat Fact",
    description: "Get random interesting facts about cats",
    category: "fun",
    difficulty: "easy",
    icon_url: "/lottie/Success-Checkmark-Green.lottie",
    config: {
      title: "Cat Fact Generator",
      description: "Learn random interesting facts about cats!",
      endpoint_url: "https://catfact.ninja/fact",
      method: "GET",
      category: "Utilities",
      price_usdc: "0.0005",
    },
    customizable_fields: [
      {
        field: "title",
        label: "Blink Title",
        placeholder: "Cat Fact Generator",
        helpText: "What should people call your Blink?",
        required: true,
      },
      {
        field: "description",
        label: "Description",
        placeholder: "Discover fascinating cat facts...",
        helpText: "Explain what your Blink does",
        required: true,
      },
      {
        field: "price_usdc",
        label: "Price per Use (SOL)",
        placeholder: "0.0005",
        helpText: "How much to charge per fact",
        required: true,
      },
    ],
    tags: ["cat", "fact", "fun", "random", "animals"],
    is_popular: false,
    estimated_setup_time: "20 seconds",
  },
  {
    id: "dog-image",
    name: "Random Dog Picture",
    description: "Get adorable random dog pictures",
    category: "fun",
    difficulty: "easy",
    icon_url: "/lottie/Success-Checkmark-Green.lottie",
    config: {
      title: "Random Dog Picture",
      description: "Get a random adorable dog picture to brighten your day",
      endpoint_url: "https://dog.ceo/api/breeds/image/random",
      method: "GET",
      category: "Utilities",
      price_usdc: "0.0005",
    },
    customizable_fields: [
      {
        field: "title",
        label: "Blink Title",
        placeholder: "Random Dog Picture",
        helpText: "What should people call your Blink?",
        required: true,
      },
      {
        field: "description",
        label: "Description",
        placeholder: "Get cute dog pictures...",
        helpText: "Explain what your Blink does",
        required: true,
      },
      {
        field: "price_usdc",
        label: "Price per Use (SOL)",
        placeholder: "0.0005",
        helpText: "How much to charge per picture",
        required: true,
      },
    ],
    tags: ["dog", "picture", "fun", "random", "animals"],
    is_popular: true,
    estimated_setup_time: "20 seconds",
  },
  {
    id: "uuid-generator",
    name: "UUID Generator",
    description: "Generate unique identifiers instantly",
    category: "utilities",
    difficulty: "easy",
    icon_url: "/lottie/Success-Checkmark-Green.lottie",
    config: {
      title: "UUID Generator",
      description: "Generate universally unique identifiers (UUIDs) for your projects",
      endpoint_url: "https://www.uuidtools.com/api/generate/v4",
      method: "GET",
      category: "Utilities",
      price_usdc: "0.0005",
    },
    customizable_fields: [
      {
        field: "title",
        label: "Blink Title",
        placeholder: "UUID Generator",
        helpText: "What should people call your Blink?",
        required: true,
      },
      {
        field: "description",
        label: "Description",
        placeholder: "Generate unique IDs...",
        helpText: "Explain what your Blink does",
        required: true,
      },
      {
        field: "price_usdc",
        label: "Price per Use (SOL)",
        placeholder: "0.0005",
        helpText: "How much to charge per UUID",
        required: true,
      },
    ],
    tags: ["uuid", "generator", "utility", "id"],
    is_popular: false,
    estimated_setup_time: "20 seconds",
  },
  {
    id: "number-trivia",
    name: "Number Trivia",
    description: "Get interesting facts about numbers",
    category: "fun",
    difficulty: "easy",
    icon_url: "/lottie/Success-Checkmark-Green.lottie",
    config: {
      title: "Number Trivia",
      description: "Discover fascinating trivia about any number",
      endpoint_url: "http://numbersapi.com/random/trivia",
      method: "GET",
      category: "Utilities",
      price_usdc: "0.0005",
    },
    customizable_fields: [
      {
        field: "title",
        label: "Blink Title",
        placeholder: "Number Trivia",
        helpText: "What should people call your Blink?",
        required: true,
      },
      {
        field: "description",
        label: "Description",
        placeholder: "Learn cool number facts...",
        helpText: "Explain what your Blink does",
        required: true,
      },
      {
        field: "price_usdc",
        label: "Price per Use (SOL)",
        placeholder: "0.0005",
        helpText: "How much to charge per trivia",
        required: true,
      },
    ],
    tags: ["number", "trivia", "fun", "facts"],
    is_popular: false,
    estimated_setup_time: "20 seconds",
  },
]

/**
 * Get a template by ID
 */
export function getTemplateById(id: string): BlinkTemplate | undefined {
  return BLINK_TEMPLATES.find((template) => template.id === id)
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(
  category: BlinkTemplate["category"]
): BlinkTemplate[] {
  return BLINK_TEMPLATES.filter((template) => template.category === category)
}

/**
 * Get popular templates
 */
export function getPopularTemplates(): BlinkTemplate[] {
  return BLINK_TEMPLATES.filter((template) => template.is_popular)
}

/**
 * Get all template categories with counts
 */
export function getTemplateCategoriesWithCounts(): Array<{
  category: BlinkTemplate["category"]
  count: number
}> {
  const categoryCounts = new Map<BlinkTemplate["category"], number>()

  BLINK_TEMPLATES.forEach((template) => {
    const current = categoryCounts.get(template.category) || 0
    categoryCounts.set(template.category, current + 1)
  })

  return Array.from(categoryCounts.entries()).map(([category, count]) => ({
    category,
    count,
  }))
}
