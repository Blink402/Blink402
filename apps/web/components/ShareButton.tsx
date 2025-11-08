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

  const actionUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://blink402.dev'}/actions/${slug}`
  const blinkUrl = `solana-action:${actionUrl}`
  const dialToUrl = `https://dial.to/?action=${encodeURIComponent(blinkUrl)}`

  const twitterText = `Check out this Blink: ${title}`
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(twitterText)}&url=${encodeURIComponent(blinkUrl)}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(blinkUrl)
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
          url: blinkUrl,
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

      {/* dial.to Preview Button */}
      <Button
        onClick={() => window.open(dialToUrl, '_blank')}
        variant="outline"
        className="font-mono"
      >
        Preview on dial.to
      </Button>
    </div>
  )
}
