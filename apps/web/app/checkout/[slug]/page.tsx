"use client"
import { useEffect, useState, Suspense } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { usePrivy, useWallets } from "@privy-io/react-auth"
import {
  Connection,
  PublicKey,
  VersionedTransaction,
} from "@solana/web3.js"
import { buildUsdcPaymentTransaction, applyB402Discount, getB402HolderTier, getTierDisplayInfo, type TokenHolderTier } from "@blink402/solana"
import NeonDivider from "@/components/NeonDivider"
import Lottie from "@/components/Lottie"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { WalletButton } from "@/components/wallet"
import WalletAnalysisResult from "@/components/WalletAnalysisResult"
import TokenPriceResult from "@/components/TokenPriceResult"
import { SlotMachine } from "@/components/SlotMachine"
import Link from "next/link"
import { getBlinkBySlug, getPaymentStatus, type PaymentStatus } from "@/lib/api"
import { logger } from "@/lib/logger"
import { retryFetch } from "@/lib/retry"
import type { BlinkData, SpinResult } from "@/lib/types"

// API configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// Solana network configuration
const SOLANA_NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'devnet'
  ? 'solana-devnet'
  : 'solana'

// Payment states
type PaymentState =
  | "idle"           // Initial state
  | "ready"          // Wallet connected, ready to pay
  | "paying"         // Payment in progress
  | "executing"      // Executing API call
  | "success"        // API executed successfully
  | "failed"         // Payment or API execution failed
  | "cancelled"      // User cancelled

function CheckoutPageContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const slug = (params.slug as string) || ""

  const { ready, authenticated, user } = usePrivy()
  const { wallets } = useWallets()

  // Get wallet address - prioritize Solana wallet for Solana payments
  const wallet = wallets[0]
  const solanaAccount: any = user?.linkedAccounts?.find(
    (account: any) => account.type === 'wallet' && account.chainType === 'solana'
  )
  // IMPORTANT: Prioritize Solana account for Solana payments
  const connectedWallet = (solanaAccount as any)?.address || wallet?.address
  const connected = authenticated && !!connectedWallet

  // Debug wallet connection
  useEffect(() => {
    if (ready && authenticated) {
      logger.info('Wallet connection debug:', {
        authenticated,
        walletsCount: wallets.length,
        connectedWallet,
        walletType: wallet?.walletClientType,
        hasSolanaAccount: !!solanaAccount
      })
    }
  }, [ready, authenticated, wallets, connectedWallet, wallet, solanaAccount])

  const [blink, setBlink] = useState<BlinkData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [paymentState, setPaymentState] = useState<PaymentState>("idle")
  const [requestBody, setRequestBody] = useState('{}')
  const [queryParams, setQueryParams] = useState<Record<string, string>>({})
  const [dynamicParams, setDynamicParams] = useState<Record<string, string>>({}) // For blink.parameters
  const [responseData, setResponseData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [txSignature, setTxSignature] = useState<string | null>(null)
  const [lastReference, setLastReference] = useState<string | null>(null)
  const [isCheckingStatus, setIsCheckingStatus] = useState(false)

  // B402 token holder state
  const [b402Tier, setB402Tier] = useState<TokenHolderTier>('NONE')
  const [finalPrice, setFinalPrice] = useState<number>(0)
  const [savings, setSavings] = useState(0)
  const [discountPercent, setDiscountPercent] = useState(0)

  useEffect(() => {
    // Fetch blink data from API
    if (slug) {
      getBlinkBySlug(slug).then((data) => {
        if (data) {
          setBlink(data)

          // Extract URL parameters from endpoint_url (e.g., {user_input}, {wallet})
          const urlParams: Record<string, string> = {}
          const matches = data.endpoint_url.match(/\{([^}]+)\}/g)
          if (matches) {
            matches.forEach((match) => {
              const paramName = match.replace(/[{}]/g, '')
              // Pre-fill from URL query params if available (e.g., ?wallet=abc123)
              urlParams[paramName] = searchParams.get(paramName) || ''
            })
            setQueryParams(urlParams)
          }

          // Initialize dynamic parameters from blink.parameters definition
          const params: any = {}
          const initialDynamicParams: Record<string, string> = {}

          if (data.parameters && data.parameters.length > 0) {
            // Dynamic parameter retrieval based on parameter definitions
            for (const param of data.parameters) {
              const storedValue = localStorage.getItem(`blink_param_${param.name}`)
              if (storedValue) {
                params[param.name] = storedValue
                initialDynamicParams[param.name] = storedValue
                logger.info(`Retrieved ${param.name} parameter from localStorage:`, storedValue)
              } else {
                // Initialize with empty string for user input
                initialDynamicParams[param.name] = ''
              }
            }
            setDynamicParams(initialDynamicParams)
          } else {
            // Legacy fallback for hardcoded parameters (backward compatibility)
            const walletParam = localStorage.getItem('blink_param_wallet')
            const tokenParam = localStorage.getItem('blink_param_token')
            const textParam = localStorage.getItem('blink_param_text')

            if (walletParam && (slug === 'wallet-tracker' || slug === 'wallet-analyzer')) {
              params.wallet = walletParam
              logger.info('Retrieved wallet parameter from localStorage (legacy):', walletParam)
            }
            if (tokenParam && slug === 'token-price') {
              params.tokenAddress = tokenParam
              logger.info('Retrieved token parameter from localStorage (legacy):', tokenParam)
            }
            if (textParam && slug === 'qr-code') {
              params.text = textParam
              logger.info('Retrieved text parameter from localStorage (legacy):', textParam)
            }
          }

          // If we have parameters, pre-fill the request body
          if (Object.keys(params).length > 0) {
            setRequestBody(JSON.stringify(params, null, 2))
          }
        } else {
          setError('Blink not found')
        }
      }).catch((err) => {
        logger.error('Failed to load blink:', err)
        setError(err.message || 'Failed to load blink')
      }).finally(() => {
        setIsLoading(false)
      })
    } else {
      setError('No blink specified')
      setIsLoading(false)
    }
  }, [slug, searchParams])

  // Fetch B402 holder tier and apply discount when wallet connects and blink loads
  useEffect(() => {
    const fetchB402Discount = async () => {
      if (!connected || !connectedWallet || !blink) {
        // Reset to no tier if wallet disconnects or no blink
        setB402Tier('NONE')
        setFinalPrice(blink ? Number(blink.price_usdc) : 0)
        setSavings(0)
        setDiscountPercent(0)
        return
      }

      const basePrice = Number(blink.price_usdc)

      try {
        logger.info('Fetching B402 holder tier for wallet:', connectedWallet)

        // Get tier and apply discount
        const discount = await applyB402Discount(basePrice, connectedWallet, 'blinks')

        logger.info('B402 blink discount applied:', {
          tier: discount.tier,
          originalPrice: discount.originalPrice,
          discountedPrice: discount.discountedPrice,
          savings: discount.savings,
          discountPercent: discount.discountPercent
        })

        setB402Tier(discount.tier)
        setFinalPrice(discount.discountedPrice)
        setSavings(discount.savings)
        setDiscountPercent(discount.discountPercent)
      } catch (err) {
        logger.error('Failed to fetch B402 tier:', err)
        // Fail gracefully - use base price
        setB402Tier('NONE')
        setFinalPrice(basePrice)
        setSavings(0)
        setDiscountPercent(0)
      }
    }

    fetchB402Discount()
  }, [connected, connectedWallet, blink])

  // Update state when wallet connects/disconnects
  useEffect(() => {
    if (connected && ready && paymentState === "idle") {
      setPaymentState("ready")
    } else if (!connected) {
      // Reset payment state on wallet disconnect
      if (paymentState !== "idle" && paymentState !== "success") {
        setPaymentState("idle")
        setError("Wallet disconnected. Please reconnect to continue.")
        setTxSignature(null)
        setResponseData(null)
      }
    }
  }, [connected, ready, paymentState])

  // ONCHAIN x402 payment flow with manual transaction building
  const handlePay = async () => {
    if (!blink || !connected || !ready || !connectedWallet) {
      setError("Please connect your wallet first")
      return
    }

    setPaymentState("paying")
    setError(null)

    try {
      // Parse request body
      let requestData
      try {
        requestData = JSON.parse(requestBody)
      } catch {
        requestData = {}
      }

      // Get the ACTUAL connected wallet from window.solana (not Privy's cached address)
      // @ts-ignore
      const solana = window.solana || window.phantom?.solana

      if (!solana || !solana.publicKey) {
        throw new Error(
          "No Solana wallet connected. Please ensure Phantom, Solflare, or another Solana wallet is installed and connected."
        )
      }

      logger.info('Building Solana USDC transaction...', { privyWallet: connectedWallet })

      // Use the wallet's actual public key (this is guaranteed to be on-curve)
      const actualWalletAddress = solana.publicKey.toBase58()
      logger.info('Using actual wallet address from window.solana:', { actualWalletAddress, privyAddress: connectedWallet })

      // Verify they match (warn if different)
      if (actualWalletAddress !== connectedWallet) {
        logger.warn('Wallet address mismatch! Using window.solana address instead of Privy address', {
          windowSolana: actualWalletAddress,
          privyAddress: connectedWallet
        })
      }

      // Setup Solana connection
      const connection = new Connection(
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
        "confirmed"
      )

      const payer = solana.publicKey  // Use the actual PublicKey object from wallet

      // Validate merchant address before creating PublicKey
      let merchant: PublicKey
      try {
        merchant = new PublicKey(blink.payout_wallet)
        logger.info('Merchant address:', { address: merchant.toBase58() })
      } catch (err) {
        logger.error('Invalid merchant payout_wallet address:', {
          payoutWallet: blink.payout_wallet,
          blinkSlug: blink.slug,
          error: err
        })
        throw new Error(`Invalid merchant address for this blink: ${blink.payout_wallet}. Please contact the blink creator.`)
      }

      const amountUsdc = finalPrice || Number(blink.price_usdc) // Use discounted price if B402 holder, fallback to base price

      logger.info('Building payment transaction with B402 discount:', {
        originalPrice: Number(blink.price_usdc),
        finalPrice: amountUsdc,
        tier: b402Tier,
        savings: savings
      })

      // Build USDC payment transaction using shared utility
      // This creates a VersionedTransaction with exactly 3 instructions:
      // 1. ComputeBudgetProgram.setComputeUnitLimit (40,000 units)
      // 2. ComputeBudgetProgram.setComputeUnitPrice (1 microlamport)
      // 3. SPL Token Transfer (USDC from payer to merchant)
      // Uses PayAI fee payer to prevent Phantom Lighthouse MEV injection
      const transaction = await buildUsdcPaymentTransaction({
        connection,
        payer,
        merchant,
        amountUsdc,
        network: SOLANA_NETWORK === 'solana-devnet' ? 'devnet' : 'mainnet-beta'
      })

      logger.info('Requesting wallet signature...')

      // Sign transaction with user's wallet (using the solana instance from earlier)
      let signedTx: VersionedTransaction
      try {
        signedTx = await solana.signTransaction(transaction)
      } catch (signError: any) {
        if (signError.message?.includes('rejected') || signError.message?.includes('denied')) {
          throw new Error('Transaction rejected by user')
        }
        throw new Error(`Failed to sign transaction: ${signError.message}`)
      }

      logger.info('Transaction signed successfully')

      // Serialize and encode transaction
      // NOTE: Do NOT broadcast here! ONCHAIN /v1/settle handles broadcasting
      // The transaction needs PayAI's fee payer signature first (added during settlement)
      const base64Tx = Buffer.from(signedTx.serialize()).toString('base64')

      // Build x402 payment payload (ONCHAIN format)
      const paymentPayload = {
        x402Version: 1,
        scheme: 'exact',
        network: 'solana',
        payload: {
          transaction: base64Tx
        }
      }

      const xPaymentHeader = btoa(JSON.stringify(paymentPayload))

      logger.info('Sending payment and executing API call with ONCHAIN x402...')
      setPaymentState("executing")

      // Generate unique reference for tracking this payment
      const reference = crypto.randomUUID()
      setLastReference(reference) // Store for status checking later

      // Single-step flow: Backend handles verify+settle+execute all at once
      // ✨ Using retryFetch with exponential backoff for transient failures

      // DEBUG: Log the queryParams being sent
      logger.info('🔍 DEBUG: queryParams state:', queryParams)
      logger.info('🔍 DEBUG: dynamicParams state:', dynamicParams)

      // Merge requestData with dynamicParams (dynamic params take precedence)
      const mergedData = { ...requestData, ...dynamicParams }

      const requestPayload = {
        ...mergedData,
        reference, // Include reference for backend tracking
        _urlParams: queryParams, // URL placeholder replacements (e.g., {user_input})
      }
      logger.info('🔍 DEBUG: Full request payload:', requestPayload)

      const apiRes = await retryFetch(
        `${API_BASE_URL}/bazaar/${slug}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Payment': xPaymentHeader,  // Backend will verify+settle this payment
          },
          body: JSON.stringify(requestPayload),
        },
        {
          maxRetries: 3,
          initialDelayMs: 1000,
          onRetry: (attempt, error, delayMs) => {
            logger.warn(`Payment API call failed, retrying (${attempt}/3)...`, {
              error: error.message,
              delayMs,
              slug
            })
          }
        }
      )

      // Handle 402 Payment Required specially
      if (apiRes.status === 402) {
        logger.error('Payment verification failed - transaction not confirmed on-chain')
        throw new Error('Payment verification failed. Please ensure your transaction has been confirmed on the blockchain.')
      }

      if (!apiRes.ok) {
        const errorData = await apiRes.json()
        logger.error('API execution failed:', errorData)
        throw new Error(errorData.error || `API execution failed (${apiRes.status})`)
      }

      const result = await apiRes.json()
      logger.info('✅ API executed successfully!', result)

      // Set transaction signature (we already have it from broadcast)
      setTxSignature(txSignature)
      logger.info('Transaction hash:', txSignature)

      setResponseData(result.data || result)
      setPaymentState("success")

    } catch (err) {
      logger.error('Payment error:', err)

      // Better error messages for common issues
      let errorMessage = "Payment or execution failed"
      if (err instanceof Error) {
        if (err.message.includes('rejected') || err.message.includes('denied')) {
          errorMessage = "Transaction rejected by user"
        } else if (err.message.includes('Insufficient')) {
          errorMessage = err.message
        } else if (err.message.includes('USDC')) {
          errorMessage = err.message
        } else {
          errorMessage = err.message
        }
      }

      setError(errorMessage)
      setPaymentState("failed")
    }
  }

  // Check if a payment with the last reference actually succeeded
  const checkPaymentStatus = async () => {
    if (!lastReference) {
      setError("No payment reference to check")
      return
    }

    setIsCheckingStatus(true)
    try {
      logger.info('Checking payment status for reference:', lastReference)
      const status = await getPaymentStatus(lastReference)

      if (!status) {
        setError("Payment not found. The reference may be invalid or expired.")
        return
      }

      logger.info('Payment status:', status.status)

      if (status.status === 'executed') {
        // Payment succeeded! Show success state
        setResponseData({ message: 'Payment already completed successfully' })
        setPaymentState("success")
        setError(null)
        if (status.signature) {
          setTxSignature(status.signature)
        }
      } else if (status.status === 'paid') {
        setError(`Payment is paid but not yet executed. Status: ${status.status}`)
      } else if (status.status === 'failed') {
        setError(`Payment failed: ${status.error_message || 'Unknown error'}`)
      } else {
        setError(`Payment is pending. Current status: ${status.status}`)
      }
    } catch (err) {
      logger.error('Error checking payment status:', err)
      setError(err instanceof Error ? err.message : "Failed to check payment status")
    } finally {
      setIsCheckingStatus(false)
    }
  }

  const handleCancel = () => {
    setPaymentState("cancelled")
    setTimeout(() => {
      router.push(`/blink/${slug}`)
    }, 1500)
  }

  const handleReset = () => {
    setPaymentState("ready")
    setError(null)
    setResponseData(null)
    setTxSignature(null)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neon-black flex items-center justify-center">
        <div className="text-center">
          <Lottie src="/lottie/Loading (Neon spinning).lottie" autoplay loop width={64} height={64} />
          <p className="text-neon-grey font-mono text-sm mt-4">Loading...</p>
        </div>
      </div>
    )
  }

  if (error && !blink) {
    return (
      <div className="min-h-screen bg-neon-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-red-500/20 border border-red-500 flex items-center justify-center mx-auto mb-4">
            <span className="text-red-500 text-4xl">✕</span>
          </div>
          <h1 className="text-2xl font-mono text-neon-white mb-4">
            {error || 'Blink not found'}
          </h1>
          <Link href="/catalog">
            <Button variant="outline" className="font-mono">
              ← Back to Catalog
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  if (!blink) {
    return (
      <div className="min-h-screen bg-neon-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-red-500/20 border border-red-500 flex items-center justify-center mx-auto mb-4">
            <span className="text-red-500 text-4xl">✕</span>
          </div>
          <h1 className="text-2xl font-mono text-neon-white mb-4">Blink not found</h1>
          <Link href="/catalog">
            <Button variant="outline" className="font-mono">
              ← Back to Catalog
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // Lottery blinks should use the dedicated lottery page
  if (blink.lottery_enabled || slug.includes('lottery')) {
    return (
      <div className="min-h-screen bg-neon-black flex items-center justify-center">
        <div className="max-w-md text-center px-6">
          <div className="w-20 h-20 rounded-full bg-yellow-500/20 border border-yellow-500 flex items-center justify-center mx-auto mb-4">
            <span className="text-yellow-500 text-4xl">⚠</span>
          </div>
          <h1 className="text-2xl font-mono text-neon-white mb-4">Lottery Blink Detected</h1>
          <p className="text-neon-grey font-mono text-sm mb-6 leading-relaxed">
            This is a lottery blink and requires the dedicated lottery interface for proper ticket tracking and round management.
            Please use the button below to access the correct page.
          </p>
          <div className="space-y-3">
            <Button
              onClick={() => {
                const lotteryUrl = `/lottery/${slug}`
                router.push(lotteryUrl)
                // Fallback to window.location if router doesn't work
                setTimeout(() => {
                  if (window.location.pathname !== lotteryUrl) {
                    window.location.href = lotteryUrl
                  }
                }, 100)
              }}
              className="w-full bg-neon-blue-light hover:bg-neon-blue-dark text-neon-black font-mono font-bold"
            >
              Go to Lottery Page →
            </Button>
            <Link href="/catalog" className="block">
              <Button variant="outline" className="w-full font-mono">
                ← Back to Catalog
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-neon-black">
      <section className="px-4 sm:px-6 py-6 sm:py-8">
        <div className="max-w-5xl mx-auto">
          {/* Breadcrumb */}
          <div className="mb-6 sm:mb-8">
            <Link href={`/blink/${slug}`} className="text-neon-blue-light hover:text-neon-blue-dark font-mono text-xs sm:text-sm">
              ← Back to {blink.title}
            </Link>
          </div>

          {/* Header */}
          <header className="mb-8 sm:mb-12">
            <h1 className="font-sans text-neon-white mb-3 sm:mb-4 text-2xl sm:text-3xl md:text-4xl">
              Checkout
            </h1>
            <p className="text-neon-grey font-mono text-sm sm:text-base">Complete payment to execute API call</p>
          </header>

          <div className="grid lg:grid-cols-2 gap-6 sm:gap-8">
            {/* Left: Blink Info & Request */}
            <div className="space-y-4 sm:space-y-6">
              {/* Blink Card */}
              <Card className="bg-neon-dark border-neon-blue-dark/20 p-4 sm:p-6">
                <div className="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-6">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-neon-black border border-neon-blue-dark/30 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-neon font-mono text-xl sm:text-2xl">⚡</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
                      <h3 className="text-neon-white font-mono text-base sm:text-lg">{blink.title}</h3>
                      <Badge className="bg-neon-blue-dark/20 text-neon-blue-light border-neon-blue-dark/30 text-xs">
                        {blink.category}
                      </Badge>
                    </div>
                    <p className="text-neon-grey font-mono text-xs sm:text-sm">{blink.description}</p>
                  </div>
                </div>

                <NeonDivider className="my-3 sm:my-4" />

                <div className="space-y-2 sm:space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-neon-grey font-mono text-xs sm:text-sm">Price</span>
                    {savings > 0 ? (
                      <div className="flex items-center gap-2">
                        <span className="text-neon-grey font-mono text-xs line-through">${blink.price_usdc}</span>
                        <span className="text-neon-white font-mono font-bold text-sm sm:text-base">
                          ${finalPrice.toFixed(2)} USDC
                        </span>
                        <span className="text-green-400 font-mono text-xs">(-{discountPercent}%)</span>
                      </div>
                    ) : (
                      <span className="text-neon-white font-mono font-bold text-sm sm:text-base">
                        ${blink.price_usdc} USDC
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-neon-grey font-mono text-xs sm:text-sm">Network</span>
                    <Badge variant="outline" className="border-neon-blue-dark/30 text-neon-blue-light text-xs">
                      Solana
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-neon-grey font-mono text-xs sm:text-sm">Payment Method</span>
                    <span className="text-neon-blue-light font-mono text-xs sm:text-sm">ONCHAIN x402</span>
                  </div>
                </div>
              </Card>

              {/* URL Parameters (for GET requests with placeholders) */}
              {Object.keys(queryParams).length > 0 && (
                <Card className="bg-neon-dark border-neon-blue-dark/20 p-4 sm:p-6">
                  <div className="space-y-3 sm:space-y-4">
                    <div>
                      <Label className="text-neon-white font-mono text-xs sm:text-sm mb-3 block">
                        URL Parameters
                      </Label>
                      <div className="space-y-3">
                        {Object.keys(queryParams).map((paramName) => (
                          <div key={paramName}>
                            <Label htmlFor={`param-${paramName}`} className="text-neon-grey font-mono text-xs mb-1.5 block">
                              {paramName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                            </Label>
                            <input
                              id={`param-${paramName}`}
                              type="text"
                              value={queryParams[paramName]}
                              onChange={(e) => setQueryParams({ ...queryParams, [paramName]: e.target.value })}
                              placeholder={
                                paramName === 'user_input'
                                  ? 'Enter text or URL to encode...'
                                  : `Enter ${paramName}...`
                              }
                              className="w-full px-3 py-2 font-mono text-xs sm:text-sm bg-neon-black border border-neon-blue-dark/30 text-neon-white rounded focus:outline-none focus:border-neon-blue-light"
                              disabled={paymentState !== "idle" && paymentState !== "ready"}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="text-neon-grey/70 font-mono text-xs">
                      {blink?.method === 'GET'
                        ? 'These parameters will be added to the URL query string'
                        : 'These parameters will replace placeholders in the endpoint URL'}
                    </p>
                  </div>
                </Card>
              )}

              {/* Dynamic Parameters (from blink.parameters) */}
              {blink?.parameters && blink.parameters.length > 0 && (
                <Card className="bg-neon-dark border-neon-blue-dark/20 p-4 sm:p-6">
                  <div className="space-y-3 sm:space-y-4">
                    <div>
                      <Label className="text-neon-white font-mono text-xs sm:text-sm mb-3 block">
                        Parameters
                      </Label>
                      <div className="space-y-3">
                        {blink.parameters.map((param: any) => (
                          <div key={param.name}>
                            <Label htmlFor={`dynamic-param-${param.name}`} className="text-neon-grey font-mono text-xs mb-1.5 block">
                              {param.label || param.name}
                              {param.required && <span className="text-red-400 ml-1">*</span>}
                            </Label>
                            {param.type === 'textarea' ? (
                              <Textarea
                                id={`dynamic-param-${param.name}`}
                                value={dynamicParams[param.name] || ''}
                                onChange={(e) => setDynamicParams({ ...dynamicParams, [param.name]: e.target.value })}
                                placeholder={param.placeholder || `Enter ${param.name}...`}
                                className="font-mono text-xs sm:text-sm h-24 bg-neon-black border-neon-blue-dark/30 text-neon-white"
                                disabled={paymentState !== "idle" && paymentState !== "ready"}
                                maxLength={param.max}
                              />
                            ) : (
                              <input
                                id={`dynamic-param-${param.name}`}
                                type={param.type === 'number' ? 'number' : 'text'}
                                value={dynamicParams[param.name] || ''}
                                onChange={(e) => setDynamicParams({ ...dynamicParams, [param.name]: e.target.value })}
                                placeholder={param.placeholder || `Enter ${param.name}...`}
                                className="w-full px-3 py-2 font-mono text-xs sm:text-sm bg-neon-black border border-neon-blue-dark/30 text-neon-white rounded focus:outline-none focus:border-neon-blue-light"
                                disabled={paymentState !== "idle" && paymentState !== "ready"}
                                min={param.min}
                                max={param.max}
                              />
                            )}
                            {param.patternDescription && (
                              <p className="text-neon-grey/70 font-mono text-xs mt-1">
                                {param.patternDescription}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* Request Body (for POST/PUT requests) */}
              {blink?.method !== 'GET' && (
                <Card className="bg-neon-dark border-neon-blue-dark/20 p-4 sm:p-6">
                  <div className="space-y-3 sm:space-y-4">
                    <div>
                      <Label htmlFor="request-body" className="text-neon-white font-mono text-xs sm:text-sm mb-2 block">
                        Request Body (JSON)
                      </Label>
                      <Textarea
                        id="request-body"
                        value={requestBody}
                        onChange={(e) => setRequestBody(e.target.value)}
                        placeholder='{"param": "value"}'
                        className="font-mono text-xs sm:text-sm h-24 sm:h-32 bg-neon-black border-neon-blue-dark/30 text-neon-white"
                        disabled={paymentState !== "idle" && paymentState !== "ready"}
                      />
                    </div>
                    <p className="text-neon-grey/70 font-mono text-xs">
                      Customize the request parameters for the API endpoint
                    </p>
                  </div>
                </Card>
              )}
            </div>

            {/* Right: Payment Status & Actions */}
            <div className="space-y-4 sm:space-y-6">
              {/* B402 Tier Badge */}
              {connected && b402Tier !== 'NONE' && (
                <Card className="bg-green-900/20 border-green-500/60 p-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{getTierDisplayInfo(b402Tier).icon}</span>
                    <div className="flex-1">
                      <div className="text-green-400 font-mono text-sm font-bold">{getTierDisplayInfo(b402Tier).label}</div>
                      <div className="text-green-300 font-mono text-xs">
                        {savings > 0 && `Save ${savings.toFixed(4)} USDC with your ${discountPercent}% discount!`}
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* Wallet Status */}
              {!connected && (
                <Alert className="bg-neon-blue-dark/10 border-neon-blue-dark/30">
                  <AlertDescription className="text-neon-white font-mono text-xs sm:text-sm">
                    Connect your wallet to continue
                  </AlertDescription>
                </Alert>
              )}

              {/* Error Alert */}
              {error && (
                <Alert className="bg-red-500/10 border-red-500/30">
                  <AlertDescription className="text-red-400 font-mono text-xs sm:text-sm">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              {/* Success State */}
              {paymentState === "success" && slug === "slot-machine" && (
                <div className="space-y-4">
                  {/* Payment Success Alert */}
                  <Alert className="bg-green-500/10 border-green-500/30">
                    <AlertDescription className="text-green-400 font-mono text-xs sm:text-sm">
                      ✓ Payment successful! Time to spin...
                    </AlertDescription>
                  </Alert>

                  {/* Slot Machine Component */}
                  <SlotMachine
                    onSpin={async () => {
                      try {
                        // Call backend slots API with payment reference
                        const response = await fetch(`${API_BASE_URL}/api/slots/spin`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            reference: lastReference || '',
                            payer: connectedWallet || '',
                          }),
                        })

                        if (!response.ok) {
                          const errorData = await response.json()
                          throw new Error(errorData.error || 'Spin failed')
                        }

                        const spinResult: SpinResult = await response.json()
                        return spinResult
                      } catch (error) {
                        logger.error('Spin failed:', error)
                        throw error
                      }
                    }}
                  />

                  {/* Back to Landing Button */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => router.push('/slot-machine')}
                      className="flex-1 font-mono text-xs sm:text-sm bg-neon-blue-dark hover:bg-neon-blue-light"
                    >
                      Back to Slot Machine
                    </Button>
                  </div>
                </div>
              )}

              {paymentState === "success" && slug !== "slot-machine" && responseData && (
                <Card className="bg-neon-dark border-green-500/30 p-4 sm:p-6">
                  <div className="mb-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-full bg-green-500/20 border border-green-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-green-500 text-2xl">✓</span>
                      </div>
                      <div>
                        <h3 className="text-green-400 font-mono font-bold text-base sm:text-lg">Payment Successful</h3>
                        <p className="text-neon-grey font-mono text-xs sm:text-sm">API executed successfully</p>
                      </div>
                    </div>

                    {txSignature && (
                      <div className="mt-3 p-3 bg-neon-black/50 rounded border border-neon-blue-dark/20">
                        <p className="text-neon-grey font-mono text-xs mb-1">Transaction</p>
                        <a
                          href={`https://explorer.solana.com/tx/${txSignature}${SOLANA_NETWORK === 'solana-devnet' ? '?cluster=devnet' : ''}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-neon-blue-light hover:text-neon-blue-dark font-mono text-xs break-all underline"
                        >
                          {txSignature}
                        </a>
                      </div>
                    )}
                  </div>

                  <NeonDivider className="my-4" />

                  {/* Output Section - Clearly labeled */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 p-3 bg-green-500/10 border-2 border-dashed border-green-500/40 rounded-lg">
                      <span className="text-sm font-mono text-green-400 font-bold">📤 API OUTPUT</span>
                    </div>

                    {/* Wallet Analysis Output */}
                    {(slug === 'wallet-tracker' || slug === 'wallet-analyzer') && responseData && (
                      <WalletAnalysisResult data={responseData.data || responseData} />
                    )}

                    {/* Token Price Output */}
                    {slug === 'token-price' && responseData.data && (
                      <TokenPriceResult
                        data={{
                          ...responseData.data,
                          timestamp: responseData.timestamp
                        }}
                      />
                    )}

                    {/* QR Code Output */}
                    {slug === 'qr-code' && responseData.data && (
                      <div className="space-y-4">
                        <div className="p-6 bg-neon-dark border border-neon-grey/20 rounded-lg">
                          <h4 className="text-lg text-neon-white mb-4">Generated QR Code</h4>

                          <div className="flex justify-center mb-4">
                            <img
                              src={responseData.data.qrCode}
                              alt="Generated QR Code"
                              className="max-w-full h-auto rounded border-4 border-neon-blue-dark/40"
                              style={{ maxWidth: '400px' }}
                            />
                          </div>

                          <div className="space-y-3 text-sm">
                            <div>
                              <div className="text-neon-grey mb-1">Encoded Text</div>
                              <div className="p-3 bg-black/30 rounded text-neon-white font-mono break-all">
                                {responseData.data.textPreview}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <div className="text-neon-grey mb-1">Size</div>
                                <div className="text-neon-white">{responseData.data.size}x{responseData.data.size}px</div>
                              </div>
                              <div>
                                <div className="text-neon-grey mb-1">Format</div>
                                <div className="text-neon-white uppercase">{responseData.data.format}</div>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 pt-4 border-t border-neon-grey/20">
                            <a
                              href={responseData.data.qrCode}
                              download={`qr-code-${Date.now()}.png`}
                              className="block w-full text-center py-2 px-4 bg-neon-blue-dark hover:bg-neon-blue-light text-neon-black font-mono font-bold rounded transition-colors"
                            >
                              Download QR Code
                            </a>
                          </div>
                        </div>

                        <div className="text-center text-xs text-neon-grey font-mono">
                          Generated at {new Date(responseData.timestamp).toLocaleString()}
                        </div>
                      </div>
                    )}

                    {/* Generic JSON Output (fallback for other blinks) */}
                    {slug !== 'wallet-tracker' && slug !== 'wallet-analyzer' && slug !== 'token-price' && slug !== 'qr-code' && (
                      <div className="p-4 bg-neon-black/50 rounded border border-neon-grey/20">
                        <pre className="text-xs text-neon-white font-mono overflow-x-auto">
                          {JSON.stringify(responseData, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex gap-2">
                    <Button
                      onClick={handleReset}
                      variant="outline"
                      className="flex-1 font-mono text-xs sm:text-sm"
                    >
                      Try Again
                    </Button>
                    <Button
                      onClick={() => router.push(`/blink/${slug}`)}
                      className="flex-1 font-mono text-xs sm:text-sm bg-neon-blue-dark hover:bg-neon-blue-light"
                    >
                      Back to Blink
                    </Button>
                  </div>
                </Card>
              )}

              {/* Payment Actions */}
              {paymentState !== "success" && (
                <Card className="bg-neon-dark border-neon-blue-dark/20 p-4 sm:p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-neon-white font-mono text-sm sm:text-base">Total</span>
                      {savings > 0 ? (
                        <div className="text-right">
                          <div className="text-neon-grey font-mono text-xs line-through">${blink.price_usdc}</div>
                          <div className="text-neon-blue-light font-mono font-bold text-xl sm:text-2xl">
                            ${finalPrice.toFixed(2)}
                          </div>
                          <div className="text-green-400 font-mono text-xs">Save ${savings.toFixed(4)}</div>
                        </div>
                      ) : (
                        <span className="text-neon-blue-light font-mono font-bold text-xl sm:text-2xl">
                          ${finalPrice > 0 ? finalPrice.toFixed(2) : blink.price_usdc}
                        </span>
                      )}
                    </div>

                    <NeonDivider />

                    <div className="space-y-2 sm:space-y-3">
                      {!connected && (
                        <WalletButton variant="default" className="w-full" />
                      )}

                      {connected && paymentState === "ready" && (
                        <Button
                          onClick={handlePay}
                          className="w-full bg-neon-blue-dark hover:bg-neon-blue-light font-mono text-sm sm:text-base h-11 sm:h-12"
                        >
                          Pay ${finalPrice > 0 ? finalPrice.toFixed(2) : blink.price_usdc} USDC{savings > 0 ? ` (-${discountPercent}%)` : ''}
                        </Button>
                      )}

                      {paymentState === "paying" && (
                        <div className="w-full">
                          <Button
                            disabled
                            className="w-full bg-neon-blue-dark font-mono text-sm sm:text-base h-11 sm:h-12"
                          >
                            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                            Confirming Payment on Solana...
                          </Button>
                          <div className="mt-2 text-center">
                            <p className="text-xs text-neon-grey font-mono">
                              ⏱️ Waiting for blockchain confirmation (2-6s typical)
                            </p>
                          </div>
                        </div>
                      )}

                      {paymentState === "executing" && (
                        <div className="w-full">
                          <Button
                            disabled
                            className="w-full bg-neon-blue-dark font-mono text-sm sm:text-base h-11 sm:h-12"
                          >
                            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                            {slug === "wallet-tracker"
                              ? "Analyzing Wallet Data..."
                              : "Executing API Call..."
                            }
                          </Button>
                          <div className="mt-2 text-center">
                            <p className="text-xs text-neon-grey font-mono">
                              {slug === "wallet-tracker"
                                ? "🔍 Fetching on-chain data (1-2s typical)"
                                : "⚡ Processing your request..."
                              }
                            </p>
                          </div>
                        </div>
                      )}

                      {paymentState === "failed" && (
                        <div className="flex flex-col gap-3 w-full">
                          {error && (
                            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded">
                              <div className="flex items-start gap-3">
                                <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div className="flex-1">
                                  <h4 className="text-red-400 font-mono font-bold text-sm mb-1">Payment Failed</h4>
                                  <p className="text-red-300 font-mono text-xs leading-relaxed">{error}</p>
                                </div>
                              </div>
                            </div>
                          )}
                          {lastReference && (
                            <Button
                              onClick={checkPaymentStatus}
                              disabled={isCheckingStatus}
                              className="w-full bg-yellow-600 hover:bg-yellow-700 font-mono text-sm sm:text-base h-11 sm:h-12"
                            >
                              {isCheckingStatus ? (
                                <>
                                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                  Checking Status...
                                </>
                              ) : (
                                "Check Payment Status"
                              )}
                            </Button>
                          )}
                          <Button
                            onClick={handleReset}
                            className="w-full bg-red-500 hover:bg-red-600 font-mono text-sm sm:text-base h-11 sm:h-12"
                          >
                            Try Again
                          </Button>
                        </div>
                      )}

                      {paymentState === "cancelled" && (
                        <div className="text-center py-4">
                          <p className="text-neon-grey font-mono text-sm">Cancelled. Redirecting...</p>
                        </div>
                      )}

                      {(paymentState === "ready" || paymentState === "failed") && (
                        <Button
                          onClick={handleCancel}
                          variant="outline"
                          className="w-full font-mono text-xs sm:text-sm"
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              )}

              {/* Payment Info */}
              <Card className="bg-neon-dark/50 border-neon-blue-dark/20 p-4">
                <h4 className="text-neon-white font-mono text-xs sm:text-sm font-bold mb-2">Payment Details</h4>
                <ul className="space-y-1 text-neon-grey font-mono text-xs">
                  <li>• Powered by ONCHAIN Connect</li>
                  <li>• Automatic verification & settlement</li>
                  <li>• 2.1s average settlement time</li>
                  <li>• Multi-facilitator routing</li>
                </ul>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-neon-black flex items-center justify-center">
        <Lottie src="/lottie/Loading (Neon spinning).lottie" autoplay loop width={64} height={64} />
      </div>
    }>
      <CheckoutPageContent />
    </Suspense>
  )
}
