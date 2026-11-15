import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // el alias de Nuxt, para poder probar el motor (sin audio) desde los tests
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./app', import.meta.url)),
      // Strudel importa su editor de audio, que no se usa: en Node no carga
      '@kabelsalat/web': fileURLToPath(new URL('./tests/helpers/kabelsalatStub.ts', import.meta.url)),
    },
  },
  // Nuxt sustituye `import.meta.client` al compilar; en los tests, el código de los composables se ejecuta como en el navegador
  define: { 'import.meta.client': true, 'import.meta.dev': false },
  test: {
    environment: 'node',
    testTimeout: 60000,
    include: ['tests/unit/**/*.test.ts'],
    // los paquetes de Strudel pasan por Vite para que valga el alias de arriba
    server: { deps: { inline: [/@strudel\//] } },
    coverage: {
      provider: 'v8',
      include: ['app/lib/**/*.ts', 'app/composables/**/*.ts'],
    },
  },
})
