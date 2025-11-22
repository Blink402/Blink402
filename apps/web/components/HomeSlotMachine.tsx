"use client"

import { useEffect, useState } from "react"
import { usePrivy, useWallets } from "@privy-io/react-auth"
import { cn } from "@/lib/utils"
import { SlotMachine } from "@/components/SlotMachine"
import type { SpinResult } from "@blink402/types"
import {
  PublicKey,
  Connection,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
} from '@solana/web3.js'
import {
  getAssociatedTokenAddress,
  createTransferCheckedInstruction,
  getAccount,
} from '@solana/spl-token'

const API_BASE_URL = ''
const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
const USDC_DECIMALS = 6
const PAYAI_FEE_PAYER = new PublicKey('2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4')

type GameState = 'idle' | 'paying' | 'ready-to-spin' | 'error'

interface BlinkData {
  id: string
  slug: string
  title: string
  description: string
  price_usdc: string
  payout_wallet: string
  payment_token: 'SOL' | 'USDC'
  payment_mode: 'charge' | 'reward'
}

export function HomeSlotMachine() {
  const { ready, authenticated, login, user } = usePrivy()
  const { wallets } = useWallets()
  const [gameState, setGameState] = useState<GameState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lastReference, setLastReference] = useState<string | null>(null)
  const [xPaymentHeader, setXPaymentHeader] = useState<string | null>(null)
  const [isSpinning, setIsSpinning] = useState(false)
  const [blink, setBlink] = useState<BlinkData | null>(null)

  const wallet = wallets[0]
  const solanaAccount: any = user?.linkedAccounts?.find(
    (account: any) => account.type === 'wallet' && account.chainType === 'solana'
  )
  const connectedWallet = (solanaAccount as any)?.address || wallet?.address
  const connected = authenticated && !!connectedWallet

  // Fetch blink data on mount
  useEffect(() => {
    fetch(`${API_BASE_URL}/blinks/slot-machine`)
      .then(res => res.json())
      .then(data => {
        const blinkData = data.data || data.blink
        if (blinkData) {
          setBlink(blinkData)
        } else {
          setError('Failed to load slot machine')
        }
      })
      .catch(() => {
        setError('Failed to load slot machine')
      })
  }, [])

  const handlePlayNow = async () => {
    if (!ready) return

    if (!authenticated) {
      login()
      return
    }

    if (!connected) {
      setError('No Solana wallet found. Please reconnect.')
      return
    }

    await handlePayment()
  }

  const handlePayment = async () => {
    setGameState('paying')
    setError(null)

    try {
      if (!authenticated) {
        throw new Error('Wallet not authenticated')
      }

      if (!connectedWallet) {
        throw new Error('Wallet not connected')
      }

      if (!blink) {
        throw new Error('Slot machine data not loaded')
      }

      // @ts-ignore
      const solana = window.solana || window.phantom?.solana

      if (!solana || !solana.publicKey) {
        throw new Error("No Solana wallet found")
      }

      const connection = new Connection(SOLANA_RPC_URL, 'confirmed')
      const payer = solana.publicKey
      const merchant = new PublicKey(blink.payout_wallet)

      const amountUsdc = 0.10
      const amountAtomic = BigInt(Math.round(amountUsdc * 1_000_000))

      const payerATA = await getAssociatedTokenAddress(USDC_MINT, payer)
      const merchantATA = await getAssociatedTokenAddress(USDC_MINT, merchant)

      // Verify payer has enough USDC
      try {
        const payerAccount = await getAccount(connection, payerATA)
        const balance = Number(payerAccount.amount) / 1_000_000

        if (balance < amountUsdc) {
          throw new Error(`Insufficient USDC. You have ${balance.toFixed(2)} USDC but need ${amountUsdc} USDC.`)
        }
      } catch (err: any) {
        if (err.message.includes('could not find')) {
          throw new Error('No USDC account found. Please add USDC to your wallet first.')
        }
        throw err
      }

      const { blockhash } = await connection.getLatestBlockhash('confirmed')

      const instructions = [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 40_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
        createTransferCheckedInstruction(
          payerATA,
          USDC_MINT,
          merchantATA,
          payer,
          BigInt(amountAtomic.toString()),
          USDC_DECIMALS
        )
      ]

      const messageV0 = new TransactionMessage({
        payerKey: PAYAI_FEE_PAYER,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message()

      const transaction = new VersionedTransaction(messageV0)

      // @ts-ignore
      const signedTx = await solana.signTransaction(transaction)
      const base64Tx = Buffer.from(signedTx.serialize()).toString('base64')

      const paymentPayload = {
        x402Version: 1,
        scheme: 'exact',
        network: 'solana',
        payload: {
          transaction: base64Tx
        }
      }

      const xPaymentHeader = btoa(JSON.stringify(paymentPayload))
      const reference = crypto.randomUUID()

      setLastReference(reference)
      setXPaymentHeader(xPaymentHeader)
      setGameState('ready-to-spin')

    } catch (err: any) {
      console.error('Payment error:', err)
      setError(err.message || 'Payment failed')
      setGameState('error')
    }
  }

  const handleSpin = async (): Promise<SpinResult> => {
    if (isSpinning) {
      throw new Error('Spin already in progress')
    }

    setIsSpinning(true)
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      if (xPaymentHeader) {
        headers['X-Payment'] = xPaymentHeader
      }

      const response = await fetch(`${API_BASE_URL}/api/slots/spin`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          reference: lastReference || '',
          payer: connectedWallet || '',
        }),
      })

      if (!response.ok) {
        let errorMessage = 'Spin failed'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorData.details || errorMessage
        } catch {
          errorMessage = `Spin failed: ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      let spinResult: SpinResult
      try {
        spinResult = await response.json()

        if (!spinResult.success || !spinResult.reels) {
          throw new Error('Invalid spin result format')
        }
      } catch (parseError) {
        throw new Error('Invalid response from server')
      }

      return spinResult
    } catch (err) {
      throw err
    } finally {
      setIsSpinning(false)
    }
  }

  const handlePlayAgain = async () => {
    setLastReference(null)
    setXPaymentHeader(null)
    setError(null)

    // @ts-ignore
    const solana = window.solana || window.phantom?.solana

    if (!solana || !solana.publicKey) {
      setError('Wallet disconnected')
      setGameState('idle')
      login()
      return
    }

    await handlePayment()
  }

  return (
    <div className="w-full">
      {gameState === 'ready-to-spin' ? (
        <div className="space-y-6">
          <div
            className={cn(
              "p-4 rounded-lg text-center",
              "border-2 border-dashed border-green-500/60",
              "bg-[--neon-black]"
            )}
            style={{
              boxShadow: "0 0 16px rgba(34, 197, 94, 0.3)"
            }}
          >
            <div className="text-green-400 font-mono text-sm font-bold flex items-center justify-center gap-2">
              <span className="inline-block w-3 h-3 bg-green-400 rounded-full animate-pulse" />
              Payment successful! Ready to spin...
            </div>
          </div>

          <SlotMachine
            key={lastReference || 'default'}
            onSpin={handleSpin}
            onPlayAgain={handlePlayAgain}
            disabled={isSpinning}
          />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Preview Reels */}
          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
            {['🎰', '💎', '⚡'].map((symbol, i) => (
              <div
                key={i}
                className={cn(
                  "relative h-24 w-full overflow-hidden rounded-lg",
                  "border-2 border-dashed border-[--neon-blue-light]",
                  "bg-gradient-to-br from-[--neon-black] to-[--neon-dark]",
                  "flex items-center justify-center",
                  "transition-all duration-300 hover:scale-110",
                  "group cursor-pointer"
                )}
                style={{
                  boxShadow: "0 0 16px rgba(90, 180, 255, 0.5)",
                }}
              >
                <div
                  className="text-5xl font-bold transition-transform group-hover:scale-125"
                  style={{
                    textShadow: "0 0 20px rgba(90, 180, 255, 0.8)"
                  }}
                >
                  {symbol}
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div
              className={cn(
                "p-4 rounded-lg",
                "border-2 border-dashed border-red-500/60",
                "bg-[--neon-black]"
              )}
              style={{
                boxShadow: "0 0 12px rgba(239, 68, 68, 0.3)"
              }}
            >
              <div className="text-red-400 font-mono text-sm text-center">
                {error}
              </div>
            </div>
          )}

          {connected && connectedWallet && (
            <div
              className={cn(
                "p-3 rounded-lg",
                "border-2 border-dashed border-[--neon-blue-light]/60",
                "bg-[--neon-black]"
              )}
              style={{
                boxShadow: "0 0 12px rgba(90, 180, 255, 0.3)"
              }}
            >
              <div className="text-[--neon-blue-light] font-mono text-sm text-center flex items-center justify-center gap-2">
                <span className="inline-block w-2 h-2 bg-[--neon-blue-light] rounded-full animate-pulse" />
                Connected: {connectedWallet.slice(0, 4)}...{connectedWallet.slice(-4)}
              </div>
            </div>
          )}

          <div className="text-center">
            <button
              onClick={handlePlayNow}
              disabled={!ready || gameState === 'paying' || !blink}
              className={cn(
                "relative inline-block py-4 px-12 rounded-lg font-mono text-xl font-bold",
                "border-2 border-dashed overflow-hidden group",
                "transition-all duration-300",
                (!ready || gameState === 'paying' || !blink)
                  ? "border-[--neon-grey] bg-[--neon-dark] text-[--neon-grey] cursor-not-allowed"
                  : "border-[--neon-blue-light] bg-[--neon-black] text-[--neon-white] hover:bg-[--neon-blue-light] hover:text-[--neon-black] hover:scale-105"
              )}
              style={
                ready && gameState !== 'paying' && blink
                  ? {
                      boxShadow: "0 0 24px rgba(90, 180, 255, 0.7)"
                    }
                  : undefined
              }
            >
              {!blink ? (
                <span className="flex items-center justify-center gap-3">
                  <span className="inline-block w-5 h-5 border-2 border-[--neon-grey] border-t-transparent rounded-full animate-spin" />
                  Loading...
                </span>
              ) : gameState === 'paying' ? (
                <span className="flex items-center justify-center gap-3">
                  <span className="inline-block w-5 h-5 border-2 border-[--neon-grey] border-t-transparent rounded-full animate-spin" />
                  Processing...
                </span>
              ) : authenticated ? (
                '💰 PAY 0.10 USDC & PLAY'
              ) : (
                '🎰 CONNECT WALLET'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
