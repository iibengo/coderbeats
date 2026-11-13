import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // el alias de Nuxt, para poder probar el motor (sin audio) desde los tests
  resolve: { alias: { '~': fileURLToPath(new URL('./app', import.meta.url)) } },
  test: {
    environment: 'node',
    testTimeout: 20000,
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['app/lib/**/*.ts'],
    },
  },
})
