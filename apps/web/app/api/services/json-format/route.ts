import { NextRequest, NextResponse } from "next/server"

/**
 * JSON Formatter & Validator API
 * Validates and prettifies JSON with configurable indentation
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { json, indent = 2, minify = false } = body

    if (!json) {
      return NextResponse.json(
        { error: "JSON input is required" },
        { status: 400 }
      )
    }

    let parsedJson: any
    let inputString: string

    // Handle both string and object inputs
    if (typeof json === "string") {
      inputString = json
      try {
        parsedJson = JSON.parse(json)
      } catch (parseError) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid JSON",
            details: parseError instanceof Error ? parseError.message : "Unknown parse error"
          },
          { status: 400 }
        )
      }
    } else {
      parsedJson = json
      inputString = JSON.stringify(json)
    }

    // Format the JSON
    const formatted = minify
      ? JSON.stringify(parsedJson)
      : JSON.stringify(parsedJson, null, Number(indent))

    // Calculate some stats
    const stats = {
      valid: true,
      keys: countKeys(parsedJson),
      depth: calculateDepth(parsedJson),
      size: formatted.length,
      originalSize: inputString.length,
      compressed: minify ? ((1 - (formatted.length / inputString.length)) * 100).toFixed(2) + "%" : null
    }

    return NextResponse.json({
      success: true,
      data: {
        formatted,
        stats,
        minified: minify
      }
    })
  } catch (error) {
    console.error("JSON formatting error:", error)
    return NextResponse.json(
      { error: "Failed to format JSON" },
      { status: 500 }
    )
  }
}

function countKeys(obj: any): number {
  if (typeof obj !== "object" || obj === null) return 0

  let count = 0
  if (Array.isArray(obj)) {
    obj.forEach(item => {
      count += countKeys(item)
    })
  } else {
    count = Object.keys(obj).length
    Object.values(obj).forEach(value => {
      count += countKeys(value)
    })
  }

  return count
}

function calculateDepth(obj: any, currentDepth = 0): number {
  if (typeof obj !== "object" || obj === null) return currentDepth

  if (Array.isArray(obj)) {
    if (obj.length === 0) return currentDepth + 1
    return Math.max(...obj.map(item => calculateDepth(item, currentDepth + 1)))
  } else {
    const values = Object.values(obj)
    if (values.length === 0) return currentDepth + 1
    return Math.max(...values.map(value => calculateDepth(value, currentDepth + 1)))
  }
}
