// Laboratorio · Capas: al entrar no suena nada; el primer toque pone la base; tocar un círculo enciende/apaga su capa; el panel DJ no da error.
import { labOpen, click, sleep } from './lab-lib.mjs'
const { b, p, errs, O } = await labOpen()
await click(p, 'Capas'); await sleep(4000)
const st = () => p.evaluate(() => window.__capas.state() + ' suena=' + window.__capas.playing())
console.log('al entrar:', await st())
const r = await p.evaluate(() => { const c = document.querySelector('canvas').getBoundingClientRect(); return [c.x, c.y, c.width] })
const at = (i) => { const a = -Math.PI / 2 + (i * Math.PI * 2) / 6; const k = r[2] / 680; return [r[0] + (340 + Math.cos(a) * 190) * k, r[1] + (340 + Math.sin(a) * 190) * k] }
await p.touchscreen.tap(...at(3)); await sleep(1500)
console.log('tras tocar «bajo»:', await st())
await p.touchscreen.tap(...at(0)); await sleep(500)
console.log('tras tocar «bombo» (apaga):', await st())
await p.touchscreen.tap(...at(5)); await sleep(800)
await p.screenshot({ path: `${O}/c1.png` })
console.log('tras tocar «melodía»:', await st())
const pad = await p.evaluate(() => { const e = document.querySelector('[aria-label=DJ] .touch-none').getBoundingClientRect(); return [e.x + 20, e.y + 30] })
await p.touchscreen.touchStart(...pad); await sleep(300); await p.touchscreen.touchEnd(); await sleep(500)
console.log('errores', errs)
await b.close()
