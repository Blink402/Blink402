"use client"

import { useEffect } from "react"
import Lottie from "@/components/Lottie"

export default function TempPage() {
  useEffect(() => {
    // Hide navigation and other UI elements
    const nav = document.querySelector('nav') as HTMLElement
    const promoBanner = document.querySelector('[role="banner"]') as HTMLElement
    const tokenBubble = document.querySelector('[data-testid="token-bubble"]') as HTMLElement
    
    if (nav) nav.style.display = 'none'
    if (promoBanner) promoBanner.style.display = 'none'
    if (tokenBubble) tokenBubble.style.display = 'none'
    
    // Cleanup on unmount
    return () => {
      if (nav) nav.style.display = ''
      if (promoBanner) promoBanner.style.display = ''
      if (tokenBubble) tokenBubble.style.display = ''
    }
  }, [])

  return (
    <main className="min-h-screen">
      {/* Hero Section - Same structure as homepage */}
      <section className="relative overflow-hidden px-4 sm:px-6 py-16 sm:py-24 md:py-32">
        <div className="relative z-10 max-w-6xl mx-auto grid md:grid-cols-[1.3fr_.7fr] gap-8 sm:gap-12 items-center">
          {/* Empty space where hero content would be */}
          <div></div>
          
          {/* Hero Animation - Same positioning as homepage */}
          <aside className="justify-self-center">
            <Lottie
              src="/lottie/3D Shape Animation.lottie"
              autoplay
              loop
              width={320}
              height={320}
              applyNeonFilter={true}
              pauseOnInvisible={true}
            />
          </aside>
        </div>
      </section>
    </main>
  )
}