import { fileURLToPath } from 'node:url'
import labTake from './dev/labTake'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@nuxtjs/tailwindcss', '@vite-pwa/nuxt', '@nuxt/icon', '@nuxt/fonts'],

  typescript: { strict: true },

  // Todo el audio corre en el navegador: la página no se renderiza en el servidor.
  routeRules: { '/': { ssr: false }, ...(process.env.NODE_ENV === 'production' ? {} : { '/spike': { ssr: false }, '/lab/voz': { ssr: false }, '/lab/aro': { ssr: false }, '/lab/sonido': { ssr: false }, '/lab/estudio': { ssr: false } }) },

  // Páginas de desarrollo (en dev/): /spike (banco de pruebas de Strudel) y /lab/voz (laboratorio de voz, spec 002).
  // Solo existen con `nuxt dev`: no entran en el build.
  hooks: {
    'pages:extend'(pages) {
      if (process.env.NODE_ENV === 'production') return
      const dev = (f: string) => fileURLToPath(new URL(`./dev/${f}`, import.meta.url))
      pages.push({ name: 'spike', path: '/spike', file: dev('spike.vue') })
      pages.push({ name: 'lab-voz', path: '/lab/voz', file: dev('lab-voz.vue') })
      pages.push({ name: 'lab-aro', path: '/lab/aro', file: dev('lab-aro.vue') })
      pages.push({ name: 'lab-sonido', path: '/lab/sonido', file: dev('lab-sonido.vue') })
      pages.push({ name: 'lab-estudio', path: '/lab/estudio', file: dev('lab-estudio.vue') })
    },
  },

  // Ruta de desarrollo que guarda las tomas del laboratorio en tests/fixtures/voice/ (solo `nuxt dev`)
  nitro: process.env.NODE_ENV === 'production' ? {} : { devHandlers: [{ route: '/_lab/take', handler: labTake }] },

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
