import { FastifyPluginAsync } from 'fastify'
import { getAllBlinks } from '@blink402/database'

export const debugRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /debug/endpoints - Show all endpoint URLs (dev only)
  fastify.get('/endpoints', async (request, reply) => {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return reply.code(404).send({ error: 'Not found' })
    }

    try {
      const blinks = await getAllBlinks()

      const endpoints = blinks
        .filter(b => b.status === 'active')
        .map(b => ({
          slug: b.slug,
          title: b.title,
          endpoint_url: b.endpoint_url,
          method: b.method,
          payment: `${b.price_usdc} ${b.payment_token}`,
          issues: [] as string[]
        }))

      // Check for common issues
      endpoints.forEach(e => {
        if (!e.endpoint_url) {
          e.issues.push('❌ No endpoint URL')
        } else if (!e.endpoint_url.startsWith('http') && !e.endpoint_url.startsWith('/')) {
          e.issues.push('❌ Invalid URL format')
        } else if (e.endpoint_url.includes('localhost') || e.endpoint_url.includes('127.0.0.1')) {
          e.issues.push('⚠️ Localhost URL')
        } else if (e.endpoint_url.startsWith('/')) {
          e.issues.push('ℹ️ Internal route')
        }

        if (e.endpoint_url === '/api/test' || e.endpoint_url === '/test') {
          e.issues.push('⚠️ Test endpoint - may not exist')
        }
      })

      return reply
        .code(200)
        .header('Content-Type', 'text/html')
        .send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Endpoint Debug</title>
            <style>
              body { font-family: monospace; padding: 20px; background: #1a1a1a; color: #00ff00; }
              table { border-collapse: collapse; width: 100%; margin-top: 20px; }
              th, td { border: 1px solid #00ff00; padding: 10px; text-align: left; }
              th { background: #0a0a0a; }
              .issues { color: #ff9900; font-size: 0.9em; }
              .endpoint { color: #00aaff; word-break: break-all; }
              h1 { color: #00ff00; }
            </style>
          </head>
          <body>
            <h1>🔍 Blink Endpoint Debug</h1>
            <p>Total Active Blinks: ${endpoints.length}</p>
            <table>
              <thead>
                <tr>
                  <th>Slug</th>
                  <th>Title</th>
                  <th>Endpoint URL</th>
                  <th>Method</th>
                  <th>Payment</th>
                  <th>Issues</th>
                </tr>
              </thead>
              <tbody>
                ${endpoints.map(e => `
                  <tr>
                    <td>${e.slug}</td>
                    <td>${e.title}</td>
                    <td class="endpoint">${e.endpoint_url || '(empty)'}</td>
                    <td>${e.method}</td>
                    <td>${e.payment}</td>
                    <td class="issues">${e.issues.join('<br>') || '✅ OK'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <br>
            <p style="color: #888;">
              Common 404 causes:<br>
              - Endpoint URL doesn't exist<br>
              - Wrong HTTP method (GET vs POST)<br>
              - Missing leading slash for internal routes<br>
              - Localhost URLs in production
            </p>
          </body>
          </html>
        `)
    } catch (error) {
      fastify.log.error({ error }, 'Debug endpoint error')
      return reply.code(500).send({ error: 'Failed to fetch endpoints' })
    }
  })
}