// Tutorial: tras la guía, «Arrastra un golpe» con la mano fantasma; al arrastrar uno pasa a «Llévalo al centro…»; al borrarlo termina.
import { open, sleep, clickLabel, clickExact } from './lib.mjs'
const { b, p, errs } = await open()
await p.evaluate(() => localStorage.setItem('coderbeats:guide:v1', JSON.stringify({ done: true })))
await p.reload({ waitUntil: 'networkidle2' }); await sleep(2500)
await p.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Usar el micro'))?.click()); await sleep(7000)
await clickLabel(p, 'ajustes'); await sleep(400); await clickLabel(p, 'Cargar demo'); await sleep(600)
await clickExact(p, 'tocar'); await sleep(3500)
await p.evaluate(() => window.__engine.pilot.begin()) // (el micro de mentira no cuenta: solo el motor cambia los golpes)
await sleep(4000)
const line = () => p.evaluate(() => document.querySelector('.tutorial-line')?.textContent?.trim() ?? null)
console.log('paso 2:', await line(), await p.evaluate(() => JSON.stringify(window.__engine.loops.value.loops.map(l => [l.instrument, l.hits.length]))))
let hand = false
for (let i = 0; i < 12 && !hand; i++) { await sleep(1000); hand = await p.evaluate(() => !!document.querySelector('.pilot .finger')) }
console.log('mano fantasma vista:', hand)
// (el pitido del micro de mentira llena el carril de bombo y el arrastre con el dedo no se puede comprobar bien: se edita por el motor, que es lo que hace el gesto)
const edit = (f) => p.evaluate((src) => { const e = window.__engine; const st = e.loops.value; const fn = new Function('st', src); e.editLoops(fn(st)) }, f)
await edit("const l = st.loops.map((x, i) => i === 0 ? { ...x, hits: x.hits.map((h, j) => j === 0 ? { ...h, pos: 0.0 + 1 } : h) } : x); return { ...st, loops: l }")
await sleep(1200)
console.log('tras mover un golpe:', await line(), await p.evaluate(() => JSON.stringify(window.__engine.loops.value.loops.map(l => [l.instrument, l.hits.map(h => h.pos)]))))
await edit("const l = st.loops.map((x, i) => i === 0 ? { ...x, hits: x.hits.slice(1) } : x); return { ...st, loops: l }")
await sleep(1200)
console.log('tras borrar uno:', await line(), errs)
await b.close(); process.exit(0)
