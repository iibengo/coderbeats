// Mis canciones: importar por texto pegado y por archivo (con el validador), rechazo de basura, copia de seguridad; nada de red.
import { writeFileSync } from 'node:fs'
import { open, clickLabel, sleep } from './lib.mjs'
const { b, p, errs } = await open()
const reqs = []
p.on('request', (r) => { if (!r.url().startsWith('http://localhost:3999') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) reqs.push(r.url().slice(0, 80)) })
await p.evaluate(() => window.__engine.loadDemo()); await sleep(800)
const text = await p.evaluate(() => { const s = window.__engine.snapshot(); return JSON.stringify({ v: 1, n: 'Importada por texto', s: s.style, k: s.kit, b: s.bgMode, f: s.fx, g: s.song }) })
const lib = () => p.evaluate(() => (JSON.parse(localStorage.getItem('coderbeats:library:v1') || '{"songs":[]}').songs || []).map((s) => s.name))
await clickLabel(p, 'mis canciones'); await sleep(600)
await p.evaluate(() => document.querySelector('[data-tools]').click()); await sleep(200)
await p.evaluate(() => document.querySelector('[data-import-open]').click()); await sleep(200)
const paste = async (t) => { await p.evaluate((t) => { const x = document.querySelector('[data-import-text]'); x.value = t; x.dispatchEvent(new Event('input', { bubbles: true })) }, t); await sleep(150); await p.evaluate(() => document.querySelector('[data-import-add]').click()); await sleep(500); return p.evaluate(() => document.querySelector('[data-tool-note]')?.textContent) }
console.log('basura:', await paste('esto no es una canción'))
console.log('script:', await paste('{"v":1,"n":"<script>alert(1)</script>","s":"zz"}'))
console.log('texto válido:', await paste(text), '→', JSON.stringify(await lib()))
console.log('otra vez lo mismo (se omite):', await paste(text), '→', (await lib()).length, 'canciones')
// por archivo
const f = '/tmp/claude-1000/-home-ioni-dev-coderbeats/bcaf8334-889a-45dc-9d11-cd0dfcf41e47/scratchpad/prueba.json'
writeFileSync(f, JSON.stringify({ formato: 'coderbeats-copia', version: 1, canciones: [JSON.parse(text), { ...JSON.parse(text), n: 'Otra por archivo' }] }))
const input = await p.$('[data-import-file]')
await input.uploadFile(f); await sleep(800)
console.log('por archivo (copia de 2):', await p.evaluate(() => document.querySelector('[data-tool-note]')?.textContent), '→', JSON.stringify(await lib()))
await p.evaluate(() => document.querySelector('[data-export-all]').click()); await sleep(500)
console.log('exportar todo:', await p.evaluate(() => document.querySelector('[data-tool-note]')?.textContent))
console.log('peticiones fuera de localhost:', reqs, errs)
await b.close()
