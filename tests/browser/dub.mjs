// Sinte dub (spec 046): el motor evalúa el código con el eco (.off con funciones flecha) sin errores y suena (hay señal a la salida).
import { open, sleep } from './lib.mjs'
const { b, p, errs } = await open()
await p.evaluate(() => {
  const e = window.__engine
  const chord = [53, 56, 60, 63, 67].map((midi) => ({ pos: 0, strength: 0.8, midi, dur: 4 }))
  e.editLoops({ loops: [{ id: 1, instrument: 'mel', bars: 1, phaseBar: 0, hits: chord, muted: false, bornAt: 0, fromTemplate: false, synth: 'dub' }], nextId: 2 })
  e.play()
  window.__tap = (async () => { const ac = new AudioContext(); await ac.resume(); const an = ac.createAnalyser(); an.fftSize = 2048; ac.createMediaStreamSource(e.videoAudio()).connect(an); const buf = new Float32Array(2048)
    window.__rms = (ms) => new Promise((res) => { let sum = 0, n = 0, pk = 0; const t0 = performance.now(); const tick = () => { an.getFloatTimeDomainData(buf); for (const x of buf) { sum += x * x; n++; pk = Math.max(pk, Math.abs(x)) } if (performance.now() - t0 < ms) setTimeout(tick, 20); else res({ rmsDb: 10 * Math.log10(sum / n + 1e-12), peakDb: 20 * Math.log10(pk + 1e-9) }) }; tick() }) })()
})
await sleep(2500); await p.evaluate(() => window.__tap)
const r = await p.evaluate(() => window.__rms(6000))
console.log('suena:', await p.evaluate(() => window.__engine.playing.value), '| nivel de salida:', `RMS ${r.rmsDb.toFixed(1)} dB · pico ${r.peakDb.toFixed(1)} dB`, '| hay señal:', r.peakDb > -50, '| errores:', errs)
await b.close()
