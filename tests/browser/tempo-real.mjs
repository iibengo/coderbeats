// El tempo que se elige («+ Nueva canción») y el de una canción importada es el que suena de verdad: mide la duración real del compás en cada estilo.
import { open, clickLabel, sleep } from './lib.mjs'
const ESTILOS = { hiphop90: 90, house2: 124, dnb: 174, dembow: 120, reggaeton: 95, techno2: 132 }
const { b, p, errs } = await open()
const medir = async () => {
  await p.evaluate(() => window.__engine.play()); await sleep(3000)
  const t = []
  for (let i = 0; i < 7; i++) { t.push(await p.evaluate(() => { const c = window.__engine.clockNow(); return [Date.now(), c.bar + c.barPhase] })); await sleep(1000) }
  await p.evaluate(() => window.__engine.stop())
  const r = ((t.at(-1)[0] - t[0][0]) / 1000) / (t.at(-1)[1] - t[0][1]); console.log('   motor bpm', await p.evaluate(() => [window.__engine.bpm.value, window.__engine.song.value.bpm, window.__engine.style.value].join(' ')), 'compases', (t.at(-1)[1] - t[0][1]).toFixed(2)); return r
}
let fallos = 0
const ver = (que, seg, bpm) => { const ok = Math.abs(seg - 240 / bpm) / (240 / bpm) < 0.04; if (!ok) fallos++; console.log(ok ? '✓' : '✗', que.padEnd(34), seg.toFixed(3), 's/compás (esperado', (240 / bpm).toFixed(3) + ')') }
const SOLO = (process.argv[2] || '').split(',').filter(Boolean)
for (const [id, bpmEstilo] of Object.entries(ESTILOS)) {
  if (SOLO.length && !SOLO.includes(id)) continue
  const elegido = Math.round(bpmEstilo * 0.85)
  // 1) «+ Nueva canción» con el tempo elegido
  await clickLabel(p, 'mis canciones'); await sleep(500)
  await p.evaluate(() => document.querySelector('[data-new-song]').click()); await sleep(200)
  await p.evaluate((i) => document.querySelector(`[data-new-style=${i}]`).click(), id)
  await p.evaluate((v) => { const x = document.querySelector('[data-new-bpm]'); x.value = v; x.dispatchEvent(new Event('input', { bubbles: true })) }, elegido); await sleep(150)
  await p.evaluate(() => document.querySelector('[data-new-create]').click()); await sleep(700)
  // si lo de ahora no está guardado, pide confirmar
  await p.evaluate(() => [...document.querySelectorAll('[role=alertdialog] button')].find((x) => /Empezar|Continuar/.test(x.textContent))?.click()); await sleep(1500)
  // un ritmo suelto (no la demo del estilo, que en dnb y dembow es una canción con su propio tempo)
  await p.evaluate(() => { const e = window.__engine; const l = (i, steps) => ({ id: e.loops.value.nextId + steps.length, instrument: i, bars: 1, phaseBar: 0, hits: steps.map((pos) => ({ pos, strength: 0.8 })), muted: false, bornAt: 0, fromTemplate: false }); e.editLoops({ loops: [l('bd', [0, 4, 8, 12])], nextId: e.loops.value.nextId + 20 }) }); await sleep(300)
  ver(`${id} · nueva canción a ${elegido}`, await medir(), elegido)
  // 2) una canción importada con tempo propio
  const importado = Math.round(bpmEstilo * 1.1)
  const texto = await p.evaluate((i, v) => { const s = window.__engine.snapshot(); return JSON.stringify({ v: 1, n: 'Importada ' + i, s: i, k: s.kit, b: 'manual', f: s.fx, g: { ...s.song, bpm: v } }) }, id, importado)
  await clickLabel(p, 'mis canciones'); await sleep(500)
  await p.evaluate(() => { const t = document.querySelector('[data-tools]'); if (!document.querySelector('[data-tools-panel]')) t.click() }); await sleep(200)
  await p.evaluate(() => { if (!document.querySelector('[data-import-text]')) document.querySelector('[data-import-open]').click() }); await sleep(200)
  await p.evaluate((t) => { const x = document.querySelector('[data-import-text]'); x.value = t; x.dispatchEvent(new Event('input', { bubbles: true })) }, texto); await sleep(150)
  await p.evaluate(() => document.querySelector('[data-import-add]').click()); await sleep(600)
  await p.evaluate((n) => [...document.querySelectorAll('li button')].find((x) => x.textContent.includes(n))?.click(), 'Importada ' + id); await sleep(600)
  // lo de ahora no está guardado: pide confirmar
  await p.evaluate(() => [...document.querySelectorAll('[role=alertdialog] button')].find((x) => /Continuar|Abrir/.test(x.textContent))?.click()); await sleep(2000)
  ver(`${id} · importada a ${importado}`, await medir(), importado)
}
console.log(fallos ? `${fallos} fallos` : 'todo bien', errs)
await b.close()
process.exit(fallos ? 1 : 0)
