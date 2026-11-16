// Estudio: «Mis remixes» y los remixes de serie en una sola hoja.
import { open, clickLabel, sleep } from './lib.mjs'
const { b, p, errs } = await open()
console.log('abre la hoja:', await clickLabel(p, 'mis remixes')); await sleep(800)
console.log('títulos:', await p.evaluate(() => [...document.querySelectorAll('h2,h3')].map((h) => h.textContent.trim())))
console.log('de serie:', await p.evaluate(() => [...document.querySelectorAll('[data-remixes-serie] li')].map((l) => l.querySelector('p').textContent)))
await p.evaluate(() => document.querySelector('[data-remixes-serie] li button').click()); await sleep(1500)
console.log('tras Abrir:', await p.evaluate(() => ({ cells: window.__engine.song.value.cells.length, name: window.__engine.song.value.cells.map((c) => c.name).join(), style: window.__engine.style.value, cerrada: !document.querySelector('[data-remixes-serie]') })), errs)
console.log('duración a la vista:', await p.evaluate(() => document.querySelector('[data-duration]')?.textContent))
await p.screenshot({ path: `${process.env.OUT || '/tmp'}/remixes-u.png` })
await b.close()
