// Exportar vídeo: graba 2 compases de la demo en vertical 720; el archivo se reproduce, mide lo esperado, tiene imagen (no en blanco) y sonido.
import { open, sleep, clickLabel, clickExact } from './lib.mjs'
const { b, p, errs } = await open()
await clickExact(p, 'techno'); await sleep(300)
await clickLabel(p, 'ajustes'); await sleep(400); await clickLabel(p, 'Cargar demo'); await sleep(800)
await clickExact(p, 'tocar'); await sleep(3000)
const t0 = Date.now()
const ok = await p.evaluate(() => window.__video.start({ what: 'cell', bars: 2, format: 'vertical', size: 720, fps: 30, mark: true }))
console.log('grabado', ok, Math.round((Date.now() - t0) / 100) / 10, 's')
const r = await p.evaluate(async () => {
  const st = window.__video.state
  const blob = await (await fetch(st.url)).blob()
  const v = document.createElement('video'); v.muted = true; v.src = st.url; v.playsInline = true
  await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej('error al cargar: ' + (v.error && v.error.code) + ' ' + (v.error && v.error.message) + ' · tipo ' + blob.type + ' · ' + blob.size + ' bytes'); setTimeout(() => rej('tiempo'), 8000) })
  await v.play().catch(() => {}); await new Promise(r => setTimeout(r, 1200)); v.pause()
  const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; const g = c.getContext('2d'); g.drawImage(v, 0, 0)
  const px = g.getImageData(0, 0, c.width, c.height).data; let lit = 0; for (let i = 0; i < px.length; i += 16) if (px[i] + px[i + 1] + px[i + 2] > 60) lit++
  // audio: se decodifica y se mide el volumen
  let rms = null
  try { const ac = new AudioContext(); const buf = await ac.decodeAudioData(await blob.arrayBuffer()); const d = buf.getChannelData(0); let s = 0; for (const x of d) s += x * x; rms = Math.sqrt(s / d.length); rms = { rms, dur: buf.duration } } catch (e) { rms = 'sin audio decodificable: ' + e }
  return { type: blob.type, bytes: blob.size, w: v.videoWidth, h: v.videoHeight, dur: v.duration, litPixels: lit, audio: rms, name: st.name }
})
console.log(JSON.stringify(r), errs)
await b.close(); process.exit(0)
