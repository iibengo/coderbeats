// Previsualizar un remix entero (Sinfonía 40): copia y relleno célula a célula; al final suena entero y la canción del usuario se restaura.
import { open, sleep, clickLabel, clickExact } from './lib.mjs'
const { b, p, errs } = await open()
const sig = (x) => JSON.stringify(x.order.map(id => { const c = x.cells.find(c => c.id === id); return [c.turns, c.parts, c.loops.map(l => [l.instrument, l.bars, l.hits.map(h => h.pos)])] }))
await clickLabel(p, 'remixes'); await sleep(600)
await p.evaluate(() => { const bs = [...document.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Abrir'); window.__n = bs.length })
const idx = await p.evaluate(() => { const bs = [...document.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Abrir'); const i = bs.findIndex(b => /Sinfon/.test(b.closest('li,div')?.parentElement?.textContent || '')); return i })
await p.evaluate((i) => [...document.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Abrir')[Math.max(0, i)].click(), idx)
await sleep(2500)
const target = await p.evaluate(() => JSON.parse(JSON.stringify(window.__engine.snapshot().song)))
console.log('células de la canción:', target.order.length, 'grupos', target.groups.length)
await p.evaluate(() => window.__engine.setSuggestions(true))
await clickLabel(p, 'ajustes'); await sleep(500); await clickLabel(p, 'Previsualizar')
let built = null; const seen = new Set(); const t0 = Date.now(); let maxCells = 0
while (Date.now() - t0 < 380000) {
  await sleep(2000)
  const st = await p.evaluate(() => ({ on: !!document.querySelector('.pilot'), cells: window.__engine.song.value.order.length, cap: document.querySelector('.caption')?.textContent }))
  maxCells = Math.max(maxCells, st.cells); if (st.cap && !seen.has(st.cap)) { seen.add(st.cap); console.log(Math.round((Date.now() - t0) / 1000), st.cells, st.cap) }
  if (st.cap === 'La canción entera') {
    // ya está construida: se comprueba (la canción puesta es la original) y se para con un toque, que debe devolver lo del usuario
    built = await p.evaluate(() => JSON.parse(JSON.stringify(window.__engine.snapshot().song)))
    await sleep(3000); await p.touchscreen.tap(200, 400); await sleep(3000); break
  }
  if (!st.on) break
}
const after = await p.evaluate(() => JSON.parse(JSON.stringify(window.__engine.snapshot().song)))
console.log('construida idéntica a la canción:', built ? sig(built) === sig(target) : 'no llegó', 'máx. células durante:', maxCells, 'restaurada idéntica:', sig(after) === sig(target), errs)
await p.screenshot({ path: '/tmp/prev-remix.png' })
await b.close()
process.exit(sig(after) === sig(target) && maxCells >= target.order.length ? 0 : 1)
