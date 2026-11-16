// Laboratorio · Círculo de ritmo: tocar un punto pone y quita un golpe del instrumento de ese anillo.
import { labOpen, click, sleep } from './lab-lib.mjs'
const { b, p, errs, O } = await labOpen()
await click(p, 'Círculo'); await sleep(5000)
const hits = () => p.evaluate(() => [...document.querySelectorAll('svg path')].length)
const box = await p.evaluate(() => { const r = document.querySelector('svg').getBoundingClientRect(); return [r.x, r.y, r.width] })
const at = (ring, step) => { const a = (step / 16) * Math.PI * 2 - Math.PI / 2; const rr = [18, 30, 42][ring] / 100 * box[2]; return [box[0] + box[2] / 2 + Math.cos(a) * rr, box[1] + box[2] / 2 + Math.sin(a) * rr] }
const dots = () => p.evaluate(() => [...document.querySelectorAll('svg circle')].filter((c) => c.getAttribute('r') === '2.1').length)
console.log('golpes al empezar', await dots())
await p.touchscreen.tap(...at(2, 3)); await sleep(300)
console.log('tras poner un platillo en el paso 3', await dots())
await p.touchscreen.tap(...at(2, 3)); await sleep(300)
console.log('tras quitarlo', await dots())
await p.screenshot({ path: `${O}/l5.png` })
console.log('errores', errs)
await b.close()
