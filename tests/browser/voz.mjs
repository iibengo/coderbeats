import { open, labels, sleep, clickLabel, clickExact } from './lib.mjs'
const { b, p, errs } = await open()
p.on('console', m => { const t = m.text(); if (/error|not found|sound/i.test(t) && !/getTrigger/.test(t)) console.log('C', t.slice(0,140)) })
await clickLabel(p, 'ajustes'); await sleep(500); await clickLabel(p, 'Cargar demo'); await sleep(800)
await clickExact(p, 'tocar'); await sleep(4000)
console.log('btn', (await labels(p)).filter(x=>/voz/i.test(x)))
console.log('click', await clickLabel(p, 'grabar tu voz'))
for (let i=0;i<9;i++){ await sleep(1500); console.log(i, await p.evaluate(() => ({ rec: window.__engine.voiceRec.value, voz: window.__engine.loops.value.loops.filter(l=>l.instrument==='voz').length, notice: document.querySelector('.notice')?.textContent }))) }
const r = await p.evaluate(async () => {
  const e = window.__engine
  const l = e.loops.value.loops.find(l=>l.instrument==='voz')
  const db = await new Promise(res => { const q = indexedDB.open('coderbeats-voz'); q.onsuccess = () => res(q.result) })
  const all = await new Promise(res => { const q = db.transaction('voz').objectStore('voz').getAll(); q.onsuccess = () => res(q.result) })
  return { loop: l && { bars: l.bars, phase: l.phaseBar, born: l.bornAt, voice: l.voice }, stored: all.map(x => ({ id: x.id, bytes: x.pcm.byteLength, sr: x.sampleRate })), errors: e.diag.value.filter(x=>x.kind==='error').map(x=>x.text) }
})
console.log(JSON.stringify(r))
await sleep(5000)
await p.screenshot({ path: '/tmp/voz.png' })
console.log('errs', errs)
await b.close()
