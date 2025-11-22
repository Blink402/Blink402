'use client'

import { useState } from 'react'
import type { EndpointSuggestion } from '@blink402/types'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { ExternalLink, Check } from 'lucide-react'
import { HelpTooltip } from '@/components/HelpTooltip'

interface APIResultCardProps {
  suggestion: EndpointSuggestion
  onSelect: (suggestion: EndpointSuggestion) => void
  isSelected?: boolean
}

export function APIResultCard({ suggestion, onSelect, isSelected = false }: APIResultCardProps) {
  const [isHovered, setIsHovered] = useState(false)

  // Get pricing badge variant
  const getPricingBadgeColor = (tier: string) => {
    switch (tier) {
      case 'free':
        return 'bg-green-500/10 text-green-400 border-green-500/30'
      case 'freemium':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30'
      case 'paid':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/30'
      default:
        return 'bg-neon-blue-dark/10 text-neon-blue-light border-neon-blue-dark/30'
    }
  }

  // Get HTTP method badge color
  const getMethodBadgeColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'bg-green-500/10 text-green-400 border-green-500/30'
      case 'POST':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30'
      case 'PUT':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
      case 'DELETE':
        return 'bg-red-500/10 text-red-400 border-red-500/30'
      default:
        return 'bg-neon-grey/10 text-neon-grey border-neon-grey/30'
    }
  }

  return (
    <Card
      className={`
        bg-neon-black border transition-all duration-300 group animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col h-full overflow-hidden w-full
        ${
          isSelected
            ? 'border-neon-blue-light shadow-[0_0_12px_rgba(90,180,255,0.4)]'
            : 'border-neon-blue-dark/30 hover:border-neon-blue-light/60 hover:-translate-y-1 hover:shadow-[0_0_8px_rgba(90,180,255,0.2)]'
        }
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardHeader className="pb-3 sm:pb-4 px-4 sm:px-6 pt-4 sm:pt-6 overflow-hidden w-full">
        <div className="flex items-start justify-between mb-3 gap-2 w-full">
          <div className="flex-1 min-w-0 max-w-[65%] sm:max-w-[70%]">
            <CardTitle className="text-neon-white font-mono text-base sm:text-lg mb-1 break-words hyphens-auto leading-snug">
              <span className="break-words">{suggestion.name}</span>
              {suggestion.provider && (
                <span className="text-neon-grey text-xs font-normal break-words block mt-1">
                  by {suggestion.provider}
                </span>
              )}
            </CardTitle>
          </div>
          <div className="flex flex-col gap-2 items-end shrink-0">
            <Badge className={`${getPricingBadgeColor(suggestion.pricing_tier)} font-mono text-[10px] sm:text-xs whitespace-nowrap flex items-center gap-1 sm:gap-1.5 py-1 px-2`}>
              {suggestion.pricing_tier.toUpperCase()}
              <HelpTooltip
                content={
                  suggestion.pricing_tier === 'free'
                    ? "Completely free to use with no cost"
                    : suggestion.pricing_tier === 'freemium'
                    ? "Free tier available, paid plans for advanced features"
                    : "Requires paid subscription or per-use payment"
                }
                side="left"
              />
            </Badge>
          </div>
        </div>

        {/* Match Score Bar */}
        <div className="mb-3 w-full">
          <div className="flex items-center justify-between mb-1 w-full">
            <span className="text-xs font-mono text-neon-grey flex items-center gap-1.5 shrink-0">
              Match Score
              <HelpTooltip
                content="How well this API matches your search. Higher scores (80%+) mean better fit. Lower scores may still work but check the description carefully."
                side="top"
              />
            </span>
            <span className="text-xs font-mono text-neon-blue-light font-bold shrink-0">
              {suggestion.match_score}%
            </span>
          </div>
          <div className="h-2 bg-neon-dark rounded-full overflow-hidden border border-neon-blue-dark/20 w-full max-w-full">
            <div
              className="h-full bg-gradient-to-r from-neon-blue-dark to-neon-blue-light transition-all duration-500"
              style={{ width: `${Math.min(suggestion.match_score, 100)}%` }}
            />
          </div>
        </div>

        <CardDescription className="text-neon-grey font-mono text-xs sm:text-sm leading-relaxed break-words overflow-wrap-anywhere line-clamp-3 w-full">
          {suggestion.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 sm:space-y-4 pb-3 sm:pb-4 px-4 sm:px-6 flex-1 overflow-hidden w-full">
        {/* Endpoint Preview */}
        <div className="min-w-0 w-full">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-2 flex-wrap">
            <Badge className={`${getMethodBadgeColor(suggestion.method)} font-mono text-[10px] sm:text-xs whitespace-nowrap shrink-0 flex items-center gap-1 sm:gap-1.5 py-1 px-2`}>
              {suggestion.method}
              <HelpTooltip
                content={
                  suggestion.method === 'GET'
                    ? "GET = Retrieves data from the API (like fetching weather or user info)"
                    : suggestion.method === 'POST'
                    ? "POST = Submits data to the API (like creating an image or sending a message)"
                    : suggestion.method === 'PUT'
                    ? "PUT = Updates existing data on the API"
                    : "DELETE = Removes data from the API"
                }
                side="top"
              />
            </Badge>
            <Badge className="bg-neon-blue-dark/10 text-neon-blue-light border-neon-blue-dark/30 font-mono text-[10px] sm:text-xs whitespace-nowrap shrink-0 py-1 px-2">
              {suggestion.category}
            </Badge>
            {suggestion.auth_required && (
              <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30 font-mono text-[10px] sm:text-xs whitespace-nowrap shrink-0 flex items-center gap-1 sm:gap-1.5 py-1 px-2">
                Auth
                <span className="hidden sm:inline">Required</span>
                <HelpTooltip
                  content="This API requires an API key or authentication. You'll need to sign up on their website to get access credentials."
                  side="top"
                />
              </Badge>
            )}
          </div>

          <div className="relative group min-w-0 w-full overflow-hidden">
            <code className="block text-[10px] sm:text-xs bg-neon-dark p-2 sm:p-3 rounded border border-neon-blue-dark/20 text-neon-white font-mono break-all w-full hover:border-neon-blue-dark/40 transition-colors leading-relaxed">
              {suggestion.endpoint_url}
            </code>
          </div>
        </div>

        {/* Setup Instructions (Accordion) */}
        <Accordion type="single" collapsible className="border-t border-neon-grey/10 pt-3 sm:pt-4 w-full">
          <AccordionItem value="setup" className="border-none">
            <AccordionTrigger className="text-neon-white font-mono text-xs sm:text-sm hover:text-neon-blue-light py-2 hover:no-underline">
              <span className="flex items-center gap-1.5 sm:gap-2">
                <span>Setup Instructions</span>
                <Badge className="bg-neon-blue-dark/20 text-neon-blue-light border-none font-mono text-[10px] sm:text-xs py-0.5 px-1.5">
                  {suggestion.setup_steps.length} steps
                </Badge>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pt-2 sm:pt-3">
              <div className="space-y-2 sm:space-y-3 w-full">
                {suggestion.setup_steps.map((step, index) => (
                  <div key={index} className="flex gap-2 sm:gap-3 group/step w-full">
                    <div className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-neon-blue-dark/20 border border-neon-blue-dark/30 flex items-center justify-center text-[10px] sm:text-xs font-mono text-neon-blue-light">
                      {index + 1}
                    </div>
                    <p className="text-neon-grey text-xs sm:text-sm font-mono pt-0.5 group-hover/step:text-neon-white transition-colors break-words w-full min-w-0 leading-relaxed">
                      {step}
                    </p>
                  </div>
                ))}

                {suggestion.docs_url && (
                  <div className="pt-2 border-t border-neon-grey/10">
                    <a
                      href={suggestion.docs_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-mono text-neon-blue-light hover:text-neon-blue-dark transition-colors touch-manipulation"
                    >
                      <ExternalLink size={10} className="sm:w-3 sm:h-3" />
                      View Full Documentation
                    </a>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Example Request */}
          {suggestion.example_request && (
            <AccordionItem value="example" className="border-none">
              <AccordionTrigger className="text-neon-white font-mono text-xs sm:text-sm hover:text-neon-blue-light py-2 hover:no-underline">
                Example Request
              </AccordionTrigger>
              <AccordionContent className="pt-2 sm:pt-3 w-full overflow-hidden">
                <pre className="text-[10px] sm:text-xs bg-neon-dark p-2 sm:p-3 rounded border border-neon-blue-dark/20 text-neon-white font-mono overflow-x-auto max-w-full leading-relaxed">
                  {typeof suggestion.example_request === 'string'
                    ? suggestion.example_request
                    : JSON.stringify(suggestion.example_request, null, 2)}
                </pre>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </CardContent>

      <CardFooter className="pt-3 sm:pt-4 px-4 sm:px-6 pb-4 sm:pb-6 border-t border-neon-grey/10">
        <Button
          onClick={() => onSelect(suggestion)}
          className={`
            w-full font-mono transition-all text-sm sm:text-base py-3 sm:py-2.5 touch-manipulation min-h-[44px]
            ${
              isSelected
                ? 'bg-neon-blue-light text-neon-black hover:bg-neon-blue-dark border-neon-blue-light'
                : 'btn-primary'
            }
          `}
          disabled={isSelected}
        >
          {isSelected ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              Selected
            </>
          ) : (
            <>
              {isHovered ? '✨ ' : ''}Use This API
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
