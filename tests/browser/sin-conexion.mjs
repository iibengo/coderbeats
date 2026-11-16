// La PWA abre sin conexión (service worker con todo precacheado). Necesita `npm run build && npx nuxt preview --port 4173`.
import puppeteer from 'puppeteer-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const url = `http://localhost:${process.env.PORT || 4173}/`
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] })
const p = await b.newPage()
await p.goto(url, { waitUntil: 'networkidle2', timeout: 60000 })
await p.evaluate(() => navigator.serviceWorker.ready)
await sleep(6000) // que termine de precachear
const cached = await p.evaluate(async () => { const ks = await caches.keys(); let n = 0; for (const k of ks) n += (await (await caches.open(k)).keys()).length; return n })
console.log('entradas en caché:', cached)
await p.setOfflineMode(true)
await p.reload({ waitUntil: 'load', timeout: 30000 })
await sleep(2500)
console.log('sin conexión, texto:', JSON.stringify((await p.evaluate(() => document.body.innerText)).slice(0, 80)))
const wav = await p.evaluate(async () => { try { const r = await fetch('/samples/electro/bd.wav'); return r.ok } catch { return false } })
console.log('sample sin conexión:', wav)
await b.close()
