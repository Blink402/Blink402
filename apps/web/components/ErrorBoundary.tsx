'use client'

import React, { Component, type ReactNode } from 'react'
import { logger } from '@/lib/logger'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('Error boundary caught an error:', error, { errorInfo })

    // In production, you could send this to an error tracking service
    if (process.env.NODE_ENV === 'production') {
      // Example: sendToErrorTrackingService(error, errorInfo)
    }
  }

  render() {
    if (this.state.hasError) {
      // Render custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI matching neon theme
      return (
        <div className="min-h-screen bg-neon-black flex items-center justify-center px-6">
          <div className="max-w-md w-full">
            <div className="bg-neon-dark border border-red-500/30 rounded-lg p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500 flex items-center justify-center mx-auto mb-6">
                <span className="text-red-500 text-3xl">⚠</span>
              </div>

              <h1 className="text-neon-white font-mono text-2xl mb-4">
                Something went wrong
              </h1>

              <p className="text-neon-grey font-mono text-sm mb-6">
                An unexpected error occurred. We've been notified and are working on a fix.
              </p>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="text-left mb-6">
                  <summary className="text-neon-blue-light font-mono text-xs cursor-pointer mb-2">
                    Error details (dev only)
                  </summary>
                  <pre className="text-red-400 font-mono text-xs overflow-auto p-4 bg-neon-black rounded border border-red-500/30">
                    {this.state.error.toString()}
                    {this.state.error.stack}
                  </pre>
                </details>
              )}

              <button
                onClick={() => window.location.reload()}
                className="btn-primary w-full"
              >
                Reload page
              </button>

              <a
                href="/"
                className="block mt-4 text-neon-blue-light hover:text-neon-blue-dark font-mono text-sm"
              >
                ← Go to homepage
              </a>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
