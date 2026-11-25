// Cambiar de canción (remix) mientras suena: sale el cuadro de confirmación de la app (no el nativo), al aceptar la canción cambia, sigue sonando y al cancelar no cambia nada.
import { open, sleep, clickLabel, clickExact } from './lib.mjs'
const { b, p, errs } = await open()
let nativos = 0
p.on('dialog', async (d) => { nativos++; await d.dismiss() })
const st = () => p.evaluate(() => ({ playing: window.__engine.playing.value, cells: window.__engine.song.value.order.length, clock: !!window.__engine.pilot.clock() }))
await p.evaluate(() => window.__engine.loadDemo()); await sleep(800)
await clickExact(p, 'tocar'); await sleep(4000); console.log('demo sonando', JSON.stringify(await st()))
const abrir = (i) => p.evaluate((i) => [...document.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Abrir')[i].click(), i)
await clickLabel(p, 'remixes'); await sleep(700); await abrir(0); await sleep(600)
console.log('cuadro de la app:', await p.evaluate(() => !!document.querySelector('[role=alertdialog]')))
await clickExact(p, 'Cancelar'); await sleep(500); console.log('tras cancelar', JSON.stringify(await st()))
await abrir(0); await sleep(600); await clickExact(p, 'Continuar'); await sleep(6000)
const r = await st(); console.log('tras aceptar', JSON.stringify(r), 'cuadros nativos', nativos, errs)
await b.close(); process.exit(r.playing && r.cells > 1 && r.clock && nativos === 0 ? 0 : 1)
