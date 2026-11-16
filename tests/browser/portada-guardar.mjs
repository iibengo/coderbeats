// Guardar y compartir en la portada: guardado automático como «Mi canción», deshacer/rehacer y el vídeo sin opciones.
import { open, sleep, clickLabel } from './lib.mjs'
const OUT = process.env.OUT || '/tmp'
const { b, p, errs } = await open({ simple: true })
await clickLabel(p, 'House'); await sleep(2500)
await p.evaluate(() => window.__engine.clearAll?.()); await sleep(400)
const kinds = () => p.evaluate(() => window.__engine.loops.value.loops.filter((l) => l.instrument !== 'mel').map((l) => `${l.instrument}:${l.hits.length}`).join(' '))
const pad = async (label) => { const box = await p.evaluate((l) => { const r = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === l).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, label); await p.touchscreen.tap(box.x, box.y) }
for (let r = 0; r < 4; r++) { await pad('bum'); await sleep(350); await pad('pff'); await sleep(350) }
await sleep(5000)
const withRhythm = await kinds()
console.log('con ritmo:', withRhythm)
const lib = () => p.evaluate(() => (localStorage.getItem('coderbeats:library:v1') || 'vacía').slice(0, 160))
await sleep(3500)
console.log('biblioteca tras 3 s:', JSON.stringify(await lib()))
const ok = await clickLabel(p, 'deshacer lo último'); await sleep(600)
console.log('deshacer →', ok, '|', await kinds() || '(sin ritmo)')
const ok2 = await clickLabel(p, 'volver a poner'); await sleep(600)
console.log('rehacer →', ok2, '|', await kinds())
await clickLabel(p, 'compartir en vídeo'); await sleep(700)
console.log('hoja de vídeo: selectores =', await p.$$eval('select', (s) => s.length), '| botón Grabar =', await p.evaluate(() => [...document.querySelectorAll('button')].some((x) => x.textContent.includes('Grabar'))))
await p.screenshot({ path: `${OUT}/portada-4.png` })
console.log('errores', errs)
await b.close()
