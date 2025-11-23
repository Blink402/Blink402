/**
 * Form validation schema for Blink creation
 */
import * as z from "zod"

// Zod schema for form validation
export const blinkSchema = z.object({
  // Step 1: Endpoint Configuration
  endpoint_url: z.string().min(1, "API endpoint URL is required").url("Must be a valid URL"),
  method: z.enum(["GET", "POST", "PUT", "DELETE"], {
    required_error: "Please select an HTTP method",
  }),
  title: z.string().min(3, "Title must be at least 3 characters").max(50, "Title must be at most 50 characters"),
  description: z.string().min(10, "Description must be at least 10 characters").max(200, "Description must be at most 200 characters"),
  category: z.enum(["AI/ML", "Utilities", "Data", "API Tools", "Web3"]),

  // Step 2: Payment Mode & Pricing
  payment_mode: z.enum(["charge", "reward"], {
    required_error: "Please select a payment mode",
  }),
  payment_token: z.enum(["USDC", "SOL"], {
    required_error: "Please select a payment token",
  }).default("USDC"), // Default to USDC (required for PayAI x402)
  price_usdc: z.string()
    .refine(
      (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
      { message: "Price must be a positive number" }
    ),
  payout_wallet: z.string()
    .min(32, "Wallet address is too short")
    .max(44, "Wallet address is too long")
    .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "Invalid Solana wallet address"),

  // Reward mode fields
  reward_amount: z.string().optional(),
  funded_wallet: z.string().optional(),
  max_claims_per_user: z.string().optional(),

  // Step 3: Optional fields
  icon_url: z.string().url().optional().or(z.literal("")),
  example_request: z.string().optional(),
  parameters: z.string().optional(), // JSON string defining input parameters for Solana Actions
}).refine(
  (data) => {
    // If payment_mode is reward, validate reward fields
    if (data.payment_mode === "reward") {
      return !!(data.reward_amount && data.funded_wallet && data.max_claims_per_user)
    }
    return true
  },
  {
    message: "Reward mode requires reward_amount, funded_wallet, and max_claims_per_user",
    path: ["payment_mode"],
  }
)

export type BlinkFormData = z.infer<typeof blinkSchema>

export const STEPS = [
  { id: 1, title: "Endpoint Config", description: "Configure your API endpoint" },
  { id: 2, title: "Pricing & Wallet", description: "Set price and payout details" },
  { id: 3, title: "Preview & Publish", description: "Review and create your Blink" },
]
