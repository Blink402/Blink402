"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { mountReveals } from "@/lib/reveal"
import { mountScramble } from "@/lib/scramble"
import { getReceipt } from "@/lib/api"
import { logger } from "@/lib/logger"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import NeonDivider from "@/components/NeonDivider"

type ReceiptData = {
  id: string
  createdAt: string
  blink: {
    id: string
    title: string
    priceUsdc: string
    iconUrl: string
  }
  transaction: {
    reference: string
    signature: string
    payer: string
    status: "success" | "failed" | "pending"
    durationMs: number
  }
  creator: {
    wallet: string
  }
}

export default function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [id, setId] = useState<string | null>(null)

  useEffect(() => {
    // Unwrap params Promise
    params.then((p) => {
      setId(p.id)
    })
  }, [params])

  useEffect(() => {
    if (!id) return

    mountReveals()
    mountScramble()

    // Load receipt from API
    getReceipt(id)
      .then((data) => {
        setReceipt(data)
        setLoading(false)
      })
      .catch((err) => {
        logger.error('Error loading receipt:', err)
        setError(err.message || 'Failed to load receipt')
        setLoading(false)
      })
  }, [id])

  if (loading) {
    return (
      <main className="min-h-screen px-6 py-24">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-neon-dark/40 rounded w-48 mb-4" />
            <div className="h-64 bg-neon-dark/40 rounded" />
          </div>
        </div>
      </main>
    )
  }

  if (error || !receipt) {
    return (
      <main className="min-h-screen px-6 py-24">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl font-mono text-neon-white mb-4">
            {error || 'Receipt not found'}
          </h1>
          <Link href="/dashboard">
            <Button variant="outline" className="btn-ghost">
              ← Back to Dashboard
            </Button>
          </Link>
        </div>
      </main>
    )
  }

  const statusColors = {
    success: "text-neon-blue-light border-neon-blue-light/40 bg-neon-blue-light/10",
    failed: "text-red-400 border-red-400/40 bg-red-400/10",
    pending: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10",
  }

  return (
    <main className="min-h-screen">
      {/* Header */}
      <section className="px-6 py-12 md:py-16">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumb */}
          <nav className="mb-8 font-mono text-sm text-neon-grey" data-reveal>
            <Link href="/" className="hover:text-neon-blue-light transition-colors">
              Home
            </Link>
            <span className="mx-2">/</span>
            <Link href="/dashboard" className="hover:text-neon-blue-light transition-colors">
              Dashboard
            </Link>
            <span className="mx-2">/</span>
            <span className="text-neon-white">Receipt</span>
          </nav>

          {/* Title & Status */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1
                data-reveal
                data-scramble
                className="text-4xl md:text-5xl font-sans text-neon-white mb-2"
                style={{ fontWeight: 300, letterSpacing: "-0.03em" }}
              >
                Receipt
              </h1>
              <p className="font-mono text-neon-grey text-sm">ID: {receipt.id}</p>
            </div>
            <Badge className={`${statusColors[receipt.transaction.status]} font-mono text-sm px-4 py-2`} data-reveal>
              {receipt.transaction.status.toUpperCase()}
            </Badge>
          </div>

          <NeonDivider className="mb-8" />
        </div>
      </section>

      {/* Receipt Details */}
      <section className="px-6 pb-20">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6">
          {/* Transaction Info */}
          <Card className="p-6 bg-neon-dark/40 border-neon-grey/20" data-reveal>
            <h2 className="text-xl font-mono text-neon-white mb-4">Transaction Details</h2>

            <div className="space-y-3 font-mono text-sm">
              <div>
                <span className="text-neon-grey">Reference:</span>
                <p className="text-neon-white break-all">{receipt.transaction.reference}</p>
              </div>

              <div>
                <span className="text-neon-grey">Signature:</span>
                <p className="text-neon-white break-all">{receipt.transaction.signature}</p>
              </div>

              <div>
                <span className="text-neon-grey">Payer:</span>
                <p className="text-neon-white break-all">{receipt.transaction.payer}</p>
              </div>

              <div>
                <span className="text-neon-grey">Amount:</span>
                <p className="text-neon">
                  ${receipt.blink.priceUsdc} <span className="text-neon-grey">USDC</span>
                </p>
              </div>

              <div>
                <span className="text-neon-grey">Duration:</span>
                <p className="text-neon-white">{receipt.transaction.durationMs}ms</p>
              </div>

              <div>
                <span className="text-neon-grey">Timestamp:</span>
                <p className="text-neon-white">{new Date(receipt.createdAt).toLocaleString()}</p>
              </div>
            </div>
          </Card>

          {/* Blink Info */}
          <Card className="p-6 bg-neon-dark/40 border-neon-grey/20" data-reveal>
            <h2 className="text-xl font-mono text-neon-white mb-4">Blink Details</h2>

            <div className="space-y-3 font-mono text-sm">
              <div>
                <span className="text-neon-grey">Title:</span>
                <p className="text-neon-white">{receipt.blink.title}</p>
              </div>

              <div>
                <span className="text-neon-grey">Blink ID:</span>
                <p className="text-neon-white break-all">{receipt.blink.id}</p>
              </div>

              <div>
                <span className="text-neon-grey">Price:</span>
                <p className="text-neon-blue-light">${receipt.blink.priceUsdc} USDC</p>
              </div>

              <div>
                <span className="text-neon-grey">Creator Wallet:</span>
                <p className="text-neon-white break-all">{receipt.creator.wallet}</p>
              </div>
            </div>

            <Link href={`/blink/${receipt.blink.id}`}>
              <Button variant="outline" className="w-full mt-6 btn-ghost">
                View Blink Details
              </Button>
            </Link>
          </Card>
        </div>

        {/* Actions */}
        <div className="max-w-4xl mx-auto mt-8 flex flex-wrap gap-4 justify-center" data-reveal>
          <Link href={`/blink/${receipt.blink.id}`}>
            <Button className="btn-primary">Run Again</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline" className="btn-ghost">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </section>
    </main>
  )
}
