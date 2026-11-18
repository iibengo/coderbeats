// Master (spec 047): el limitador de pico carga y limita de verdad, el EQ (apagado por defecto) cambia el espectro y el medidor de Ajustes se mueve.
import { open, clickLabel, sleep } from './lib.mjs'
const { b, p, errs } = await open()
const logs = []
p.on('console', (m) => logs.push(m.text()))
await p.evaluate(() => {
  const e = window.__engine
  const l = (id, i, hits, extra = {}) => ({ id, instrument: i, bars: 1, phaseBar: 0, hits, muted: false, bornAt: 0, fromTemplate: false, ...extra })
  const d = (ps, s = 0.95) => ps.map((pos) => ({ pos, strength: s }))
  e.setKit('techno')
  e.editLoops({ loops: [l(1, 'bd', d([0, 4, 8, 12])), l(2, 'hh', d(Array.from({ length: 16 }, (_, i) => i), 0.9)), l(3, 'sd', d([4, 12]))], nextId: 4 })
  e.play()
  window.__spec = (async () => {
    const ac = new AudioContext(); await ac.resume()
    const an = ac.createAnalyser(); an.fftSize = 8192; an.smoothingTimeConstant = 0
    ac.createMediaStreamSource(e.videoAudio()).connect(an)
    const bins = new Float32Array(an.frequencyBinCount); const hz = ac.sampleRate / an.fftSize
    window.__band = (ms) => new Promise((res) => { const acc = { lo: 0, mid: 0, hi: 0, n: 0 }; const t0 = performance.now(); const tick = () => { an.getFloatFrequencyData(bins); const sum = (a, bb) => { let s = 0; for (let k = Math.floor(a / hz); k <= Math.floor(bb / hz); k++) s += 10 ** (bins[k] / 10); return s }; acc.lo += sum(10, 25); acc.mid += sum(2000, 5000); acc.hi += sum(80, 200); acc.n++; if (performance.now() - t0 < ms) setTimeout(tick, 50); else res({ sub: 10 * Math.log10(acc.lo / acc.n + 1e-20), brillo: 10 * Math.log10(acc.mid / acc.n + 1e-20), cuerpo: 10 * Math.log10(acc.hi / acc.n + 1e-20) }) }; tick() })
  })()
})
await sleep(2500); await p.evaluate(() => window.__spec)
const W = (240 / 132) * 4 * 1000
const f = (x) => `sub 10–25 Hz ${x.sub.toFixed(1)} · cuerpo 80–200 Hz ${x.cuerpo.toFixed(1)} · brillo 2–5 kHz ${x.brillo.toFixed(1)} dB`
const res = []
for (const on of [false, true, false, true]) { await p.evaluate((o) => window.__engine.setEq(o), on); await sleep(800); const x = await p.evaluate((w) => window.__band(w), W); res.push([on, x]); console.log(on ? 'EQ encendido:' : 'EQ apagado:  ', f(x)) }
const avg = (on, k) => res.filter(([o]) => o === on).reduce((a, [, x]) => a + x[k], 0) / 2
console.log(`diferencia (encendido − apagado): brillo ${(avg(true, 'brillo') - avg(false, 'brillo')).toFixed(2)} dB · cuerpo ${(avg(true, 'cuerpo') - avg(false, 'cuerpo')).toFixed(2)} dB · sub ${(avg(true, 'sub') - avg(false, 'sub')).toFixed(2)} dB`)
await p.evaluate(() => window.__engine.setEq(false))
console.log('limitador de pico cargado (sin aviso de error):', !logs.some((x) => x.includes('master-limiter')))
// con una señal ESTABLE (ruido blanco a la entrada de la cadena master) para medir bien: el EQ de verdad, sin el ruido de un patrón
await p.evaluate(() => window.__engine.stop?.()); await sleep(600)
await p.evaluate(() => {
  const ctx = window.__masterIn.context
  const buf = ctx.createBuffer(2, ctx.sampleRate * 2, ctx.sampleRate)
  for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.12 }
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(window.__masterIn); src.start()
  window.__noise = src
})
await sleep(1000)
const rn = []
for (const on of [false, true, false, true]) { await p.evaluate((o) => window.__engine.setEq(o), on); await sleep(800); const x = await p.evaluate(() => window.__band(3000)); rn.push([on, x]); console.log('ruido blanco, EQ', on ? 'encendido:' : 'apagado:  ', f(x)) }
const av = (on, k) => rn.filter(([o]) => o === on).reduce((a, [, x]) => a + x[k], 0) / 2
console.log(`ruido blanco · diferencia (encendido − apagado): brillo 2–5 kHz ${(av(true, 'brillo') - av(false, 'brillo')).toFixed(2)} dB (esperado ≈ +2,5) · cuerpo 80–200 Hz ${(av(true, 'cuerpo') - av(false, 'cuerpo')).toFixed(2)} dB (esperado ≈ 0) · sub 10–25 Hz ${(av(true, 'sub') - av(false, 'sub')).toFixed(2)} dB (esperado < −4)`)
await p.evaluate(() => { window.__noise.stop(); window.__engine.setEq(false) })
// el limitador de pico: ruido muy fuerte (+18 dB por encima del cero) a la entrada; la salida no puede pasar de −1 dBFS
await p.evaluate(() => {
  const ctx = window.__masterIn.context
  const buf = ctx.createBuffer(2, ctx.sampleRate, ctx.sampleRate)
  for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 8 }
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(window.__masterIn); src.start(); window.__loud = src
  const an = ctx.createAnalyser(); an.fftSize = 2048; window.__engine.videoAudio(); ctx.createMediaStreamSource(window.__engine.videoAudio()).connect?.(an)
})
const pico = await p.evaluate(async () => { const ctx = window.__masterIn.context; const ac = new AudioContext(); await ac.resume(); const an = ac.createAnalyser(); an.fftSize = 2048; ac.createMediaStreamSource(window.__engine.videoAudio()).connect(an); const buf = new Float32Array(2048); let pk = 0; const t0 = performance.now(); while (performance.now() - t0 < 3000) { an.getFloatTimeDomainData(buf); for (const x of buf) pk = Math.max(pk, Math.abs(x)); await new Promise((r) => setTimeout(r, 20)) } return 20 * Math.log10(pk) })
console.log(`limitador de pico con +18 dB a la entrada: pico de salida ${pico.toFixed(2)} dBFS | no pasa de −1 dBFS:`, pico <= -0.99)
await p.evaluate(() => window.__loud.stop())
// el worklet del limitador, solo, en un AudioWorklet de verdad (sin el resto de la cadena): +9,5 dB a la entrada → nunca más de −1 dBFS
const solo = await p.evaluate(async () => {
  const off = new OfflineAudioContext(2, 48000, 48000)
  await off.audioWorklet.addModule(`${location.origin}/worklets/master-limiter.js`)
  const buf = off.createBuffer(2, 48000, 48000)
  for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = 3 * Math.sin((2 * Math.PI * 110 * i) / 48000) + (i % 997 === 0 ? 2 : 0) }
  const src = off.createBufferSource(); src.buffer = buf
  const lim = new AudioWorkletNode(off, 'master-limiter', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], processorOptions: { ceilingDb: -1, lookaheadMs: 1.5, releaseMs: 80 } })
  src.connect(lim).connect(off.destination); src.start()
  const out = await off.startRendering()
  let pk = 0; for (let c = 0; c < 2; c++) for (const x of out.getChannelData(c)) pk = Math.max(pk, Math.abs(x))
  return 20 * Math.log10(pk)
})
console.log(`worklet del limitador solo, +9,5 dB a la entrada: pico ${solo.toFixed(3)} dBFS | no pasa de −1 dBFS:`, solo <= -0.999)
// el medidor de Ajustes → Avanzado
await p.evaluate(() => localStorage.setItem('coderbeats:studio:v2', JSON.stringify({ advanced: true })))
await p.reload({ waitUntil: 'networkidle2' }); await sleep(800)
await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Usar el micro'))?.click()); await sleep(6000)
await p.evaluate(() => {
  const e = window.__engine; const l = (id, i, hits) => ({ id, instrument: i, bars: 1, phaseBar: 0, hits, muted: false, bornAt: 0, fromTemplate: false })
  e.editLoops({ loops: [l(1, 'bd', [0, 4, 8, 12].map((pos) => ({ pos, strength: 0.95 })))], nextId: 2 }); e.play()
})
await sleep(1500)
await clickLabel(p, 'ajustes'); await sleep(1500)
console.log('medidor:', await p.evaluate(() => document.querySelector('[data-meter-text]')?.textContent), '| interruptor EQ:', await p.evaluate(() => document.querySelector('[data-eq-toggle]')?.getAttribute('aria-pressed')))
await p.evaluate(() => document.querySelector('[data-eq-toggle]').click()); await sleep(300)
console.log('tras pulsar: EQ', await p.evaluate(() => document.querySelector('[data-eq-toggle]').getAttribute('aria-pressed')), '| guardado:', await p.evaluate(() => localStorage.getItem('coderbeats:studio:v2')))
console.log('errores:', errs)
await b.close()
