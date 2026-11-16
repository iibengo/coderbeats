// «🎬 Mi reel»: el vídeo de la portada (círculo, golpes, aguja, estilo y BPM arriba) con tu audio; sin opciones.
import { open, sleep, clickLabel } from './lib.mjs'
const OUT = process.env.OUT || '/tmp'
const { b, p, errs } = await open({ simple: true })
await clickLabel(p, 'Techno'); await sleep(2500)
const box = async (l) => p.evaluate((l) => { const r = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === l).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, l)
for (let i = 0; i < 6; i++) { const m = await box(i % 2 ? 'pff' : 'bum'); await p.touchscreen.tap(m.x, m.y); await sleep(330) }
await sleep(1500)
await clickLabel(p, 'mi reel'); await sleep(600)
console.log('hoja: selectores', await p.$$eval('select', (s) => s.length), '| título', await p.evaluate(() => document.querySelector('h2')?.textContent))
await clickLabel(p, 'Grabar mi reel')
await p.waitForFunction(() => window.__video && ['done', 'error'].includes(document.__v ?? ''), { timeout: 100 }).catch(() => {})
for (let i = 0; i < 40; i++) { await sleep(1000); const st = await p.evaluate(() => { const v = document.querySelector('video'); return { video: !!v, text: document.body.innerText.match(/Grabando[^\n]*|mp4|webm/)?.[0] } }); if (st.video) { console.log('listo tras', i + 1, 's'); break } }
const info = await p.evaluate(() => { const v = document.querySelector('video'); return v ? { w: v.videoWidth, h: v.videoHeight, name: document.querySelector('p.truncate')?.textContent } : null })
console.log('vídeo:', JSON.stringify(info))
const frame = await p.evaluate(async () => { const v = document.querySelector('video'); v.muted = true; v.currentTime = 6; await new Promise((r) => (v.onseeked = r)); const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d').drawImage(v, 0, 0); return c.toDataURL('image/png') })
const fs = await import('node:fs'); fs.writeFileSync(`${OUT}/portada-reel-frame.png`, Buffer.from(frame.split(',')[1], 'base64'))
console.log('errores', errs)
await b.close()
