import puppeteer from 'puppeteer-core'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const O = process.env.OUT || '/tmp/claude-1000/-home-ioni-dev-coderbeats/bcaf8334-889a-45dc-9d11-cd0dfcf41e47/scratchpad'
export async function labOpen(w=420,h=800){
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--lang=es-ES', '--no-sandbox','--autoplay-policy=no-user-gesture-required'] })
  const p = await b.newPage(); await p.setViewport({ width:w, height:h, hasTouch:true, isMobile:true })
  const errs=[]; p.on('console', m=>{ if(m.type()==='error') errs.push(m.text().slice(0,250)) }); p.on('pageerror', e=>errs.push('PAGEERR '+String(e).slice(0,300)))
  await p.goto('http://localhost:3999/lab', { waitUntil:'networkidle2', timeout:120000 }); await sleep(2500)
  return { b, p, errs, O }
}
export const click = (p,t)=>p.evaluate((t)=>{const el=[...document.querySelectorAll('button')].find(b=>((b.getAttribute('aria-label')||'')+b.textContent).includes(t)); if(!el) return false; el.click(); return true}, t)
/** El Laboratorio de antes de la spec 050: vista de círculos y sin pasar solo a la siguiente parte (para los guiones que comprueban justo eso). Fija las dos claves y recarga. */
export async function labClassic(p) {
  await p.evaluate(() => { localStorage.setItem('coderbeats:lab:vista:v1', JSON.stringify({ v: 'circulos' })); localStorage.setItem('coderbeats:lab:auto:v1', JSON.stringify({ v: false })) })
  await p.reload({ waitUntil: 'networkidle2' }); await sleep(2500)
}
export { sleep }
