// Laboratorio · Piano mágico: al entrar no suena; cada toque avanza el contador (y el primero pone la base); ■ para todo; otro estilo cambia la melodía.
import { labOpen, click, sleep } from './lab-lib.mjs'
const { b, p, errs, O } = await labOpen()
await click(p, 'Piano'); await sleep(4000)
const r = await p.evaluate(() => { const c = document.querySelector('canvas').getBoundingClientRect(); return [c.x, c.y, c.width] })
const info = () => p.evaluate(() => `${window.__piano.played()}/${window.__piano.total()} · ${document.querySelector('header + nav + div + div button')?.getAttribute('aria-label')}`)
console.log('al entrar:', await info())
for (let i = 0; i < 5; i++) { await p.touchscreen.tap(r[0] + 60 + i * 50, r[1] + 100 + i * 40); await sleep(350) }
await p.screenshot({ path: `${O}/p1.png` })
console.log('tras 5 toques:', await info())
await click(p, 'techno'); await sleep(3000)
console.log('techno:', await info(), await p.evaluate(() => document.body.innerText.includes('Sinfonía')))
await click(p, 'parar todo'); await sleep(500)
console.log('tras ■:', await info(), errs)
await b.close()
