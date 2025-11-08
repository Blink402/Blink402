import { NextRequest, NextResponse } from "next/server"

/**
 * Simple sentiment analysis using keyword-based approach
 * Returns: positive, negative, or neutral
 */

const POSITIVE_WORDS = [
  "good", "great", "excellent", "amazing", "wonderful", "fantastic",
  "love", "like", "happy", "pleased", "delighted", "awesome", "best",
  "perfect", "beautiful", "brilliant", "outstanding", "superb", "terrific"
]

const NEGATIVE_WORDS = [
  "bad", "terrible", "awful", "horrible", "hate", "dislike", "angry",
  "sad", "disappointed", "poor", "worst", "disgusting", "pathetic",
  "useless", "annoying", "frustrating", "disappointing", "dreadful"
]

function analyzeSentiment(text: string): {
  sentiment: "positive" | "negative" | "neutral"
  score: number
  confidence: number
} {
  const words = text.toLowerCase().split(/\s+/)
  let positiveCount = 0
  let negativeCount = 0

  words.forEach(word => {
    if (POSITIVE_WORDS.includes(word)) positiveCount++
    if (NEGATIVE_WORDS.includes(word)) negativeCount++
  })

  const totalSentimentWords = positiveCount + negativeCount
  const score = positiveCount - negativeCount

  let sentiment: "positive" | "negative" | "neutral"
  if (score > 0) {
    sentiment = "positive"
  } else if (score < 0) {
    sentiment = "negative"
  } else {
    sentiment = "neutral"
  }

  // Calculate confidence based on number of sentiment words found
  const confidence = totalSentimentWords > 0
    ? Math.min(totalSentimentWords / (words.length * 0.3), 1)
    : 0.5

  return {
    sentiment,
    score,
    confidence: Math.round(confidence * 100) / 100
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { text } = body

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Text is required and must be a string" },
        { status: 400 }
      )
    }

    if (text.length > 5000) {
      return NextResponse.json(
        { error: "Text must be less than 5000 characters" },
        { status: 400 }
      )
    }

    const result = analyzeSentiment(text)

    return NextResponse.json({
      success: true,
      data: {
        text: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
        ...result,
        wordCount: text.split(/\s+/).length
      }
    })
  } catch (error) {
    console.error("Sentiment analysis error:", error)
    return NextResponse.json(
      { error: "Failed to analyze sentiment" },
      { status: 500 }
    )
  }
}
