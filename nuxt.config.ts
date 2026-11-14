import { fileURLToPath } from 'node:url'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@nuxtjs/tailwindcss', '@vite-pwa/nuxt', '@nuxt/icon', '@nuxt/fonts'],

  typescript: { strict: true },

  // Todo el audio corre en el navegador: la página no se renderiza en el servidor.
  routeRules: { '/': { ssr: false }, ...(process.env.NODE_ENV === 'production' ? {} : { '/spike': { ssr: false } }) },

  // /spike (banco de pruebas de Strudel) vive en dev/ y solo existe con `nuxt dev`: no entra en el build
  hooks: {
    'pages:extend'(pages) {
      if (process.env.NODE_ENV === 'production') return
      pages.push({ name: 'spike', path: '/spike', file: fileURLToPath(new URL('./dev/spike.vue', import.meta.url)) })
    },
  },

  app: {
    head: {
      title: 'coderbeats',
      htmlAttrs: { lang: 'es' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#0B0B0F' },
      ],
    },
  },

  pwa: {
    manifest: {
      name: 'coderbeats',
      short_name: 'coderbeats',
      theme_color: '#0B0B0F',
      background_color: '#0B0B0F',
      lang: 'es',
    },
  },
})
