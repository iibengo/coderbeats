// «Guardar audio (MP3)» del Laboratorio (spec 054): abre un remix, pulsa el botón del menú «⋯», espera a que termine y guarda el MP3 que daría la descarga.
// Uso: node tests/browser/lab-exportar-mp3.mjs [parte-del-título] [salida.mp3]   (por defecto: Korobeiniki; va en tiempo real, ≈ la duración del remix)
// Después se mide con ffmpeg: ffmpeg -i salida.mp3 -af ebur128=peak=true -f null -    y ffprobe para la duración.
// Va en tiempo real y usa el puerto de PORT (3999 por defecto): levantar antes `NUXT_IGNORE_LOCK=1 npx nuxt dev --port 3999`.
import puppeteer from 'puppeteer-core'
import { writeFileSync } from 'node:fs'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const title = process.argv[2] || 'Korobeiniki'
const out = process.argv[3] || 'remix.mp3'
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--lang=es-ES', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] })
const p = await b.newPage()
await p.setViewport({ width: 420, height: 800, hasTouch: true, isMobile: true })
const errs = []
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)))
// la descarga: se intercepta el clic del enlace y se guarda el contenido del archivo
await p.evaluateOnNewDocument(() => {
  const click = HTMLAnchorElement.prototype.click
  HTMLAnchorElement.prototype.click = function () {
    if (this.download) { window.__dl = { href: this.href, name: this.download }; return }
    return click.call(this)
  }
})
await p.goto(`http://localhost:${process.env.PORT || 3999}/lab`, { waitUntil: 'networkidle2', timeout: 180000 })
await sleep(2500)
const click = (t) => p.evaluate((t) => { const el = [...document.querySelectorAll('button')].find((b) => ((b.getAttribute('aria-label') || '') + b.textContent).includes(t)); if (!el) return false; el.click(); return true }, t)
console.log('Remixes:', await click('Remixes')); await sleep(5000)
console.log(`«${title}»:`, await click(title)); await sleep(3000)
console.log('botón del MP3:', await p.evaluate(() => { const e = document.querySelector('[data-audio-export]'); if (!e) return false; e.click(); return true }))
const t0 = Date.now()
let last = ''
for (let i = 0; i < 400; i++) {
  const st = await p.evaluate(() => document.querySelector('[data-audio-status]')?.textContent?.trim() ?? (document.querySelector('[data-audio-done]') ? 'LISTO' : ''))
  if (st !== last && st) { console.log(`${Math.round((Date.now() - t0) / 1000)} s · ${st}`); last = st }
  if (st === 'LISTO' || /No se pudo/.test(st)) break
  await sleep(1000)
}
const ok = await p.evaluate(() => { const e = document.querySelector('[data-audio-save]'); if (!e) return false; e.click(); return true })
console.log('Guardar:', ok)
await sleep(500)
const b64 = await p.evaluate(async () => {
  const d = window.__dl; if (!d) return null
  const buf = await (await fetch(d.href)).arrayBuffer()
  let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000))
  return { name: d.name, data: btoa(s) }
})
if (b64) { writeFileSync(out, Buffer.from(b64.data, 'base64')); console.log('guardado:', out, '← nombre de la descarga:', b64.name, Math.round(b64.data.length * 0.75 / 1024), 'KB') }
console.log(errs.length ? 'errores: ' + errs.join(' | ') : 'sin errores')
await b.close()
