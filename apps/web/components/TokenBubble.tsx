"use client"
import { useEffect, useState } from "react"
import Link from "next/link"

interface TokenBubbleProps {
  address?: string
  twitterUrl?: string
  tokenUrl?: string
}

export default function TokenBubble({
  address = "TBD",
  twitterUrl = "https://x.com/Blinkx402",
  tokenUrl
}: TokenBubbleProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Prevent hydration mismatch by rendering invisible placeholder
  if (!mounted) {
    return (
      <div
        className="fixed bottom-6 right-6 z-50 opacity-0 pointer-events-none"
        aria-hidden="true"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8" />
          <div className="h-8 w-24" />
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-2 duration-700"
      style={{ animationDelay: "300ms" }}
    >
      <div className="flex items-center gap-3">
        {/* X (Twitter) Link */}
        <Link
          href={twitterUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="relative group"
        >
          <div
            className="absolute inset-0 rounded-full blur-lg opacity-50 group-hover:opacity-80 transition-opacity duration-300"
            style={{
              background: "radial-gradient(circle, rgba(90, 180, 255, 0.6) 0%, rgba(59, 143, 217, 0.4) 50%, rgba(45, 123, 198, 0.2) 70%, transparent 100%)",
            }}
          />
          <div
            className="relative backdrop-blur-md rounded-full p-2.5 border shadow-lg overflow-hidden transition-all duration-300 group-hover:scale-110"
            style={{
              background: "rgba(30, 30, 30, 0.9)",
              borderColor: "rgba(90, 180, 255, 0.6)",
              boxShadow: "0 0 20px rgba(90, 180, 255, 0.3), 0 0 40px rgba(59, 143, 217, 0.2), inset 0 0 15px rgba(90, 180, 255, 0.05)",
            }}
          >
            {/* X Logo SVG */}
            <svg
              viewBox="0 0 24 24"
              className="w-4 h-4 transition-all duration-300"
              style={{
                fill: "url(#xGradient)",
                filter: "drop-shadow(0 0 4px rgba(90, 180, 255, 0.4))",
              }}
            >
              <defs>
                <linearGradient id="xGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: "#5AB4FF", stopOpacity: 1 }} />
                  <stop offset="50%" style={{ stopColor: "#7CC7FF", stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: "#3B8FD9", stopOpacity: 1 }} />
                </linearGradient>
              </defs>
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.80l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </div>
        </Link>

        {/* Token Address Bubble */}
        {tokenUrl ? (
          <Link
            href={tokenUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="relative group block"
          >
            {/* Animated glow effect */}
            <div
              className="absolute inset-0 rounded-full blur-lg opacity-50 group-hover:opacity-80 transition-opacity duration-300"
              style={{
                background: "radial-gradient(circle, rgba(90, 180, 255, 0.5) 0%, rgba(59, 143, 217, 0.3) 50%, rgba(45, 123, 198, 0.1) 70%, transparent 100%)",
                animation: "pulse 3s ease-in-out infinite",
              }}
            />

            {/* Main bubble */}
            <div
              className="relative backdrop-blur-md rounded-full px-3.5 py-1.5 border shadow-lg overflow-hidden transition-all duration-300 group-hover:scale-105"
              style={{
                background: "rgba(30, 30, 30, 0.9)",
                borderColor: "rgba(90, 180, 255, 0.6)",
                boxShadow: "0 0 20px rgba(90, 180, 255, 0.3), 0 0 40px rgba(59, 143, 217, 0.2), inset 0 0 15px rgba(90, 180, 255, 0.05)",
              }}
            >
              {/* Noise texture overlay */}
              <svg className="absolute inset-0 w-full h-full opacity-5 pointer-events-none">
                <filter id="token-bubble-noise">
                  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch" />
                </filter>
                <rect width="100%" height="100%" filter="url(#token-bubble-noise)" />
              </svg>

              {/* Content */}
              <div className="relative flex items-center gap-1.5">
                {/* Animated dot indicator */}
                <div className="relative flex items-center justify-center">
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: "linear-gradient(135deg, #5AB4FF 0%, #7CC7FF 50%, #3B8FD9 100%)",
                      boxShadow: "0 0 12px rgba(90, 180, 255, 0.8), 0 0 20px rgba(59, 143, 217, 0.4)",
                      animation: "ping 2s cubic-bezier(0, 0, 0.2, 1) infinite",
                    }}
                  />
                  <div
                    className="absolute w-1.5 h-1.5 rounded-full"
                    style={{
                      background: "linear-gradient(135deg, #5AB4FF 0%, #7CC7FF 50%, #3B8FD9 100%)",
                    }}
                  />
                </div>

                {/* Text */}
                <div className="flex items-center gap-1 font-mono text-xs">
                  <span
                    className="text-neon-blue-light font-medium"
                    style={{
                      textShadow: "0 0 8px rgba(90, 180, 255, 0.6)",
                    }}
                  >
                    CA:
                  </span>
                  <span
                    className="text-neon-white font-medium tracking-wide"
                    style={{
                      textShadow: "0 0 10px rgba(90, 180, 255, 0.4), 0 0 20px rgba(59, 143, 217, 0.2)",
                    }}
                  >
                    {address}
                  </span>
                </div>
              </div>

              {/* Shine effect on hover */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{
                  background: "linear-gradient(45deg, transparent 30%, rgba(90, 180, 255, 0.15) 50%, transparent 70%)",
                  transform: "translateX(-100%)",
                  animation: "shine 3s ease-in-out infinite",
                }}
              />
            </div>
          </Link>
        ) : (
          <div className="relative group">
            {/* Animated glow effect */}
            <div
              className="absolute inset-0 rounded-full blur-lg opacity-50 group-hover:opacity-80 transition-opacity duration-300"
              style={{
                background: "radial-gradient(circle, rgba(90, 180, 255, 0.5) 0%, rgba(59, 143, 217, 0.3) 50%, rgba(45, 123, 198, 0.1) 70%, transparent 100%)",
                animation: "pulse 3s ease-in-out infinite",
              }}
            />

            {/* Main bubble */}
            <div
              className="relative backdrop-blur-md rounded-full px-3.5 py-1.5 border shadow-lg overflow-hidden"
              style={{
                background: "rgba(30, 30, 30, 0.9)",
                borderColor: "rgba(90, 180, 255, 0.6)",
                boxShadow: "0 0 20px rgba(90, 180, 255, 0.3), 0 0 40px rgba(59, 143, 217, 0.2), inset 0 0 15px rgba(90, 180, 255, 0.05)",
              }}
            >
              {/* Noise texture overlay */}
              <svg className="absolute inset-0 w-full h-full opacity-5 pointer-events-none">
                <filter id="token-bubble-noise">
                  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch" />
                </filter>
                <rect width="100%" height="100%" filter="url(#token-bubble-noise)" />
              </svg>

              {/* Content */}
              <div className="relative flex items-center gap-1.5">
                {/* Animated dot indicator */}
                <div className="relative flex items-center justify-center">
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: "linear-gradient(135deg, #5AB4FF 0%, #7CC7FF 50%, #3B8FD9 100%)",
                      boxShadow: "0 0 12px rgba(90, 180, 255, 0.8), 0 0 20px rgba(59, 143, 217, 0.4)",
                      animation: "ping 2s cubic-bezier(0, 0, 0.2, 1) infinite",
                    }}
                  />
                  <div
                    className="absolute w-1.5 h-1.5 rounded-full"
                    style={{
                      background: "linear-gradient(135deg, #5AB4FF 0%, #7CC7FF 50%, #3B8FD9 100%)",
                    }}
                  />
                </div>

                {/* Text */}
                <div className="flex items-center gap-1 font-mono text-xs">
                  <span
                    className="text-neon-blue-light font-medium"
                    style={{
                      textShadow: "0 0 8px rgba(90, 180, 255, 0.6)",
                    }}
                  >
                    CA:
                  </span>
                  <span
                    className="text-neon-white font-medium tracking-wide"
                    style={{
                      textShadow: "0 0 10px rgba(90, 180, 255, 0.4), 0 0 20px rgba(59, 143, 217, 0.2)",
                    }}
                  >
                    {address}
                  </span>
                </div>
              </div>

              {/* Shine effect on hover */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{
                  background: "linear-gradient(45deg, transparent 30%, rgba(90, 180, 255, 0.15) 50%, transparent 70%)",
                  transform: "translateX(-100%)",
                  animation: "shine 3s ease-in-out infinite",
                }}
              />
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }

        @keyframes shine {
          0% {
            transform: translateX(-100%);
          }
          50%, 100% {
            transform: translateX(200%);
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 0.5;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.05);
          }
        }
      `}</style>
    </div>
  )
}
