"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { usePrivy, useWallets } from "@privy-io/react-auth"
import { getCreatorProfile, updateCreatorProfile } from "@/lib/api"
import type { CreatorProfile, UpdateCreatorProfilePayload } from "@blink402/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"
import { mountReveals } from "@/lib/reveal"
import { mountScramble } from "@/lib/scramble"

export default function EditProfilePage() {
  const router = useRouter()
  const { ready, authenticated } = usePrivy()
  const { wallets } = useWallets()
  const wallet = wallets[0]
  const publicKey = wallet?.address
  const [profile, setProfile] = useState<CreatorProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [isUploadingBanner, setIsUploadingBanner] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Form state
  const [displayName, setDisplayName] = useState("")
  const [bio, setBio] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  const [bannerUrl, setBannerUrl] = useState("")
  const [profileSlug, setProfileSlug] = useState("")
  const [twitterHandle, setTwitterHandle] = useState("")
  const [githubHandle, setGithubHandle] = useState("")
  const [website, setWebsite] = useState("")
  const [discordHandle, setDiscordHandle] = useState("")

  useEffect(() => {
    async function loadProfile() {
      if (!publicKey) {
        setIsLoading(false)
        return
      }

      try {
        const profileData = await getCreatorProfile(publicKey)
        if (profileData) {
          setProfile(profileData)
          // Populate form with existing data
          setDisplayName(profileData.display_name || "")
          setBio(profileData.bio || "")
          setAvatarUrl(profileData.avatar_url || "")
          setBannerUrl(profileData.banner_url || "")
          setProfileSlug(profileData.profile_slug || "")
          if (profileData.social_links) {
            setTwitterHandle(profileData.social_links.twitter || "")
            setGithubHandle(profileData.social_links.github || "")
            setWebsite(profileData.social_links.website || "")
            setDiscordHandle(profileData.social_links.discord || "")
          }
        }
      } catch (err) {
        console.error("Error loading profile:", err)
      } finally {
        setIsLoading(false)
      }
    }

    loadProfile()
  }, [publicKey])

  useEffect(() => {
    if (!isLoading) {
      mountReveals()
      mountScramble()
    }
  }, [isLoading])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !publicKey) return

    setIsUploadingAvatar(true)
    setError(null)

    try {
      // Create form data
      const formData = new FormData()
      formData.append('file', file)

      // Upload to API (wallet in query string)
      const wallet = publicKey
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/profiles/upload-avatar?wallet=${wallet}`, {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to upload avatar')
      }

      // Update local state with new avatar URL
      setAvatarUrl(result.avatarUrl)
      setSuccessMessage('Avatar uploaded successfully!')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload avatar')
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !publicKey) return

    setIsUploadingBanner(true)
    setError(null)

    try {
      // Create form data
      const formData = new FormData()
      formData.append('file', file)

      // Upload to API (wallet in query string)
      const wallet = publicKey
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/profiles/upload-banner?wallet=${wallet}`, {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to upload banner')
      }

      // Update local state with new banner URL
      setBannerUrl(result.bannerUrl)
      setSuccessMessage('Banner uploaded successfully!')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload banner')
    } finally {
      setIsUploadingBanner(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!publicKey) {
      setError("Please connect your wallet to edit your profile")
      return
    }

    setIsSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      // Prepare update payload
      const updates: UpdateCreatorProfilePayload = {}
      if (displayName) updates.display_name = displayName
      if (bio) updates.bio = bio
      if (avatarUrl) updates.avatar_url = avatarUrl
      if (bannerUrl) updates.banner_url = bannerUrl
      if (profileSlug) updates.profile_slug = profileSlug

      // Only include social_links if at least one field is filled
      if (twitterHandle || githubHandle || website || discordHandle) {
        updates.social_links = {}
        if (twitterHandle) updates.social_links.twitter = twitterHandle
        if (githubHandle) updates.social_links.github = githubHandle
        if (website) updates.social_links.website = website
        if (discordHandle) updates.social_links.discord = discordHandle
      }

      // Create simple auth token with wallet (Privy handles authentication)
      const authToken = btoa(JSON.stringify({
        wallet: publicKey,
        timestamp: Date.now()
      }))

      await updateCreatorProfile(updates, authToken)

      setSuccessMessage("Profile updated successfully!")

      // Redirect to profile page after 1.5 seconds
      setTimeout(() => {
        router.push(`/profile/${publicKey}`)
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-neon-black">
        <div className="container mx-auto px-6 py-16 flex items-center justify-center">
          <p className="text-neon-grey font-mono text-sm">Loading...</p>
        </div>
      </main>
    )
  }

  if (!publicKey) {
    return (
      <main className="min-h-screen bg-neon-black">
        <div className="container mx-auto px-6 py-16">
          <div className="text-center max-w-md mx-auto">
            <h1 className="text-neon-white font-sans text-2xl mb-4">Wallet Not Connected</h1>
            <p className="text-neon-grey font-mono text-sm mb-8">
              Please connect your wallet to edit your profile
            </p>
            <Link href="/" className="text-neon-blue-light hover:text-neon-blue-dark font-mono text-sm">
              ← Go Home
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-neon-black">
      <div className="container mx-auto px-6 py-24">
        {/* Header */}
        <div className="mb-8" data-reveal>
          <Link
            href={`/profile/${publicKey}`}
            className="inline-flex items-center gap-2 text-neon-grey hover:text-neon-blue-light transition-colors font-mono text-sm mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Profile
          </Link>
          <h1 className="font-sans text-neon-white text-3xl md:text-4xl mb-2" data-scramble>
            Edit Profile
          </h1>
          <p className="text-neon-grey font-mono text-sm">
            Update your public creator profile
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="max-w-2xl" data-reveal>
          <Card className="bg-neon-dark border-neon-blue-dark/20">
            <CardHeader>
              <CardTitle className="text-neon-white font-sans">Profile Information</CardTitle>
              <CardDescription className="text-neon-grey font-mono text-sm">
                All fields are optional. Leave blank to keep existing values.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Display Name */}
              <div>
                <Label htmlFor="displayName" className="text-neon-white font-mono text-sm mb-2 block">
                  Display Name
                </Label>
                <Input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your display name"
                  maxLength={100}
                  className="bg-neon-black border-neon-blue-dark/40 text-neon-white font-mono"
                />
              </div>

              {/* Bio */}
              <div>
                <Label htmlFor="bio" className="text-neon-white font-mono text-sm mb-2 block">
                  Bio
                </Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about yourself..."
                  maxLength={500}
                  rows={4}
                  className="bg-neon-black border-neon-blue-dark/40 text-neon-white font-mono"
                />
                <p className="text-neon-grey font-mono text-xs mt-1">
                  {bio.length}/500 characters
                </p>
              </div>

              {/* Avatar Upload */}
              <div>
                <Label className="text-neon-white font-mono text-sm mb-2 block">
                  Profile Avatar
                </Label>
                {avatarUrl && (
                  <div className="mb-3 flex items-center gap-4">
                    <img
                      src={avatarUrl}
                      alt="Avatar preview"
                      className="w-20 h-20 rounded-full object-cover border-2 border-neon-blue-dark/40"
                    />
                    <span className="text-neon-grey font-mono text-xs">Current avatar</span>
                  </div>
                )}
                <div className="flex gap-3">
                  <label
                    htmlFor="avatarUpload"
                    className={`btn-primary cursor-pointer flex items-center gap-2 ${isUploadingAvatar ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isUploadingAvatar ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        Upload Avatar
                      </>
                    )}
                  </label>
                  <input
                    id="avatarUpload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleAvatarUpload}
                    disabled={isUploadingAvatar}
                    className="hidden"
                  />
                </div>
                <p className="text-neon-grey font-mono text-xs mt-2">
                  Recommended: Square image, 512×512px or larger. Max 10MB.
                </p>
              </div>

              {/* Banner Upload */}
              <div>
                <Label className="text-neon-white font-mono text-sm mb-2 block">
                  Profile Banner
                </Label>
                {bannerUrl && (
                  <div className="mb-3">
                    <img
                      src={bannerUrl}
                      alt="Banner preview"
                      className="w-full h-32 object-cover border-2 border-neon-blue-dark/40"
                    />
                    <span className="text-neon-grey font-mono text-xs mt-1 block">Current banner</span>
                  </div>
                )}
                <div className="flex gap-3">
                  <label
                    htmlFor="bannerUpload"
                    className={`btn-primary cursor-pointer flex items-center gap-2 ${isUploadingBanner ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isUploadingBanner ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        Upload Banner
                      </>
                    )}
                  </label>
                  <input
                    id="bannerUpload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleBannerUpload}
                    disabled={isUploadingBanner}
                    className="hidden"
                  />
                </div>
                <p className="text-neon-grey font-mono text-xs mt-2">
                  Recommended: 1500×500px (3:1 ratio). Supports animated GIFs. Max 10MB.
                </p>
              </div>

              {/* Profile Slug */}
              <div>
                <Label htmlFor="profileSlug" className="text-neon-white font-mono text-sm mb-2 block">
                  Custom Profile Slug
                </Label>
                <Input
                  id="profileSlug"
                  type="text"
                  value={profileSlug}
                  onChange={(e) => setProfileSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="my-username"
                  maxLength={100}
                  className="bg-neon-black border-neon-blue-dark/40 text-neon-white font-mono"
                />
                <p className="text-neon-grey font-mono text-xs mt-1">
                  Your profile will be accessible at /profile/{profileSlug || 'your-slug'}
                </p>
              </div>

              {/* Social Links */}
              <div className="pt-4 border-t border-neon-blue-dark/20">
                <h3 className="text-neon-white font-mono text-sm mb-4">Social Links</h3>

                <div className="space-y-4">
                  {/* Twitter */}
                  <div>
                    <Label htmlFor="twitter" className="text-neon-white font-mono text-sm mb-2 block">
                      Twitter
                    </Label>
                    <Input
                      id="twitter"
                      type="text"
                      value={twitterHandle}
                      onChange={(e) => setTwitterHandle(e.target.value)}
                      placeholder="@username"
                      className="bg-neon-black border-neon-blue-dark/40 text-neon-white font-mono"
                    />
                  </div>

                  {/* GitHub */}
                  <div>
                    <Label htmlFor="github" className="text-neon-white font-mono text-sm mb-2 block">
                      GitHub
                    </Label>
                    <Input
                      id="github"
                      type="text"
                      value={githubHandle}
                      onChange={(e) => setGithubHandle(e.target.value)}
                      placeholder="username"
                      className="bg-neon-black border-neon-blue-dark/40 text-neon-white font-mono"
                    />
                  </div>

                  {/* Website */}
                  <div>
                    <Label htmlFor="website" className="text-neon-white font-mono text-sm mb-2 block">
                      Website
                    </Label>
                    <Input
                      id="website"
                      type="url"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://example.com"
                      className="bg-neon-black border-neon-blue-dark/40 text-neon-white font-mono"
                    />
                  </div>

                  {/* Discord */}
                  <div>
                    <Label htmlFor="discord" className="text-neon-white font-mono text-sm mb-2 block">
                      Discord
                    </Label>
                    <Input
                      id="discord"
                      type="text"
                      value={discordHandle}
                      onChange={(e) => setDiscordHandle(e.target.value)}
                      placeholder="username#1234"
                      className="bg-neon-black border-neon-blue-dark/40 text-neon-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Error/Success Messages */}
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 font-mono text-sm">
                  {error}
                </div>
              )}

              {successMessage && (
                <div className="p-4 bg-neon-blue-dark/10 border border-neon-blue-light/30 text-neon-blue-light font-mono text-sm">
                  {successMessage}
                </div>
              )}

              {/* Submit Button */}
              <div className="flex gap-4 pt-4">
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="btn-primary flex-1"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
                <Link
                  href={`/profile/${publicKey}`}
                  className="btn-ghost flex-1 text-center"
                >
                  Cancel
                </Link>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </main>
  )
}
