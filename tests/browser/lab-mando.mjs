// Laboratorio · mando: un mando simulado (se sustituye navigator.getGamepads) enciende capas en Capas y mueve el cursor en el Círculo.
import { labOpen, click, sleep } from './lab-lib.mjs'
const { b, p, errs } = await labOpen()
await p.evaluate(() => { window.__btn = new Array(17).fill(false); navigator.getGamepads = () => [{ connected: true, buttons: window.__btn.map((x) => ({ pressed: x })), axes: [0, 0, 0, 0] }] })
const press = async (i) => { await p.evaluate((i) => (window.__btn[i] = true), i); await sleep(120); await p.evaluate((i) => (window.__btn[i] = false), i); await sleep(120) }
await click(p, 'Capas'); await sleep(4000)
console.log('Capas al entrar:', await p.evaluate(() => window.__capas.state()))
await press(3); await press(5)
console.log('tras Y (bajo) y RB (melodía):', await p.evaluate(() => window.__capas.state() + ' suena=' + window.__capas.playing()))
await p.evaluate(() => document.querySelector('[aria-label="volver al menú"]').click()); await sleep(800)
await click(p, 'Círculo'); await sleep(4000)
const before = await p.evaluate(() => window.__circulo.counts())
await press(0)
console.log('Círculo: A pone un golpe:', before, '→', await p.evaluate(() => window.__circulo.counts()), errs)
await b.close()
