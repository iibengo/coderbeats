// Reproduce el bloqueo (pendiente): cambiar de canción (remix) mientras suena. Uso: PORT=3999 node tests/browser/repro-bloqueo-cambio.mjs
import { open, sleep, clickLabel, clickExact } from './lib.mjs'
const { b, p } = await open()
p.setDefaultTimeout(15000)
const st = () => Promise.race([p.evaluate(() => ({ playing: window.__engine.playing.value, cells: window.__engine.song.value.order.length })), new Promise(r => setTimeout(() => r('BLOQUEADA (>15 s sin responder)'), 15000))])
await clickLabel(p, 'ajustes'); await sleep(500); await clickLabel(p, 'Cargar demo'); await sleep(800)
await clickExact(p, 'tocar'); await sleep(4000); console.log('demo sonando', JSON.stringify(await st()))
for (const i of [0, 2, 1]) {
  await clickLabel(p, 'remixes'); await sleep(700)
  await p.evaluate((i) => [...document.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Abrir')[i].click(), i).catch(e => console.log('click', String(e).slice(0, 60)))
  await sleep(5000); console.log('remix', i, JSON.stringify(await st()))
}
await b.close(); process.exit(0)
