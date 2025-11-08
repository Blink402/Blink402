"use client"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { mountReveals } from "@/lib/reveal"
import { mountScramble } from "@/lib/scramble"
import { createBlink } from "@/lib/api"
import { useAuth } from "@/components/providers/AuthProvider"
import NeonDivider from "@/components/NeonDivider"
import Lottie from "@/components/Lottie"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { useRouter } from "next/navigation"

// Zod schema for form validation
const blinkSchema = z.object({
  // Step 1: Endpoint Configuration
  endpoint_url: z.string().url({ message: "Must be a valid URL" }),
  method: z.enum(["GET", "POST", "PUT", "DELETE"], {
    required_error: "Please select an HTTP method",
  }),
  title: z.string().min(3, "Title must be at least 3 characters").max(50),
  description: z.string().min(10, "Description must be at least 10 characters").max(200),
  category: z.enum(["AI/ML", "Utilities", "Data", "API Tools", "Web3"]),
  
  // Step 2: Pricing & Wallet
  price_usdc: z.string()
    .refine(
      (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
      { message: "Price must be a positive number" }
    ),
  payout_wallet: z.string()
    .min(32, "Wallet address is too short")
    .max(44, "Wallet address is too long")
    .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "Invalid Solana wallet address"),
  
  // Step 3: Optional fields
  icon_url: z.string().url().optional().or(z.literal("")),
  example_request: z.string().optional(),
})

type BlinkFormData = z.infer<typeof blinkSchema>

const STEPS = [
  { id: 1, title: "Endpoint Config", description: "Configure your API endpoint" },
  { id: 2, title: "Pricing & Wallet", description: "Set price and payout details" },
  { id: 3, title: "Preview & Publish", description: "Review and create your Blink" },
]

export default function CreateBlinkPage() {
  const router = useRouter()
  const { authToken, isAuthenticated, wallet, signIn } = useAuth()
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    trigger,
  } = useForm<BlinkFormData>({
    resolver: zodResolver(blinkSchema),
    mode: "onBlur",
    defaultValues: {
      method: "POST",
      category: "API Tools",
      price_usdc: "0.01",
      example_request: "{}",
    },
  })

  const formValues = watch()

  useEffect(() => {
    mountReveals()
    mountScramble()
  }, [])

  // Pre-fill payout wallet with connected wallet
  useEffect(() => {
    if (wallet && !formValues.payout_wallet) {
      setValue('payout_wallet', wallet)
    }
  }, [wallet, formValues.payout_wallet, setValue])

  const validateStep = async () => {
    let fieldsToValidate: (keyof BlinkFormData)[] = []
    
    switch (currentStep) {
      case 1:
        fieldsToValidate = ["endpoint_url", "method", "title", "description", "category"]
        break
      case 2:
        fieldsToValidate = ["price_usdc", "payout_wallet"]
        break
      case 3:
        fieldsToValidate = ["icon_url", "example_request"]
        break
    }

    const isValid = await trigger(fieldsToValidate as any)
    return isValid
  }

  const handleNext = async () => {
    const isValid = await validateStep()
    if (isValid && currentStep < 3) {
      setCurrentStep(currentStep + 1)
      setError(null)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
      setError(null)
    }
  }

  const onSubmit = async (data: BlinkFormData) => {
    // Check if user is authenticated
    if (!isAuthenticated || !authToken) {
      setError("Please connect your wallet and sign in to create a Blink")
      if (wallet) {
        await signIn()
      }
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      // Generate slug from title
      const slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')

      // Create blink via API
      await createBlink(
        {
          slug,
          title: data.title,
          description: data.description,
          price_usdc: data.price_usdc,
          endpoint_url: data.endpoint_url,
          method: data.method,
          category: data.category,
          icon_url: data.icon_url || '/lottie/Success-Checkmark-Green.lottie',
          status: 'active',
          payment_token: 'SOL', // Explicitly set to SOL for user-created blinks
          payout_wallet: data.payout_wallet, // Send payout wallet (can differ from creator)
          creator: {
            wallet: wallet!
          }
        } as any,
        authToken
      )

      // Show success animation
      setIsSubmitting(false)
      setIsSuccess(true)

      // Redirect to dashboard after showing success
      setTimeout(() => {
        router.push("/dashboard")
      }, 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create Blink. Please try again.")
      setIsSubmitting(false)
    }
  }

  // Show success state
  if (isSuccess) {
    return (
      <main className="min-h-screen bg-neon-black flex items-center justify-center">
        <div className="text-center">
          <Lottie
            src="/lottie/Success-Outline-Minimal.lottie"
            autoplay
            loop={false}
            width={120}
            height={120}
            className="mx-auto mb-6"
          />
          <h2 className="text-neon-white font-mono text-2xl mb-2">Blink Created!</h2>
          <p className="text-neon-grey font-mono text-sm">Redirecting to dashboard...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-neon-black">
      {/* Header */}
      <section className="px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <Link href="/" className="text-neon-blue-light hover:text-neon-blue-dark font-mono text-sm">
              ← Back to home
            </Link>
          </div>

          <header data-reveal className="mb-12">
            <h1
              data-scramble
              className="font-sans text-neon-white mb-4 heading-lg"
            >
              Create a Blink
            </h1>
            <p className="text-neon-grey font-mono text-base">
              Turn your API into a pay-per-call link in minutes
            </p>
          </header>

          {/* Mode Selection */}
          <div data-reveal className="mb-12">
            <Card className="bg-neon-dark border-dashed-neon p-6">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Easy Mode */}
                <Link
                  href="/create/easy"
                  className="flex-1 group"
                >
                  <div className="bg-neon-black border border-neon-green-light/30 rounded p-6 hover:border-neon-green-light hover:bg-neon-green-light/5 transition-all cursor-pointer h-full">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-neon-green-light/10 rounded border border-neon-green-light/30 flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl">✨</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-sans text-neon-white group-hover:text-neon-green-light transition-colors">
                            Easy Mode
                          </h3>
                          <Badge className="bg-neon-green-light/10 text-neon-green-light border-neon-green-light text-xs">
                            Recommended
                          </Badge>
                        </div>
                        <p className="text-neon-grey font-mono text-sm mb-3">
                          Pick a pre-built template and customize it. No coding required.
                        </p>
                        <ul className="space-y-1 text-neon-grey font-mono text-xs">
                          <li>• 8+ ready-to-use templates</li>
                          <li>• Setup in 30 seconds</li>
                          <li>• Perfect for beginners</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </Link>

                {/* Advanced Mode (Current Page) */}
                <div className="flex-1">
                  <div className="bg-neon-black border-2 border-neon-blue-light/50 rounded p-6 h-full">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-neon-blue-light/10 rounded border border-neon-blue-light/30 flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl">⚙️</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-sans text-neon-white">
                            Advanced Mode
                          </h3>
                          <Badge className="bg-neon-blue-light/10 text-neon-blue-light border-neon-blue-light/30 text-xs">
                            Current
                          </Badge>
                        </div>
                        <p className="text-neon-grey font-mono text-sm mb-3">
                          Full control over API endpoints, methods, and configuration.
                        </p>
                        <ul className="space-y-1 text-neon-grey font-mono text-xs">
                          <li>• Any API endpoint</li>
                          <li>• Custom configuration</li>
                          <li>• Full flexibility</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Progress Stepper */}
          <div data-reveal className="mb-12">
            <div className="flex items-center justify-between relative">
              {STEPS.map((step, index) => (
                <div key={step.id} className="flex-1 relative">
                  <div className="flex items-center">
                    <div
                      className={`
                        w-12 h-12 rounded-full flex items-center justify-center font-mono font-bold
                        ${
                          currentStep === step.id
                            ? "bg-neon-blue-dark text-neon-black"
                            : currentStep > step.id
                            ? "bg-neon-blue-dark/30 text-neon-blue-light border border-neon-blue-dark"
                            : "bg-neon-dark text-neon-grey border border-neon-grey/30"
                        }
                      `}
                    >
                      {currentStep > step.id ? "✓" : step.id}
                    </div>

                    {index < STEPS.length - 1 && (
                      <div
                        className={`
                          flex-1 h-0.5 mx-2
                          ${currentStep > step.id ? "bg-neon-blue-dark" : "bg-neon-grey/30"}
                        `}
                      />
                    )}
                  </div>
                  
                  <div className="mt-3">
                    <div className={`font-mono text-sm ${currentStep >= step.id ? "text-neon-white" : "text-neon-grey"}`}>
                      {step.title}
                    </div>
                    <div className="font-mono text-xs text-neon-grey mt-1">
                      {step.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form */}
          <Card data-reveal className="bg-neon-dark border-neon-blue-dark/20 p-8">
            <form onSubmit={handleSubmit(onSubmit)}>
              {/* Step 1: Endpoint Configuration */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <Label htmlFor="endpoint_url" className="text-neon-white font-mono">
                      API Endpoint URL *
                    </Label>
                    <Input
                      id="endpoint_url"
                      {...register("endpoint_url")}
                      placeholder="https://api.example.com/v1/endpoint"
                      className="mt-2 bg-neon-black border-neon-blue-dark/30 text-neon-white font-mono"
                      aria-required="true"
                      aria-invalid={!!errors.endpoint_url}
                      aria-describedby={errors.endpoint_url ? "endpoint_url-error" : undefined}
                    />
                    {errors.endpoint_url && (
                      <p
                        id="endpoint_url-error"
                        role="alert"
                        aria-live="polite"
                        className="text-red-400 text-xs font-mono mt-1"
                      >
                        {errors.endpoint_url.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="method" className="text-neon-white font-mono">
                      HTTP Method *
                    </Label>
                    <Select
                      onValueChange={(value) => setValue("method", value as any)}
                      defaultValue="POST"
                    >
                      <SelectTrigger className="mt-2 bg-neon-black border-neon-blue-dark/30 text-neon-white font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-neon-dark border-neon-blue-dark/30">
                        <SelectItem value="GET">GET</SelectItem>
                        <SelectItem value="POST">POST</SelectItem>
                        <SelectItem value="PUT">PUT</SelectItem>
                        <SelectItem value="DELETE">DELETE</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.method && (
                      <p className="text-red-400 text-xs font-mono mt-1">{errors.method.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="title" className="text-neon-white font-mono">
                      Blink Title *
                    </Label>
                    <Input
                      id="title"
                      {...register("title")}
                      placeholder="My Awesome API"
                      className="mt-2 bg-neon-black border-neon-blue-dark/30 text-neon-white font-mono"
                      aria-required="true"
                      aria-invalid={!!errors.title}
                      aria-describedby={errors.title ? "title-error" : undefined}
                    />
                    {errors.title && (
                      <p
                        id="title-error"
                        role="alert"
                        aria-live="polite"
                        className="text-red-400 text-xs font-mono mt-1"
                      >
                        {errors.title.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="description" className="text-neon-white font-mono">
                      Description *
                    </Label>
                    <Textarea
                      id="description"
                      {...register("description")}
                      placeholder="Describe what your API does..."
                      className="mt-2 bg-neon-black border-neon-blue-dark/30 text-neon-white font-mono"
                      rows={3}
                      aria-required="true"
                      aria-invalid={!!errors.description}
                      aria-describedby={errors.description ? "description-error" : undefined}
                    />
                    {errors.description && (
                      <p
                        id="description-error"
                        role="alert"
                        aria-live="polite"
                        className="text-red-400 text-xs font-mono mt-1"
                      >
                        {errors.description.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="category" className="text-neon-white font-mono">
                      Category *
                    </Label>
                    <Select
                      onValueChange={(value) => setValue("category", value as any)}
                      defaultValue="API Tools"
                    >
                      <SelectTrigger className="mt-2 bg-neon-black border-neon-blue-dark/30 text-neon-white font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-neon-dark border-neon-blue-dark/30">
                        <SelectItem value="AI/ML">AI/ML</SelectItem>
                        <SelectItem value="Utilities">Utilities</SelectItem>
                        <SelectItem value="Data">Data</SelectItem>
                        <SelectItem value="API Tools">API Tools</SelectItem>
                        <SelectItem value="Web3">Web3</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.category && (
                      <p className="text-red-400 text-xs font-mono mt-1">{errors.category.message}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Step 2: Pricing & Wallet */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div>
                    <Label htmlFor="price_usdc" className="text-neon-white font-mono">
                      Price per Call (SOL) *
                    </Label>
                    <div className="relative mt-2">
                      <Input
                        id="price_usdc"
                        {...register("price_usdc")}
                        type="text"
                        placeholder="0.01"
                        className="bg-neon-black border-neon-blue-dark/30 text-neon-white font-mono"
                        aria-required="true"
                        aria-invalid={!!errors.price_usdc}
                        aria-describedby={errors.price_usdc ? "price_usdc-error" : undefined}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neon-grey font-mono text-sm">
                        SOL
                      </span>
                    </div>
                    {errors.price_usdc && (
                      <p
                        id="price_usdc-error"
                        role="alert"
                        aria-live="polite"
                        className="text-red-400 text-xs font-mono mt-1"
                      >
                        {errors.price_usdc.message}
                      </p>
                    )}
                    <p className="text-neon-grey text-xs font-mono mt-2">
                      Platform fee: 2.5% • You'll receive ~{(parseFloat(formValues.price_usdc || "0") * 0.975).toFixed(4)} SOL per call
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="payout_wallet" className="text-neon-white font-mono">
                      Payout Wallet (Solana) *
                    </Label>
                    <Input
                      id="payout_wallet"
                      {...register("payout_wallet")}
                      placeholder="Your Solana wallet address"
                      className="mt-2 bg-neon-black border-neon-blue-dark/30 text-neon-white font-mono"
                      aria-required="true"
                      aria-invalid={!!errors.payout_wallet}
                      aria-describedby={errors.payout_wallet ? "payout_wallet-error" : undefined}
                    />
                    {errors.payout_wallet && (
                      <p
                        id="payout_wallet-error"
                        role="alert"
                        aria-live="polite"
                        className="text-red-400 text-xs font-mono mt-1"
                      >
                        {errors.payout_wallet.message}
                      </p>
                    )}
                    <p className="text-neon-grey text-xs font-mono mt-2">
                      Payments are settled instantly on Solana mainnet
                    </p>
                  </div>

                  <Alert className="bg-neon-dark/50 border-neon-blue-dark/30">
                    <AlertDescription className="text-neon-grey font-mono text-sm">
                      <span className="text-neon-blue-light">💡 Tip:</span> Start with a low price to encourage testing. You can always adjust pricing later.
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {/* Step 3: Preview & Publish */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div>
                    <Label htmlFor="icon_url" className="text-neon-white font-mono">
                      Icon URL (optional)
                    </Label>
                    <Input
                      id="icon_url"
                      {...register("icon_url")}
                      placeholder="https://example.com/icon.jpg"
                      className="mt-2 bg-neon-black border-neon-blue-dark/30 text-neon-white font-mono"
                    />
                    {errors.icon_url && (
                      <p className="text-red-400 text-xs font-mono mt-1">{errors.icon_url.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="example_request" className="text-neon-white font-mono">
                      Example Request Body (optional)
                    </Label>
                    <Textarea
                      id="example_request"
                      {...register("example_request")}
                      placeholder='{"key": "value"}'
                      className="mt-2 bg-neon-black border-neon-blue-dark/30 text-neon-white font-mono"
                      rows={4}
                    />
                    {errors.example_request && (
                      <p className="text-red-400 text-xs font-mono mt-1">{errors.example_request.message}</p>
                    )}
                  </div>

                  <NeonDivider className="my-6" />

                  {/* Preview Card */}
                  <div>
                    <h3 className="text-neon-white font-mono text-lg mb-4">Preview</h3>
                    <Card className="bg-neon-black border-neon-blue-dark/30 p-6">
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 bg-neon-dark border border-neon-blue-dark/30 rounded-lg flex items-center justify-center">
                          <span className="text-neon font-mono text-2xl">⚡</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-neon-white font-mono text-lg">{formValues.title || "Untitled"}</h4>
                            <Badge className="bg-neon-blue-dark/20 text-neon-blue-light border-neon-blue-dark/30">
                              {formValues.category}
                            </Badge>
                          </div>
                          <p className="text-neon-grey font-mono text-sm mb-4">
                            {formValues.description || "No description"}
                          </p>
                          <div className="flex items-center gap-6 text-xs font-mono">
                            <div>
                              <span className="text-neon-grey">Price: </span>
                              <span className="text-neon-blue-light">{formValues.price_usdc || "0.00"} SOL</span>
                            </div>
                            <div>
                              <span className="text-neon-grey">Method: </span>
                              <span className="text-neon-white">{formValues.method}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <Alert className="mt-6 bg-red-500/10 border-red-500/30">
                  <AlertDescription className="text-red-400 font-mono text-sm">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between mt-8">
                <Button
                  type="button"
                  onClick={handleBack}
                  disabled={currentStep === 1}
                  className="btn-ghost"
                >
                  ← Back
                </Button>

                {currentStep < 3 ? (
                  <Button type="button" onClick={handleNext} className="btn-primary">
                    Next →
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary"
                  >
                    {isSubmitting ? "Creating..." : "Create Blink"}
                  </Button>
                )}
              </div>
            </form>
          </Card>
        </div>
      </section>
    </main>
  )
}
