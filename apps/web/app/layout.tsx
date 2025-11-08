import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { PromoBanner } from "@/components/PromoBanner"
import { Navigation } from "@/components/Navigation"
import TokenBubble from "@/components/TokenBubble"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { SolanaProviderWrapper } from "@/components/providers/SolanaProviderWrapper"

const geistSans = Geist({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-sans",
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "Blink402 - Turn APIs into Paid Links",
  description: "Turn any API into a pay-per-call Blink—shareable anywhere on the web.",
  metadataBase: new URL('https://blink402.dev'),
  openGraph: {
    title: "Blink402 - Turn APIs into Paid Links",
    description: "Turn any API into a pay-per-call Blink—shareable anywhere on the web.",
    url: "https://blink402.dev",
    siteName: "Blink402",
    images: [
      {
        url: "https://blink402.dev/blink-402-webpreview.png",
        secureUrl: "https://blink402.dev/blink-402-webpreview.png",
        width: 1200,
        height: 630,
        alt: "Blink402 - Turn APIs into Paid Links",
        type: "image/png",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Blink402 - Turn APIs into Paid Links",
    description: "Turn any API into a pay-per-call Blink—shareable anywhere on the web.",
    site: "@Blinkx402",
    creator: "@Blinkx402",
    images: ["https://blink402.dev/blink-402-webpreview.png"],
  },
  // Icons are automatically detected from app/icon.png and app/favicon.png
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#171717',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-neon-black relative`}>
        <SolanaProviderWrapper>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-neon-blue-dark focus:text-neon-white focus:font-mono focus:text-sm focus:rounded focus:outline-none focus:ring-2 focus:ring-neon-blue-light"
          >
            Skip to main content
          </a>
          <ErrorBoundary>
            <div className="noise-overlay" aria-hidden="true" />
            <PromoBanner />
            <Navigation />
            <TokenBubble
              address="2mESiwuVdfft9PxG7x36rvDvex6ccyY8m8BKCWJqpump"
              tokenUrl="https://pump.fun/coin/2mESiwuVdfft9PxG7x36rvDvex6ccyY8m8BKCWJqpump"
            />
            <main id="main-content">{children}</main>
          </ErrorBoundary>
        </SolanaProviderWrapper>
      </body>
    </html>
  )
}
