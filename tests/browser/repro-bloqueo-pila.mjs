import { open, sleep, clickLabel, clickExact } from './lib.mjs'
const { b, p } = await open()
const c = await p.createCDPSession()
await clickLabel(p, 'ajustes'); await sleep(500); await clickLabel(p, 'Cargar demo'); await sleep(800)
await clickExact(p, 'tocar'); await sleep(4000)
await clickLabel(p, 'remixes'); await sleep(700)
await c.send('Debugger.enable')
c.on('Debugger.paused', (e) => { console.log('--- PAUSADO EN:'); for (const f of e.callFrames.slice(0, 14)) console.log('  ', f.functionName || '(anon)', f.url.split('/').slice(-2).join('/'), f.location.lineNumber + 1) ; }) 
p.evaluate(() => [...document.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Abrir')[0].click()).catch(() => {})
for (const ms of [300, 600, 1000, 1500]) { await sleep(ms); try { await c.send('Debugger.pause') } catch (e) { console.log('cerrada', String(e).slice(0, 50)); process.exit(0) } await sleep(400); try { await c.send('Debugger.resume') } catch {} }
await sleep(3000)
console.log('no se pausó (¿no está colgada?)'); process.exit(0)
