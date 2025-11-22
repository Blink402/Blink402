'use client'

import { useEffect, useRef } from 'react'

export interface ConsoleLog {
  timestamp: number
  type: 'info' | 'success' | 'error' | 'warning'
  message: string
}

interface DemoConsoleProps {
  logs: ConsoleLog[]
  className?: string
}

export function DemoConsole({ logs, className = '' }: DemoConsoleProps) {
  const consoleRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight
    }
  }, [logs])

  const getTypeStyles = (type: ConsoleLog['type']) => {
    switch (type) {
      case 'success':
        return 'text-neon-blue-light'
      case 'error':
        return 'text-red-400'
      case 'warning':
        return 'text-yellow-400'
      default:
        return 'text-neon-grey'
    }
  }

  const getTypeIcon = (type: ConsoleLog['type']) => {
    switch (type) {
      case 'success':
        return '✓'
      case 'error':
        return '✗'
      case 'warning':
        return '⚠'
      default:
        return '→'
    }
  }

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    })
  }

  return (
    <div className={`rounded-lg border border-neon-blue-light/30 bg-neon-black ${className}`}>
      {/* Console Header */}
      <div className="border-b border-neon-blue-light/30 px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-500/50" />
            <div className="h-3 w-3 rounded-full bg-yellow-500/50" />
            <div className="h-3 w-3 rounded-full bg-green-500/50" />
          </div>
          <span className="font-mono text-xs text-neon-grey">console.log</span>
        </div>
      </div>

      {/* Console Body */}
      <div
        ref={consoleRef}
        className="h-64 overflow-y-auto p-4 font-mono text-xs md:text-sm"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(39, 218, 180, 0.3) rgba(30, 30, 30, 0.5)',
        }}
      >
        {logs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-neon-grey/50">
            Waiting for demo to start...
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map((log, index) => (
              <div key={index} className="flex gap-3">
                <span className="text-neon-grey/50">{formatTimestamp(log.timestamp)}</span>
                <span className={getTypeStyles(log.type)}>{getTypeIcon(log.type)}</span>
                <span className={getTypeStyles(log.type)}>{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Console Footer */}
      <div className="border-t border-neon-blue-light/30 px-4 py-2">
        <div className="flex items-center justify-between text-xs text-neon-grey">
          <span>{logs.length} log{logs.length !== 1 ? 's' : ''}</span>
          <span className="font-mono">
            {logs.length > 0 && logs[logs.length - 1].type === 'success' && (
              <span className="text-neon-blue-light">● Ready</span>
            )}
            {logs.length > 0 && logs[logs.length - 1].type === 'error' && (
              <span className="text-red-400">● Error</span>
            )}
            {logs.length > 0 &&
              logs[logs.length - 1].type !== 'success' &&
              logs[logs.length - 1].type !== 'error' && (
                <span className="text-yellow-400">● Processing</span>
              )}
          </span>
        </div>
      </div>
    </div>
  )
}
