// Previsualizar: con sugerencias encendidas, la canción del usuario queda idéntica al terminar y tras parar con un toque; ajustes restaurados.
import { open, sleep, clickLabel, clickExact } from './lib.mjs'
let fails = 0
for (const modo of ['terminar', 'parar']) {
  const { b, p, errs } = await open()
  await clickExact(p, 'techno'); await sleep(400)
  await p.evaluate(() => window.__engine.loadDemo()); await sleep(800)
  const before = await p.evaluate(() => { const e = window.__engine; e.setSuggestions(true); return JSON.stringify({ song: e.snapshot().song, style: e.style.value, kit: e.kit.value, sug: e.suggestions.value, assist: e.assist.value }) })
  await clickLabel(p, 'ajustes'); await sleep(500); await clickLabel(p, 'Previsualizar'); await sleep(modo === 'parar' ? 9000 : 1000)
  if (modo === 'parar') await p.touchscreen.tap(200, 400)
  else { const t0 = Date.now(); while (Date.now() - t0 < 150000) { await sleep(2000); if (!(await p.evaluate(() => !!document.querySelector('.pilot')))) break } }
  await sleep(2500)
  const after = await p.evaluate(() => { const e = window.__engine; return JSON.stringify({ song: e.snapshot().song, style: e.style.value, kit: e.kit.value, sug: e.suggestions.value, assist: e.assist.value }) })
  const A = JSON.parse(before), B = JSON.parse(after)
  // (los ids de loop y el nacimiento pueden cambiar al reiniciar: se compara lo musical)
  const norm = (x) => JSON.stringify(x.song.order.map(id => { const c = x.song.cells.find(c => c.id === id); return [c.parts, c.turns, c.loops.map(l => [l.instrument, l.bars, l.hits.map(h => h.pos)])] }))
  const ok = norm(A) === norm(B) && A.style === B.style && A.kit === B.kit && A.sug === B.sug && A.assist === B.assist
  console.log(modo, ok ? 'OK' : 'FALLO', errs); if (!ok) { fails++; console.log(norm(A).slice(0, 300), '\n', norm(B).slice(0, 300)) }
  await b.close()
}
process.exit(fails ? 1 : 0)
