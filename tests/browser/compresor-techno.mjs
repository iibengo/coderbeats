// Compresor «techno» de la salida (spec 042): mide el nivel real de la salida con y sin el interruptor, y que el interruptor (Ajustes → Avanzado) se guarda.
import { open, clickLabel, sleep } from './lib.mjs'
const { b, p, errs } = await open()
await p.evaluate((k) => { window.__K = k }, process.env.NIVEL ?? 1) // NIVEL=0.5: una mezcla más baja (con 1, el limitador manda y casi no se nota)
await p.evaluate(() => {
  const e = window.__engine
  e.setKit('techno')
  const l = (id, i, hits, extra = {}) => ({ id, instrument: i, bars: 1, phaseBar: 0, hits, muted: false, bornAt: 0, fromTemplate: false, ...extra })
  const k = Number(window.__K ?? 1)
  const d = (ps, s = 0.95) => ps.map((pos) => ({ pos, strength: s * k }))
  const m = (note) => [{ pos: 0, dur: 8, midi: note, strength: 0.9 }, { pos: 8, dur: 8, midi: note + 7, strength: 0.9 }]
  e.editLoops({ loops: [l(1, 'bd', d([0, 4, 8, 12])), l(2, 'sd', d([4, 12], 0.9)), l(3, 'hh', d([2, 6, 10, 14], 0.8)), l(4, 'mel', m(38), { synth: 'bass' }), l(5, 'mel', m(62), { synth: 'lead' })], nextId: 6 })
  e.play()
  window.__tap = (async () => {
    const stream = e.videoAudio(); const ac = new AudioContext(); await ac.resume()
    const an = ac.createAnalyser(); an.fftSize = 2048; ac.createMediaStreamSource(stream).connect(an)
    const buf = new Float32Array(an.fftSize)
    window.__measure = (ms) => new Promise((res) => { let peak = 0, sum = 0, n = 0; const t0 = performance.now(); const tick = () => { an.getFloatTimeDomainData(buf); for (const x of buf) { peak = Math.max(peak, Math.abs(x)); sum += x * x; n++ } if (performance.now() - t0 < ms) setTimeout(tick, 20); else res({ peakDb: 20 * Math.log10(peak + 1e-9), rmsDb: 10 * Math.log10(sum / n + 1e-12) }) }; tick() })
  })()
})
await sleep(2500); await p.evaluate(() => window.__tap)
const fmt = (r) => `pico ${r.peakDb.toFixed(1)} dB · RMS ${r.rmsDb.toFixed(1)} dB · cresta ${(r.peakDb - r.rmsDb).toFixed(1)} dB`
// ventanas de 4 compases justos (a 132 bpm: 7,27 s) y alternando, para que la comparación no dependa del punto del patrón ni del orden
const W = (240 / 132) * 4 * 1000
const res = []
for (const on of [false, true, false, true]) {
  await p.evaluate((o) => window.__engine.setGlue(o), on); await sleep(1200)
  const r = await p.evaluate((w) => window.__measure(w), W); res.push([on, r]); console.log(on ? 'encendido:' : 'apagado:  ', fmt(r))
}
const avg = (on, k) => res.filter(([o]) => o === on).reduce((a, [, r]) => a + r[k], 0) / 2
console.log(`diferencia (encendido − apagado): cresta ${(avg(true, 'peakDb') - avg(true, 'rmsDb') - (avg(false, 'peakDb') - avg(false, 'rmsDb'))).toFixed(2)} dB · RMS ${(avg(true, 'rmsDb') - avg(false, 'rmsDb')).toFixed(2)} dB · pico ${(avg(true, 'peakDb') - avg(false, 'peakDb')).toFixed(2)} dB`)
// el mensaje llega al worklet: unos ajustes extremos (umbral −40 dB, ratio 20) tienen que bajar el nivel claramente
await p.evaluate(() => window.__glueSend({ thresholdDb: -40, ratio: 20, kneeDb: 6, attack: 0.03, release: 0.12, rmsMs: 40, makeupDb: 0 })); await sleep(1200)
const ext = await p.evaluate((w) => window.__measure(w), W); console.log('ajustes extremos (prueba del canal):', fmt(ext), '| baja el RMS más de 2 dB:', ext.rmsDb < avg(false, 'rmsDb') - 2)
await p.evaluate(() => window.__engine.setGlue(false))
// el interruptor de Ajustes → Avanzado: sale solo con «avanzado», empieza apagado, se guarda y sobrevive a recargar
await clickLabel(p, 'ajustes'); await sleep(600)
console.log('cerrado «avanzado»: el interruptor existe:', await p.evaluate(() => !!document.querySelector('[data-glue-toggle]')))
await p.evaluate(() => document.querySelector('[data-advanced-toggle]').click()); await sleep(400)
console.log('abierto: existe', await p.evaluate(() => !!document.querySelector('[data-glue-toggle]')), '| empieza apagado:', await p.evaluate(() => document.querySelector('[data-glue-toggle]').getAttribute('aria-pressed')))
await p.evaluate(() => document.querySelector('[data-glue-toggle]').click()); await sleep(300)
console.log('tras pulsarlo: aria-pressed', await p.evaluate(() => document.querySelector('[data-glue-toggle]').getAttribute('aria-pressed')), '| guardado:', await p.evaluate(() => localStorage.getItem('coderbeats:studio:v2')), '| ui:v1 intacto:', await p.evaluate(() => !!localStorage.getItem('coderbeats:ui:v1')))
await p.reload({ waitUntil: 'networkidle2' }); await sleep(800)
await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Usar el micro'))?.click()); await sleep(6000)
await clickLabel(p, 'ajustes'); await sleep(600)
console.log('tras recargar: aria-pressed', await p.evaluate(() => document.querySelector('[data-glue-toggle]')?.getAttribute('aria-pressed')))
console.log('errores:', errs)
await b.close()
