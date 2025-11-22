import { NextRequest, NextResponse } from "next/server"
import QRCode from "qrcode"

/**
 * QR Code Generator API
 * Generates QR codes from text/URLs and returns as data URL
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { text, size = 256, darkColor = "#000000", lightColor = "#ffffff" } = body

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Text is required and must be a string" },
        { status: 400 }
      )
    }

    if (text.length > 2000) {
      return NextResponse.json(
        { error: "Text must be less than 2000 characters" },
        { status: 400 }
      )
    }

    // Validate size
    const qrSize = typeof size === "number" ? size : parseInt(size, 10)
    if (isNaN(qrSize) || qrSize < 64 || qrSize > 1024) {
      return NextResponse.json(
        { error: "Size must be between 64 and 1024 pixels" },
        { status: 400 }
      )
    }

    // Generate QR code as data URL
    const qrDataUrl = await QRCode.toDataURL(text, {
      width: qrSize,
      margin: 2,
      color: {
        dark: darkColor,
        light: lightColor
      },
      errorCorrectionLevel: "M"
    })

    return NextResponse.json({
      success: true,
      data: {
        qrCode: qrDataUrl,
        size: qrSize,
        inputLength: text.length,
        format: "png"
      }
    })
  } catch (error) {
    console.error("QR code generation error:", error)
    return NextResponse.json(
      { error: "Failed to generate QR code" },
      { status: 500 }
    )
  }
}
