"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Share2, Check, Copy, Twitter } from "lucide-react"

interface ShareButtonProps {
  slug: string
  title: string
  className?: string
}

export default function ShareButton({ slug, title, className }: ShareButtonProps) {
  const [copied, setCopied] = useState(false)

  // Updated to use checkout page with x402 payment flow (replaces deprecated Solana Actions)
  const checkoutUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://blink402.dev'}/checkout?slug=${slug}`
  const blinkUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://blink402.dev'}/blink/${slug}`

  const twitterText = `Check out this Blink: ${title}\n\n${checkoutUrl}`
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(twitterText)}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(checkoutUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: `Check out this Blink: ${title}`,
          url: checkoutUrl,
        })
      } catch (err) {
        // User cancelled or share failed
        console.log('Share cancelled')
      }
    } else {
      // Fallback to copy
      handleCopy()
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {/* Share Button (uses native share or copy fallback) */}
      <Button
        onClick={handleShare}
        variant="outline"
        className={`font-mono ${className || ''}`}
      >
        <Share2 className="w-4 h-4 mr-2" />
        Share Blink
      </Button>

      {/* Copy Button */}
      <Button
        onClick={handleCopy}
        variant="outline"
        className="font-mono"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4 mr-2" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="w-4 h-4 mr-2" />
            Copy URL
          </>
        )}
      </Button>

      {/* Twitter Share Button */}
      <Button
        onClick={() => window.open(twitterUrl, '_blank', 'width=550,height=420')}
        variant="outline"
        className="font-mono"
      >
        <Twitter className="w-4 h-4 mr-2" />
        Share on X
      </Button>

      {/* View Blink Button */}
      <Button
        onClick={() => window.open(blinkUrl, '_blank')}
        variant="outline"
        className="font-mono"
      >
        View Blink
      </Button>
    </div>
  )
}
