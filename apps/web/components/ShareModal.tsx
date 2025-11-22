"use client"
import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Share2, Copy, Check, Twitter, Download } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"

interface ShareModalProps {
  slug: string
  title: string
  description: string
  iconUrl?: string
  trigger?: React.ReactNode
}

export default function ShareModal({
  slug,
  title,
  description,
  iconUrl,
  trigger,
}: ShareModalProps) {
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)

  // Web URL for pretty sharing (X will use actions.json discovery to resolve)
  const webUrl = typeof window !== 'undefined' ? window.location.origin : 'https://blink402.dev'

  // Pretty blink URL for X unfurling - X will fetch actions.json and resolve to /actions endpoint
  const blinkUrl = `${webUrl}/blink/${slug}`

  // Direct checkout URL (used in QR code and as fallback)
  const checkoutUrl = `${webUrl}/checkout/${slug}`

  // Share the pretty blink URL on X - this enables unfurling via actions.json discovery
  const twitterText = `Check out this Blink: ${title}\n\n${description}\n\n${blinkUrl}`
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(twitterText)}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(blinkUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const downloadQRCode = () => {
    const svg = document.getElementById('qr-code-svg')
    if (!svg) return

    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx?.drawImage(img, 0, 0)
      const pngFile = canvas.toDataURL('image/png')

      const downloadLink = document.createElement('a')
      downloadLink.download = `blink-${slug}-qr.png`
      downloadLink.href = pngFile
      downloadLink.click()
    }

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="font-mono">
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-neon-dark border-neon-grey/30">
        <DialogHeader>
          <DialogTitle className="font-mono text-neon-white">
            Share Blink
          </DialogTitle>
          <DialogDescription className="font-mono text-neon-grey">
            Share this Blink on Twitter/X or scan the QR code
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* QR Code */}
          <div className="flex justify-center">
            <div className="p-4 bg-white rounded-lg">
              <QRCodeSVG
                id="qr-code-svg"
                value={blinkUrl}
                size={200}
                level="H"
                includeMargin={true}
              />
            </div>
          </div>

          {/* Blink URL for X Unfurling */}
          <div className="space-y-2">
            <label className="text-sm font-mono text-neon-grey">
              Blink URL (for X/Twitter unfurling)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={blinkUrl}
                readOnly
                className="flex-1 px-3 py-2 bg-neon-black border border-neon-grey/30 rounded font-mono text-sm text-neon-white"
              />
              <Button
                onClick={handleCopy}
                variant="outline"
                size="sm"
                className="font-mono"
              >
                {copied ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Share Instructions */}
          <div className="space-y-2">
            <h4 className="text-sm font-mono text-neon-white font-bold">
              How to share on Twitter/X:
            </h4>
            <ol className="list-decimal list-inside space-y-1 text-sm font-mono text-neon-grey">
              <li>Click "Share on X" below</li>
              <li>X will unfurl this as an interactive Solana Blink card</li>
              <li>Users click the action button and pay with USDC!</li>
            </ol>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => window.open(twitterUrl, '_blank', 'width=550,height=420')}
              className="flex-1 bg-neon-blue-light hover:bg-neon-blue-dark text-neon-black font-mono font-bold"
            >
              <Twitter className="w-4 h-4 mr-2" />
              Share on X
            </Button>

            <Button
              onClick={downloadQRCode}
              variant="outline"
              className="font-mono"
            >
              <Download className="w-4 h-4 mr-2" />
              Save QR
            </Button>

            <Button
              onClick={() => window.open(blinkUrl, '_blank')}
              variant="outline"
              className="font-mono"
            >
              View Blink
            </Button>
          </div>

          {/* Note about Blink unfurling */}
          <div className="p-3 bg-neon-black border border-blue-500/30 rounded">
            <p className="text-xs font-mono text-blue-400">
              <strong>Note:</strong> This URL will unfurl as a Solana Blink on X/Twitter using actions.json discovery.
              Payments are processed via x402 protocol. Average settlement: 2.1s.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
