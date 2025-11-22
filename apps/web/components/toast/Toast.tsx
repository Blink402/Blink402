"use client"

import { useEffect, useState } from 'react'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import type { Toast as ToastType } from './ToastContext'

interface ToastProps {
  toast: ToastType
  onClose: (id: string) => void
}

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

const colorMap = {
  success: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    icon: 'text-green-500',
    text: 'text-green-400',
  },
  error: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    icon: 'text-red-500',
    text: 'text-red-400',
  },
  warning: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    icon: 'text-yellow-500',
    text: 'text-yellow-400',
  },
  info: {
    bg: 'bg-neon-blue-light/10',
    border: 'border-neon-blue-light/30',
    icon: 'text-neon-blue-light',
    text: 'text-neon-blue-light',
  },
}

export function Toast({ toast, onClose }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false)
  const Icon = iconMap[toast.type]
  const colors = colorMap[toast.type]

  useEffect(() => {
    if (!toast.duration || toast.duration <= 0) return

    const timer = setTimeout(() => {
      setIsExiting(true)
      setTimeout(() => onClose(toast.id), 300) // Match animation duration
    }, toast.duration - 300)

    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, onClose])

  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => onClose(toast.id), 300)
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`
        ${colors.bg} ${colors.border}
        border rounded-lg p-4 shadow-lg backdrop-blur-sm
        flex items-start gap-3 min-w-[320px] max-w-md
        transition-all duration-300 ease-out
        ${isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}
      `}
    >
      <Icon className={`${colors.icon} flex-shrink-0 mt-0.5`} size={20} />

      <p className={`${colors.text} text-sm font-mono flex-1`}>
        {toast.message}
      </p>

      <button
        onClick={handleClose}
        className={`
          ${colors.icon} hover:opacity-70 active:opacity-50
          transition-opacity flex-shrink-0 rounded p-0.5
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-blue-light
        `}
        aria-label="Close notification"
      >
        <X size={16} />
      </button>
    </div>
  )
}
