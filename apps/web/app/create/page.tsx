"use client"
import { Suspense, useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { EndpointSuggestion } from "@blink402/types"
import { mountReveals } from "@/lib/reveal"
import { mountScramble } from "@/lib/scramble"
import { createBlink } from "@/lib/api"
import { usePrivy, useWallets } from "@privy-io/react-auth"
import { generateAuthMessage, createAuthToken, encodeAuthToken } from "@/lib/auth"
import NeonDivider from "@/components/NeonDivider"
import Lottie from "@/components/Lottie"
import { AIEndpointFinder } from "@/components/AIEndpointFinder"
import { UsdcAtaChecker } from "@/components/UsdcAtaChecker"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { HelpTooltip } from "@/components/HelpTooltip"
import { FormHelp } from "@/components/FormHelp"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { blinkSchema, type BlinkFormData, STEPS } from "./schema"
import { CreateBlinkStepper, StepNavigation } from "./components"

function CreateBlinkPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { ready, authenticated, login, user } = usePrivy()
  const { wallets } = useWallets()

  // Wallet detection (same pattern as WalletButton and checkout)
  const walletFromArray = wallets[0]
  const solanaAccount: any = user?.linkedAccounts?.find(
    (account: any) => account.type === 'wallet' && account.chainType === 'solana'
  )
  const wallet = (solanaAccount as any)?.address || walletFromArray?.address
  const isAuthenticated = authenticated && !!wallet

  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isFork, setIsFork] = useState(false)
  const [forkOfBlinkId, setForkOfBlinkId] = useState<string | null>(null)
  const [originalCreator, setOriginalCreator] = useState<string | null>(null)
  const [showAISuccessAlert, setShowAISuccessAlert] = useState(false)
  const [aiGeneratedFields, setAiGeneratedFields] = useState<string[]>([])
  const [testingEndpoint, setTestingEndpoint] = useState(false)
  const [testResult, setTestResult] = useState<{
    valid: boolean
    statusCode?: number
    responseTime?: number
    error?: string
  } | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, touchedFields },
    setValue,
    watch,
    trigger,
  } = useForm<BlinkFormData>({
    resolver: zodResolver(blinkSchema),
    mode: "onTouched",
    defaultValues: {
      endpoint_url: "",
      method: "POST",
      title: "",
      description: "",
      category: "API Tools",
      payment_mode: "charge",
      payment_token: "USDC", // Default to USDC (required for PayAI x402)
      price_usdc: "0.01",
      payout_wallet: "",
      max_claims_per_user: "1",
      example_request: "{}",
      parameters: "",
      icon_url: "",
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

  // Pre-fill form when forking a blink
  useEffect(() => {
    const fork = searchParams.get('fork')
    if (fork === 'true') {
      setIsFork(true)
      setForkOfBlinkId(searchParams.get('fork_of_blink_id'))
      setOriginalCreator(searchParams.get('original_creator'))

      // Pre-fill form fields from URL params
      const title = searchParams.get('title')
      const description = searchParams.get('description')
      const endpoint_url = searchParams.get('endpoint_url')
      const method = searchParams.get('method')
      const price_usdc = searchParams.get('price_usdc')
      const category = searchParams.get('category')
      const icon_url = searchParams.get('icon_url')
      const payment_token = searchParams.get('payment_token')

      if (title) setValue('title', title)
      if (description) setValue('description', description)
      if (endpoint_url) setValue('endpoint_url', endpoint_url)
      if (method) setValue('method', method as any)
      if (price_usdc) setValue('price_usdc', price_usdc)
      if (category) setValue('category', category as any)
      if (icon_url) setValue('icon_url', icon_url)
      if (payment_token) setValue('payment_token', payment_token as any)
    }
  }, [searchParams, setValue])

  // Handle AI endpoint selection
  const handleAISelect = (suggestion: EndpointSuggestion) => {
    // Track which fields were AI-generated
    const generatedFields: string[] = []

    // Fill form with AI suggestion - use shouldValidate and shouldDirty to ensure form updates
    setValue('endpoint_url', suggestion.endpoint_url, { shouldValidate: true, shouldDirty: true })
    generatedFields.push('endpoint_url')

    setValue('method', suggestion.method as any, { shouldValidate: true, shouldDirty: true })
    generatedFields.push('method')

    setValue('title', suggestion.name, { shouldValidate: true, shouldDirty: true })
    generatedFields.push('title')

    setValue('description', suggestion.description, { shouldValidate: true, shouldDirty: true })
    generatedFields.push('description')

    setValue('category', suggestion.category as any, { shouldValidate: true, shouldDirty: true })
    generatedFields.push('category')

    if (suggestion.example_request) {
      const exampleStr = typeof suggestion.example_request === 'string'
        ? suggestion.example_request
        : JSON.stringify(suggestion.example_request, null, 2)
      setValue('example_request', exampleStr, { shouldValidate: true, shouldDirty: true })
      generatedFields.push('example_request')
    }

    // Trigger validation for all filled fields
    trigger(['endpoint_url', 'method', 'title', 'description', 'category'])

    // Show success alert
    setShowAISuccessAlert(true)
    setAiGeneratedFields(generatedFields)

    // Auto-hide alert after 10 seconds
    setTimeout(() => {
      setShowAISuccessAlert(false)
    }, 10000)

    // Scroll to stepper
    const stepperElement = document.querySelector('[data-stepper]')
    if (stepperElement) {
      stepperElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

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

  const testEndpoint = async () => {
    const endpoint_url = formValues.endpoint_url
    const method = formValues.method

    // Reset previous result
    setTestResult(null)

    // Validate required fields
    if (!endpoint_url || !method) {
      setTestResult({
        valid: false,
        error: "Please fill in both endpoint URL and method before testing"
      })
      return
    }

    // Validate URL format
    try {
      new URL(endpoint_url)
    } catch {
      setTestResult({
        valid: false,
        error: "Invalid URL format"
      })
      return
    }

    setTestingEndpoint(true)

    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const response = await fetch(`${API_BASE_URL}/blinks/test-endpoint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint_url,
          method,
        }),
      })

      const data = await response.json()

      if (data.success && data.valid) {
        setTestResult({
          valid: true,
          statusCode: data.statusCode,
          responseTime: data.responseTime,
        })
      } else {
        setTestResult({
          valid: false,
          statusCode: data.statusCode,
          responseTime: data.responseTime,
          error: data.error || 'Endpoint test failed',
        })
      }
    } catch (error) {
      setTestResult({
        valid: false,
        error: error instanceof Error ? error.message : 'Failed to test endpoint',
      })
    } finally {
      setTestingEndpoint(false)
    }
  }

  const onSubmit = async (data: BlinkFormData) => {
    // Check if user is authenticated
    if (!isAuthenticated) {
      setError("Please connect your wallet to create a Blink")
      login()
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      // Generate slug from title
      const slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')

      // Parse parameters JSON if provided
      let parsedParameters: any = undefined
      if (data.parameters && data.parameters.trim()) {
        try {
          parsedParameters = JSON.parse(data.parameters)
          // Validate it's an array
          if (!Array.isArray(parsedParameters)) {
            throw new Error('Parameters must be a JSON array')
          }
        } catch (parseError: any) {
          throw new Error(`Invalid parameters JSON: ${parseError.message}`)
        }
      }

      // Build blink payload based on payment mode
      const blinkPayload: any = {
        slug,
        title: data.title,
        description: data.description,
        endpoint_url: data.endpoint_url,
        method: data.method,
        category: data.category,
        icon_url: data.icon_url || '/lottie/Success-Checkmark-Green.lottie',
        status: 'active',
        payment_token: data.payment_token || 'USDC', // Default USDC (required for PayAI x402)
        payment_mode: data.payment_mode,
        parameters: parsedParameters, // Add parameters for dynamic input fields
        creator: {
          wallet: wallet!
        }
      }

      // Add charge mode fields
      if (data.payment_mode === "charge") {
        blinkPayload.price_usdc = data.price_usdc
        blinkPayload.payout_wallet = data.payout_wallet
      }

      // Add reward mode fields
      if (data.payment_mode === "reward") {
        blinkPayload.price_usdc = "0" // Set price to 0 for reward mode (user doesn't pay)
        blinkPayload.payout_wallet = wallet! // Use creator wallet as placeholder
        blinkPayload.reward_amount = data.reward_amount
        blinkPayload.funded_wallet = data.funded_wallet
        blinkPayload.max_claims_per_user = parseInt(data.max_claims_per_user || "1", 10)
      }

      // Add fork tracking if this is a fork
      if (isFork && forkOfBlinkId) {
        blinkPayload.fork_of_blink_id = forkOfBlinkId
      }

      // Generate auth message and get wallet signature
      const { message } = generateAuthMessage(wallet!)

      // Use window.solana for signing (same pattern as checkout)
      // @ts-ignore
      const solana = window.solana || window.phantom?.solana

      if (!solana) {
        throw new Error('No Solana wallet found. Please install Phantom or Solflare and connect it.')
      }

      if (!solana.isConnected) {
        throw new Error('Wallet not connected. Please connect your wallet in the navigation bar.')
      }

      // Convert message to Uint8Array for Solana signing
      const messageBytes = new TextEncoder().encode(message)

      // Request signature from Solana wallet
      let signature: Uint8Array
      try {
        const signResult = await solana.signMessage(messageBytes, 'utf8')
        signature = signResult.signature
      } catch (signError: any) {
        if (signError.message?.includes('rejected') || signError.message?.includes('denied')) {
          throw new Error('Signature rejected by user')
        }
        throw new Error(`Failed to sign message: ${signError.message}`)
      }

      // Convert signature bytes to base58 string
      const bs58 = await import('bs58')
      const signatureBase58 = bs58.default.encode(signature)

      // Create and encode auth token
      const authToken = createAuthToken(wallet!, signatureBase58, message)
      const encodedToken = encodeAuthToken(authToken)

      // Create blink via API with proper auth token
      await createBlink(blinkPayload, encodedToken)

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
              {isFork ? 'Fork a Blink' : 'Create a Blink'}
            </h1>
            <p className="text-neon-grey font-mono text-base">
              {isFork
                ? 'Customize this forked Blink and make it your own'
                : 'Turn your API into a pay-per-call link in minutes'}
            </p>
          </header>

          {/* Fork Indicator */}
          {isFork && originalCreator && (
            <Alert className="mb-8 bg-neon-blue-light/10 border-neon-blue-light/30 text-neon-white">
              <AlertDescription className="font-mono text-sm">
                <span className="text-neon-blue-light font-bold">🍴 Forking from:</span>{' '}
                <code className="bg-neon-dark px-2 py-1 rounded text-xs">
                  {originalCreator.slice(0, 8)}...{originalCreator.slice(-8)}
                </code>
                <br />
                <span className="text-neon-grey text-xs mt-1 block">
                  Feel free to modify the configuration, price, and payout wallet. Your payout wallet will receive all payments.
                </span>
              </AlertDescription>
            </Alert>
          )}

          {/* AI Endpoint Finder */}
          <AIEndpointFinder
            onSelect={handleAISelect}
            className="mb-8"
          />

          {/* AI Success Alert */}
          {showAISuccessAlert && (
            <Alert className="mb-8 bg-green-500/10 border-green-500/30 animate-in fade-in slide-in-from-top-2 duration-300">
              <AlertDescription className="font-mono text-sm">
                <div className="flex items-start gap-3">
                  <Lottie
                    src="/lottie/Success-Checkmark-Green.lottie"
                    autoplay
                    loop={false}
                    width={32}
                    height={32}
                  />
                  <div className="flex-1">
                    <p className="text-green-400 font-bold mb-1">
                      ✨ Form Pre-filled with AI Suggestion
                    </p>
                    <p className="text-neon-grey text-xs mb-2">
                      Review the details below and customize as needed. You can change any field.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {aiGeneratedFields.map((field) => (
                        <Badge
                          key={field}
                          className="bg-neon-blue-light/10 text-neon-blue-light border-neon-blue-light/30 text-xs"
                        >
                          ✓ {field.replace('_', ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAISuccessAlert(false)}
                    className="text-neon-grey hover:text-neon-white transition-colors"
                    aria-label="Dismiss alert"
                  >
                    ×
                  </button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Progress Stepper */}
          <CreateBlinkStepper currentStep={currentStep} />

          {/* Form */}
          <Card data-reveal className="bg-neon-dark border-neon-blue-dark/20 p-8">
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              {/* Step 1: Endpoint Configuration */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <Label htmlFor="endpoint_url" className="text-neon-white font-mono flex items-center gap-2">
                      API Endpoint URL *
                      <HelpTooltip content="The web address (URL) your Blink will call when someone pays. This is the API you want to charge access for. Example: https://api.weather.com/v1/current" />
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
                    {!errors.endpoint_url && (
                      <FormHelp>
                        This is the API you want to gate with payments. Make sure it's publicly accessible and accepts HTTPS requests.
                      </FormHelp>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="method" className="text-neon-white font-mono flex items-center gap-2">
                      HTTP Method *
                      <HelpTooltip content="The type of request your API expects. GET = retrieve data (most common), POST = submit data, PUT = update data, DELETE = remove data. When in doubt, choose POST." />
                    </Label>
                    <Select
                      value={formValues.method}
                      onValueChange={(value) => setValue("method", value as any, { shouldValidate: true })}
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
                    {!errors.method && (
                      <FormHelp>
                        Most APIs use POST for data submission or GET for data retrieval. Check your API documentation if unsure.
                      </FormHelp>
                    )}
                  </div>

                  {/* Test Endpoint Button */}
                  <div className="border border-neon-blue-dark/30 rounded-lg p-4 bg-black/20">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="text-sm font-mono text-neon-white mb-1">Test Endpoint</h4>
                        <p className="text-xs text-neon-grey">Verify your endpoint is reachable before creating the blink</p>
                      </div>
                      <Button
                        type="button"
                        onClick={testEndpoint}
                        disabled={testingEndpoint || !formValues.endpoint_url || !formValues.method}
                        className="btn-primary"
                      >
                        {testingEndpoint ? 'Testing...' : 'Test Now'}
                      </Button>
                    </div>

                    {/* Test Result Display */}
                    {testResult && (
                      <Alert className={testResult.valid ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}>
                        <AlertDescription className="font-mono text-sm">
                          {testResult.valid ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-green-400">
                                <span className="text-lg">✓</span>
                                <span className="font-medium">Endpoint is reachable!</span>
                              </div>
                              <div className="text-xs text-neon-grey ml-6">
                                Status: {testResult.statusCode} • Response time: {testResult.responseTime}ms
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-red-400">
                                <span className="text-lg">✗</span>
                                <span className="font-medium">Endpoint test failed</span>
                              </div>
                              <div className="text-xs text-red-300 ml-6">
                                {testResult.error}
                                {testResult.statusCode && ` (Status: ${testResult.statusCode})`}
                              </div>
                            </div>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="title" className="text-neon-white font-mono flex items-center gap-2">
                      Blink Title *
                      <HelpTooltip content="A short, descriptive name for your Blink. This is what users will see when browsing. Good examples: 'Weather API', 'AI Image Generator'. Bad examples: 'api123', 'test'." />
                    </Label>
                    <Input
                      id="title"
                      {...register("title")}
                      placeholder="Weather Data API"
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
                    {!errors.title && (
                      <FormHelp>
                        Keep it clear and descriptive. Users will see this when deciding whether to use your Blink. (3-50 characters)
                      </FormHelp>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="description" className="text-neon-white font-mono flex items-center gap-2">
                      Description *
                      <HelpTooltip content="Explain what your API does and what users will get. Be clear and specific. Example: 'Get real-time weather data for any city including temperature, humidity, and forecasts.'" />
                    </Label>
                    <Textarea
                      id="description"
                      {...register("description")}
                      placeholder="Get real-time weather data including temperature, humidity, and forecasts for any city worldwide."
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
                    {!errors.description && (
                      <FormHelp>
                        Help users understand what they'll get by using your API. Focus on benefits and features. (10-200 characters)
                      </FormHelp>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="category" className="text-neon-white font-mono flex items-center gap-2">
                      Category *
                      <HelpTooltip content="Choose the category that best fits your API. AI/ML = artificial intelligence, Utilities = tools & helpers, Data = information/analytics, API Tools = testing/development, Web3 = blockchain/crypto." />
                    </Label>
                    <Select
                      value={formValues.category}
                      onValueChange={(value) => setValue("category", value as any, { shouldValidate: true })}
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
                    {!errors.category && (
                      <FormHelp>
                        This helps users find your Blink when browsing by category. Choose the most relevant one.
                      </FormHelp>
                    )}
                  </div>
                </div>
              )}

              {/* Step 2: Pricing & Wallet */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  {/* Payment Mode Selection */}
                  <div>
                    <Label htmlFor="payment_mode" className="text-neon-white font-mono flex items-center gap-2">
                      Payment Mode *
                      <HelpTooltip content="Charge Mode = Users pay YOU to access your API (most common). Reward Mode = YOU pay users to complete an action (for marketing/incentives). Most creators use Charge Mode." />
                    </Label>
                    <Select
                      value={formValues.payment_mode}
                      onValueChange={(value) => setValue("payment_mode", value as any, { shouldValidate: true })}
                    >
                      <SelectTrigger className="mt-2 bg-neon-black border-neon-blue-dark/30 text-neon-white font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-neon-dark border-neon-blue-dark/30">
                        <SelectItem value="charge">Charge Mode - User pays for service</SelectItem>
                        <SelectItem value="reward">Reward Mode - You pay user for completing action</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-neon-grey text-xs font-mono mt-2">
                      {formValues.payment_mode === "reward"
                        ? `You will pay users ${formValues.payment_token || 'USDC'} when they complete the action`
                        : `Users will pay you ${formValues.payment_token || 'USDC'} to use your service`}
                    </p>
                  </div>

                  {/* Payment Token Selection */}
                  <div>
                    <Label htmlFor="payment_token" className="text-neon-white font-mono flex items-center gap-2">
                      Payment Token *
                      <HelpTooltip content="SOL = Solana's native cryptocurrency (price fluctuates, lowest fees). USDC = Stablecoin pegged to US Dollar (stable price, predictable earnings). New users often prefer USDC for predictable pricing." />
                    </Label>
                    <Select
                      value={formValues.payment_token}
                      onValueChange={(value) => setValue("payment_token", value as any, { shouldValidate: true })}
                    >
                      <SelectTrigger className="mt-2 bg-neon-black border-neon-blue-dark/30 text-neon-white font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-neon-dark border-neon-blue-dark/30">
                        <SelectItem value="SOL">SOL (Solana native token)</SelectItem>
                        <SelectItem value="USDC">USDC (USD stablecoin)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormHelp>
                      {formValues.payment_token === "USDC"
                        ? "USDC provides stable pricing in USD equivalent - great for predictable revenue"
                        : "SOL is Solana's native token with lowest fees - price varies with market"}
                    </FormHelp>
                  </div>

                  {/* Charge Mode Fields */}
                  {formValues.payment_mode === "charge" && (
                    <>
                      <div>
                        <Label htmlFor="price_usdc" className="text-neon-white font-mono flex items-center gap-2">
                          Price per Call ({formValues.payment_token || 'USDC'}) *
                          <HelpTooltip content={`How much users pay each time they use your API. Typical ranges: Simple APIs (0.001-0.01), AI APIs (0.05-0.2), Premium APIs (0.5+). ${formValues.payment_token === 'USDC' ? '0.01 USDC = 1 cent' : 'Check current SOL price for USD equivalent'}.`} />
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
                            {formValues.payment_token || 'USDC'}
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
                        <FormHelp>
                          Platform fee: 2.5% covers infrastructure and payment processing • You'll receive ~{(parseFloat(formValues.price_usdc || "0") * 0.975).toFixed(4)} {formValues.payment_token || 'USDC'} per call
                        </FormHelp>
                      </div>

                      <div>
                        <Label htmlFor="payout_wallet" className="text-neon-white font-mono flex items-center gap-2">
                          Payout Wallet (Solana) *
                          <HelpTooltip content="Your Solana wallet address where you'll receive payments. This should be YOUR wallet address (starts with a letter or number, 32-44 characters). Payments are sent here instantly when users pay." />
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
                        {!errors.payout_wallet && (
                          <FormHelp>
                            Payments are settled instantly on the Solana blockchain - no waiting periods or withdrawals needed.
                          </FormHelp>
                        )}

                        {/* USDC ATA Checker - ensures merchant can receive payments */}
                        {formValues.payout_wallet && formValues.payout_wallet.length >= 32 && (
                          <div className="mt-3">
                            <UsdcAtaChecker
                              payoutWallet={formValues.payout_wallet}
                              connectedWallet={wallet}
                            />
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Reward Mode Fields */}
                  {formValues.payment_mode === "reward" && (
                    <>
                      <div>
                        <Label htmlFor="reward_amount" className="text-neon-white font-mono">
                          Reward Amount ({formValues.payment_token || 'USDC'}) *
                        </Label>
                        <div className="relative mt-2">
                          <Input
                            id="reward_amount"
                            {...register("reward_amount")}
                            type="text"
                            placeholder="0.01"
                            className="bg-neon-black border-neon-blue-dark/30 text-neon-white font-mono"
                            aria-required="true"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neon-grey font-mono text-sm">
                            {formValues.payment_token || 'USDC'}
                          </span>
                        </div>
                        <p className="text-neon-grey text-xs font-mono mt-2">
                          Amount you'll pay each user who completes the action
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="funded_wallet" className="text-neon-white font-mono">
                          Funded Wallet (pays rewards) *
                        </Label>
                        <Input
                          id="funded_wallet"
                          {...register("funded_wallet")}
                          placeholder="Your Solana wallet address"
                          className="mt-2 bg-neon-black border-neon-blue-dark/30 text-neon-white font-mono"
                          aria-required="true"
                        />
                        <p className="text-neon-grey text-xs font-mono mt-2">
                          This wallet must have sufficient {formValues.payment_token || 'USDC'} balance to pay rewards
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="max_claims_per_user" className="text-neon-white font-mono">
                          Max Claims per User *
                        </Label>
                        <Input
                          id="max_claims_per_user"
                          {...register("max_claims_per_user")}
                          type="number"
                          min="1"
                          placeholder="1"
                          className="mt-2 bg-neon-black border-neon-blue-dark/30 text-neon-white font-mono"
                          aria-required="true"
                        />
                        <p className="text-neon-grey text-xs font-mono mt-2">
                          Maximum number of times a single wallet can claim the reward
                        </p>
                      </div>

                      <Alert className="bg-neon-dark/50 border-neon-blue-dark/30">
                        <AlertDescription className="text-neon-grey font-mono text-sm">
                          <span className="text-neon-blue-light">⚠️ Warning:</span> Ensure your funded wallet has enough SOL to pay all potential rewards. Calculate: reward_amount × max_claims_per_user × expected_users
                        </AlertDescription>
                      </Alert>
                    </>
                  )}

                  {formValues.payment_mode === "charge" && (
                    <Alert className="bg-neon-dark/50 border-neon-blue-dark/30">
                      <AlertDescription className="text-neon-grey font-mono text-sm">
                        <span className="text-neon-blue-light">💡 Tip:</span> Start with a low price to encourage testing. You can always adjust pricing later.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {/* Step 3: Preview & Publish */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div>
                    <Label htmlFor="icon_url" className="text-neon-white font-mono flex items-center gap-2">
                      Icon URL (optional)
                      <HelpTooltip content="A square image (recommended 512x512px) that represents your Blink. Use services like imgur.com or cloudinary.com to host your image. Leave blank to use the default icon." />
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
                    {!errors.icon_url && (
                      <FormHelp>
                        Upload your icon to a public hosting service and paste the URL here. Square images (512x512px) work best.
                      </FormHelp>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="example_request" className="text-neon-white font-mono flex items-center gap-2">
                      Example Request Body (optional)
                      <HelpTooltip content="For POST/PUT APIs: Show what data your API expects. This is automatically sent when users pay for your Blink. Must be valid JSON format. For GET requests, you can leave this blank." />
                    </Label>
                    <FormHelp>
                      For POST/PUT requests: Show the JSON data structure your API expects. This helps users understand what will be sent to your API.
                    </FormHelp>
                    <div className="bg-neon-dark border border-neon-blue-dark/30 rounded p-3 mb-2">
                      <p className="text-neon-grey font-mono text-xs mb-1">Example:</p>
                      <code className="text-neon-white font-mono text-xs block">
                        {`{\n  "prompt": "A sunset over mountains",\n  "model": "stable-diffusion",\n  "width": 512,\n  "height": 512\n}`}
                      </code>
                    </div>
                    <Textarea
                      id="example_request"
                      {...register("example_request")}
                      placeholder='{"key": "value"}'
                      className="bg-neon-black border-neon-blue-dark/30 text-neon-white font-mono"
                      rows={4}
                    />
                    {errors.example_request && (
                      <p className="text-red-400 text-xs font-mono mt-1">{errors.example_request.message}</p>
                    )}
                  </div>

                  <div className="mt-6 p-4 bg-gradient-to-br from-blue-500/5 to-purple-500/5 border border-blue-500/20 rounded-lg">
                    <Label htmlFor="parameters" className="text-neon-white font-mono flex items-center gap-2 mb-2">
                      📥 Input Parameters (optional)
                      <HelpTooltip content="Define input fields that users fill before paying. This enables dynamic blinks with user-provided data (wallet addresses, text, amounts, etc.). Must be valid JSON array following Solana Actions spec." />
                    </Label>
                    <FormHelp>
                      If your API needs user input (like wallet address, token address, custom text), define parameters here. These create input fields on your Blink page.
                    </FormHelp>
                    <div className="bg-neon-dark border border-neon-blue-dark/30 rounded p-3 mb-2">
                      <p className="text-neon-grey font-mono text-xs mb-1">Example - Wallet Analyzer:</p>
                      <code className="text-neon-white font-mono text-xs block whitespace-pre">
{`[
  {
    "name": "wallet",
    "type": "text",
    "label": "Wallet Address",
    "required": true,
    "pattern": "^[1-9A-HJ-NP-Za-km-z]{32,44}$",
    "patternDescription": "Valid Solana address"
  }
]`}
                      </code>
                    </div>
                    <Textarea
                      id="parameters"
                      {...register("parameters")}
                      placeholder='[{"name": "wallet", "type": "text", "label": "Wallet Address", "required": true}]'
                      className="bg-neon-black border-blue-500/30 text-neon-white font-mono"
                      rows={6}
                    />
                    <p className="text-xs text-blue-400 font-mono mt-2">
                      💡 Supported types: text, number, email, url, textarea, checkbox
                    </p>
                    {errors.parameters && (
                      <p className="text-red-400 text-xs font-mono mt-1">{errors.parameters.message}</p>
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
              <StepNavigation
                currentStep={currentStep}
                totalSteps={3}
                isSubmitting={isSubmitting}
                onBack={handleBack}
                onNext={handleNext}
              />
            </form>
          </Card>
        </div>
      </section>
    </main>
  )
}

export default function CreateBlinkPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-neon-black flex items-center justify-center">
        <div className="text-neon-blue-light font-mono">Loading...</div>
      </div>
    }>
      <CreateBlinkPageContent />
    </Suspense>
  )
}
