'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import bs58 from 'bs58'
import type { AuthToken } from '@/lib/auth'
import { encodeAuthToken } from '@/lib/auth'
import { logger } from '@/lib/logger'

interface AuthContextType {
  authToken: string | null
  isAuthenticated: boolean
  isAuthenticating: boolean
  signIn: () => Promise<boolean>
  signOut: () => void
  wallet: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const AUTH_TOKEN_KEY = 'blink402_auth_token'

export function AuthProvider({ children }: { children: ReactNode }) {
  const { publicKey, signMessage, connected } = useWallet()
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [isAuthenticating, setIsAuthenticating] = useState(false)

  // Check for existing auth token on mount
  useEffect(() => {
    const storedToken = localStorage.getItem(AUTH_TOKEN_KEY)
    if (storedToken) {
      // Verify token is not expired
      try {
        const tokenData: AuthToken = JSON.parse(
          Buffer.from(storedToken, 'base64').toString('utf-8')
        )
        if (Date.now() < tokenData.expiresAt) {
          setAuthToken(storedToken)
        } else {
          localStorage.removeItem(AUTH_TOKEN_KEY)
        }
      } catch (error) {
        logger.error('Error parsing stored auth token:', error)
        localStorage.removeItem(AUTH_TOKEN_KEY)
      }
    }
  }, [])

  // Clear auth token if wallet disconnects
  useEffect(() => {
    if (!connected) {
      signOut()
    }
  }, [connected])

  const signIn = async (): Promise<boolean> => {
    if (!publicKey || !signMessage) {
      logger.error('Wallet not connected or does not support message signing')
      return false
    }

    setIsAuthenticating(true)

    try {
      const walletAddress = publicKey.toBase58()

      // Generate auth message
      const response = await fetch('/api/auth/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: walletAddress }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate auth message')
      }

      const { message } = await response.json()

      // Sign the message with wallet
      const messageBytes = new TextEncoder().encode(message)
      const signatureBytes = await signMessage(messageBytes)
      const signature = bs58.encode(signatureBytes)

      // Create and store auth token
      const token: AuthToken = {
        wallet: walletAddress,
        signature,
        message,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      }

      const encodedToken = encodeAuthToken(token)

      // Store in localStorage and state
      localStorage.setItem(AUTH_TOKEN_KEY, encodedToken)
      setAuthToken(encodedToken)

      setIsAuthenticating(false)
      return true
    } catch (error) {
      logger.error('Error signing in:', error)
      setIsAuthenticating(false)
      return false
    }
  }

  const signOut = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    setAuthToken(null)
  }

  const value: AuthContextType = {
    authToken,
    isAuthenticated: !!authToken,
    isAuthenticating,
    signIn,
    signOut,
    wallet: publicKey?.toBase58() || null,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
