// Teclado de agua: «🎹 Agua» + tocar el fondo fuera del aro apunta notas; «■» las pasa a un loop de melodía de 4 compases con notas de la escala del estilo.
import { open, sleep, clickLabel, clickExact } from './lib.mjs'
const { b, p, errs } = await open()
await clickExact(p, 'techno'); await sleep(300)
await clickLabel(p, 'ajustes'); await sleep(400); await clickLabel(p, 'Cargar demo'); await sleep(600)
await clickExact(p, 'tocar'); await sleep(3500)
await p.evaluate(() => window.__engine.pilot.begin()) // (sin el pitido del micro de mentira)
console.log('agua', await clickLabel(p, 'teclado de agua')); await sleep(300)
console.log('grabar', await clickLabel(p, 'grabar lo que toques')); await sleep(300)
for (const [x, y] of [[12, 480], [380, 480], [14, 560], [386, 560], [12, 420], [388, 420]]) { await p.touchscreen.tap(x, y); await sleep(500) }
const n = await p.evaluate(() => window.__engine.keysRec.value?.count)
console.log('notas apuntadas', n)
await clickLabel(p, 'terminar y guardar lo tocado'); await sleep(1200)
const r = await p.evaluate(() => { const l = window.__engine.loops.value.loops.filter(l => l.instrument === 'mel'); return l.map(x => ({ bars: x.bars, notas: x.hits.map(h => [h.pos, h.midi, h.dur]) })) })
console.log('melodías', JSON.stringify(r), errs)
await b.close(); process.exit(n > 0 && r.length ? 0 : 1)
