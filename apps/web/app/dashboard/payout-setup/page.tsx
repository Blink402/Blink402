"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { usePrivy, useWallets } from "@privy-io/react-auth"
import { Keypair } from "@solana/web3.js"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import NeonDivider from "@/components/NeonDivider"
import Link from "next/link"
import { cn } from "@/lib/utils"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function PayoutSetupPage() {
  const router = useRouter()
  const { ready, authenticated, user } = usePrivy()
  const { wallets } = useWallets()

  // Get wallet address
  const wallet = wallets[0]
  const solanaAccount: any = user?.linkedAccounts?.find(
    (account: any) => account.type === 'wallet' && account.chainType === 'solana'
  )
  const connectedWallet = (solanaAccount as any)?.address || wallet?.address
  const connected = authenticated && !!connectedWallet

  const [privateKey, setPrivateKey] = useState("")
  const [generatedKey, setGeneratedKey] = useState<{ private: string; public: string } | null>(null)
  const [existingKey, setExistingKey] = useState<{ publicKey: string; maskedKey: string } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showPrivateKey, setShowPrivateKey] = useState(false)

  // Check if user already has a key configured
  useEffect(() => {
    if (connected && connectedWallet) {
      checkExistingKey()
    }
  }, [connected, connectedWallet])

  async function checkExistingKey() {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/creator/payout-key/status?wallet=${connectedWallet}`
      )
      const data = await response.json()

      if (data.configured) {
        setExistingKey({
          publicKey: data.publicKey,
          maskedKey: data.maskedKey,
        })
      }
    } catch (err) {
      console.error('Failed to check existing key:', err)
    }
  }

  async function handleGenerate() {
    if (!connected || !connectedWallet) {
      setError("Please connect your wallet first")
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/creator/payout-key/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: connectedWallet }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate keypair')
      }

      setGeneratedKey({
        private: data.privateKey,
        public: data.publicKey,
      })

      setSuccess(
        "Keypair generated! Copy the private key and save it securely. You'll need to paste it below to save it."
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate keypair')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSave() {
    if (!connected || !connectedWallet) {
      setError("Please connect your wallet first")
      return
    }

    const keyToSave = privateKey || generatedKey?.private

    if (!keyToSave) {
      setError("Please paste a private key or generate a new one")
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      // Validate format
      const parsed = JSON.parse(keyToSave)
      if (!Array.isArray(parsed) || parsed.length !== 64) {
        throw new Error('Invalid private key format. Must be JSON array of 64 numbers.')
      }

      // Verify keypair is valid
      Keypair.fromSecretKey(Buffer.from(parsed))

      const response = await fetch(`${API_BASE_URL}/api/creator/payout-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: connectedWallet,
          privateKey: keyToSave,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save private key')
      }

      setSuccess("Payout key saved successfully! You can now create reward-based blinks.")
      setExistingKey({
        publicKey: data.publicKey,
        maskedKey: data.maskedKey,
      })
      setPrivateKey("")
      setGeneratedKey(null)

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save private key')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleDelete() {
    if (!connected || !connectedWallet) {
      setError("Please connect your wallet first")
      return
    }

    if (!confirm('Are you sure you want to remove your payout key? This will disable payouts for your reward-based blinks.')) {
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/creator/payout-key`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: connectedWallet }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove private key')
      }

      setSuccess("Payout key removed successfully")
      setExistingKey(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove private key')
    } finally {
      setIsLoading(false)
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    setSuccess("Copied to clipboard!")
    setTimeout(() => setSuccess(null), 2000)
  }

  if (!ready || !authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-neon-grey font-mono">Please connect your wallet...</p>
      </div>
    )
  }

  return (
    <main className="min-h-screen">
      <section className="px-4 sm:px-6 py-6 sm:py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <Link href="/dashboard" className="text-neon-blue-light hover:text-neon-blue-dark font-mono text-sm mb-4 inline-block">
              ← Back to Dashboard
            </Link>
            <h1 className="font-sans text-neon-white mb-3 text-3xl md:text-4xl">
              Payout Wallet Setup
            </h1>
            <p className="text-neon-grey font-mono text-sm">
              Configure your payout wallet for reward-based blinks (e.g., slot machines, giveaways)
            </p>
          </div>

          {/* Existing Key Status */}
          {existingKey && (
            <Alert className="bg-green-500/10 border-green-500/30 mb-6">
              <AlertDescription className="text-green-400 font-mono text-sm">
                ✓ Payout wallet configured: {existingKey.maskedKey}
                <br />
                <span className="text-neon-grey text-xs">Public Key: {existingKey.publicKey}</span>
              </AlertDescription>
            </Alert>
          )}

          {/* Error Alert */}
          {error && (
            <Alert className="bg-red-500/10 border-red-500/30 mb-6">
              <AlertDescription className="text-red-400 font-mono text-sm">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Success Alert */}
          {success && (
            <Alert className="bg-green-500/10 border-green-500/30 mb-6">
              <AlertDescription className="text-green-400 font-mono text-sm">
                {success}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            {/* Option 1: Generate New Keypair */}
            <Card className="bg-neon-dark border-neon-blue-dark/20 p-6">
              <h2 className="text-neon-white font-mono text-lg mb-4">Option 1: Generate New</h2>
              <p className="text-neon-grey font-mono text-sm mb-4">
                Let us generate a new Solana keypair for you. You'll need to fund it with USDC for payouts.
              </p>

              <Button
                onClick={handleGenerate}
                disabled={isLoading}
                className="w-full bg-neon-blue-dark hover:bg-neon-blue-light font-mono mb-4"
              >
                Generate New Keypair
              </Button>

              {generatedKey && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-neon-white font-mono text-xs mb-2 block">
                      Public Key (Wallet Address)
                    </Label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={generatedKey.public}
                        readOnly
                        className="flex-1 px-3 py-2 font-mono text-xs bg-neon-black border border-neon-blue-dark/30 text-neon-white rounded"
                      />
                      <Button
                        onClick={() => copyToClipboard(generatedKey.public)}
                        variant="outline"
                        className="font-mono text-xs"
                      >
                        Copy
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label className="text-neon-white font-mono text-xs mb-2 block">
                      Private Key (Keep Secret!)
                    </Label>
                    <div className="flex gap-2">
                      <input
                        type={showPrivateKey ? "text" : "password"}
                        value={generatedKey.private}
                        readOnly
                        className="flex-1 px-3 py-2 font-mono text-xs bg-neon-black border border-neon-blue-dark/30 text-neon-white rounded"
                      />
                      <Button
                        onClick={() => setShowPrivateKey(!showPrivateKey)}
                        variant="outline"
                        className="font-mono text-xs"
                      >
                        {showPrivateKey ? "Hide" : "Show"}
                      </Button>
                      <Button
                        onClick={() => copyToClipboard(generatedKey.private)}
                        variant="outline"
                        className="font-mono text-xs"
                      >
                        Copy
                      </Button>
                    </div>
                  </div>

                  <Alert className="bg-yellow-500/10 border-yellow-500/30">
                    <AlertDescription className="text-yellow-400 font-mono text-xs">
                      ⚠️ Save the private key securely! You'll need to paste it below to save it to our encrypted database.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </Card>

            {/* Option 2: Paste Existing */}
            <Card className="bg-neon-dark border-neon-blue-dark/20 p-6">
              <h2 className="text-neon-white font-mono text-lg mb-4">Option 2: Use Existing</h2>
              <p className="text-neon-grey font-mono text-sm mb-4">
                Paste an existing Solana private key (JSON array format).
              </p>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="privateKey" className="text-neon-white font-mono text-xs mb-2 block">
                    Private Key (JSON Array)
                  </Label>
                  <Textarea
                    id="privateKey"
                    value={privateKey}
                    onChange={(e) => setPrivateKey(e.target.value)}
                    placeholder='[123,45,67,...]'
                    className="font-mono text-xs h-32 bg-neon-black border-neon-blue-dark/30 text-neon-white"
                    disabled={isLoading}
                  />
                  <p className="text-neon-grey/70 font-mono text-xs mt-1">
                    Example: [31,174,117,179,...]
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Save/Delete Buttons */}
          <div className="mt-6 flex gap-4">
            <Button
              onClick={handleSave}
              disabled={isLoading || (!privateKey && !generatedKey)}
              className="flex-1 bg-neon-blue-dark hover:bg-neon-blue-light font-mono text-lg h-12"
            >
              {isLoading ? "Saving..." : "Save Payout Key"}
            </Button>

            {existingKey && (
              <Button
                onClick={handleDelete}
                disabled={isLoading}
                variant="outline"
                className="border-red-500/30 text-red-400 hover:bg-red-500/10 font-mono"
              >
                Remove Key
              </Button>
            )}
          </div>

          <NeonDivider className="my-8" />

          {/* Security Information */}
          <Card className="bg-neon-dark/50 border-neon-blue-dark/20 p-6">
            <h3 className="text-neon-white font-mono text-lg mb-4">🔒 Security Information</h3>

            <div className="space-y-4 text-neon-grey font-mono text-sm">
              <div>
                <h4 className="text-neon-white font-bold mb-2">How We Store Your Key:</h4>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Encrypted using AES-256-GCM (military-grade encryption)</li>
                  <li>Each key gets unique salt + IV (randomized)</li>
                  <li>Authentication tags prevent tampering</li>
                  <li>Master encryption key stored separately in Railway</li>
                  <li>We cannot decrypt your key without the master key</li>
                </ul>
              </div>

              <div>
                <h4 className="text-neon-white font-bold mb-2">What You Need to Do:</h4>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Fund the wallet with USDC for payouts</li>
                  <li>Monitor balance regularly (set up alerts)</li>
                  <li>Keep a backup of the private key offline</li>
                  <li>Don't share your private key with anyone</li>
                </ul>
              </div>

              <div>
                <h4 className="text-neon-white font-bold mb-2">Recommended Balance:</h4>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Minimum: 50 USDC</li>
                  <li>Recommended: 200-500 USDC</li>
                  <li>Formula: (Expected Daily Spins × 0.05 × 0.50)</li>
                </ul>
              </div>

              <Alert className="bg-yellow-500/10 border-yellow-500/30 mt-4">
                <AlertDescription className="text-yellow-400 font-mono text-xs">
                  ⚠️ If your payout wallet runs out of USDC, winners won't receive payouts. Refill immediately if this happens!
                </AlertDescription>
              </Alert>
            </div>
          </Card>
        </div>
      </section>
    </main>
  )
}
