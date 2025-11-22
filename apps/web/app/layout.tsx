import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import "./globals.css"
import { ClientProviders } from "@/components/ClientProviders"
import TopBlinksMarquee from "@/components/TopBlinksMarquee"
import { Navigation } from "@/components/Navigation"
import { ReferralWidget } from "@/components/ReferralWidget"

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

// Force dynamic rendering to avoid build-time Privy initialization errors
export const dynamic = 'force-dynamic'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased bg-neon-black relative`}>
        <ClientProviders>
          <TopBlinksMarquee />
          <Navigation />
          <main id="main-content">{children}</main>
          <ReferralWidget />
        </ClientProviders>
      </body>
    </html>
  )
}
