// `/` lleva al Laboratorio; un enlace con # lleva al Estudio.
import puppeteer from 'puppeteer-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--lang=es-ES', '--no-sandbox'] })
for (const u of ['/', '/#x']) { const p = await b.newPage(); await p.goto(`http://localhost:${process.env.PORT || 3999}${u}`, { waitUntil: 'networkidle2' }); await sleep(2500); console.log(u, '→', new URL(p.url()).pathname) }
await b.close()
