#!/usr/bin/env python3
"""
Brighten notext.png icon for better Dialect blink preview visibility
- Increases brightness and contrast of the neon blue
- Adds subtle glow effect
- Keeps transparent background
"""

from PIL import Image, ImageEnhance, ImageFilter
import sys

def brighten_icon(input_path, output_path):
    """Brighten neon icon and add glow effect"""

    # Open the image
    img = Image.open(input_path).convert('RGBA')

    # Split into channels
    r, g, b, a = img.split()

    # Create RGB image without alpha for processing
    rgb_img = Image.merge('RGB', (r, g, b))

    # Increase brightness moderately (1.0 = original, >1.0 = brighter)
    enhancer = ImageEnhance.Brightness(rgb_img)
    rgb_img = enhancer.enhance(1.4)  # 1.4x brighter (subtle)

    # Increase contrast slightly to make neon pop (1.0 = original, >1.0 = more contrast)
    enhancer = ImageEnhance.Contrast(rgb_img)
    rgb_img = enhancer.enhance(1.3)  # 1.3x more contrast

    # Increase color saturation moderately for vibrant neon blue
    enhancer = ImageEnhance.Color(rgb_img)
    rgb_img = enhancer.enhance(1.5)  # 1.5x more saturated

    # Split processed RGB
    r_new, g_new, b_new = rgb_img.split()

    # Recombine with original alpha channel
    brightened = Image.merge('RGBA', (r_new, g_new, b_new, a))

    # Create glow effect
    # 1. Create a blurred version for the glow
    glow = brightened.copy()
    glow = glow.filter(ImageFilter.GaussianBlur(radius=4))

    # 2. Blend the glow with the original
    final = Image.alpha_composite(glow, brightened)

    # Save the result
    final.save(output_path, 'PNG', optimize=True)
    print(f"[SUCCESS] Brightened icon saved to: {output_path}")
    print(f"   - Brightness: 1.4x (subtle)")
    print(f"   - Contrast: 1.3x")
    print(f"   - Saturation: 1.5x")
    print(f"   - Glow: 4px Gaussian blur (subtle)")

if __name__ == '__main__':
    input_file = 'apps/web/public/notext.png'
    output_file = 'apps/web/public/notext-bright.png'

    try:
        brighten_icon(input_file, output_file)
    except Exception as e:
        print(f"[ERROR] {e}")
        sys.exit(1)
