// Laboratorio · DJ: la canción suena, el dedo cambia el filtro y el eco, los botones no dan error y al soltar vuelve todo.
import { labOpen, click, sleep } from './lab-lib.mjs'
const { b, p, errs, O } = await labOpen()
await click(p, 'DJ'); await sleep(6000)
const info = () => p.evaluate(() => document.body.innerText.match(/filtro \d+% · eco \d+%/)?.[0])
await p.touchscreen.touchStart(60, 300); await p.touchscreen.touchMove(120, 250); await sleep(300)
console.log('arrastrando:', await info())
await p.screenshot({ path: `${O}/l4.png` })
await p.touchscreen.touchEnd(); await sleep(300)
console.log('suelto:', await info())
for (const t of ['platillo', 'subida', 'drop']) { await p.evaluate((t) => { const el = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === t); el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })) }, t); await sleep(500) }
await sleep(2500)
console.log('errores', errs)
await b.close()
