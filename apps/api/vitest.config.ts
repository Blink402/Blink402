import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.{test,spec}.ts',
        'vitest.config.ts',
      ],
    },
    // Timeout for integration tests (can be slow with DB/network)
    testTimeout: 10000,
    // Run tests sequentially to avoid DB conflicts
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
  },
})
