// Sin micro por defecto (spec 022): «Empezar» entra al Estudio sin pedir el micro; con el micro denegado, «Usar el micro (opcional)» da un aviso claro y «Empezar» sigue funcionando.
import puppeteer from 'puppeteer-core'
import { sleep } from './lib.mjs'
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--lang=es-ES', '--no-sandbox', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] })
const p = await b.newPage()
await p.setViewport({ width: 400, height: 800, isMobile: true, hasTouch: true })
await p.evaluateOnNewDocument(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError')) })
const errs = []
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
await p.goto(`http://localhost:${process.env.PORT || 3999}/estudio`, { waitUntil: 'networkidle2', timeout: 120000 })
const click = (t) => p.evaluate((t) => { const el = [...document.querySelectorAll('button')].find((b) => b.textContent.includes(t)); if (el) el.click(); return !!el }, t)
await click('Usar el micro'); await sleep(4000)
console.log('aviso con el micro denegado:', /Permiso de micro denegado/.test(await p.evaluate(() => document.body.innerText)))
await click('Empezar'); await sleep(8000)
const st = await p.evaluate(() => ({ editar: !!document.querySelector('[aria-label="editar parte"]'), noMic: window.__engine?.noMic?.value, loops: window.__engine?.loops?.value?.loops?.length }))
console.log('dentro del Estudio sin micro:', JSON.stringify(st), errs)
await b.close()
