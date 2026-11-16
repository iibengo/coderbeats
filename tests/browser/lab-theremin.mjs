// Laboratorio · Theremín: deslizar el dedo da una nota de la escala y al soltar se apaga; ■ para todo.
import { labOpen, click, sleep } from './lab-lib.mjs'
const { b, p, errs, O } = await labOpen()
await click(p, 'Theremín'); await sleep(5000)
const cx = 200
await p.touchscreen.touchStart(cx, 600)
for (let i = 0; i < 12; i++) { await p.touchscreen.touchMove(cx + i * 10, 600 - i * 25); await sleep(60) }
const during = await p.evaluate(() => document.body.innerText.replace(/\n+/g, ' | ').slice(-60))
await p.screenshot({ path: `${O}/l2.png` })
await p.touchscreen.touchEnd(); await sleep(300)
console.log('durante:', during, '| errores', errs)
await b.close()
