// Sin micro (denegado o sin dispositivo): «Entrar sin micro» abre el Estudio con una demo y sin guía de beatbox.
import puppeteer from 'puppeteer-core'
import { sleep } from './lib.mjs'
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] }) // sin micro de mentira: NotFoundError
const p = await b.newPage()
await p.setViewport({ width: 400, height: 800, isMobile: true, hasTouch: true })
await p.evaluateOnNewDocument(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError')) })
const errs = []
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
await p.goto(`http://localhost:${process.env.PORT || 3999}/`, { waitUntil: 'networkidle2', timeout: 120000 })
const click = (t) => p.evaluate((t) => { const el = [...document.querySelectorAll('button')].find((b) => b.textContent.includes(t)); if (el) el.click(); return !!el }, t)
await click('Empezar'); await sleep(8000)
const err = await p.evaluate(() => document.body.innerText); console.log(JSON.stringify(err.slice(0,300)))
console.log('error visible:', /micro/i.test(err), '| botón sin micro:', await click('Entrar sin micro'))
await sleep(9000)
const st = await p.evaluate(() => ({ text: document.body.innerText, loops: window.__engine?.loops?.value?.loops?.length, noMic: window.__engine?.noMic?.value }))
console.log('noMic', st.noMic, '| loops', st.loops, '| rótulo', /Sin micro/.test(st.text), '| guía beatbox', /bum · pff/.test(st.text))
await p.screenshot({ path: `${process.env.OUT || '/tmp'}/sin-micro.png` })
console.log('errores', errs)
await b.close()
