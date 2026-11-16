// La espiral dentro de la portada: dedo puesto moviéndose, las notas llegan, la octava la pone la altura del dedo y lo tocado queda grabado.
import { open, sleep, clickLabel } from './lib.mjs'
const OUT = process.env.OUT || '/tmp'
const { b, p, errs } = await open({ simple: true })
await clickLabel(p, 'Hip hop'); await sleep(2500)
const tag = () => p.evaluate(() => document.querySelector('.th .tag')?.textContent.trim().replace(/\s+/g, ' '))
console.log('antes de tocar:', await tag())
const t = await p.touchscreen.touchStart(200, 250) // arriba del área: octava +1
const heard = []
for (let i = 0; i < 300; i++) { await t.move(200 + 120 * Math.sin(i / 9), i < 150 ? 220 : 520); await sleep(50); const n = await p.evaluate(() => window.__engine.thereminNote.value); if (n && heard[heard.length - 1] !== n) heard.push(n) }
await p.screenshot({ path: `${OUT}/portada-2.png` })
await t.end(); await sleep(300)
const mel = await p.evaluate(() => window.__engine.loops.value.loops.filter((l) => l.instrument === 'mel').map((l) => l.hits.map((h) => h.midi)))
console.log('notas oídas: de', Math.min(...heard), 'a', Math.max(...heard), '(arriba no cabe más agudo; abajo baja una octava):', heard.join(' '))
console.log('melodía grabada:', mel.length, 'loop(s), notas', mel[0]?.length, '| rango', Math.min(...(mel[0] ?? [0])), '-', Math.max(...(mel[0] ?? [0])))
console.log('errores', errs)
await b.close()
