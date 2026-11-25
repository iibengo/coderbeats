// Compartir por enlace: se genera el enlace de una canción, se abre en otra página limpia (con confirmación) y la canción queda idéntica; un enlace roto avisa y no cambia nada.
import { open, sleep, clickLabel, clickExact } from './lib.mjs'
const { b, p, errs } = await open()
await clickExact(p, 'dnb'); await sleep(300)
await p.evaluate(() => window.__engine.loadDemo()); await sleep(800)
const sig = (x) => JSON.stringify(x.order.map(id => { const c = x.cells.find(c => c.id === id); return [c.turns, c.parts, c.loops.map(l => [l.instrument, l.bars, l.hits.map(h => h.pos)])] }))
const orig = await p.evaluate(() => JSON.parse(JSON.stringify(window.__engine.snapshot().song)))
const link = await p.evaluate(async (mod) => { const m = await import(mod); const e = window.__engine; return m.shareUrl(location.origin + '/', await m.encodeShare(e.snapshot(), 'Mi demo')) }, `/_nuxt/@fs${process.cwd()}/app/lib/shareLink.ts`) // se ejecuta desde la raíz del proyecto
console.log('enlace de', link.length, 'caracteres')
await b.close()
for (const [nombre, url, espera] of [['válido', link, true], ['roto', link.slice(0, 60) + 'AAAA', false]]) {
  const { b: b2, p: p2, errs: e2 } = await open({ goto: false })
  let dialogs = []
  p2.on('dialog', async (d) => { dialogs.push(d.message().slice(0, 60)); await d.accept() })
  p2.on('framenavigated', () => {})
  await p2.goto(url, { waitUntil: 'networkidle2' }); await sleep(2500)
  await p2.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Usar el micro'))?.click()); await sleep(8000)
  // el cuadro de confirmación es el de la app (el aviso de enlace roto sigue siendo nativo)
  if (await p2.evaluate(() => !!document.querySelector('[role=alertdialog]'))) { dialogs.push('cuadro de la app'); await p2.evaluate(() => [...document.querySelectorAll('[role=alertdialog] button')].find(b => b.textContent.trim() === 'Continuar').click()); await sleep(2500) }
  const got = await p2.evaluate(() => ({ song: JSON.parse(JSON.stringify(window.__engine.snapshot().song)), hash: location.hash }))
  const same = sig(got.song) === sig(orig)
  console.log(nombre, 'diálogos', JSON.stringify(dialogs), 'idéntica', same, 'hash quitado', got.hash === '', e2)
  await b2.close()
  if (same !== espera) { console.log('FALLO'); process.exit(1) }
}
console.log('OK'); process.exit(0)
