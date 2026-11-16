// 🎤 Voz (spec 016 §17): apagada por defecto, la app ignora el micro; al encenderla, lo oye; al apagarla, vuelve a ignorarlo; el Estudio escucha siempre.
import { open, sleep, clickLabel } from './lib.mjs'
const { b, p, errs } = await open({ simple: true })
await clickLabel(p, 'Hip hop'); await sleep(1500)
await p.evaluate(() => window.__engine.clearAll()); await sleep(300)
const st = () => p.evaluate(() => ({ listening: window.__engine.listening.value, micOpen: window.__engine.micOpen.value, loops: window.__engine.loops.value.loops.length }))
await sleep(9000) // el micro de mentira pita cada poco: apagada, no debe entrar nada
console.log('apagada:', JSON.stringify(await st()))
await clickLabel(p, 'encender la voz'); await sleep(9000)
console.log('encendida:', JSON.stringify(await st()))
await clickLabel(p, 'apagar la voz'); await sleep(7000) // que cierre la frase que ya estaba en curso
await p.evaluate(() => window.__engine.clearAll()); await sleep(9000)
console.log('apagada otra vez:', JSON.stringify(await st()))
await p.evaluate(() => window.__engine.closeMic()); await sleep(300)
console.log('micro cerrado:', JSON.stringify(await st()))
await clickLabel(p, 'encender la voz'); await sleep(8000)
console.log('reabierto y encendida:', JSON.stringify(await st()))
console.log('errores', errs)
await b.close()
