// Kit «Batería» (spec 034): se elige, carga sus 3 WAV (sin errores de red) y el motor suena con él.
import { open, sleep } from './lib.mjs'
const { b, p, errs } = await open()
const bad = []
p.on('response', (r) => { if (r.url().includes('/samples/') && r.status() >= 400) bad.push(r.status() + ' ' + r.url()) })
const got = []
p.on('response', (r) => { if (r.url().includes('/samples/drums/')) got.push(r.url().split('/samples/')[1] + ' ' + r.status()) })
await p.evaluate(() => window.__engine.setKit('drums')); await sleep(500)
await p.evaluate(() => { window.__engine.setBackgroundMode?.('manual'); window.__engine.play() }); await sleep(3000)
console.log('kit:', await p.evaluate(() => window.__engine.kit.value), 'suena:', await p.evaluate(() => window.__engine.playing.value))
console.log('samples bajados:', got.length ? got : '(ya cargados en el arranque)', 'errores de red:', bad, errs)
await b.close()
