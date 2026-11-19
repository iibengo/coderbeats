// Con el interruptor «Zoom» apagado (y la vista de círculos, spec 050), Remixes del Laboratorio se ve y funciona exactamente igual que antes del zoom (spec 026).
// Compara el lienzo (hash de los píxeles, parado y sin toques) y el texto de todos los botones con lo guardado en tests/browser/golden/.
// `node tests/browser/lab-remix-igual.mjs --guardar` regraba lo de referencia (solo con un cambio de Remixes que sea querido).
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { labOpen, labClassic, click, sleep } from './lab-lib.mjs'
const G = new URL('./golden/lab-remix-zoom-off.json', import.meta.url)
const { b, p, errs } = await labOpen(390, 900)
await labClassic(p)
await click(p, 'Remixes'); await sleep(5000)
await click(p, 'Mozart'); await sleep(3000)
const snap = await p.evaluate(() => {
  const cv = document.querySelector('canvas')
  const buttons = [...document.querySelectorAll('button')].map((x) => (x.getAttribute('aria-label') || '') + '|' + x.textContent.trim().replace(/\s+/g, ' '))
  return { canvas: cv.toDataURL(), buttons }
})
const now = { canvasSha: createHash('sha256').update(snap.canvas).digest('hex'), buttons: snap.buttons.filter((t) => !/zoom|vista|auto/i.test(t)) }
// con el interruptor apagado no hay nada de zoom que mirar: parte y capas siguen funcionando igual
await p.evaluate(() => document.querySelector('[data-part=Drop]').click()); await sleep(2500)
now.afterDrop = await p.evaluate(() => ({ part: window.__remix.part(), on: window.__remix.on() }))
if (process.argv.includes('--guardar') || !existsSync(G)) {
  writeFileSync(G, JSON.stringify(now, null, 2) + '\n')
  console.log('referencia guardada', now.canvasSha.slice(0, 12), now.buttons.length, 'botones')
} else {
  const ref = JSON.parse(readFileSync(G, 'utf8'))
  const ok = ref.canvasSha === now.canvasSha && JSON.stringify(ref.buttons) === JSON.stringify(now.buttons) && JSON.stringify(ref.afterDrop) === JSON.stringify(now.afterDrop)
  console.log(ok ? 'IGUAL que antes del zoom' : 'DISTINTO', { canvas: ref.canvasSha === now.canvasSha, botones: JSON.stringify(ref.buttons) === JSON.stringify(now.buttons), tras: JSON.stringify(ref.afterDrop) === JSON.stringify(now.afterDrop) }, errs)
  process.exitCode = ok ? 0 : 1
}
await b.close()
