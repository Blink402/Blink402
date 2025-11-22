import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Lucky Slot Machine | Blink402",
  description: "Spin the reels for a chance to win up to 50x your bet! Each spin costs 0.10 USDC with a 98% RTP. Provably fair using SHA-256. Instant payouts sent directly to your wallet.",
  metadataBase: new URL('https://blink402.dev'),
  openGraph: {
    title: "Lucky Slot Machine | Blink402",
    description: "Spin the reels for a chance to win up to 50x your bet! 98% RTP, provably fair, instant payouts.",
    url: "https://blink402.dev/slot-machine",
    siteName: "Blink402",
    images: [
      {
        url: "https://blink402.dev/SLOTS.png",
        secureUrl: "https://blink402.dev/SLOTS.png",
        width: 1200,
        height: 630,
        alt: "Lucky Slot Machine - Win up to 50x your bet!",
        type: "image/png",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lucky Slot Machine | Blink402",
    description: "🎰 Spin for 0.10 USDC • 98% RTP • Win up to 50x • Provably Fair • Instant Payouts",
    site: "@Blinkx402",
    creator: "@Blinkx402",
    images: ["https://blink402.dev/SLOTS.png"],
  },
}

export default function SlotMachineLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
