// Remixes → «Abrir en el Estudio»: copia en Mis canciones (con la marca lab), se abre en el Estudio, y vuelve a Remixes como «mío».
import { labOpen, click, sleep } from './lab-lib.mjs'
const { b, p, errs } = await labOpen()
await click(p, 'Remixes'); await sleep(5000)
await click(p, 'Mozart'); await sleep(3000)
console.log('abrir:', await click(p, 'Abrir en el Estudio')); await sleep(6000)
const st = await p.evaluate(() => ({ url: location.pathname + location.search, cells: window.__engine?.song?.value?.cells?.length, order: window.__engine?.song?.value?.order?.length, style: window.__engine?.style?.value, lib: JSON.parse(localStorage.getItem('coderbeats:library:v1') || '{}').songs?.map((s) => [s.name, s.lab?.remixId, s.song.cells.length]) }))
console.log('en el Estudio:', JSON.stringify(st))
await p.goto('http://localhost:3999/lab', { waitUntil: 'networkidle2' }); await sleep(2500)
await click(p, 'Remixes'); await sleep(5000)
console.log('lista de remixes:', await p.evaluate(() => [...document.querySelectorAll('button')].map((b) => b.textContent.trim().replace(/\s+/g, ' ')).filter((t) => /mío|Mozart|Himno|Dies|Wow/.test(t))))
console.log(errs)
await b.close()
