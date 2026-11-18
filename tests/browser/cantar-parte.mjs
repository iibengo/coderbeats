// Cantar esta parte (spec 039): con una voz sintética de fondo (micro falso), pide la escala si falta, graba 2 compases, crea una melodía NUEVA con notas de la escala y no toca lo que había.
// Uso:  node tests/browser/cantar-parte.mjs        (genera su propio WAV de «voz»: sol la si♭ do re, en bucle)
import { writeFileSync } from 'node:fs'
const SR = 48000
const hz = (m) => 440 * 2 ** ((m - 69) / 12)
const notas = [[67, 0.55], [69, 0.55], [70, 0.55], [72, 0.55], [74, 0.55], [72, 0.55], [70, 0.55], [67, 0.55]]
const out = []
for (let k = 0; k < 3; k++) for (const [m, d] of notas) { const n = Math.round(d * SR); let ph = 0; for (let i = 0; i < n; i++) { ph += (2 * Math.PI * hz(m) * (1 + 0.004 * Math.sin((2 * Math.PI * 5 * i) / SR))) / SR; const env = Math.min(1, i / (0.02 * SR), (n - i) / (0.03 * SR)); out.push(0.3 * env * (Math.sin(ph) + 0.4 * Math.sin(2 * ph) + 0.2 * Math.sin(3 * ph))) } for (let i = 0; i < 0.06 * SR; i++) out.push(0) }
const buf = Buffer.alloc(44 + out.length * 2)
buf.write('RIFF', 0); buf.writeUInt32LE(36 + out.length * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(out.length * 2, 40)
out.forEach((v, i) => buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2))
const wav = `${process.env.TMPDIR || '/tmp'}/voz-sintetica.wav`
writeFileSync(wav, buf)
process.env.FAKE_WAV = wav
const { open, clickLabel, sleep } = await import('./lib.mjs')
const { b, p, errs } = await open()
const MULTI = process.argv.includes('--multi')
if (MULTI) {
  const { readFileSync } = await import('node:fs')
  const song = JSON.parse(readFileSync(process.env.CANCION || '/tmp/ej.json', 'utf8')).g
  await p.evaluate((sg) => { const e = window.__engine; e.setSong(sg); e.play() }, song)
} else await p.evaluate(() => {
  const e = window.__engine
  const l = (id, i, hits) => ({ id, instrument: i, bars: 1, phaseBar: 0, hits: hits.map((pos) => ({ pos, strength: 0.8 })), muted: false, bornAt: 0, fromTemplate: false })
  e.editLoops({ loops: [l(1, 'bd', [0, 4, 8, 12]), l(2, 'hh', [2, 6, 10, 14])], nextId: 3 })
  e.play()
})
await sleep(2500)
const antes = await p.evaluate(() => JSON.stringify(window.__engine.loops.value.loops.map((x) => [x.id, x.instrument, x.hits.length])))
console.log('antes:', antes, '| escala:', await p.evaluate(() => JSON.stringify(window.__engine.song.value.scale ?? null)))
await clickLabel(p, 'editar parte'); await sleep(600)
await p.evaluate(() => document.querySelector('[data-sing-btn]').click()); await sleep(400)
console.log('pregunta la escala (no adivina):', await p.evaluate(() => !!document.querySelector('[data-sing-ask]')))
if (await p.evaluate(() => !!document.querySelector('[data-sing-ask]'))) {
  await p.evaluate(() => { const s = document.querySelector('[data-sing-pick]'); s.value = '7-minor'; s.dispatchEvent(new Event('change', { bubbles: true })) }); await sleep(200)
  await p.evaluate(() => document.querySelector('[data-sing-use]').click())
}
// el micro falso suena desde el principio y el detector de batería de siempre lo oye mientras no se canta; lo que cuenta es lo que pasa desde que se arma la toma
for (let i = 0; i < 40 && (await p.evaluate(() => window.__engine.voiceRec.value)) === 'idle'; i++) await sleep(100)
const armado = await p.evaluate(() => JSON.stringify(window.__engine.loops.value.loops.map((x) => [x.id, x.instrument, x.hits.length])))
const estados = new Set()
// en cuanto nace la melodía se mira el resto (después, el micro falso sigue sonando y el detector de batería de siempre lo oye)
for (let i = 0; i < 400; i++) { estados.add(await p.evaluate(() => document.querySelector('[data-sing-btn]')?.textContent.trim().slice(0, 14))); if (await p.evaluate(() => window.__engine.lastSung.value !== null)) break; await sleep(50) }
console.log('estados del botón:', [...estados])
const r = await p.evaluate(() => ({ sung: window.__engine.lastSung.value, escala: window.__engine.song.value.scale, loops: window.__engine.loops.value.loops.map((x) => ({ id: x.id, i: x.instrument, bars: x.bars, ph: x.phaseBar, n: x.hits.length, midis: [...new Set(x.hits.map((h) => h.midi % 12))].sort((a, c) => a - c), pos: x.hits.map((h) => h.pos) })), msg: document.querySelector('[data-sing-msg]')?.textContent, borrar: !!document.querySelector('[data-sing-delete]') }))
console.log(JSON.stringify(r))
const mel = r.loops.find((x) => x.id === r.sung)
const sc = r.escala
const GMIN = (sc.mode === 'minor' ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11]).map((d) => (sc.tonic + d) % 12)
console.log('armado:', armado)
console.log('partes:', await p.evaluate(() => window.__engine.song.value.order.length), '| parte que se ve:', await p.evaluate(() => window.__engine.viewCellId.value), '| fase del loop cantado:', mel?.ph, 'compases:', mel?.bars)
console.log('melodía nueva:', !!mel, '| todas en la escala de la canción:', mel ? mel.midis.every((m) => GMIN.includes(m)) : null, '| en la rejilla:', mel ? mel.pos.every(Number.isInteger) : null, '| lo de antes sigue (mismos loops; el micro falso suena sin parar y el detector de batería puede añadir golpes por su cuenta):', JSON.stringify(r.loops.filter((x) => x.id !== r.sung).map((x) => [x.id, x.i])) === JSON.stringify(JSON.parse(armado).map((x) => [x[0], x[1]])), '| la melodía es un loop nuevo (id distinto):', mel && !JSON.parse(armado).some((x) => x[0] === mel.id))
await p.evaluate(() => document.querySelector('[data-sing-delete]')?.click()); await sleep(300)
console.log('tras «borrar toma», melodías:', await p.evaluate(() => window.__engine.loops.value.loops.filter((x) => x.instrument === 'mel').length), errs)
await b.close()
