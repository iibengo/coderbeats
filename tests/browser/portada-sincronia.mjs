// «Melodía en el compás» (spec 016 §9.3): cada nota de la espiral se programa en un paso exacto del compás del motor, y lo grabado lleva la fase del compás.
import { open, sleep, clickLabel } from './lib.mjs'
const { b, p, errs } = await open({ simple: true })
await p.evaluateOnNewDocument(() => {})
await p.evaluate(() => { window.__sched = []; const o = AudioParam.prototype.setTargetAtTime; AudioParam.prototype.setTargetAtTime = function (v, t, c) { if (c === 0.02 && v > 100 && v < 2200) window.__sched.push(t); return o.call(this, v, t, c) } })
await clickLabel(p, 'Hip hop'); await sleep(2500)
const t = await p.touchscreen.touchStart(200, 300)
for (let i = 0; i < 300; i++) { await t.move(200 + 100 * Math.sin(i / 9), 300 + 100 * Math.cos(i / 7)); await sleep(50) }
await t.end(); await sleep(500)
const r = await p.evaluate(() => {
  const ck = window.__engine.pilot.clock(); const bc = ck
  const step = ck.stepSec; const t0 = ck.at(0)
  const fr = window.__sched.map((t) => { const x = (t - t0) / step; return Math.abs(x - Math.round(x)) })
  const mel = window.__engine.loops.value.loops.filter((l) => l.instrument === 'mel').map((l) => ({ n: l.hits.length, phase: l.phaseBar, bars: l.bars }))
  return { n: fr.length, max: Math.max(...fr), mean: fr.reduce((a, c) => a + c, 0) / fr.length, mel, step }
})
console.log('notas programadas:', r.n, '| desvío máx del paso (en pasos):', r.max.toFixed(4), '(', (r.max * r.step * 1000).toFixed(2), 'ms ) | medio', r.mean.toFixed(4))
console.log('melodía grabada:', JSON.stringify(r.mel))
console.log('errores', errs)
await b.close()
