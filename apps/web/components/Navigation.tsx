'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { X, Menu, Github, Send, Twitter } from 'lucide-react'
import { SCROLL_CONSTANTS } from '@/lib/constants'
import { WalletButton } from '@/components/wallet/WalletButton'
import { Button } from '@/components/ui/button'
import { ImageWithFallback } from '@/components/ImageWithFallback'
import { TierBadgeWidget } from '@/components/TierBadgeWidget'
import { usePrivy } from '@privy-io/react-auth'

export function Navigation() {
  const { authenticated } = usePrivy()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let ticking = false
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > SCROLL_CONSTANTS.NAV_SCROLL_THRESHOLD)
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      // Save scrollbar width to prevent layout shift
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
      document.body.style.overflow = 'hidden'
      document.body.style.paddingRight = `${scrollbarWidth}px`
    } else {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
    }
    return () => {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
    }
  }, [mobileMenuOpen])

  // Handle focus trap and escape key
  useEffect(() => {
    if (!mobileMenuOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false)
        menuButtonRef.current?.focus()
      }

      if (e.key === 'Tab') {
        const menuElement = menuRef.current
        if (!menuElement) return

        const focusableElements = menuElement.querySelectorAll<HTMLElement>(
          'a, button, [tabindex]:not([tabindex="-1"])'
        )
        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus()
            e.preventDefault()
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus()
            e.preventDefault()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [mobileMenuOpen])

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  const links = [
    { href: '/catalog', label: 'Catalog' },
    { href: '/use-cases', label: 'Use Cases' },
    { href: '/dashboard', label: 'My Blinks' },
    { href: '/docs', label: 'Docs' },
  ]

  const isActive = (href: string) => pathname === href

  return (
    <>
      {/* Desktop Navigation */}
      <nav
        className={`
          sticky top-0 z-50
          hidden md:flex items-center justify-between px-6 h-16
          border-b transition-all duration-300
          ${isScrolled
            ? 'border-neon-grey/30 bg-neon-black/80 backdrop-blur-md shadow-lg'
            : 'border-neon-grey/10 bg-neon-black/20 backdrop-blur-sm'
          }
        `}
      >
        {/* Neon bottom line that glows on scroll */}
        <div
          className={`
            absolute bottom-0 left-0 right-0 h-[1px] transition-all duration-500
            ${isScrolled
              ? 'bg-gradient-to-r from-transparent via-neon-blue-light to-transparent opacity-60 shadow-[0_0_8px_rgba(90,180,255,0.4)]'
              : 'opacity-0'
            }
          `}
        />
        {/* Left: Logo */}
        <Link
          href="/"
          className="flex items-center gap-3 text-2xl font-mono font-light tracking-tight group relative"
        >
          <span className="text-neon-white group-hover:text-gradient-animated transition-colors">
            Blink402
          </span>
          <div className="relative glow-pulse">
            <ImageWithFallback
              src="/logo.png"
              alt="Blink402 Logo"
              width={40}
              height={40}
              className="drop-shadow-[0_0_8px_rgba(90,180,255,0.4)] group-hover:drop-shadow-[0_0_16px_rgba(90,180,255,0.8)] transition-all duration-300 relative z-10 group-hover:rotate-slow"
              fallbackSrc="/placeholder-logo.svg"
              showPlaceholder={false}
            />
          </div>
        </Link>

        {/* Center: Links */}
        <div className="flex items-center gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`
                h-10 inline-flex items-center px-4 font-mono text-sm transition-all relative rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-blue-light
                ${isActive(link.href)
                  ? 'text-neon-blue-light bg-neon-blue-dark/20'
                  : 'text-neon-grey hover:text-neon-white hover:bg-neon-dark/50 active:text-neon-blue-light active:scale-95'
                }
              `}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right: Buy B402 + CTA + Wallet + Social Icons */}
        <div className="flex items-center gap-2">
          <Link
            href="https://pump.fun/coin/2mESiwuVdfft9PxG7x36rvDvex6ccyY8m8BKCWJqpump"
            target="_blank"
            rel="noopener noreferrer"
            className="h-10 inline-flex items-center px-4 rounded border border-neon-blue-light/60 bg-neon-blue-dark/20 text-neon-blue-light hover:bg-neon-blue-dark/40 hover:border-neon-blue-light transition-all font-mono text-sm font-medium"
          >
            Buy B402
          </Link>
          <Link
            href="/create"
            className="h-10 inline-flex items-center px-4 rounded border border-dashed border-neon-blue-dark/60 bg-transparent text-neon-white hover:border-neon-blue-light/60 hover:text-neon-blue-light transition-all font-mono text-sm font-medium"
          >
            Create Blink
          </Link>

          {/* Tier Badge Widget (desktop) */}
          {authenticated && (
            <div className="h-10 inline-flex items-center">
              <TierBadgeWidget variant="desktop" />
            </div>
          )}

          <div className="h-10 inline-flex items-center">
            <WalletButton variant="default" />
          </div>

          {/* Desktop Social Icons */}
          <div className="hidden lg:flex items-center gap-1 ml-2 pl-2 border-l border-neon-grey/20">
            <Link
              href="https://github.com/Blink402/Blink402"
              target="_blank"
              rel="noopener noreferrer"
              className="h-10 w-10 inline-flex items-center justify-center rounded border border-transparent hover:border-neon-blue-dark/40 hover:bg-neon-dark transition-all group"
              aria-label="GitHub"
            >
              <Github className="w-4 h-4 text-neon-blue-light/70 group-hover:text-neon-blue-light transition-colors" />
            </Link>
            <Link
              href="https://t.me/blinkx402"
              target="_blank"
              rel="noopener noreferrer"
              className="h-10 w-10 inline-flex items-center justify-center rounded border border-transparent hover:border-neon-blue-dark/40 hover:bg-neon-dark transition-all group"
              aria-label="Telegram"
            >
              <Send className="w-4 h-4 text-neon-blue-light/70 group-hover:text-neon-blue-light transition-colors -rotate-45 translate-x-0.5" />
            </Link>
            <Link
              href="https://x.com/Blinkx402"
              target="_blank"
              rel="noopener noreferrer"
              className="h-10 w-10 inline-flex items-center justify-center rounded border border-transparent hover:border-neon-blue-dark/40 hover:bg-neon-dark transition-all group"
              aria-label="Twitter/X"
            >
              <Twitter className="w-4 h-4 text-neon-blue-light/70 group-hover:text-neon-blue-light transition-colors" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <nav
        className={`
          sticky top-0 z-50
          md:hidden border-b transition-all duration-300
          ${isScrolled
            ? 'border-neon-grey/30 bg-neon-black/80 backdrop-blur-lg shadow-lg'
            : 'border-neon-grey/20 bg-neon-black/40 backdrop-blur-sm'
          }
        `}
      >
        {/* Neon bottom line that glows on scroll */}
        <div
          className={`
            absolute bottom-0 left-0 right-0 h-[1px] transition-all duration-500
            ${isScrolled
              ? 'bg-gradient-to-r from-transparent via-neon-blue-light to-transparent opacity-60 shadow-[0_0_8px_rgba(90,180,255,0.4)]'
              : 'opacity-0'
            }
          `}
        />
        <div className="flex items-center justify-between px-4 py-3">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2.5 text-xl font-mono font-light tracking-tight group"
            onClick={() => setMobileMenuOpen(false)}
          >
            <span className="text-neon-white group-hover:text-neon-blue-light transition-colors">
              Blink402
            </span>
            <ImageWithFallback
              src="/logo.png"
              alt="Blink402 Logo"
              width={36}
              height={36}
              className="drop-shadow-[0_0_8px_rgba(90,180,255,0.4)] group-hover:drop-shadow-[0_0_12px_rgba(90,180,255,0.6)] transition-all duration-300"
              fallbackSrc="/placeholder-logo.svg"
              showPlaceholder={false}
            />
          </Link>

          {/* Hamburger Button */}
          <button
            ref={menuButtonRef}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2.5 min-w-11 min-h-11 flex items-center justify-center hover:bg-neon-dark active:bg-neon-dark/70 active:scale-95 rounded transition-all text-neon-white hover:text-neon-blue-light active:text-neon-blue-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-blue-light"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
          >
            {mobileMenuOpen ? (
              <X size={24} />
            ) : (
              <Menu size={24} />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay - OUTSIDE nav to prevent height constraints */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[10000] bg-neon-black/80 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Menu Content */}
          <div
            ref={menuRef}
            id="mobile-menu"
            className="fixed inset-0 z-[10001] flex flex-col items-center justify-center bg-neon-black/95"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation menu"
          >
            {/* Close Button */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-3 min-w-12 min-h-12 flex items-center justify-center hover:bg-neon-dark active:bg-neon-dark/70 active:scale-95 rounded transition-all text-neon-white hover:text-neon-blue-light active:text-neon-blue-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-blue-light"
              aria-label="Close menu"
            >
              <X size={28} />
            </button>

            {/* Links */}
            <nav className="flex flex-col items-center gap-8">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`
                    text-3xl font-mono font-light transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-blue-light rounded px-4 py-2
                    ${isActive(link.href)
                      ? 'text-neon-blue-light'
                      : 'text-neon-white hover:text-neon-blue-light active:text-neon-blue-light active:scale-95'
                    }
                  `}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Mobile CTAs */}
            <div className="flex flex-col gap-4 mt-12 w-72 px-4">
              <Link
                href="https://pump.fun/coin/2mESiwuVdfft9PxG7x36rvDvex6ccyY8m8BKCWJqpump"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-3 rounded border border-neon-blue-light/60 bg-neon-blue-dark/20 text-neon-blue-light hover:bg-neon-blue-dark/40 hover:border-neon-blue-light transition-all font-mono text-sm font-medium text-center"
              >
                Buy B402
              </Link>
              <Link href="/create" onClick={() => setMobileMenuOpen(false)} className="w-full">
                <Button variant="default" className="w-full">
                  Create Blink
                </Button>
              </Link>

              {/* Tier Badge Widget (mobile) */}
              {authenticated && <TierBadgeWidget variant="mobile" />}

              <WalletButton variant="mobile" />

              {/* Mobile Social Icons */}
              <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-neon-grey/20">
                <Link
                  href="https://github.com/Blink402/Blink402"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-3 rounded-full bg-neon-dark/50 hover:bg-neon-dark transition-all group"
                  aria-label="GitHub"
                >
                  <Github className="w-5 h-5 text-neon-blue-light/70 group-hover:text-neon-blue-light transition-colors" />
                </Link>
                <Link
                  href="https://t.me/blinkx402"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-3 rounded-full bg-neon-dark/50 hover:bg-neon-dark transition-all group"
                  aria-label="Telegram"
                >
                  <Send className="w-5 h-5 text-neon-blue-light/70 group-hover:text-neon-blue-light transition-colors -rotate-45 translate-x-0.5" />
                </Link>
                <Link
                  href="https://x.com/Blinkx402"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-3 rounded-full bg-neon-dark/50 hover:bg-neon-dark transition-all group"
                  aria-label="Twitter/X"
                >
                  <Twitter className="w-5 h-5 text-neon-blue-light/70 group-hover:text-neon-blue-light transition-colors" />
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
