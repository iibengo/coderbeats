// Laboratorio · Coro: arrastrar da tres notas de la escala (la voz y dos que armonizan) y al soltar se apagan.
import { labOpen, click, sleep } from './lab-lib.mjs'
const { b, p, errs, O } = await labOpen()
await click(p, 'Coro'); await sleep(4000)
const r = await p.evaluate(() => { const c = document.querySelector('canvas').getBoundingClientRect(); return [c.x, c.y, c.width] })
await p.touchscreen.touchStart(r[0] + 100, r[1] + r[2] * 0.7); await sleep(400)
console.log('al tocar:', await p.evaluate(() => JSON.stringify(window.__coro.voice())))
for (let i = 0; i < 10; i++) { await p.touchscreen.touchMove(r[0] + 100 + i * 20, r[1] + r[2] * (0.7 - i * 0.05)); await sleep(60) }
console.log('arrastrando:', await p.evaluate(() => JSON.stringify(window.__coro.voice())))
await p.screenshot({ path: `${O}/co.png` })
await p.touchscreen.touchEnd(); await sleep(300)
console.log('suelto:', await p.evaluate(() => JSON.stringify(window.__coro.voice())), errs)
await b.close()
