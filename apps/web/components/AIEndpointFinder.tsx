'use client'

import { useState, useEffect } from 'react'
import type { EndpointSuggestion, AISuggestionResponse } from '@blink402/types'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { APIResultCard } from '@/components/APIResultCard'
import { Sparkles, AlertCircle, ChevronDown, ChevronUp, Lightbulb, Check } from 'lucide-react'
import Lottie from '@/components/Lottie'
import { HelpTooltip } from '@/components/HelpTooltip'

interface AIEndpointFinderProps {
  onSelect: (suggestion: EndpointSuggestion) => void
  className?: string
}

const EXAMPLE_QUERIES = [
  'I need current weather data for any city',
  'Get real-time crypto prices from DEXes',
  'AI image generation from text prompts',
  'Send transactional emails to users',
  'Get country information and flags',
  'Shorten long URLs and track clicks'
]

export function AIEndpointFinder({ onSelect, className = '' }: AIEndpointFinderProps) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<EndpointSuggestion[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  const charCount = query.length
  const maxChars = 500
  const minChars = 10

  // Pulse animation for the badge
  useEffect(() => {
    if (!hasSearched) {
      const timer = setTimeout(() => {
        const badge = document.querySelector('.ai-badge-pulse')
        if (badge) {
          badge.classList.add('animate-pulse')
        }
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [hasSearched])

  const handleSearch = async () => {
    if (query.trim().length < minChars) {
      setError(`Query must be at least ${minChars} characters`)
      return
    }

    if (query.length > maxChars) {
      setError(`Query must be less than ${maxChars} characters`)
      return
    }

    setIsSearching(true)
    setError(null)
    setHasSearched(true)
    setResults([])

    try {
      const response = await fetch('/api/ai/suggest-endpoints', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query, limit: 5 })
      })

      if (!response.ok) {
        throw new Error('Failed to fetch suggestions')
      }

      const data: AISuggestionResponse = await response.json()
      setResults(data.suggestions)

      if (data.suggestions.length === 0) {
        setError('No matching APIs found. Try refining your query.')
      }
    } catch (err) {
      console.error('AI search error:', err)
      setError('Failed to search for APIs. Please try again.')
    } finally {
      setIsSearching(false)
    }
  }

  const handleSelectSuggestion = (suggestion: EndpointSuggestion) => {
    setSelectedId(suggestion.name)
    onSelect(suggestion)

    // Collapse the finder after selection
    setTimeout(() => {
      setIsOpen(false)
    }, 800)
  }

  const handleExampleClick = (example: string) => {
    setQuery(example)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSearch()
    }
  }

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={className}
    >
      <Card
        className="bg-neon-dark border-2 border-dashed border-neon-blue-light/60 relative overflow-hidden group shadow-[0_0_20px_rgba(90,180,255,0.15)]"
        data-reveal
      >
        {/* Animated glow effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-neon-blue-light/10 via-transparent to-neon-blue-dark/10 opacity-50 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-neon-blue-light/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

        <CollapsibleTrigger className="w-full text-left px-8 py-6 hover:bg-neon-blue-dark/10 transition-all relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-neon-blue-light/20 to-neon-blue-dark/20 border-2 border-neon-blue-light/40 flex items-center justify-center shadow-[0_0_10px_rgba(90,180,255,0.3)]">
                <Sparkles className="w-6 h-6 text-neon-blue-light" />
              </div>
              <div>
                <h3 className="text-neon-white font-sans text-xl flex items-center gap-3">
                  AI Endpoint Finder
                  <Badge className="ai-badge-pulse bg-neon-blue-light/20 text-neon-blue-light border-neon-blue-light/40 text-xs font-mono px-2 py-1 flex items-center gap-1.5">
                    BETA
                    <HelpTooltip
                      content="This AI-powered tool searches for free and paid APIs matching your description. It saves you time finding the right API endpoint to gate with payments."
                      side="right"
                    />
                  </Badge>
                </h3>
                <p className="text-neon-grey font-mono text-sm mt-1.5 max-w-2xl">
                  Can't find an API? Describe what you need in plain English and we'll suggest free and paid options with setup instructions. You can also manually enter your endpoint URL below.
                </p>
              </div>
            </div>

            {isOpen ? (
              <ChevronUp className="w-6 h-6 text-neon-blue-light transition-transform" />
            ) : (
              <ChevronDown className="w-6 h-6 text-neon-blue-light transition-transform" />
            )}
          </div>

          {/* Show success indicator when collapsed and item selected */}
          {!isOpen && selectedId && (
            <div className="mt-3 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded">
              <div className="text-green-400 font-mono text-sm mb-4 flex items-center gap-2">
                <Check className="w-4 h-4" /> API selected - Review and customize fields below
              </div>
            </div>
          )}
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-8 pb-8 pt-6 space-y-6 relative z-10 border-t border-neon-blue-dark/30">
            {/* Search Input */}
            <div className="space-y-4">
              <div className="relative">
                <Textarea
                  placeholder="Try: 'I need weather data' or 'AI to generate images' or 'simple free API for testing'"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="bg-neon-black border-2 border-neon-blue-dark/40 text-neon-white font-mono text-base focus:border-neon-blue-light focus:ring-2 focus:ring-neon-blue-light/30 min-h-[120px] resize-none p-4"
                  aria-label="Describe what API you need"
                  aria-describedby="ai-helper-text"
                  style={{ fontSize: '16px' }} // Prevent iOS zoom
                />
                <div className="absolute bottom-3 right-3 flex items-center gap-3">
                  <span
                    className={`text-xs font-mono ${charCount > maxChars
                        ? 'text-red-400'
                        : charCount < minChars
                          ? 'text-neon-grey'
                          : 'text-neon-blue-light'
                      }`}
                  >
                    {charCount}/{maxChars}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <p id="ai-helper-text" className="text-neon-grey text-xs font-mono flex items-center gap-1.5">
                  <span className="text-neon-blue-light">💡</span>
                  Use plain English - mention if you need free APIs or specific features. Press <kbd className="px-2 py-1 bg-neon-dark border border-neon-grey/30 rounded text-xs">Cmd/Ctrl + Enter</kbd> to search
                </p>
              </div>

              {/* Example Queries */}
              {!hasSearched && query.length === 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-neon-blue-light" />
                    <span className="text-sm font-mono text-neon-grey">Try these examples:</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {EXAMPLE_QUERIES.map((example, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleExampleClick(example)}
                        className="px-4 py-2 text-sm font-mono bg-neon-dark border border-neon-blue-dark/40 text-neon-grey hover:text-neon-white hover:border-neon-blue-light/60 rounded transition-all hover:scale-105 active:scale-95"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Search Button */}
              <Button
                onClick={handleSearch}
                disabled={isSearching || query.trim().length < minChars}
                className="w-full md:w-auto btn-primary text-base py-6"
              >
                {isSearching ? (
                  <>
                    <div className="w-5 h-5 border-2 border-neon-white border-t-transparent rounded-full animate-spin mr-2" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Find APIs
                  </>
                )}
              </Button>
            </div>

            {/* Error State */}
            {error && (
              <Alert className="bg-red-500/10 border-red-500/30">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <AlertDescription className="text-red-400 font-mono text-sm">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            {/* Loading State */}
            {isSearching && (
              <div className="space-y-4" role="status" aria-live="polite">
                <div className="text-center py-4">
                  <Lottie
                    src="/lottie/Loading (Neon spinning).lottie"
                    autoplay
                    loop
                    width={80}
                    height={80}
                    className="mx-auto mb-3"
                  />
                  <p className="text-neon-blue-light text-sm font-mono">
                    Searching for matching APIs...
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Skeleton variant="neon" className="h-64" />
                  <Skeleton variant="neon" className="h-64 hidden md:block" />
                  <Skeleton variant="neon" className="h-64 hidden lg:block" />
                </div>
              </div>
            )}

            {/* Results */}
            {!isSearching && results.length > 0 && (
              <div
                className="space-y-5"
                role="region"
                aria-label="API search results"
                aria-live="polite"
              >
                <div className="flex items-center justify-between p-4 bg-neon-black/50 border border-neon-blue-dark/30 rounded-lg">
                  <h4 className="text-neon-white font-mono text-base font-bold">
                    Found {results.length} matching API{results.length !== 1 ? 's' : ''}
                  </h4>
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/40 font-mono text-sm px-3 py-1">
                    {results[0]?.match_score}% match
                  </Badge>
                </div>

                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 auto-rows-fr w-full">
                  {results.map((suggestion, index) => (
                    <div
                      key={`${suggestion.name}-${index}`}
                      style={{ animationDelay: `${index * 100}ms` }}
                      className="flex w-full min-w-0"
                    >
                      <APIResultCard
                        suggestion={suggestion}
                        onSelect={handleSelectSuggestion}
                        isSelected={selectedId === suggestion.name}
                      />
                    </div>
                  ))}
                </div>

                <Alert className="bg-neon-blue-dark/10 border-neon-blue-dark/30">
                  <Lightbulb className="h-4 w-4 text-neon-blue-light" />
                  <AlertDescription className="text-neon-grey font-mono text-sm">
                    <span className="text-neon-blue-light">💡 Tip:</span> After selecting an API, review and customize the pre-filled fields below. You can always change the endpoint URL, pricing, and other settings.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* Empty State */}
            {!isSearching && hasSearched && results.length === 0 && !error && (
              <div className="text-center py-8">
                <Lottie
                  src="/lottie/Empty-State-Simple.lottie"
                  autoplay
                  loop
                  width={120}
                  height={120}
                  className="mx-auto mb-4"
                />
                <p className="text-neon-grey font-mono text-sm mb-4">
                  No matching APIs found
                </p>
                <p className="text-neon-grey font-mono text-xs mb-4">
                  Try rephrasing your query or use one of the examples above
                </p>
                <Button
                  onClick={() => {
                    setQuery('')
                    setHasSearched(false)
                    setError(null)
                  }}
                  className="btn-ghost"
                >
                  Clear Search
                </Button>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
