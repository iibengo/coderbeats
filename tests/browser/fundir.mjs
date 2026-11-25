// Fundir: arrastrar una célula sobre otra y mantener 0,8 s las funde; «↶ deshacer» las devuelve.
import { open, sleep, clickLabel, clickExact } from './lib.mjs'
const { b, p, errs } = await open()
await clickExact(p, 'dnb'); await sleep(300)
await p.evaluate(() => window.__engine.loadDemo()); await sleep(800)
await clickExact(p, 'Componer'); await sleep(2500)
const info = () => p.evaluate(() => ({ n: window.__engine.song.value.cells.length, undo: window.__engine.undoInfo.value, at: window.__engine.song.value.cells.map(c => [Math.round(c.at.x * 10) / 10, Math.round(c.at.y * 10) / 10]) }))
const before = await info()
const pts = await p.evaluate(() => { const cp = window.__stage().colonyPoints(); const o = window.__engine.song.value.order; return { a: cp.cell(o[0]), b: cp.cell(o[1]) } })
console.log('antes', JSON.stringify(before), JSON.stringify(pts))
const fire = (t, x, y) => p.evaluate((t, x, y) => window.__stage().rootEl().dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: 9001, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, buttons: t === 'pointerup' ? 0 : 1 })), t, x, y)
await fire('pointerdown', pts.a.x, pts.a.y); await sleep(100)
for (let i = 1; i <= 14; i++) { await fire('pointermove', pts.a.x + (pts.b.x - pts.a.x) * i / 14, pts.a.y + (pts.b.y - pts.a.y) * i / 14); await sleep(30) }
await sleep(1200)
await fire('pointerup', pts.b.x, pts.b.y); await sleep(1500)
const after = await info()
console.log('después', JSON.stringify(after), await p.evaluate(() => document.querySelector('.notice')?.textContent))
let ok = after.n === before.n - 1
if (ok) { await clickLabel(p, 'deshacer'); await sleep(2000); const u = await info(); console.log('tras deshacer', JSON.stringify(u)); ok = u.n === before.n }
console.log(ok ? 'OK' : 'FALLO', errs)
await b.close(); process.exit(ok ? 0 : 1)
