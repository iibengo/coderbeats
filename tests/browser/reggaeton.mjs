// Reggaetón (spec 032): sale en la lista de estilos, su demo se carga y suena a ~95 bpm.
import { open, sleep } from './lib.mjs'
const { b, p, errs } = await open()
await p.evaluate(() => document.querySelector('[data-style-label]').click()); await sleep(300)
console.log('estilos:', await p.evaluate(() => [...document.querySelectorAll('[data-style-menu] [role=option]')].map((x) => x.textContent.trim())))
await p.evaluate(() => [...document.querySelectorAll('[data-style-menu] [role=option]')].find((x) => /reggaet|dembow/i.test(x.textContent))?.click()); await sleep(1500)
await p.evaluate(() => document.querySelector('[data-demo-start]')?.click()); await sleep(1000)
console.log('tras la demo:', JSON.stringify(await p.evaluate(() => ({ estilo: window.__engine.style.value, bpm: window.__engine.bpm.value, loops: window.__engine.loops.value.loops.map((l) => l.instrument + ':' + l.hits.length) }))))
await p.evaluate(() => { window.__engine.setBackgroundMode('manual'); window.__engine.setBackgroundManual({ bass: true, chords: true }); window.__engine.play() }); await sleep(6000)
const t = []
for (let i = 0; i < 8; i++) { t.push(await p.evaluate(() => { const c = window.__engine.clockNow(); return [Date.now(), c.bar + c.barPhase] })); await sleep(1000) }
console.log('segundos por compás:', (((t.at(-1)[0] - t[0][0]) / 1000) / (t.at(-1)[1] - t[0][1])).toFixed(2), '(esperado', (240 / 95).toFixed(2) + ')', 'suena:', await p.evaluate(() => window.__engine.playing.value), errs)
await b.close()
