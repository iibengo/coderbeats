// Laboratorio · Piano mágico: entra sin micro, suena, cada toque avanza el contador y ■ para todo.
import { labOpen, click, sleep } from './lab-lib.mjs'
const { b, p, errs, O } = await labOpen()
console.log(await click(p,'Piano'), 'piano'); await sleep(5000)
await p.screenshot({ path: `${O}/l1a.png` })
console.log('botón', await p.evaluate(()=>document.querySelector('header button[aria-label]:last-of-type')?.getAttribute('aria-label')))
for (let i=0;i<5;i++){ await p.touchscreen.tap(100+i*40, 400+i*30); await sleep(300) }
await p.screenshot({ path: `${O}/l1b.png` })
console.log(await p.evaluate(()=>document.body.innerText.replace(/\n+/g,' | ').slice(0,200)), errs)
await click(p,'parar todo'); await sleep(500); console.log('botón', await p.evaluate(()=>document.querySelector('header button[aria-label]:last-of-type')?.getAttribute('aria-label')))
await b.close()
