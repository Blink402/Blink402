'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { X, Menu } from 'lucide-react'
import { SCROLL_CONSTANTS } from '@/lib/constants'
import { WalletButton } from '@/components/wallet/WalletButton'

export function Navigation() {
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
    { href: '/gallery/manage', label: 'My Gallery' },
    { href: '/demo', label: 'Try it out!' },
    { href: '/docs', label: 'Docs' },
  ]

  const isActive = (href: string) => pathname === href

  return (
    <>
      {/* Desktop Navigation */}
      <nav 
        className={`
          hidden md:flex items-center justify-between px-6 py-4 
          border-b transition-all duration-300
          ${isScrolled 
            ? 'border-neon-grey/30 bg-neon-black/95 backdrop-blur-md shadow-lg' 
            : 'border-neon-grey/20 bg-neon-black'
          }
        `}
      >
        {/* Left: Logo */}
        <Link
          href="/"
          className="flex items-center gap-3 text-2xl font-mono font-light tracking-tight group"
        >
          <span className="text-neon-white group-hover:text-neon-blue-light transition-colors">
            Blink402
          </span>
          <Image
            src="/logo.png"
            alt="Blink402 Logo"
            width={40}
            height={40}
            className="drop-shadow-[0_0_8px_rgba(90,180,255,0.4)] group-hover:drop-shadow-[0_0_12px_rgba(90,180,255,0.6)] transition-all duration-300"
          />
        </Link>

        {/* Center: Links */}
        <div className="flex items-center gap-8">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`
                font-mono text-sm transition-all relative rounded px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-blue-light
                ${isActive(link.href)
                  ? 'text-neon-blue-light'
                  : 'text-neon-grey hover:text-neon-white active:text-neon-blue-light active:scale-95'
                }
              `}
            >
              {link.label}
              {isActive(link.href) && (
                <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-neon-gradient" />
              )}
            </Link>
          ))}
        </div>

        {/* Right: CTA + Wallet + Dashboard */}
        <div className="flex items-center gap-4">
          <Link
            href="/create"
            className="btn-primary"
          >
            Create Blink
          </Link>
          <WalletButton variant="default" />
          <Link
            href="/dashboard"
            className="p-2 rounded hover:bg-neon-dark active:bg-neon-dark/70 active:scale-95 transition-all text-neon-white hover:text-neon-blue-light active:text-neon-blue-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-blue-light"
            aria-label="Dashboard"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="7" height="7" x="3" y="3" rx="1" />
              <rect width="7" height="7" x="14" y="3" rx="1" />
              <rect width="7" height="7" x="14" y="14" rx="1" />
              <rect width="7" height="7" x="3" y="14" rx="1" />
            </svg>
          </Link>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <nav 
        className={`
          md:hidden border-b transition-all duration-300
          ${isScrolled 
            ? 'border-neon-grey/30 bg-neon-black/95 backdrop-blur-md shadow-lg' 
            : 'border-neon-grey/20 bg-neon-black'
          }
        `}
      >
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
            <Image
              src="/logo.png"
              alt="Blink402 Logo"
              width={36}
              height={36}
              className="drop-shadow-[0_0_8px_rgba(90,180,255,0.4)] group-hover:drop-shadow-[0_0_12px_rgba(90,180,255,0.6)] transition-all duration-300"
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
            <div className="flex flex-col gap-5 mt-12 w-72 px-4">
              <Link
                href="/create"
                onClick={() => setMobileMenuOpen(false)}
                className="btn-primary text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-blue-light"
              >
                Create Blink
              </Link>
              <WalletButton variant="mobile" />
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="btn-ghost text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-blue-light rounded px-4 py-2 active:scale-95"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </>
      )}
    </>
  )
}
