// Ruta de desarrollo del laboratorio de voz (spec 002, §9): guarda y lee las tomas en tests/fixtures/voice/.
// Solo existe con `nuxt dev` (se registra como devHandler en nuxt.config.ts): no entra en el build.
//   GET  /_lab/take          → lista de tomas guardadas
//   GET  /_lab/take?name=x   → { meta, wav (base64) } de una toma
//   POST /_lab/take          → { name, wav (base64), meta } la guarda como x.wav, x.json y x.expected.txt
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createError, eventHandler, getQuery, readBody } from 'h3'

const DIR = join(process.cwd(), 'tests', 'fixtures', 'voice')
const NAME = /^[a-z0-9][a-z0-9_-]{0,80}$/
const MAX_WAV_BYTES = 30 * 1024 * 1024

/** Solo la propia máquina y la red local (el móvil con `dev:phone`): esto escribe en el repo. */
function isLocal(addr: string | undefined): boolean {
  if (!addr) return false
  const a = addr.replace(/^::ffff:/, '')
  if (a === '::1' || a.startsWith('fe80:') || a.startsWith('fc') || a.startsWith('fd')) return true
  const p = a.split('.').map(Number)
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n))) return false
  return p[0] === 127 || p[0] === 10 || (p[0] === 192 && p[1] === 168) || (p[0] === 172 && p[1]! >= 16 && p[1]! <= 31)
}

export default eventHandler(async (event) => {
  if (!isLocal(event.node.req.socket.remoteAddress)) throw createError({ statusCode: 403, statusMessage: 'solo red local' })

  if (event.method === 'GET') {
    const { name } = getQuery(event)
    if (name === undefined) {
      const files = await readdir(DIR).catch(() => [] as string[])
      return { takes: files.filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort() }
    }
    if (typeof name !== 'string' || !NAME.test(name)) throw createError({ statusCode: 400, statusMessage: 'nombre no válido' })
    try {
      const meta = JSON.parse(await readFile(join(DIR, `${name}.json`), 'utf8')) as unknown
      const wav = (await readFile(join(DIR, `${name}.wav`))).toString('base64')
      return { meta, wav }
    } catch {
      throw createError({ statusCode: 404, statusMessage: 'toma no encontrada' })
    }
  }

  if (event.method === 'POST') {
    const body = (await readBody(event)) as { name?: unknown; wav?: unknown; meta?: unknown }
    if (typeof body.name !== 'string' || !NAME.test(body.name)) throw createError({ statusCode: 400, statusMessage: 'nombre no válido' })
    if (typeof body.wav !== 'string') throw createError({ statusCode: 400, statusMessage: 'falta el wav' })
    const wav = Buffer.from(body.wav, 'base64')
    if (wav.length < 44 || wav.length > MAX_WAV_BYTES || wav.toString('ascii', 0, 4) !== 'RIFF')
      throw createError({ statusCode: 400, statusMessage: 'wav no válido' })
    const meta = (body.meta && typeof body.meta === 'object' ? body.meta : {}) as { expected?: unknown }
    await mkdir(DIR, { recursive: true })
    await writeFile(join(DIR, `${body.name}.wav`), wav)
    await writeFile(join(DIR, `${body.name}.json`), JSON.stringify(meta, null, 2))
    await writeFile(join(DIR, `${body.name}.expected.txt`), `${typeof meta.expected === 'string' ? meta.expected : ''}\n`)
    return { ok: true, path: `tests/fixtures/voice/${body.name}.wav` }
  }

  throw createError({ statusCode: 405 })
})
