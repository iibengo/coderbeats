// «+ Nueva canción» (spec 027): estilo y tempo; queda guardada en Mis canciones y se abre vacía con el panel de la parte.
import { open, clickLabel, sleep } from './lib.mjs'
const { b, p, errs } = await open()
await clickLabel(p, 'mis canciones'); await sleep(600)
await p.evaluate(() => document.querySelector('[data-new-song]').click()); await sleep(300)
await p.evaluate(() => document.querySelector('[data-new-style=hiphop90]').click())
await p.evaluate(() => { const i = document.querySelector('[data-new-bpm]'); i.value = 94; i.dispatchEvent(new Event('input', { bubbles: true })) }); await sleep(200)
await p.evaluate(() => document.querySelector('[data-new-create]').click()); await sleep(1500)
const st = await p.evaluate(() => ({ estilo: window.__engine.style.value, bpm: window.__engine.bpm.value, loops: window.__engine.loops.value.loops.length, panel: !!document.querySelector('[aria-label="editar parte"][role], section[aria-label="editar parte"]'), lib: JSON.parse(localStorage.getItem('coderbeats:library:v1')).songs.map((s) => [s.name, s.style, s.song.bpm]) }))
console.log(JSON.stringify(st), errs)
await b.close()
