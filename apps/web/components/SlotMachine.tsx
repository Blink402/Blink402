"use client"

import { useState, useEffect } from "react"
import { SlotReel } from "./SlotReel"
import { mountScramble } from "@/lib/scramble"
import { cn, formatUsdc } from "@/lib/utils"
import type { SlotSymbol, SpinResult } from "@blink402/types"

interface SlotMachineProps {
  onSpin: () => Promise<SpinResult>
  onPlayAgain?: () => void
  disabled?: boolean
}

export function SlotMachine({ onSpin, onPlayAgain, disabled = false }: SlotMachineProps) {
  const [isSpinning, setIsSpinning] = useState(false)
  const [reels, setReels] = useState<[SlotSymbol, SlotSymbol, SlotSymbol]>(['🍒', '🍋', '🍊'])
  const [resultReels, setResultReels] = useState<[SlotSymbol, SlotSymbol, SlotSymbol] | null>(null)
  const [lastResult, setLastResult] = useState<SpinResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Mount text scramble effect
  useEffect(() => {
    mountScramble()
  }, [lastResult])

  const handleSpin = async () => {
    if (isSpinning || disabled) return

    setIsSpinning(true)
    setError(null)
    setLastResult(null)
    setResultReels(null)

    try {
      // Execute backend spin
      const result = await onSpin()

      // Store result reels immediately so animation can land on correct symbols
      setResultReels(result.reels)

      // Wait for reel animations to complete (3.0s total - ensures all 3 reels finish)
      setTimeout(() => {
        setReels(result.reels)
        setLastResult(result)
        setIsSpinning(false)
      }, 3000)

    } catch (error) {
      console.error('Spin failed:', error)
      setError(error instanceof Error ? error.message : 'Spin failed. Please try again.')
      setIsSpinning(false)
      setResultReels(null)
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Slot Machine Container */}
      <div
        className={cn(
          "relative rounded-lg p-8",
          "border-2 border-dashed border-[--neon-blue-light]",
          "bg-[--neon-dark]"
        )}
        style={{
          boxShadow: "0 0 20px rgba(90, 180, 255, 0.4), 0 0 40px rgba(90, 180, 255, 0.2)"
        }}
      >

        {/* Title */}
        <div className="relative text-center mb-8">
          <h2
            className="font-sans text-3xl font-light text-[--neon-white]"
            style={{
              textShadow: "0 0 12px rgba(90, 180, 255, 0.6)"
            }}
          >
            Lucky Slot Machine
          </h2>
        </div>

        {/* Reels */}
        <div className="relative grid grid-cols-3 gap-4 mb-8">
          <SlotReel
            symbol={reels[0]}
            isSpinning={isSpinning}
            delay={0}
            finalSymbol={resultReels?.[0]}
          />
          <SlotReel
            symbol={reels[1]}
            isSpinning={isSpinning}
            delay={0.15}
            finalSymbol={resultReels?.[1]}
          />
          <SlotReel
            symbol={reels[2]}
            isSpinning={isSpinning}
            delay={0.3}
            finalSymbol={resultReels?.[2]}
          />
        </div>

        {/* Result Display */}
        {lastResult && !isSpinning && (
          <div className="relative mb-6 animate-in fade-in duration-500">
            {lastResult.win ? (
              <div
                className={cn(
                  "p-8 rounded-lg text-center relative overflow-hidden",
                  "border-2 border-dashed border-[--neon-blue-light]",
                  "bg-gradient-to-br from-[--neon-black] via-[--neon-dark] to-[--neon-black]"
                )}
                style={{
                  boxShadow: "0 0 20px rgba(90, 180, 255, 0.7), 0 0 40px rgba(90, 180, 255, 0.4), inset 0 0 20px rgba(90, 180, 255, 0.1)"
                }}
              >
                <div className="relative z-10">
                  <div className="font-sans text-[--neon-blue-light] text-2xl font-bold mb-3 animate-pulse">
                    🎉 YOU WON! 🎉
                  </div>
                  <div
                    className="font-mono text-5xl font-bold text-[--neon-white] mb-3"
                    data-scramble
                    style={{
                      textShadow: "0 0 20px rgba(90, 180, 255, 0.8), 0 0 40px rgba(90, 180, 255, 0.4)"
                    }}
                  >
                    +{formatUsdc(lastResult.payout)} USDC
                  </div>
                  <div className="font-mono text-[--neon-blue-light] text-lg font-bold mb-2">
                    {lastResult.multiplier}x multiplier
                  </div>
                  {lastResult.payoutSignature && (
                    <div className="mt-4 pt-4 border-t border-[--neon-blue-light]/30">
                      <div className="text-green-400 font-mono text-sm flex items-center justify-center gap-2">
                        ✓ Payout sent to your wallet
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div
                className={cn(
                  "p-5 rounded-lg text-center",
                  "border-2 border-dashed border-[--neon-grey]/50",
                  "bg-[--neon-black]"
                )}
              >
                <div className="font-sans text-[--neon-grey]">
                  Better luck next time!
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div
            className={cn(
              "mb-6 p-4 rounded-lg text-center",
              "border-2 border-dashed border-red-500/70",
              "bg-[--neon-black]"
            )}
            style={{
              boxShadow: "0 0 12px rgba(239, 68, 68, 0.3), 0 0 24px rgba(239, 68, 68, 0.15)"
            }}
          >
            <div className="text-red-400 font-mono text-sm">
              ✕ {error}
            </div>
          </div>
        )}

        {/* Play Again Button - shows after spin completes */}
        {lastResult && !isSpinning && onPlayAgain && (
          <div className="mb-6">
            <button
              onClick={onPlayAgain}
              disabled={disabled}
              className={cn(
                "w-full py-4 px-8 rounded-lg font-mono text-lg font-bold",
                "border-2 border-dashed transition-all duration-200",
                disabled
                  ? "border-[--neon-grey] bg-[--neon-dark] text-[--neon-grey] cursor-not-allowed"
                  : "border-[--neon-blue-light] bg-[--neon-black] text-[--neon-white] hover:bg-[--neon-blue-light] hover:text-[--neon-black] hover:scale-[1.02] active:scale-[0.98]"
              )}
              style={
                !disabled
                  ? { boxShadow: "0 0 16px rgba(90, 180, 255, 0.5), 0 0 32px rgba(90, 180, 255, 0.25)" }
                  : undefined
              }
            >
              {disabled ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-[--neon-grey] border-t-transparent rounded-full animate-spin" />
                  Processing...
                </span>
              ) : (
                '💰 Pay & Play Again'
              )}
            </button>
          </div>
        )}

        {/* Spin Button - hide after result shown */}
        {!lastResult && (
          <button
            onClick={handleSpin}
            disabled={isSpinning || disabled}
            className={cn(
            "w-full py-4 px-8 rounded-lg font-mono text-lg font-bold",
            "border-2 border-dashed transition-all duration-200",
            "relative overflow-hidden group",
            isSpinning || disabled
              ? "border-[--neon-grey] bg-[--neon-dark] text-[--neon-grey] cursor-not-allowed"
              : "border-[--neon-blue-light] bg-[--neon-black] text-[--neon-white] hover:bg-[--neon-blue-light] hover:text-[--neon-black] hover:scale-[1.02] active:scale-[0.98]"
          )}
          style={
            !isSpinning && !disabled
              ? {
                  boxShadow: "0 0 16px rgba(90, 180, 255, 0.5), 0 0 32px rgba(90, 180, 255, 0.25), inset 0 0 8px rgba(90, 180, 255, 0.1)",
                }
              : undefined
          }
        >
          {isSpinning ? (
            <span className="font-mono flex items-center justify-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-[--neon-grey] border-t-transparent rounded-full animate-spin" />
              Spinning...
            </span>
          ) : (
            <span className="font-mono">🎰 SPIN (0.10 USDC)</span>
          )}
        </button>
        )}

        {/* Stats */}
        {lastResult && (
          <div className="relative mt-6 grid grid-cols-2 gap-4 text-sm">
            <div
              className={cn(
                "p-3 rounded-lg border border-dashed border-[--neon-grey]",
                "bg-[--neon-black]"
              )}
            >
              <div className="font-sans text-[--neon-grey] mb-1">Bet Amount</div>
              <div className="font-mono text-[--neon-white]">{formatUsdc(lastResult.betAmount)} USDC</div>
            </div>
            <div
              className={cn(
                "p-3 rounded-lg border border-dashed border-[--neon-grey]",
                "bg-[--neon-black]"
              )}
            >
              <div className="font-sans text-[--neon-grey] mb-1">Result</div>
              <div className="font-mono text-[--neon-white]">
                {lastResult.reels.join(' ')}
              </div>
            </div>
          </div>
        )}

        {/* Provably Fair Info */}
        {lastResult && (
          <details className="relative mt-4">
            <summary className="font-sans cursor-pointer text-[--neon-grey] text-xs text-center hover:text-[--neon-white]">
              🔒 Verify Provably Fair Result
            </summary>
            <div
              className={cn(
                "mt-2 p-3 rounded-lg text-xs",
                "border border-dashed border-[--neon-grey]",
                "bg-[--neon-black]"
              )}
            >
              <div className="font-mono mb-2">
                <span className="text-[--neon-grey]">Server Seed Hash:</span>{" "}
                <span className="text-[--neon-blue-light] break-all">
                  {lastResult.serverSeedHash.substring(0, 32)}...
                </span>
              </div>
              <div className="font-mono mb-2">
                <span className="text-[--neon-grey]">Client Seed:</span>{" "}
                <span className="text-[--neon-blue-light] break-all">
                  {lastResult.clientSeed.substring(0, 20)}...
                </span>
              </div>
              <div className="font-mono">
                <span className="text-[--neon-grey]">Nonce:</span>{" "}
                <span className="text-[--neon-blue-light]">{lastResult.nonce}</span>
              </div>
              <div className="font-sans mt-2 pt-2 border-t border-[--neon-grey] text-[--neon-grey]">
                Use these values to independently verify this spin was fair and not manipulated.
              </div>
            </div>
          </details>
        )}
      </div>
    </div>
  )
}
