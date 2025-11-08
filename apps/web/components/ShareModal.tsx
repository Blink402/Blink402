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

  const actionUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://blink402.dev'}/actions/${slug}`
  const blinkUrl = `solana-action:${actionUrl}`
  const dialToUrl = `https://dial.to/?action=${encodeURIComponent(blinkUrl)}`

  const twitterText = `Check out this Blink: ${title}\n\n${description}`
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

          {/* Blink URL */}
          <div className="space-y-2">
            <label className="text-sm font-mono text-neon-grey">
              Blink URL
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
              <li>Paste the Blink URL in your tweet</li>
              <li>Users with Phantom/Backpack can execute directly!</li>
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
              onClick={() => window.open(dialToUrl, '_blank')}
              variant="outline"
              className="font-mono"
            >
              Preview
            </Button>
          </div>

          {/* Note about Registry */}
          <div className="p-3 bg-neon-black border border-yellow-500/30 rounded">
            <p className="text-xs font-mono text-yellow-500">
              <strong>Note:</strong> For Blinks to unfurl on Twitter/X, they must be registered with Dialect.
              Visit <a href="https://dial.to/register" target="_blank" rel="noopener noreferrer" className="underline">dial.to/register</a> to submit your Blink.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
