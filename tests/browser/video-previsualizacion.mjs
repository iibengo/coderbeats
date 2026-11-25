// Exportar la previsualización: graba mientras el piloto construye la canción; al terminar, el vídeo se reproduce y la canción del usuario queda como estaba.
import { open, sleep, clickLabel, clickExact } from './lib.mjs'
const { b, p, errs } = await open()
await clickExact(p, 'dembow'); await sleep(300)
await p.evaluate(() => window.__engine.loadDemo()); await sleep(800)
const sig = () => p.evaluate(() => JSON.stringify(window.__engine.snapshot().song.order.map(id => { const c = window.__engine.snapshot().song.cells.find(c => c.id === id); return [c.turns, c.loops.map(l => [l.instrument, l.hits.length])] })))
const antes = await sig()
const t0 = Date.now()
const ok = await p.evaluate(() => window.__video.start({ what: 'preview', bars: 4, format: 'cuadrado', size: 720, fps: 30, mark: false }))
console.log('grabado', ok, Math.round((Date.now() - t0) / 1000), 's')
const r = await p.evaluate(async () => {
  const st = window.__video.state
  const v = document.createElement('video'); v.muted = true; v.src = st.url
  await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej('error al cargar'); setTimeout(() => rej('tiempo'), 8000) })
  return { w: v.videoWidth, h: v.videoHeight, dur: v.duration, bytes: st.bytes, pilotActivo: !!document.querySelector('.pilot') }
})
console.log(JSON.stringify(r), 'canción igual que antes:', (await sig()) === antes, errs)
await b.close(); process.exit(ok && r.dur > 10 ? 0 : 1)
