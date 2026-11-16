import puppeteer from 'puppeteer-core'
export const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const mk = (i) => ({ instrument: i, features: { centroid: 0.1 + 0.1*['bd','sd','hh'].indexOf(i), bands: [0.4,0.3,0.2,0.1], mfcc: Array.from({length:13},(_,k)=>k*0.1*(1+['bd','sd','hh'].indexOf(i))), zcr: 0.1, rms: 0.3 } })
export async function open({ w = 400, h = 800, goto = true, simple = false } = {}) {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required'] })
  const p = await b.newPage()
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: true, isMobile: true })
  const errs = []
  p.on('console', m => { if (m.type()==='error') errs.push(m.text().slice(0,250)) })
  p.on('pageerror', e => errs.push('PAGEERR '+String(e).slice(0,300)))
  // los guiones de antes son del Estudio; los de la portada piden `simple: true` (spec 016)
  if (!simple) await p.evaluateOnNewDocument(() => { try { if (!localStorage.getItem('coderbeats:ui:v1')) localStorage.setItem('coderbeats:ui:v1', JSON.stringify({ version: 1, ui: 'estudio', syncMelody: true })) } catch {} })
  await p.evaluateOnNewDocument((cal) => { try { if (!localStorage.getItem('coderbeats:calibration:v1')) localStorage.setItem('coderbeats:calibration:v1', JSON.stringify(cal)) } catch {} }, {
    version: 1, createdAt: new Date().toISOString(), sampleRate: 48000,
    samples: ['bd','sd','hh'].flatMap(i => [mk(i), mk(i)]), norm: { mean: Array.from({length:13+1+4+1},()=>0), std: Array.from({length:13+1+4+1},()=>1) },
    latency: { ms: 30, spreadMs: 3, measuredAt: new Date().toISOString() },
  })
  if (!goto) return { b, p, errs }
  await p.goto(`http://localhost:${process.env.PORT || 3999}/`, { waitUntil: 'networkidle2', timeout: 120000 })
  await p.evaluate(() => [...document.querySelectorAll('button')].find(b=>b.textContent.includes('Empezar'))?.click())
  await sleep(8000)
  return { b, p, errs }
}
export const labels = (p) => p.$$eval('button', bs => bs.filter(b=>b.offsetParent!==null).map(b=>(b.getAttribute('aria-label')||b.textContent).trim().slice(0,50)))
export const clickLabel = (p, text) => p.evaluate((t) => { const el=[...document.querySelectorAll('button')].find(b=>((b.getAttribute('aria-label')||'')+b.textContent).includes(t)); if(!el) return false; el.click(); return true }, text)
export const clickExact = (p, text) => p.evaluate((t) => { const el=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||b.textContent).trim()===t); if(!el) return false; el.click(); return true }, text)
