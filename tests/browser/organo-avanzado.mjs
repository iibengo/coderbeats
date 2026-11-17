// Órgano completo (spec 028): tresillos, acordes y ligaduras solo con «Controles avanzados»; sin ellos, el Órgano es el de siempre.
import { open, sleep } from './lib.mjs'
const adv = process.argv.includes('--sin') ? false : true
const { b, p, errs } = await open({ goto: false })
await p.evaluateOnNewDocument((on) => { try { localStorage.setItem('coderbeats:studio:v2', JSON.stringify({ advanced: on })) } catch {} }, adv)
await p.goto(`http://localhost:${process.env.PORT || 3999}/estudio`, { waitUntil: 'networkidle2', timeout: 120000 })
await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Usar el micro'))?.click()); await sleep(8000)
await p.evaluate(() => window.__stage().openOrgan(200, 420)); await sleep(1500)
await p.evaluate(() => document.querySelector('[data-organ-more]').click()); await sleep(300)
console.log('avanzado', adv, '→ botones tresillos/acordes/ligaduras:', await p.evaluate(() => ['triplets', 'chords', 'ties'].map((k) => !!document.querySelector(`[data-organ-${k}]`))))
if (!adv) { console.log(errs); await b.close(); process.exit(0) }
const g = await p.evaluate(() => { const c = document.querySelector('[data-organ-grid]'); const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, cw: +c.dataset.cellW, rh: +c.dataset.rowH } })
const mel = () => p.evaluate(() => JSON.stringify(window.__engine.loops.value.loops.filter((l) => l.instrument === 'mel').map((l) => ({ bars: l.bars, hits: l.hits.map((h) => [+h.pos.toFixed(3), +h.dur.toFixed(3), h.midi]) }))))
const at = (step, row) => [g.x + step * g.cw, g.y + (row + 0.5) * g.rh]
// tresillos: tres notas de 4/3
await p.evaluate(() => document.querySelector('[data-organ-triplets]').click()); await sleep(200)
for (const s of [0.7, 2, 3.4]) { await p.mouse.click(...at(s, 5)); await sleep(150) }
console.log('tresillos:', await mel())
// acordes: otra nota en el mismo paso
await p.evaluate(() => document.querySelector('[data-organ-chords]').click()); await sleep(200)
await p.mouse.click(...at(0.7, 3)); await sleep(150)
console.log('acorde (otra nota a la vez):', await mel())
await p.mouse.click(...at(1.9, 3)); await sleep(200)
console.log('tocar esa nota la quita:', await mel())
// ligaduras: nota que cruza el compás (loop de 2 compases)
await p.evaluate(() => [...document.querySelectorAll('[data-organ-drawer] button')].find((x) => x.textContent.trim() === '2')?.click()); await sleep(300)
await p.evaluate(() => document.querySelector('[data-organ-chords]').click())
await p.evaluate(() => document.querySelector('[data-organ-ties]').click()); await sleep(200)
await p.evaluate(() => document.querySelector('[data-organ-triplets]').click()); await sleep(200)
const [sx, sy] = at(14.5, 7); await p.mouse.move(sx, sy); await p.mouse.down(); await p.mouse.move(sx + 6 * g.cw, sy, { steps: 6 }); await p.mouse.up(); await sleep(300)
console.log('ligadura (nota que cruza el compás):', await mel(), errs)
await b.close()
