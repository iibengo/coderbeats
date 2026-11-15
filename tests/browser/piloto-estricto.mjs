// El piloto deja siempre la demo, aunque las sugerencias estén encendidas, y al acabar todo vuelve a como estaba.
import { open, sleep, clickLabel, clickExact } from './lib.mjs'
const { b, p, errs } = await open()
await clickExact(p, 'dembow'); await sleep(500)
const before = await p.evaluate(() => { const e = window.__engine; e.setSuggestions(true); return { sug: e.suggestions.value, assist: e.assist.value, melody: e.melodyOn.value } })
await clickLabel(p, 'ajustes'); await sleep(500); await clickLabel(p, 'Ver cómo se construye')
const t0 = Date.now()
while (Date.now() - t0 < 80000) { await sleep(2000); if (!(await p.evaluate(() => !!document.querySelector('.pilot')))) break }
const r = await p.evaluate(() => { const e = window.__engine; return { loops: e.loops.value.loops.map(l => l.instrument + ':' + l.hits.map(h => h.pos).sort((a, b) => a - b).join(',')).sort(), bg: e.bgManual.value, sug: e.suggestions.value, assist: e.assist.value, melody: e.melodyOn.value } })
console.log(JSON.stringify(r), 'antes', JSON.stringify(before))
const ok = JSON.stringify(r.loops) === JSON.stringify(['bd:0,4,8,12', 'hh:0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15', 'sd:3,6,11,14']) && r.bg.bass && r.bg.chords && r.sug === before.sug && r.assist === before.assist && r.melody === before.melody
console.log(ok ? 'OK idéntico a la demo y ajustes restaurados' : 'FALLO', errs)
await b.close()
process.exit(ok ? 0 : 1)
