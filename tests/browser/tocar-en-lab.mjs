// «▶ Tocar en el Laboratorio» (spec 024 §1): guarda en el mismo remix (una sola vez) y abre Remixes del Laboratorio con él.
import { open, clickLabel, sleep } from './lib.mjs'
const { b, p, errs } = await open()
await clickLabel(p, 'mis remixes'); await sleep(800)
await p.evaluate(() => document.querySelector('[data-remixes-serie] li button').click()); await sleep(1500)
for (let k = 0; k < 2; k++) {
  await clickLabel(p, 'editar parte'); await sleep(500)
  await p.evaluate(() => document.querySelector('[data-play-lab]').click()); await sleep(6000)
  const st = await p.evaluate(() => ({ url: location.pathname, partes: [...document.querySelectorAll('[data-part]')].map((x) => x.dataset.part), lib: JSON.parse(localStorage.getItem('coderbeats:library:v1')).songs.map((s) => s.id.slice(0, 8)) }))
  console.log(`vuelta ${k + 1}:`, JSON.stringify(st))
  // vuelve al Estudio con la misma entrada (Abrir en el Estudio)
  await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Abrir en el Estudio'))?.click()); await sleep(6000)
}
console.log(errs)
await b.close()
