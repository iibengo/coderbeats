// Un remix principal nuevo: aparece en Remixes del Laboratorio con sus partes y suena (uso: node remix-nuevo.mjs "<texto del botón>")
import { labOpen as lo, click, sleep } from './lab-lib.mjs'
const nombre = process.argv[2] || 'Korobeiniki'
const { b, p, errs } = await lo(390, 900)
await click(p, 'Remixes'); await sleep(5000)
console.log('en la lista:', await click(p, nombre)); await sleep(3000)
console.log('partes:', await p.evaluate(() => [...document.querySelectorAll('[data-part]')].map((x) => x.dataset.part)))
for (const part of await p.evaluate(() => [...document.querySelectorAll('[data-part]')].map((x) => x.dataset.part))) {
  await p.evaluate((n) => document.querySelector(`[data-part="${n}"]`).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })), part); await sleep(400)
  console.log(' ', part, '→', await p.evaluate(() => window.__remix.on()))
}
console.log('suena:', await p.evaluate(() => window.__engine?.playing?.value ?? 'n/a'), errs)
await b.close()
