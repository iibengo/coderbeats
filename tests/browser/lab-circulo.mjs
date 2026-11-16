// Laboratorio · Círculo de ritmo: tocar un anillo pone/quita un golpe; en «ruedas», arrastrar alrededor cambia cuántos golpes lleva (y «exacto» da posiciones decimales).
import { labOpen, click, sleep } from './lab-lib.mjs'
const { b, p, errs, O } = await labOpen()
await click(p, 'Círculo'); await sleep(4000)
const r = await p.evaluate(() => { const c = document.querySelector('canvas').getBoundingClientRect(); return [c.x, c.y, c.width] })
const k = r[2] / 680
const at = (ring, step) => { const a = (step / 16) * Math.PI * 2 - Math.PI / 2; const rr = [100, 175, 245][ring]; return [r[0] + (340 + Math.cos(a) * rr) * k, r[1] + (340 + Math.sin(a) * rr) * k] }
const counts = () => p.evaluate(() => window.__circulo.counts())
console.log('al empezar (bombo,caja,platillo):', await counts())
await p.touchscreen.tap(...at(2, 3)); await sleep(300)
console.log('+1 platillo en el paso 3:', await counts())
await p.touchscreen.tap(...at(2, 3)); await sleep(300)
console.log('lo quito:', await counts())
await click(p, 'ruedas'); await sleep(200)
// girar el anillo del bombo un cuarto de vuelta en sentido horario: 4 golpes más
const [sx, sy] = at(0, 0)
await p.touchscreen.touchStart(sx, sy)
for (let i = 1; i <= 16; i++) { const [x, y] = at(0, i * 0.5); await p.touchscreen.touchMove(x, y); await sleep(30) }
await p.touchscreen.touchEnd(); await sleep(300)
console.log('tras girar el bombo media vuelta:', await counts())
await p.evaluate(() => [...document.querySelectorAll('input[type=checkbox]')][0]?.click()); await sleep(300)
await p.screenshot({ path: `${O}/ci.png` })
console.log('exacto, pasos del bombo:', JSON.stringify(await p.evaluate(() => window.__circulo.steps('bd'))), errs)
await b.close()
