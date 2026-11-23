// Idiomas (spec 025): el del navegador y el selector.
import puppeteer from 'puppeteer-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
for (const lang of ['es-ES', 'en-US', 'eu-ES', 'fr-FR']) {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: [`--lang=${lang}`, '--no-sandbox'] })
  const p = await b.newPage()
  await p.setExtraHTTPHeaders({ 'Accept-Language': lang })
  await p.evaluateOnNewDocument((l) => Object.defineProperty(navigator, 'languages', { get: () => [l] }), lang)
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto('http://localhost:3999/lab', { waitUntil: 'networkidle2', timeout: 120000 }); await sleep(2500)
  const h1 = await p.evaluate(() => document.querySelector('h1')?.textContent)
  console.log(lang, '→ título:', h1, '| html lang:', await p.evaluate(() => document.documentElement.lang), errs)
  if (lang === 'es-ES') {
    await p.evaluate(() => document.querySelector('[data-lang=eu]').click()); await sleep(500)
    console.log('  selector → euskera:', await p.evaluate(() => document.querySelector('h1')?.textContent), '|', await p.evaluate(() => document.querySelector('[data-lab-remixes] span span:last-child')?.textContent))
    await p.evaluate(() => document.querySelector('[data-lang=en]').click()); await sleep(500)
    console.log('  selector → inglés:', await p.evaluate(() => document.querySelector('h1')?.textContent))
  }
  await b.close()
}
