// Laboratorio · Capas: la base suena entera y cada botón enciende/apaga su capa (batería por loop, bajo y acordes por el fondo).
import { labOpen, click, sleep } from './lab-lib.mjs'
const { b, p, errs, O } = await labOpen()
await click(p, 'Capas'); await sleep(5000)
const st = () => p.evaluate(() => [...document.querySelectorAll('.layer')].map((x) => x.textContent.trim() + (x.getAttribute('aria-pressed') === 'true' ? '✔' : '✘')).join(' '))
console.log('inicio:', await st())
const pos = await p.evaluate(() => [...document.querySelectorAll('.layer')].map((x) => { const r = x.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2] }))
for (const i of [0, 3, 5]) { await p.touchscreen.tap(...pos[i]); await sleep(500) }
console.log('tras apagar bombo, bajo y melodía:', await st())
await p.screenshot({ path: `${O}/l3.png` })
await p.touchscreen.tap(...pos[0]); await sleep(500)
console.log('bombo otra vez:', await st(), errs)
await b.close()
