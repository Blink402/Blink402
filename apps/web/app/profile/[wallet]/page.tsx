"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { usePrivy, useWallets } from "@privy-io/react-auth"
import { getCreatorProfile, getCreatorBlinks } from "@/lib/api"
import type { CreatorProfile, BlinkData } from "@blink402/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Twitter, Github, Globe, MessageCircle, Settings } from "lucide-react"
import { mountReveals } from "@/lib/reveal"
import { mountScramble } from "@/lib/scramble"

export default function ProfilePage({ params }: { params: Promise<{ wallet: string }> }) {
  const resolvedParams = use(params)
  const { ready, authenticated } = usePrivy()
  const { wallets } = useWallets()
  const wallet = wallets[0]
  const publicKey = wallet?.address
  const [profile, setProfile] = useState<CreatorProfile | null>(null)
  const [blinks, setBlinks] = useState<BlinkData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check if viewing own profile
  const isOwnProfile = publicKey && profile && publicKey === profile.wallet

  useEffect(() => {
    async function loadProfile() {
      try {
        const profileData = await getCreatorProfile(resolvedParams.wallet)
        if (!profileData) {
          setError("Creator profile not found")
          return
        }
        setProfile(profileData)

        // Load creator's blinks
        const blinksData = await getCreatorBlinks(profileData.wallet, 20, 0)
        setBlinks(blinksData)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load profile")
      } finally {
        setIsLoading(false)
      }
    }

    loadProfile()
  }, [resolvedParams.wallet])

  useEffect(() => {
    if (!isLoading) {
      mountReveals()
      mountScramble()
    }
  }, [isLoading])

  if (isLoading) {
    return (
      <main className="min-h-screen bg-neon-black">
        <div className="container mx-auto px-6 py-16 flex items-center justify-center">
          <p className="text-neon-grey font-mono text-sm">Loading profile...</p>
        </div>
      </main>
    )
  }

  if (error || !profile) {
    return (
      <main className="min-h-screen bg-neon-black">
        <div className="container mx-auto px-6 py-16">
          <div className="text-center">
            <h1 className="text-neon-white font-sans text-2xl mb-4">Profile Not Found</h1>
            <p className="text-neon-grey font-mono text-sm mb-8">{error}</p>
            <Link href="/catalog" className="text-neon-blue-light hover:text-neon-blue-dark font-mono text-sm">
              ← Browse Catalog
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const displayName = profile.display_name || profile.wallet.slice(0, 8) + "..." + profile.wallet.slice(-6)

  return (
    <main className="min-h-screen bg-neon-black">
      {/* Banner */}
      {profile.banner_url && (
        <div className="w-full h-48 bg-neon-dark overflow-hidden">
          <img
            src={profile.banner_url}
            alt="Profile banner"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="container mx-auto px-6">
        {/* Profile Header */}
        <div className={`relative mb-8 ${profile.banner_url ? '-mt-20' : 'pt-24'}`} data-reveal>
          <div className="flex flex-col md:flex-row items-start md:items-end gap-6">
            {/* Avatar */}
            <Avatar className="w-32 h-32 border-4 border-neon-black">
              <AvatarImage src={profile.avatar_url || undefined} alt={displayName} />
              <AvatarFallback className="bg-neon-dark text-neon-white text-3xl font-sans">
                {displayName[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>

            {/* Name and Stats */}
            <div className="flex-1">
              <div className="flex items-start justify-between gap-4 mb-2">
                <h1 className="font-sans text-neon-white text-3xl md:text-4xl" data-scramble>
                  {displayName}
                </h1>
                {isOwnProfile && (
                  <Link
                    href="/profile/edit"
                    className="flex items-center gap-2 px-4 py-2 bg-neon-dark border border-dashed border-neon-blue-dark/60 hover:border-neon-blue-light text-neon-blue-light hover:text-white transition-all font-mono text-sm"
                  >
                    <Settings className="w-4 h-4" />
                    Edit Profile
                  </Link>
                )}
              </div>
              <p className="text-neon-grey font-mono text-xs mb-4">
                {profile.wallet}
              </p>

              {/* Stats */}
              <div className="flex flex-wrap gap-4 mb-4">
                <div>
                  <span className="text-neon-white font-mono text-lg">{profile.total_blinks}</span>
                  <span className="text-neon-grey font-mono text-sm ml-1">Blinks</span>
                </div>
                <div>
                  <span className="text-neon-white font-mono text-lg">{profile.total_runs}</span>
                  <span className="text-neon-grey font-mono text-sm ml-1">Runs</span>
                </div>
                <div>
                  <span className="text-neon-white font-mono text-lg">{parseFloat(profile.total_earnings).toFixed(2)}</span>
                  <span className="text-neon-grey font-mono text-sm ml-1">SOL Earned</span>
                </div>
              </div>

              {/* Social Links */}
              {profile.social_links && (
                <div className="flex gap-3">
                  {profile.social_links.twitter && (
                    <a
                      href={`https://twitter.com/${profile.social_links.twitter.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neon-grey hover:text-neon-blue-light transition-colors"
                    >
                      <Twitter className="w-5 h-5" />
                    </a>
                  )}
                  {profile.social_links.github && (
                    <a
                      href={`https://github.com/${profile.social_links.github}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neon-grey hover:text-neon-blue-light transition-colors"
                    >
                      <Github className="w-5 h-5" />
                    </a>
                  )}
                  {profile.social_links.website && (
                    <a
                      href={profile.social_links.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neon-grey hover:text-neon-blue-light transition-colors"
                    >
                      <Globe className="w-5 h-5" />
                    </a>
                  )}
                  {profile.social_links.discord && (
                    <span className="text-neon-grey font-mono text-sm flex items-center gap-1">
                      <MessageCircle className="w-4 h-4" />
                      {profile.social_links.discord}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <div className="mt-6" data-reveal>
              <p className="text-neon-grey font-mono text-sm leading-relaxed max-w-2xl">
                {profile.bio}
              </p>
            </div>
          )}
        </div>

        {/* Blinks Section */}
        <div className="py-8" data-reveal>
          <h2 className="font-sans text-neon-white text-2xl mb-6">
            Created Blinks ({blinks.length})
          </h2>

          {blinks.length === 0 ? (
            <Card className="bg-neon-dark border-neon-blue-dark/20">
              <CardContent className="p-12 text-center">
                <p className="text-neon-grey font-mono text-sm">
                  No blinks created yet
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {blinks.map((blink) => (
                <Link key={blink.id} href={`/blink/${blink.slug}`}>
                  <Card className="bg-neon-dark border-neon-blue-dark/20 hover:border-neon-blue-light/40 transition-all h-full">
                    <CardHeader>
                      <div className="flex items-start justify-between mb-2">
                        <CardTitle className="text-neon-white font-sans text-lg">
                          {blink.title}
                        </CardTitle>
                        <Badge className="bg-neon-blue-dark/20 text-neon-blue-light border-neon-blue-dark/30">
                          {blink.category}
                        </Badge>
                      </div>
                      <CardDescription className="text-neon-grey font-mono text-sm">
                        {blink.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-neon-grey font-mono text-xs">
                        <span>{blink.price_usdc} {blink.payment_token}</span>
                        <span>{blink.runs} runs</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
