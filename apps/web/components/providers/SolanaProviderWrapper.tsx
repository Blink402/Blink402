'use client'

import dynamic from 'next/dynamic'
import { ReactNode } from 'react'

// Dynamically import SolanaProvider with no SSR
const SolanaProvider = dynamic(
  () => import('./SolanaProvider').then(mod => ({ default: mod.SolanaProvider })),
  {
    ssr: false,
    loading: () => <div className="min-h-screen bg-neon-black">Loading...</div>
  }
)

// Dynamically import AuthProvider with no SSR
const AuthProvider = dynamic(
  () => import('./AuthProvider').then(mod => ({ default: mod.AuthProvider })),
  {
    ssr: false
  }
)

export function SolanaProviderWrapper({ children }: { children: ReactNode }) {
  return (
    <SolanaProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </SolanaProvider>
  )
}