// Percusión del minimal (spec 045): los cinco sonidos se cargan (con los nombres de strudel), suenan en sus pasos, sin errores de red.
import { open, sleep } from './lib.mjs'
const { b, p, errs } = await open()
const got = new Set(), bad = []
p.on('response', (r) => { const u = r.url(); if (u.includes('/samples/techno/')) got.add(u.split('/samples/')[1] + ' ' + r.status()); if (u.includes('/samples/') && r.status() >= 400) bad.push(r.status() + ' ' + u) })
await p.evaluate(() => {
  const e = window.__engine
  const l = (id, i, hits, extra = {}) => ({ id, instrument: i, bars: 1, phaseBar: 0, hits, muted: false, bornAt: 0, fromTemplate: false, ...extra })
  const perc = (id, synth, steps) => l(id, 'mel', steps.map((pos) => ({ pos, dur: 1, midi: 36, strength: 0.8 })), { synth })
  e.editLoops({ loops: [l(1, 'bd', [0, 4, 8, 12].map((pos) => ({ pos, strength: 0.9 }))), perc(2, 'rim', [3.5, 10, 13]), perc(3, 'click', [1.5, 5.5, 9.5, 14.5]), perc(4, 'cowbell', [9]), perc(5, 'tom', [15]), perc(6, 'shaker', [2, 6, 10, 14])], nextId: 7 })
  e.play()
})
await sleep(5000)
console.log('suena:', await p.evaluate(() => window.__engine.playing.value), '| archivos pedidos:', [...got].sort(), '| errores de red:', bad, errs)
await b.close()
