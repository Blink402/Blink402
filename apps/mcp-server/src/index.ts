#!/usr/bin/env node

/**
 * Blink402 MCP Server
 *
 * Model Context Protocol server that enables AI assistants to:
 * - Discover and execute Solana Blinks
 * - Automatically apply B402 token holder discounts
 * - Purchase B402 tokens for tier benefits
 * - Make intelligent recommendations about cost savings
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js'
import { Blink402Client } from './api-client.js'

// Initialize API client
const client = new Blink402Client()

// Create MCP server instance
const server = new Server(
  {
    name: 'blink402-mcp',
    version: '0.1.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
)

// Tool definitions
const TOOLS: Tool[] = [
  {
    name: 'check_b402_tier',
    description: 'Check B402 token holdings and tier benefits for a Solana wallet. Returns current tier, balance, and discount percentages. Use this before executing blinks to inform the user about potential savings.',
    inputSchema: {
      type: 'object',
      properties: {
        wallet: {
          type: 'string',
          description: 'Solana wallet address to check (base58 format)'
        }
      },
      required: ['wallet']
    }
  },
  {
    name: 'list_blinks',
    description: 'Browse available Blinks (payment-gated APIs) with tier-adjusted prices. Returns list of blinks with base price, user-specific discounted price, and savings amount based on B402 holdings. Optionally filter by category (AI/ML, Utilities, Data, API Tools, Web3).',
    inputSchema: {
      type: 'object',
      properties: {
        wallet: {
          type: 'string',
          description: 'User wallet address to calculate tier-adjusted prices'
        },
        category: {
          type: 'string',
          description: 'Filter by category: AI/ML, Utilities, Data, API Tools, Web3',
          enum: ['AI/ML', 'Utilities', 'Data', 'API Tools', 'Web3']
        },
        limit: {
          type: 'number',
          description: 'Maximum number of blinks to return (default: 20)',
          default: 20
        }
      },
      required: ['wallet']
    }
  },
  {
    name: 'execute_blink',
    description: 'Execute a Blink (payment-gated API call) with automatic B402 discount. This returns payment instructions that the user needs to complete. After payment, the API is executed and results are returned. Important: This does not directly charge the user - it provides payment details they must approve.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: {
          type: 'string',
          description: 'Blink slug identifier (e.g., "wallet-analyzer", "token-price")'
        },
        wallet: {
          type: 'string',
          description: 'User Solana wallet address (for payment and tier detection)'
        },
        params: {
          type: 'object',
          description: 'Blink-specific parameters (e.g., targetWallet for wallet-analyzer)',
          additionalProperties: true
        }
      },
      required: ['slug', 'wallet']
    }
  },
  {
    name: 'buy_b402',
    description: 'Purchase B402 tokens to unlock tier benefits and discounts. Provide ROI information to help users make informed decisions. Returns transaction details and new tier information. Recommend this when savings from tier discounts exceed token purchase cost.',
    inputSchema: {
      type: 'object',
      properties: {
        amount_sol: {
          type: 'number',
          description: 'Amount of SOL to spend on B402 tokens (e.g., 0.5 for approximately 10,000 B402)',
          minimum: 0.01,
          maximum: 100
        },
        wallet: {
          type: 'string',
          description: 'Solana wallet address to receive B402 tokens'
        }
      },
      required: ['amount_sol', 'wallet']
    }
  },
  {
    name: 'recommend_b402_purchase',
    description: 'Analyze user usage patterns and recommend B402 token purchase if it would save money. Calculates ROI based on expected blink usage. Use this proactively when a user requests multiple blink executions.',
    inputSchema: {
      type: 'object',
      properties: {
        wallet: {
          type: 'string',
          description: 'User wallet address'
        },
        expected_monthly_spend: {
          type: 'number',
          description: 'Expected monthly spend on blinks in USDC (estimate based on current usage)'
        }
      },
      required: ['wallet', 'expected_monthly_spend']
    }
  }
]

// Handle list_tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS
  }
})

// Handle call_tool request
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    switch (name) {
      case 'check_b402_tier': {
        const { wallet } = args as { wallet: string }
        const tierInfo = await client.getB402Tier(wallet)

        // Format benefits for display
        const benefits = tierInfo.benefits.blinks
        const savingsPreview = benefits.creatorFeeDiscount > 0
          ? `Save ${benefits.creatorFeeDiscount}% on all blink executions`
          : 'No tier benefits - consider buying B402 tokens for discounts'

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                tier: tierInfo.tier,
                balance: tierInfo.balance,
                benefits: {
                  discount_percent: benefits.creatorFeeDiscount,
                  priority_execution: benefits.priorityExecution,
                  custom_branding: benefits.customBranding
                },
                savings_preview: savingsPreview,
                tier_thresholds: {
                  BRONZE: '1,000 B402 → 10% discount',
                  SILVER: '10,000 B402 → 20% discount',
                  GOLD: '50,000 B402 → 30% discount',
                  DIAMOND: '100,000 B402 → 50% discount'
                }
              }, null, 2)
            }
          ]
        }
      }

      case 'list_blinks': {
        const { wallet, category, limit = 20 } = args as {
          wallet: string
          category?: string
          limit?: number
        }

        // Get tier info for discount calculation
        const tierInfo = await client.getB402Tier(wallet)
        const blinks = await client.listBlinks(category, limit)

        // Calculate tier-adjusted prices
        const blinksWithPricing = await Promise.all(
          blinks.map(async (blink) => {
            const discount = await client.getDiscount(wallet, blink.price_usdc)
            return {
              slug: blink.slug,
              title: blink.title,
              description: blink.description,
              category: blink.category,
              base_price: blink.price_usdc,
              your_price: discount.discountedPrice,
              savings: discount.savings,
              discount_percent: discount.discountPercent,
              icon_url: blink.icon_url,
              performance: {
                success_rate: blink.success_rate_percent,
                avg_latency_ms: blink.avg_latency_ms
              }
            }
          })
        )

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                blinks: blinksWithPricing,
                your_tier: tierInfo.tier,
                total_available: blinks.length,
                filter_applied: category ? `Category: ${category}` : 'None'
              }, null, 2)
            }
          ]
        }
      }

      case 'execute_blink': {
        const { slug, wallet, params = {} } = args as {
          slug: string
          wallet: string
          params?: Record<string, any>
        }

        // Get blink info
        const blink = await client.getBlink(slug)

        // Get tier and discount
        const tierInfo = await client.getB402Tier(wallet)
        const discount = await client.getDiscount(wallet, blink.price_usdc)

        // Important: For MCP, we can't actually execute payments directly
        // We need to return instructions for the user to complete payment
        const paymentInstructions = {
          step: 'PAYMENT_REQUIRED',
          message: 'To execute this blink, you need to complete payment via the Blink402 platform',
          blink_url: `https://blink402.dev/checkout/${slug}`,
          payment_details: {
            amount: discount.discountedPrice,
            original_price: discount.originalPrice,
            savings: discount.savings,
            tier: tierInfo.tier,
            payment_method: 'USDC on Solana'
          },
          instructions: [
            `1. Visit https://blink402.dev/checkout/${slug}`,
            `2. Connect your wallet (${wallet})`,
            `3. Approve USDC payment of ${discount.discountedPrice} USDC`,
            `4. The API will execute automatically after payment`,
            `5. Results will be available at the checkout page`
          ],
          note: `Your ${tierInfo.tier} tier saves you $${discount.savings.toFixed(4)} on this execution!`
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(paymentInstructions, null, 2)
            }
          ]
        }
      }

      case 'buy_b402': {
        const { amount_sol, wallet } = args as {
          amount_sol: number
          wallet: string
        }

        // Get current tier
        const currentTier = await client.getB402Tier(wallet)

        // Estimate tokens (rough estimate: ~25,000 B402 per 0.1 SOL at current prices)
        const estimatedTokens = amount_sol * 250000

        // Determine new tier
        let newTier = 'NONE'
        const totalBalance = currentTier.balance + estimatedTokens
        if (totalBalance >= 100000) newTier = 'DIAMOND'
        else if (totalBalance >= 50000) newTier = 'GOLD'
        else if (totalBalance >= 10000) newTier = 'SILVER'
        else if (totalBalance >= 1000) newTier = 'BRONZE'

        // Calculate tier upgrade
        const tierUpgrade = newTier !== currentTier.tier

        const purchaseInfo = {
          step: 'PAYMENT_REQUIRED',
          message: 'To buy B402 tokens, complete the purchase via Blink402 platform',
          purchase_url: `https://blink402.dev/checkout/buy-b402`,
          purchase_details: {
            amount_sol,
            estimated_tokens: estimatedTokens,
            current_tier: currentTier.tier,
            estimated_new_tier: newTier,
            tier_upgrade: tierUpgrade
          },
          instructions: [
            `1. Visit https://blink402.dev/checkout/buy-b402`,
            `2. Connect wallet (${wallet})`,
            `3. Enter amount: ${amount_sol} SOL`,
            `4. Approve transaction`,
            `5. Receive ~${estimatedTokens.toLocaleString()} B402 tokens`
          ],
          projected_benefits: tierUpgrade
            ? `Upgrade to ${newTier} tier - unlock higher discounts!`
            : `Continue building your ${currentTier.tier} tier balance`,
          roi_estimate: amount_sol > 0.1
            ? 'With SILVER tier (20% discount), you break even after ~50 blink executions'
            : 'With BRONZE tier (10% discount), you break even after ~100 blink executions'
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(purchaseInfo, null, 2)
            }
          ]
        }
      }

      case 'recommend_b402_purchase': {
        const { wallet, expected_monthly_spend } = args as {
          wallet: string
          expected_monthly_spend: number
        }

        const tierInfo = await client.getB402Tier(wallet)

        // Calculate savings by tier
        const savingsByTier = {
          BRONZE: expected_monthly_spend * 0.10,  // 10%
          SILVER: expected_monthly_spend * 0.20,  // 20%
          GOLD: expected_monthly_spend * 0.30,    // 30%
          DIAMOND: expected_monthly_spend * 0.50  // 50%
        }

        // Estimated costs (very rough, based on ~0.00002 SOL per B402)
        const costEstimates = {
          BRONZE: 0.02,   // ~1000 B402 ≈ 0.02 SOL ≈ $5
          SILVER: 0.2,    // ~10000 B402 ≈ 0.2 SOL ≈ $50
          GOLD: 1.0,      // ~50000 B402 ≈ 1.0 SOL ≈ $250
          DIAMOND: 2.0    // ~100000 B402 ≈ 2.0 SOL ≈ $500
        }

        // Calculate ROI
        const recommendations = Object.entries(savingsByTier).map(([tier, monthlySavings]) => {
          const cost = costEstimates[tier as keyof typeof costEstimates]
          const monthsToBreakeven = cost > 0 ? (cost * 250) / monthlySavings : 0  // Assuming $250/SOL

          return {
            tier,
            required_tokens: {
              BRONZE: 1000,
              SILVER: 10000,
              GOLD: 50000,
              DIAMOND: 100000
            }[tier],
            estimated_cost_usd: cost * 250,
            monthly_savings: monthlySavings,
            months_to_breakeven: monthsToBreakeven,
            recommended: monthsToBreakeven < 6 && monthsToBreakeven > 0
          }
        })

        const bestRecommendation = recommendations
          .filter(r => r.recommended)
          .sort((a, b) => a.months_to_breakeven - b.months_to_breakeven)[0]

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                current_tier: tierInfo.tier,
                current_balance: tierInfo.balance,
                expected_monthly_spend,
                recommendations,
                best_option: bestRecommendation || {
                  message: 'Current usage doesn\'t justify B402 purchase yet. Continue using and check back when monthly spend increases.'
                },
                note: 'ROI calculations are estimates. Actual savings depend on blink usage patterns.'
              }, null, 2)
            }
          ]
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error.message,
            tool: name
          }, null, 2)
        }
      ],
      isError: true
    }
  }
})

// Start server
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)

  // Log to stderr (stdout is reserved for MCP protocol)
  console.error('Blink402 MCP Server running on stdio')
  console.error('API URL:', process.env.BLINK402_API_URL || 'https://blink402.dev/api')
}

main().catch((error) => {
  console.error('Server error:', error)
  process.exit(1)
})
