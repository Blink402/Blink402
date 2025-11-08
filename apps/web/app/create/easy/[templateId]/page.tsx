"use client"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useParams, useRouter } from "next/navigation"
import { mountReveals } from "@/lib/reveal"
import { mountScramble } from "@/lib/scramble"
import { getTemplateById } from "@/lib/templates"
import { createBlink } from "@/lib/api"
import { useAuth } from "@/components/providers/AuthProvider"
import NeonDivider from "@/components/NeonDivider"
import Lottie from "@/components/Lottie"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

// Simplified schema for template-based creation
const templateBlinkSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(50),
  description: z.string().min(10, "Description must be at least 10 characters").max(200),
  price_usdc: z.string()
    .refine(
      (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
      { message: "Price must be a positive number" }
    ),
  payout_wallet: z.string()
    .min(32, "Wallet address is too short")
    .max(44, "Wallet address is too long")
    .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "Invalid Solana wallet address"),
})

type TemplateBlinkFormData = z.infer<typeof templateBlinkSchema>

const STEPS = [
  { id: 1, title: "Customize", description: "Personalize your Blink" },
  { id: 2, title: "Preview & Publish", description: "Review and create" },
]

export default function TemplateBuilderPage() {
  const params = useParams()
  const router = useRouter()
  const { authToken, isAuthenticated, wallet, signIn } = useAuth()
  const templateId = params.templateId as string

  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load template
  const template = getTemplateById(templateId)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    trigger,
  } = useForm<TemplateBlinkFormData>({
    resolver: zodResolver(templateBlinkSchema),
    mode: "onBlur",
    defaultValues: template ? {
      title: template.config.title,
      description: template.config.description,
      price_usdc: template.config.price_usdc,
    } : undefined,
  })

  const formValues = watch()

  useEffect(() => {
    mountReveals()
    mountScramble()
  }, [])

  // Re-mount reveals when step changes to animate new content
  useEffect(() => {
    mountReveals()
  }, [currentStep])

  // Pre-fill payout wallet with connected wallet
  useEffect(() => {
    if (wallet && !formValues.payout_wallet) {
      setValue('payout_wallet', wallet)
    }
  }, [wallet, formValues.payout_wallet, setValue])

  // Redirect if template not found
  if (!template) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-sans text-neon-white mb-4">Template Not Found</h1>
          <p className="text-neon-grey font-mono mb-6">The template you're looking for doesn't exist.</p>
          <Link href="/create/easy" className="btn-primary">
            Back to Templates
          </Link>
        </div>
      </main>
    )
  }

  const validateStep = async () => {
    let fieldsToValidate: (keyof TemplateBlinkFormData)[] = []

    if (currentStep === 1) {
      fieldsToValidate = ['title', 'description', 'price_usdc']
    }

    const isValid = await trigger(fieldsToValidate)
    return isValid
  }

  const handleNext = async () => {
    const isValid = await validateStep()
    if (isValid) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    setCurrentStep(currentStep - 1)
  }

  const onSubmit = async (data: TemplateBlinkFormData) => {
    if (!isAuthenticated) {
      setError("Please connect your wallet to create a Blink")
      signIn()
      return
    }

    if (!authToken || !wallet) {
      setError("Authentication required. Please connect your wallet.")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      // Combine template config with user customization
      const payload = {
        ...data,
        endpoint_url: template.config.endpoint_url,
        method: template.config.method,
        category: template.config.category,
        icon_url: template.icon_url,
        example_request: template.config.example_request,
        creator_wallet: wallet,
      }

      const createdBlink = await createBlink(payload, authToken)

      setIsSuccess(true)

      // Redirect to dashboard after short delay
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    } catch (err: any) {
      console.error('Failed to create Blink:', err)
      setError(err.message || 'Failed to create Blink. Please try again.')
      setIsSubmitting(false)
    }
  }

  // Calculate platform fee
  const price = parseFloat(formValues.price_usdc || "0")
  const platformFee = price * 0.025
  const netEarnings = price - platformFee

  return (
    <main className="min-h-screen">
      {/* Header */}
      <section className="relative overflow-hidden px-6 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Back link */}
          <div data-reveal className="mb-6">
            <Link href="/create/easy" className="text-neon-grey hover:text-neon-green-light font-mono text-sm transition-colors">
              ← Back to Templates
            </Link>
          </div>

          {/* Template info */}
          <div data-reveal className="mb-8">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-neon-green-light/10 rounded border border-neon-green-light/30 flex items-center justify-center flex-shrink-0">
                <span className="text-3xl">
                  {template.category === "fun" && "🎉"}
                  {template.category === "utilities" && "🛠️"}
                  {template.category === "data" && "📊"}
                  {template.category === "ai-ml" && "🤖"}
                  {template.category === "web3" && "🔗"}
                </span>
              </div>
              <div>
                <h1 className="text-3xl font-sans text-neon-white mb-2" data-scramble>
                  {template.name}
                </h1>
                <p className="text-neon-grey font-mono">{template.description}</p>
                <div className="flex gap-2 mt-2">
                  <Badge className="bg-neon-dark text-neon-grey border-neon-grey/30 capitalize">
                    {template.category.replace("-", " ")}
                  </Badge>
                  {template.estimated_setup_time && (
                    <Badge className="bg-neon-green-light/10 text-neon-green-light border-neon-green-light">
                      ⚡ {template.estimated_setup_time}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Progress Stepper */}
          <div data-reveal className="mb-8">
            <div className="flex items-center justify-center gap-4">
              {STEPS.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-mono text-sm transition-all ${
                        currentStep >= step.id
                          ? "border-neon-green-light text-neon-green-light bg-neon-green-light/10"
                          : "border-neon-grey/30 text-neon-grey"
                      }`}
                    >
                      {step.id}
                    </div>
                    <p
                      className={`mt-2 text-xs font-mono ${
                        currentStep >= step.id ? "text-neon-white" : "text-neon-grey"
                      }`}
                    >
                      {step.title}
                    </p>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div
                      className={`w-16 h-0.5 mb-6 transition-all ${
                        currentStep > step.id ? "bg-neon-green-light" : "bg-neon-grey/30"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <NeonDivider className="mb-8" />

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Step 1: Customize */}
            {currentStep === 1 && (
              <div data-reveal className="space-y-6">
                <Card className="bg-neon-dark border-dashed-neon p-6">
                  <h2 className="text-2xl font-sans text-neon-white mb-6">Customize Your Blink</h2>

                  {/* Title */}
                  <div className="mb-4">
                    <Label htmlFor="title" className="text-neon-white font-mono mb-2 block">
                      Blink Title *
                    </Label>
                    <Input
                      id="title"
                      {...register("title")}
                      placeholder="My Awesome Blink"
                      className="bg-neon-black border-neon-blue-dark/30 text-neon-white font-mono"
                    />
                    {errors.title && (
                      <p className="text-red-400 text-sm font-mono mt-1">{errors.title.message}</p>
                    )}
                    <p className="text-neon-grey text-xs font-mono mt-1">
                      What should people call your Blink?
                    </p>
                  </div>

                  {/* Description */}
                  <div className="mb-4">
                    <Label htmlFor="description" className="text-neon-white font-mono mb-2 block">
                      Description *
                    </Label>
                    <Textarea
                      id="description"
                      {...register("description")}
                      placeholder="Explain what your Blink does..."
                      className="bg-neon-black border-neon-blue-dark/30 text-neon-white font-mono min-h-[100px]"
                    />
                    {errors.description && (
                      <p className="text-red-400 text-sm font-mono mt-1">{errors.description.message}</p>
                    )}
                    <p className="text-neon-grey text-xs font-mono mt-1">
                      Help users understand what they'll get
                    </p>
                  </div>

                  {/* Price */}
                  <div className="mb-4">
                    <Label htmlFor="price_usdc" className="text-neon-white font-mono mb-2 block">
                      Price per Use (SOL) *
                    </Label>
                    <Input
                      id="price_usdc"
                      {...register("price_usdc")}
                      placeholder="0.001"
                      type="number"
                      step="0.0001"
                      className="bg-neon-black border-neon-blue-dark/30 text-neon-white font-mono"
                    />
                    {errors.price_usdc && (
                      <p className="text-red-400 text-sm font-mono mt-1">{errors.price_usdc.message}</p>
                    )}
                    {price > 0 && (
                      <div className="mt-2 p-3 bg-neon-black/50 border border-neon-grey/20 rounded">
                        <p className="text-neon-grey text-xs font-mono">
                          Platform fee (2.5%): <span className="text-neon-white">{platformFee.toFixed(4)} SOL</span>
                        </p>
                        <p className="text-neon-green-light text-sm font-mono mt-1">
                          You earn: {netEarnings.toFixed(4)} SOL per use
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Payout Wallet */}
                  <div className="mb-4">
                    <Label htmlFor="payout_wallet" className="text-neon-white font-mono mb-2 block">
                      Payout Wallet *
                    </Label>
                    <Input
                      id="payout_wallet"
                      {...register("payout_wallet")}
                      placeholder="Your Solana wallet address"
                      className="bg-neon-black border-neon-blue-dark/30 text-neon-white font-mono"
                    />
                    {errors.payout_wallet && (
                      <p className="text-red-400 text-sm font-mono mt-1">{errors.payout_wallet.message}</p>
                    )}
                    <p className="text-neon-grey text-xs font-mono mt-1">
                      Where you'll receive payments (auto-filled with your connected wallet)
                    </p>
                  </div>
                </Card>

                {/* Navigation */}
                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={handleNext}
                    className="btn-primary"
                  >
                    Next Step →
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Preview & Publish */}
            {currentStep === 2 && (
              <div data-reveal className="space-y-6">
                <Card className="bg-neon-dark border-dashed-neon p-6">
                  <h2 className="text-2xl font-sans text-neon-white mb-6">Preview Your Blink</h2>

                  {/* Preview Card */}
                  <div className="bg-neon-black p-6 rounded border border-neon-green-light/30 mb-6">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-12 h-12 bg-neon-green-light/10 rounded border border-neon-green-light/30 flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl">
                          {template.category === "fun" && "🎉"}
                          {template.category === "utilities" && "🛠️"}
                          {template.category === "data" && "📊"}
                          {template.category === "ai-ml" && "🤖"}
                          {template.category === "web3" && "🔗"}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-sans text-neon-white mb-2">
                          {formValues.title || template.config.title}
                        </h3>
                        <p className="text-neon-grey font-mono text-sm">
                          {formValues.description || template.config.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-neon-grey/20">
                      <Badge className="bg-neon-dark text-neon-grey border-neon-grey/30">
                        {template.config.category}
                      </Badge>
                      <p className="text-neon-green-light font-mono text-lg font-bold">
                        {formValues.price_usdc || template.config.price_usdc} SOL
                      </p>
                    </div>
                  </div>

                  {/* Configuration Summary */}
                  <div className="space-y-3 mb-6">
                    <h3 className="text-lg font-sans text-neon-white">Configuration</h3>
                    <div className="bg-neon-black/50 p-4 rounded border border-neon-grey/20 font-mono text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-neon-grey">API Endpoint:</span>
                        <span className="text-neon-white truncate ml-4 max-w-[300px]">{template.config.endpoint_url}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neon-grey">Method:</span>
                        <span className="text-neon-white">{template.config.method}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neon-grey">Category:</span>
                        <span className="text-neon-white">{template.config.category}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neon-grey">Payout Wallet:</span>
                        <span className="text-neon-white truncate ml-4 max-w-[300px]">
                          {formValues.payout_wallet ?
                            `${formValues.payout_wallet.slice(0, 8)}...${formValues.payout_wallet.slice(-8)}`
                            : 'Not set'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Error Display */}
                  {error && (
                    <Alert className="mb-6 bg-red-900/20 border-red-500/50">
                      <AlertDescription className="text-red-400 font-mono text-sm">
                        {error}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Success Display */}
                  {isSuccess && (
                    <Alert className="mb-6 bg-neon-green-light/10 border-neon-green-light">
                      <AlertDescription className="text-neon-green-light font-mono text-sm">
                        ✓ Blink created successfully! Redirecting to dashboard...
                      </AlertDescription>
                    </Alert>
                  )}
                </Card>

                {/* Navigation */}
                <div className="flex justify-between">
                  <Button
                    type="button"
                    onClick={handleBack}
                    variant="outline"
                    className="btn-ghost"
                    disabled={isSubmitting}
                  >
                    ← Back
                  </Button>
                  <Button
                    type={isAuthenticated ? "submit" : "button"}
                    onClick={!isAuthenticated ? signIn : undefined}
                    className="btn-primary"
                    disabled={isSubmitting || isSuccess}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <Lottie
                          src="/lottie/Loading (Neon spinning).lottie"
                          autoplay
                          loop
                          width={20}
                          height={20}
                        />
                        Creating...
                      </span>
                    ) : isSuccess ? (
                      "Created!"
                    ) : !isAuthenticated ? (
                      "Connect Wallet to Publish"
                    ) : (
                      "Publish Blink"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </form>
        </div>
      </section>
    </main>
  )
}
