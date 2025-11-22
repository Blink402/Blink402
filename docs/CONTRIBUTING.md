# Contributing to BlinkBazaar

Thank you for your interest in contributing to BlinkBazaar! 🎉

We're building the future of pay-per-call APIs with Solana micropayments, and we'd love your help.

## 🚀 Quick Start

### Prerequisites

- Node.js 20.x or higher
- pnpm 9.x or higher
- PostgreSQL 14+ (for local development)
- Git

### Development Setup

1. **Fork and clone the repository**

```bash
git clone https://github.com/YOUR_USERNAME/BlinkBazaar.git
cd BlinkBazaar
```

2. **Install dependencies**

```bash
pnpm install
```

3. **Set up environment variables**

Copy the example env files and configure them:

```bash
# Frontend
cp apps/web/.env.example apps/web/.env.local

# Backend
cp apps/api/.env.example apps/api/.env
```

Required environment variables:
- `DATABASE_URL` - PostgreSQL connection string
- `NEXT_PUBLIC_APP_URL` - Frontend URL (http://localhost:3000)
- `NEXT_PUBLIC_SOLANA_RPC_URL` - Solana RPC endpoint

4. **Set up the database**

```bash
# Create database
createdb blink402

# Run migrations
psql -U postgres -d blink402 -f schema.sql
```

5. **Start development servers**

```bash
# Run all apps (web + api)
pnpm dev

# Or run individually
cd apps/web && pnpm dev  # Frontend on :3000
cd apps/api && pnpm dev  # API on :3001
```

6. **Verify setup**

- Frontend: http://localhost:3000
- API: http://localhost:3001/health
- API Docs: http://localhost:3001/docs (dev mode only)

## 🔧 Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions/updates

### 2. Make Your Changes

- Follow the existing code style
- Keep changes focused and atomic
- Write clear, descriptive commit messages
- Add comments for complex logic
- Update documentation as needed

### 3. Test Your Changes

```bash
# Lint code
pnpm lint

# Type check
pnpm typecheck

# Build to ensure no errors
pnpm build

# Run tests (when implemented)
pnpm test
```

### 4. Commit Your Changes

Use clear, descriptive commit messages:

```bash
git commit -m "feat: add payment verification caching"
git commit -m "fix: resolve CORS issue with Phantom wallet"
git commit -m "docs: update API endpoint documentation"
```

Commit message format:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Formatting, no code change
- `refactor:` - Code restructuring
- `test:` - Adding tests
- `chore:` - Maintenance tasks

### 5. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then open a Pull Request on GitHub with:
- Clear description of changes
- Reference to related issues (if any)
- Screenshots for UI changes
- Testing steps

## 📝 Code Style Guidelines

### TypeScript

- Use TypeScript strict mode
- Prefer `interface` over `type` for object shapes
- Add JSDoc comments for public APIs
- Use meaningful variable names
- Avoid `any` - use proper types

**Good:**
```typescript
interface BlinkCreateRequest {
  endpoint_url: string
  price_usdc: number
  payout_wallet: string
}

/**
 * Verifies a Solana payment transaction on-chain
 * @param signature - Transaction signature to verify
 * @param expectedAmount - Expected USDC amount in cents
 * @returns Verification result with payment details
 */
async function verifyPayment(
  signature: string,
  expectedAmount: number
): Promise<PaymentVerificationResult> {
  // Implementation
}
```

**Bad:**
```typescript
function verify(sig: any, amt: any) {
  // No types, unclear naming
}
```

### React/Next.js

- Use functional components with hooks
- Keep components small and focused
- Use `"use client"` directive only when needed
- Prefer server components by default
- Use the `cn()` utility for conditional classes

**Good:**
```typescript
"use client"

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

export function BlinkCard({ blink, className }: BlinkCardProps) {
  const [isLoading, setIsLoading] = useState(false)

  return (
    <div className={cn("p-4 border-dashed-neon", className)}>
      {/* Content */}
    </div>
  )
}
```

### Backend/API

- Use structured logging with context
- Validate all inputs
- Return appropriate HTTP status codes
- Use TypeScript generics for route typing
- Handle errors gracefully

**Good:**
```typescript
fastify.get<{ Params: { slug: string } }>(
  '/:slug',
  async (request, reply) => {
    const { slug } = request.params

    try {
      const blink = await getBlinkBySlug(slug)

      if (!blink) {
        return reply.code(404).send({ error: 'Blink not found' })
      }

      return reply.code(200).send({ blink })
    } catch (error) {
      fastify.log.error({ error, slug }, 'Failed to fetch blink')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  }
)
```

### Styling

- Use Tailwind CSS utility classes
- Follow the neon/terminal aesthetic
- Use CSS variables from `globals.css`
- Ensure mobile responsiveness
- Respect `prefers-reduced-motion`

## 🏗️ Project Structure

```
BlinkBazaar/
├── apps/
│   ├── web/          # Next.js frontend
│   │   ├── app/      # App Router pages
│   │   ├── components/  # React components
│   │   └── lib/      # Utilities
│   └── api/          # Fastify backend
│       └── src/
│           ├── index.ts   # Server entry
│           └── routes/    # API endpoints
├── packages/
│   ├── types/        # Shared TypeScript types
│   ├── solana/       # Solana utilities
│   ├── database/     # Database layer
│   └── config/       # Configuration
└── docs/             # Documentation
```

## 🎯 Areas for Contribution

### Good First Issues

Look for issues labeled `good first issue` for beginner-friendly tasks:
- Documentation improvements
- UI/UX enhancements
- Test coverage additions
- Bug fixes

### High-Impact Areas

- **Testing**: Add unit tests, integration tests, E2E tests
- **Performance**: Optimize payment verification, reduce latency
- **Security**: Enhance rate limiting, input validation
- **Features**: New blink types, analytics improvements
- **Documentation**: Tutorials, guides, API docs

### Feature Requests

Before implementing a new feature:
1. Check if an issue exists
2. Open a discussion/issue to propose it
3. Wait for maintainer feedback
4. Get approval before starting work

## 🐛 Bug Reports

When reporting bugs, include:

1. **Clear description** of the issue
2. **Steps to reproduce** the problem
3. **Expected behavior** vs actual behavior
4. **Environment details**:
   - OS (Windows/macOS/Linux)
   - Node.js version
   - Browser (if frontend issue)
   - Error messages/logs
5. **Screenshots** (for UI issues)

## 📋 Pull Request Guidelines

### Before Submitting

- [ ] Code follows style guidelines
- [ ] All tests pass locally
- [ ] TypeScript compiles without errors
- [ ] Linting passes (`pnpm lint`)
- [ ] Documentation updated (if needed)
- [ ] Self-reviewed code
- [ ] No console.logs or debug code
- [ ] Branch is up to date with main

### PR Description Template

```markdown
## Description
Brief description of what this PR does.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How did you test this? Steps to verify.

## Screenshots (if applicable)
Add screenshots for UI changes.

## Related Issues
Closes #123
```

### Review Process

1. Maintainer reviews within 48 hours
2. Address feedback and requested changes
3. Once approved, maintainer will merge
4. Your contribution will be credited in release notes!

## 🔒 Security

**DO NOT** open public issues for security vulnerabilities.

Instead, email security@[domain].com or see [SECURITY.md](./SECURITY.md) for reporting process.

## 🤝 Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md).

By participating, you agree to:
- Be respectful and inclusive
- Accept constructive criticism gracefully
- Focus on what's best for the community
- Show empathy towards others

## 💬 Getting Help

- **Documentation**: Check the [docs/](./docs) folder
- **Issues**: Search existing issues first
- **Discussions**: Use GitHub Discussions for questions
- **Discord**: [Join our community] (if available)

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🎉 Recognition

All contributors are recognized in:
- Release notes
- Contributors page
- Special thanks in major releases

Thank you for making BlinkBazaar better! 🚀
