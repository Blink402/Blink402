'use client'

import { useState } from 'react'
import { DemoConsole, type ConsoleLog } from './DemoConsole'

type DemoState = 'idle' | 'requesting' | 'verifying' | 'calling' | 'success' | 'failed'

interface DemoResult {
  fact: string
  reference: string
  signature: string
  duration_ms: number
  timestamp: string
}

// Use Next.js API routes which proxy to the backend (avoids CORS issues)
const API_BASE_URL = '/api'

export function DemoRunner() {
  const [state, setState] = useState<DemoState>('idle')
  const [logs, setLogs] = useState<ConsoleLog[]>([])
  const [result, setResult] = useState<DemoResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const addLog = (type: ConsoleLog['type'], message: string) => {
    setLogs((prev) => [...prev, { timestamp: Date.now(), type, message }])
  }

  const resetDemo = () => {
    setState('idle')
    setLogs([])
    setResult(null)
    setError(null)
  }

  const runDemo = async () => {
    resetDemo()
    setState('requesting')
    addLog('info', 'Demo started...')

    try {
      // Step 1: Generate mock transaction
      addLog('info', 'Generating mock transaction reference...')
      await new Promise((resolve) => setTimeout(resolve, 300))
      const mockRef = Math.random().toString(36).substring(2, 15)
      addLog('success', `Mock reference generated: ${mockRef}`)

      // Step 2: Simulate payment
      setState('verifying')
      addLog('info', 'Simulating payment verification...')
      addLog('info', 'This would normally check the Solana blockchain')
      await new Promise((resolve) => setTimeout(resolve, 500))
      addLog('success', 'Payment verified (simulated)')

      // Step 3: Call the API
      setState('calling')
      addLog('info', 'Calling Dog Facts API endpoint...')
      addLog('info', `POST ${API_BASE_URL}/demo/dog-facts`)

      const response = await fetch(`${API_BASE_URL}/demo/dog-facts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.details || errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.details || data.error || 'Unknown error')
      }

      addLog('success', `API call successful (${data.data.metadata.duration_ms}ms)`)
      addLog('info', `Received dog fact from upstream API`)

      // Step 4: Display result
      setState('success')
      setResult({
        fact: data.data.fact,
        reference: data.data.metadata.reference,
        signature: data.data.metadata.signature,
        duration_ms: data.data.metadata.duration_ms,
        timestamp: data.data.metadata.timestamp,
      })
      addLog('success', 'Demo completed successfully!')
    } catch (err) {
      setState('failed')
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      addLog('error', `Demo failed: ${errorMessage}`)
    }
  }

  const getStateLabel = () => {
    switch (state) {
      case 'idle':
        return 'Ready to start'
      case 'requesting':
        return 'Generating transaction...'
      case 'verifying':
        return 'Verifying payment...'
      case 'calling':
        return 'Calling API...'
      case 'success':
        return 'Success!'
      case 'failed':
        return 'Failed'
    }
  }

  const getStateColor = () => {
    switch (state) {
      case 'success':
        return 'text-neon-blue-light'
      case 'failed':
        return 'text-red-400'
      case 'idle':
        return 'text-neon-grey'
      default:
        return 'text-yellow-400'
    }
  }

  const isLoading = ['requesting', 'verifying', 'calling'].includes(state)

  return (
    <div className="space-y-6">
      {/* Status Bar */}
      <div className="flex items-center justify-between rounded-lg border border-dashed border-neon-blue-light/30 bg-neon-dark px-6 py-4">
        <div className="flex items-center gap-3">
          <div
            className={`h-3 w-3 rounded-full ${
              state === 'success'
                ? 'bg-neon-blue-light animate-pulse'
                : state === 'failed'
                ? 'bg-red-400'
                : isLoading
                ? 'bg-yellow-400 animate-pulse'
                : 'bg-neon-grey/50'
            }`}
          />
          <span className={`font-medium ${getStateColor()}`}>{getStateLabel()}</span>
        </div>

        <button
          onClick={runDemo}
          disabled={isLoading}
          className={`rounded-lg border-2 border-dashed px-6 py-2 font-medium transition-all ${
            isLoading
              ? 'cursor-not-allowed border-neon-grey/30 text-neon-grey/50'
              : 'border-neon-blue-light text-neon-blue-light hover:border-neon-blue-dark hover:bg-neon-blue-light/10 hover:text-neon-blue-dark hover:shadow-[0_0_20px_rgba(39,218,180,0.3)]'
          }`}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg
                className="h-5 w-5 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Running...
            </span>
          ) : (
            'Run Demo'
          )}
        </button>
      </div>

      {/* Progress Steps */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[
          {
            key: 'requesting',
            label: 'Transaction',
            icon: (isActive: boolean, isCompleted: boolean, isFailed: boolean) => (
              <div className={`w-10 h-10 mx-auto rounded border-2 border-dashed flex items-center justify-center font-mono text-xl font-bold ${
                isActive ? 'border-yellow-400 text-yellow-400' :
                isCompleted ? 'border-neon-blue-light text-neon-blue-light' :
                isFailed ? 'border-red-400 text-red-400' :
                'border-neon-grey/50 text-neon-grey/50'
              }`}>
                $
              </div>
            )
          },
          {
            key: 'verifying',
            label: 'Verification',
            icon: (isActive: boolean, isCompleted: boolean, isFailed: boolean) => (
              <div className={`w-10 h-10 mx-auto rounded-full border-2 border-dashed flex items-center justify-center font-mono text-xl font-bold ${
                isActive ? 'border-yellow-400 text-yellow-400' :
                isCompleted ? 'border-neon-blue-light text-neon-blue-light' :
                isFailed ? 'border-red-400 text-red-400' :
                'border-neon-grey/50 text-neon-grey/50'
              }`}>
                ✓
              </div>
            )
          },
          {
            key: 'calling',
            label: 'API Call',
            icon: (isActive: boolean, isCompleted: boolean, isFailed: boolean) => (
              <div className={`w-10 h-10 mx-auto rounded border-2 border-dashed flex items-center justify-center font-mono text-xl font-bold ${
                isActive ? 'border-yellow-400 text-yellow-400' :
                isCompleted ? 'border-neon-blue-light text-neon-blue-light' :
                isFailed ? 'border-red-400 text-red-400' :
                'border-neon-grey/50 text-neon-grey/50'
              }`}>
                ⟳
              </div>
            )
          },
          {
            key: 'success',
            label: 'Result',
            icon: (isActive: boolean, isCompleted: boolean, isFailed: boolean) => (
              <div className={`w-10 h-10 mx-auto rounded border-2 border-dashed flex items-center justify-center font-mono text-xl font-bold ${
                isActive ? 'border-yellow-400 text-yellow-400' :
                isCompleted ? 'border-neon-blue-light text-neon-blue-light' :
                isFailed ? 'border-red-400 text-red-400' :
                'border-neon-grey/50 text-neon-grey/50'
              }`}>
                ★
              </div>
            )
          },
        ].map((step, index) => {
          const stepStates: DemoState[] = ['requesting', 'verifying', 'calling', 'success']
          const currentIndex = stepStates.indexOf(state)
          const stepIndex = stepStates.indexOf(step.key as DemoState)
          const isActive = stepIndex === currentIndex
          const isCompleted = stepIndex < currentIndex || state === 'success'
          const isFailed = state === 'failed' && stepIndex <= currentIndex

          return (
            <div
              key={step.key}
              className={`rounded-lg border border-dashed p-4 text-center transition-all ${
                isActive
                  ? 'border-yellow-400 bg-yellow-400/10'
                  : isCompleted
                  ? 'border-neon-blue-light bg-neon-blue-light/10'
                  : isFailed
                  ? 'border-red-400 bg-red-400/10'
                  : 'border-neon-grey/30 bg-neon-dark'
              }`}
            >
              <div className="mb-3">
                {step.icon(isActive, isCompleted, isFailed)}
              </div>
              <div
                className={`text-sm font-medium font-mono ${
                  isActive
                    ? 'text-yellow-400'
                    : isCompleted
                    ? 'text-neon-blue-light'
                    : isFailed
                    ? 'text-red-400'
                    : 'text-neon-grey'
                }`}
              >
                {step.label}
              </div>
            </div>
          )
        })}
      </div>

      {/* Console */}
      <DemoConsole logs={logs} />

      {/* Result */}
      {result && (
        <div className="rounded-lg border border-dashed border-neon-blue-light bg-neon-blue-light/5 p-6">
          <h3 className="mb-4 font-heading text-xl font-light text-neon-blue-light">
            Dog Fact Result
          </h3>
          <div className="space-y-4">
            <div className="rounded-lg bg-neon-dark p-4">
              <p className="text-lg leading-relaxed">{result.fact}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
              <div>
                <span className="text-neon-grey">Reference:</span>
                <p className="font-mono text-xs text-white break-all">
                  {result.reference.substring(0, 32)}...
                </p>
              </div>
              <div>
                <span className="text-neon-grey">Duration:</span>
                <p className="font-mono text-white">{result.duration_ms}ms</p>
              </div>
              <div>
                <span className="text-neon-grey">Signature:</span>
                <p className="font-mono text-xs text-white break-all">
                  {result.signature.substring(0, 32)}...
                </p>
              </div>
              <div>
                <span className="text-neon-grey">Timestamp:</span>
                <p className="font-mono text-white">
                  {new Date(result.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-dashed border-red-400 bg-red-400/5 p-6">
          <h3 className="mb-2 font-heading text-xl font-light text-red-400">Error</h3>
          <p className="text-neon-grey">{error}</p>
          <button
            onClick={resetDemo}
            className="mt-4 rounded-lg border border-dashed border-red-400 px-4 py-2 text-sm text-red-400 transition-all hover:bg-red-400/10"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  )
}
