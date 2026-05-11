import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['dist/**', 'node_modules/**', 'src/__tests__/setup.ts'],
    },
    setupFiles: ['./src/__tests__/setup.ts'],
    testTimeout: 10000,
  },
})
