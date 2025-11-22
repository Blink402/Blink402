# Lottie Animation Files

This directory stores `.lottie` animation files for the Blink402 app.

## What are .lottie files?

`.lottie` files are optimized container files for Lottie animations (vector animations exported from Adobe After Effects). They can contain:
- Single or multiple animations
- Color themes
- Interactive state machines
- Manifest metadata

## Where to Get Animations

### LottieFiles.com
Browse thousands of free and premium animations:
https://lottiefiles.com/

Search for terms like:
- "cube rotation" or "wireframe" (for hero sections)
- "checkmark" or "success" (for completed actions)
- "loading" or "spinner" (for processing states)
- "lock" or "unlock" (for payment/security)
- "payment" or "transaction" (for payment flows)

### Direct Downloads
Once you find an animation, download it as `.lottie` format and place it here.

## Recommended Animations for Blink402

Based on the neon/tech design theme, here are suggested animations:

### Hero Section
- **Wireframe Cube Orbit** - 3D rotating cube with neon blue wireframe
- **Geometric Shapes** - Abstract geometric patterns
- **Network Animation** - Connected nodes/particles

### Action Feedback
- **Success Checkmark** - Animated checkmark for completed payments
- **Loading Pulse** - Neon pulse effect for processing
- **Lock/Unlock** - Security/payment verification

### UI Elements
- **Arrow Bounce** - Directional indicators
- **Hover Glow** - Button hover states
- **Particle Burst** - Success celebrations

## Usage Example

```tsx
import Lottie from "@/components/Lottie"

<Lottie 
  src="/lottie/cube-orbit.lottie" 
  autoplay 
  loop 
  width={280} 
  height={280} 
/>
```

## File Naming Convention

Use descriptive kebab-case names:
- `cube-orbit.lottie`
- `success-checkmark.lottie`
- `payment-processing.lottie`
- `lock-unlock.lottie`

## Testing Animations

You can preview .lottie files at:
https://lottiefiles.com/preview

Or use the local dev server:
```bash
npm run dev
```

## Performance Tips

- Keep file sizes under 100KB when possible
- Use simple shapes for UI feedback animations
- Complex hero animations can be 200-500KB
- Enable `loop` only when appropriate
- Consider lazy-loading large animations

## Current Animations

_(Add links/descriptions as you add files)_

### Hero Section
- `cube-orbit.lottie` - *TODO: Add this file*
  - Recommended source: Search "wireframe cube 3D" on LottieFiles
  - Alternative: "geometric rotation neon"

### UI Feedback
- `success.lottie` - *TODO: Add this file*
- `loading.lottie` - *TODO: Add this file*
- `payment-complete.lottie` - *TODO: Add this file*
