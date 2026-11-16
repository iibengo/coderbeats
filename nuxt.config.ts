import { fileURLToPath } from 'node:url'
import labTake from './dev/labTake'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@nuxtjs/tailwindcss', '@vite-pwa/nuxt', '@nuxt/icon', '@nuxt/fonts', '@nuxtjs/i18n'],

  // Idiomas (spec 025): español base, inglés y euskera; el del navegador, con selector en «Acerca de». Sin rutas por idioma.
  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'es',
    locales: [
      { code: 'es', language: 'es-ES', name: 'Español', file: 'es.json' },
      { code: 'en', language: 'en-GB', name: 'English', file: 'en.json' },
      { code: 'eu', language: 'eu-ES', name: 'Euskara', file: 'eu.json' },
    ],
    vueI18n: './i18n.config.ts',
    detectBrowserLanguage: { useCookie: true, cookieKey: 'coderbeats_lang', fallbackLocale: 'es', redirectOn: 'root' },
    // lo que falte en inglés o euskera se ve en español, nunca una clave
    compilation: { strictMessage: false },
  },

  typescript: { strict: true },

  // Todo el audio corre en el navegador: la página no se renderiza en el servidor.
  routeRules: { '/': { ssr: false }, '/lab': { ssr: false }, '/estudio': { ssr: false }, ...(process.env.NODE_ENV === 'production' ? {} : { '/spike': { ssr: false }, '/lab/voz': { ssr: false }, '/lab/aro': { ssr: false }, '/lab/sonido': { ssr: false }, '/lab/estudio': { ssr: false } }) },

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
        { name: 'description', content: 'Haz beatbox con el micro y míralo convertirse en batería, melodía y código Strudel. Software libre (AGPL).' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-title', content: 'coderbeats' },
      ],
      link: [{ rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }],
    },
  },

  pwa: {
    manifest: {
      name: 'coderbeats',
      short_name: 'coderbeats',
      theme_color: '#0B0B0F',
      background_color: '#0B0B0F',
      lang: 'es',
      display: 'standalone',
      icons: [
        { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    // sin esto el service worker solo guardaba 3 archivos y la app no abría sin conexión (ni los samples ni los worklets)
    workbox: {
      globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2,wav,webmanifest}'],
      maximumFileSizeToCacheInBytes: 3_000_000,
      navigateFallback: '/',
    },
  },
})
