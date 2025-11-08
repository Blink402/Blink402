import { NextRequest, NextResponse } from 'next/server'

const INSPIRATIONAL_QUOTES = [
  {
    text: "The only way to do great work is to love what you do.",
    author: "Steve Jobs"
  },
  {
    text: "Innovation distinguishes between a leader and a follower.",
    author: "Steve Jobs"
  },
  {
    text: "The future belongs to those who believe in the beauty of their dreams.",
    author: "Eleanor Roosevelt"
  },
  {
    text: "It is during our darkest moments that we must focus to see the light.",
    author: "Aristotle"
  },
  {
    text: "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    author: "Winston Churchill"
  },
  {
    text: "The only impossible journey is the one you never begin.",
    author: "Tony Robbins"
  },
  {
    text: "In the middle of difficulty lies opportunity.",
    author: "Albert Einstein"
  },
  {
    text: "What you get by achieving your goals is not as important as what you become by achieving your goals.",
    author: "Zig Ziglar"
  },
  {
    text: "Don't be afraid to give up the good to go for the great.",
    author: "John D. Rockefeller"
  },
  {
    text: "The way to get started is to quit talking and begin doing.",
    author: "Walt Disney"
  },
  {
    text: "Your limitation—it's only your imagination.",
    author: "Unknown"
  },
  {
    text: "Push yourself, because no one else is going to do it for you.",
    author: "Unknown"
  },
  {
    text: "Great things never come from comfort zones.",
    author: "Unknown"
  },
  {
    text: "Dream it. Wish it. Do it.",
    author: "Unknown"
  },
  {
    text: "Dreams don't work unless you do.",
    author: "John C. Maxwell"
  }
]

const CATEGORIES = [
  "motivation",
  "success", 
  "innovation",
  "entrepreneurship",
  "wisdom",
  "inspiration"
]

export async function GET() {
  try {
    // Generate a random quote
    const randomQuote = INSPIRATIONAL_QUOTES[Math.floor(Math.random() * INSPIRATIONAL_QUOTES.length)]
    const randomCategory = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)]
    
    const result = {
      quote: randomQuote.text,
      author: randomQuote.author,
      category: randomCategory,
      timestamp: new Date().toISOString(),
      share_text: `"${randomQuote.text}" - ${randomQuote.author}`,
      formatted: `💡 "${randomQuote.text}"\n\n— ${randomQuote.author}\n\n#inspiration #motivation #quotes`
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: "Inspirational quote generated successfully"
    })
  } catch (error) {
    console.error("Quote generation error:", error)
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to generate quote",
        message: "Something went wrong while generating your inspirational quote"
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { category } = body

    // Filter quotes by category if specified
    let availableQuotes = INSPIRATIONAL_QUOTES
    
    // If category is specified, we could filter (for now we use all quotes)
    // In a real implementation, you might tag quotes by category
    
    const randomQuote = availableQuotes[Math.floor(Math.random() * availableQuotes.length)]
    const selectedCategory = category || CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)]
    
    const result = {
      quote: randomQuote.text,
      author: randomQuote.author,
      category: selectedCategory,
      timestamp: new Date().toISOString(),
      share_text: `"${randomQuote.text}" - ${randomQuote.author}`,
      formatted: `💡 "${randomQuote.text}"\n\n— ${randomQuote.author}\n\n#inspiration #motivation #quotes #${selectedCategory}`,
      requested_category: category || "random"
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: "Custom inspirational quote generated successfully"
    })
  } catch (error) {
    console.error("Quote generation error:", error)
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to generate quote",
        message: "Something went wrong while generating your inspirational quote"
      },
      { status: 500 }
    )
  }
}