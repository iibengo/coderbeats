// Graba el audio de un remix del Laboratorio (lo que suena, tal cual sale del motor) y lo guarda como .webm (opus).
// Uso: node tests/browser/exportar-audio.mjs [parte-del-título] [segundos] [salida.webm]   (por defecto: Lacrimosa, 125 s)
// Después, a mp3: ffmpeg -i salida.webm -vn -c:a libmp3lame -b:a 320k salida.mp3
// Va en tiempo real y usa el puerto de PORT (3999 por defecto): levantar antes `NUXT_IGNORE_LOCK=1 npx nuxt dev --port 3999`.
import puppeteer from 'puppeteer-core'
import { writeFileSync } from 'node:fs'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const title = process.argv[2] || 'Lacrimosa'
const secs = Number(process.argv[3] || 125)
const out = process.argv[4] || 'remix.webm'
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--lang=es-ES', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] })
const p = await b.newPage()
await p.setViewport({ width: 420, height: 800, hasTouch: true, isMobile: true })
const errs = []
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
// un «grifo» de audio: todo lo que se conecta a la salida (`destination`) se copia a un flujo que luego se graba
await p.evaluateOnNewDocument(() => {
  const orig = AudioNode.prototype.connect
  AudioNode.prototype.connect = function (dest, ...rest) {
    const r = orig.call(this, dest, ...rest)
    if (typeof AudioDestinationNode !== 'undefined' && dest instanceof AudioDestinationNode) {
      const ctx = this.context
      if (!window.__tap || window.__tap.ctx !== ctx) window.__tap = { ctx, dest: ctx.createMediaStreamDestination() }
      orig.call(this, window.__tap.dest)
    }
    return r
  }
})
await p.goto(`http://localhost:${process.env.PORT || 3999}/lab`, { waitUntil: 'networkidle2', timeout: 180000 })
await sleep(2500)
const click = (t) => p.evaluate((t) => { const el = [...document.querySelectorAll('button')].find((b) => ((b.getAttribute('aria-label') || '') + b.textContent).includes(t)); if (!el) return false; el.click(); return true }, t)
console.log('Remixes:', await click('Remixes')); await sleep(5000)
console.log(`«${title}»:`, await click(title)); await sleep(3000)
console.log('escuchar el remix original:', await click('escuchar el remix original'))
// esperar a que el motor tenga su salida y empiece a sonar
for (let i = 0; i < 40; i++) { if (await p.evaluate(() => !!window.__tap)) break; await sleep(500) }
await p.evaluate(() => {
  window.__chunks = []
  window.__rec = new MediaRecorder(window.__tap.dest.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 256000 })
  window.__rec.ondataavailable = (e) => e.data.size && window.__chunks.push(e.data)
  window.__rec.start(1000)
})
console.log(`grabando ${secs} s…`)
await sleep(secs * 1000)
const b64 = await p.evaluate(() => new Promise((res) => {
  window.__rec.onstop = async () => { const buf = await new Blob(window.__chunks, { type: 'audio/webm' }).arrayBuffer(); let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); res(btoa(s)) }
  window.__rec.stop()
}))
writeFileSync(out, Buffer.from(b64, 'base64'))
console.log('guardado:', out, Math.round(b64.length * 0.75 / 1024), 'KB', errs.length ? 'errores: ' + errs.join(' | ') : 'sin errores')
await b.close()
