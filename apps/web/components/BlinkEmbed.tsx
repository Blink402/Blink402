"use client"
import { useEffect, useState, useRef } from "react"
import { AlertTriangle } from "lucide-react"
import { Blink, useAction } from "@dialectlabs/blinks"
import { useActionSolanaWalletAdapter } from "@dialectlabs/blinks/hooks/solana"
import "@dialectlabs/blinks/index.css"
import { Card } from "@/components/ui/card"
import Lottie from "@/components/Lottie"

interface BlinkEmbedProps {
  slug: string
  className?: string
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://blink402-production.up.railway.app'
const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'

export default function BlinkEmbed({ slug, className = "" }: BlinkEmbedProps) {
  const [mounted, setMounted] = useState(false)
  const actionApiUrl = `${API_BASE_URL}/actions/${slug}`

  const { adapter } = useActionSolanaWalletAdapter(SOLANA_RPC)
  const { action, isLoading } = useAction({ url: actionApiUrl })

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Card className={`p-8 bg-neon-dark/20 border-dashed border-neon-blue-dark/30 ${className}`}>
        <div className="text-center">
          <Lottie
            src="/lottie/Loading (Neon spinning).lottie"
            autoplay
            loop
            width={48}
            height={48}
            className="mx-auto mb-3"
          />
          <p className="text-neon-grey font-mono text-sm">Loading demo...</p>
        </div>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card className={`p-8 bg-neon-dark/20 border-dashed border-neon-blue-dark/30 ${className}`}>
        <div className="text-center">
          <Lottie
            src="/lottie/Loading (Neon spinning).lottie"
            autoplay
            loop
            width={48}
            height={48}
            className="mx-auto mb-3"
          />
          <p className="text-neon-grey font-mono text-sm">Loading blink...</p>
        </div>
      </Card>
    )
  }

  if (!isLoading && !action) {
    return (
      <Card className={`p-8 bg-neon-dark/20 border-dashed border-red-500/30 ${className}`}>
        <div className="p-4 border border-red-500/30 bg-red-500/10 rounded text-center">
          <p className="text-red-400 font-mono text-sm mb-2 flex items-center justify-center gap-2"><AlertTriangle className="w-4 h-4" /> Failed to load blink</p>
          <p className="text-neon-grey font-mono text-xs">
            Please check back later or try a different demo.
          </p>
        </div>
      </Card>
    )
  }

  if (!action) {
    return null
  }

  return (
    <div className={`blink-neon-custom ${className}`}>
      <Blink
        blink={action}
        adapter={adapter}
        stylePreset="custom"
        websiteText="blink402.dev"
      />

      <style jsx global>{`
        /* Custom Neon Blue Dialect Blinks Styling */
        .blink-neon-custom {
          --blink-bg-primary: #171717;
          --blink-bg-secondary: #1e1e1e;
          --blink-button: linear-gradient(90deg, #5AB4FF 0%, #3B8FD9 100%);
          --blink-button-disabled: #9d9d9d;
          --blink-button-hover: linear-gradient(90deg, #3B8FD9 0%, #2a6ba8 100%);
          --blink-button-success: #5AB4FF;
          --blink-icon-error: #ff4444;
          --blink-icon-error-hover: #ff6666;
          --blink-icon-primary: #5AB4FF;
          --blink-icon-primary-hover: #3B8FD9;
          --blink-icon-warning: #ffaa00;
          --blink-icon-warning-hover: #ffbb22;
          --blink-input-bg: #1e1e1e;
          --blink-input-bg-disabled: #171717;
          --blink-input-bg-selected: #1e1e1e;
          --blink-input-stroke: #5AB4FF;
          --blink-input-stroke-disabled: #9d9d9d;
          --blink-input-stroke-error: #ff4444;
          --blink-input-stroke-hover: #3B8FD9;
          --blink-input-stroke-selected: #5AB4FF;
          --blink-stroke-error: #ff4444;
          --blink-stroke-primary: #5AB4FF;
          --blink-stroke-secondary: #9d9d9d;
          --blink-stroke-warning: #ffaa00;
          --blink-text-brand: #5AB4FF;
          --blink-text-button: #171717;
          --blink-text-button-disabled: #171717;
          --blink-text-button-success: #171717;
          --blink-text-error: #ff4444;
          --blink-text-error-hover: #ff6666;
          --blink-text-input: #ffffff;
          --blink-text-input-disabled: #9d9d9d;
          --blink-text-input-placeholder: #9d9d9d;
          --blink-text-link: #5AB4FF;
          --blink-text-link-hover: #3B8FD9;
          --blink-text-primary: #ffffff;
          --blink-text-secondary: #9d9d9d;
          --blink-text-success: #5AB4FF;
          --blink-text-warning: #ffaa00;
          --blink-transparent-error: rgba(255, 68, 68, 0.1);
          --blink-transparent-grey: rgba(157, 157, 157, 0.1);
          --blink-transparent-warning: rgba(255, 170, 0, 0.1);
          --blink-border-radius-rounded-lg: 8px;
          --blink-border-radius-rounded-xl: 12px;
          --blink-border-radius-rounded-2xl: 16px;
          --blink-border-radius-rounded-button: 8px;
          --blink-border-radius-rounded-input: 8px;
        }

        /* Neon glow effect on buttons */
        .blink-neon-custom button:not(:disabled):hover {
          box-shadow: 0 0 15px rgba(90, 180, 255, 0.5);
        }

        /* Neon border dashed effect */
        .blink-neon-custom [class*="border"] {
          border-style: dashed !important;
        }
      `}</style>
    </div>
  )
}
