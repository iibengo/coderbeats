// Remixes: grabar sin pulsar «Terminar»: a los ≈ 2 min entra solo el final y acaba en el compás justo (techno: 64 compases, final de 4).
import { labOpen, click, sleep } from './lab-lib.mjs'
const { b, p, errs } = await labOpen()
await click(p, 'Remixes'); await sleep(5000)
await click(p, 'Wow'); await sleep(2500)
await p.evaluate(() => document.querySelector('[data-part=Drop]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); await sleep(2500)
await click(p, 'Grabar mi versión')
let last = ''
for (let i = 0; i < 80; i++) {
  await sleep(2000)
  const s = await p.evaluate(() => ({ part: window.__remix.part(), mode: window.__remix.mode(), rec: window.__remix.rec(), take: window.__remix.take() }))
  const t = JSON.stringify(s)
  if (i % 8 === 0 || s.mode === 'escuchar') console.log(i * 2, 's', t)
  if (s.mode === 'escuchar') { last = t; break }
}
console.log('compases grabados:', await p.evaluate(() => window.__remix.take()), '(esperado 64)', errs)
await b.close()
