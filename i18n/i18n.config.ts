// vue-i18n (spec 025): composición, y lo que falte en inglés o euskera se ve en español (nunca una clave).
export default defineI18nConfig(() => ({
  legacy: false,
  fallbackLocale: 'es',
}))
