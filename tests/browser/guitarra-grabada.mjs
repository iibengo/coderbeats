// Guitarra grabada (spec 036): carga perezosa (no pide los WAV hasta que suena) y suena sin errores de red.
import { open, sleep } from './lib.mjs'
const { b, p, errs } = await open()
const got = []
p.on('response', (r) => { if (r.url().includes('/samples/guitar/')) got.push(r.url().split('/samples/')[1] + ' ' + r.status()) })
await sleep(1500)
console.log('antes de tocar la guitarra, descargas:', got.length)
await p.evaluate(() => {
  const e = window.__engine
  const mel = (id) => ({ id, instrument: 'mel', bars: 1, phaseBar: 0, synth: 'guitarSample', muted: false, bornAt: 0, fromTemplate: false, hits: [[0, 64], [4, 67], [8, 71], [12, 60]].map(([pos, midi]) => ({ pos, dur: 4, midi, strength: 0.8 })) })
  e.editLoops({ loops: [mel(900)], nextId: 901 })
  e.play()
})
await sleep(4000)
console.log('suena:', await p.evaluate(() => window.__engine.playing.value), 'descargas:', [...new Set(got)], 'errores:', errs)
await b.close()
