// Célula de melodía y sintetizador de dedo (spec 015 §12): crear, tocar deslizando, grabar y ver la melodía.
import { open, sleep, clickLabel } from './lib.mjs'
const { b, p, errs } = await open()
const OUT = '/tmp/claude-1000/-home-ioni-dev-coderbeats/bcaf8334-889a-45dc-9d11-cd0dfcf41e47/scratchpad'
await p.evaluate(async () => { await window.__engine.loadDemo(); await window.__engine.play() })
await sleep(2500)
const id = await p.evaluate(() => window.__engine.addMelodyCell())
await sleep(1500)
const st = () => p.evaluate(() => ({ kind: window.__engine.song.value.cells.find((c) => c.id === window.__engine.viewCellId.value)?.kind, th: !!document.querySelector('.th'), tag: document.querySelector('.th .tag')?.textContent, note: window.__engine.thereminNote.value }))
console.log('celda', id, await st())
await p.screenshot({ path: `${OUT}/sint-1.png` })
// deslizar de abajo a arriba
const t = await p.touchscreen.touchStart(200, 700)
const seen = new Set()
for (let y = 700; y > 150; y -= 20) { await t.move(150 + (700 - y) / 5, y); await sleep(40); seen.add((await st()).note) }
await p.screenshot({ path: `${OUT}/sint-2.png` })
await t.end(); await sleep(200)
console.log('notas distintas al deslizar:', [...seen].filter(Boolean).length, '| tras soltar:', (await st()).note)
// grabar
await clickLabel(p, 'grabar lo que toques')
await sleep(300)
for (const y of [600, 500, 400, 300]) { const k = await p.touchscreen.touchStart(200, y); await sleep(500); await k.end(); await sleep(300) }
console.log('grabando:', await p.evaluate(() => window.__engine.keysRec.value?.count))
await clickLabel(p, 'terminar y guardar')
await sleep(800)
console.log('melodía en la célula:', await p.evaluate(() => window.__engine.loops.value.loops.filter((l) => l.instrument === 'mel').map((l) => l.hits.length)))
await clickLabel(p, 'cerrar el sintetizador'); await sleep(500)
console.log('tras cerrar:', await st(), '| botón Tocar:', await p.evaluate(() => /Tocar/.test(document.body.innerText)))
await p.screenshot({ path: `${OUT}/sint-3.png` })
console.log('errores', errs)
await b.close()
