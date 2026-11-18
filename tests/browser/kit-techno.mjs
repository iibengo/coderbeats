// Kit «Techno» (spec 043): se elige, carga sus 3 WAV (sin errores de red) y el motor suena con él.
import { open, sleep } from './lib.mjs'
const { b, p, errs } = await open()
const bad = []
p.on('response', (r) => { if (r.url().includes('/samples/') && r.status() >= 400) bad.push(r.status() + ' ' + r.url()) })
const got = []
p.on('response', (r) => { if (r.url().includes('/samples/techno/')) got.push(r.url().split('/samples/')[1] + ' ' + r.status()) })
await p.evaluate(() => window.__engine.setKit('techno')); await sleep(500)
await p.evaluate(() => { const e = window.__engine; const l = (id, i, hits) => ({ id, instrument: i, bars: 1, phaseBar: 0, hits: hits.map((pos) => ({ pos, strength: 0.8 })), muted: false, bornAt: 0, fromTemplate: false }); e.editLoops({ loops: [l(1, 'bd', [0, 4, 8, 12]), l(2, 'sd', [4, 12]), l(3, 'hh', [2, 6, 10, 14])], nextId: 4 }); e.play() }); await sleep(4000)
console.log('kit:', await p.evaluate(() => window.__engine.kit.value), 'suena:', await p.evaluate(() => window.__engine.playing.value))
console.log('samples bajados:', got.length ? got : '(ya cargados en el arranque)', 'errores de red:', bad, errs)
await b.close()
