// El conversor de notas (tools/conversor/notas-a-json.mjs) va aparte de la app pero tiene que seguirla:
// si la app gana un estilo, un sinte o cambia un patrón y el conversor no, estas pruebas fallan.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { STYLES } from '~/lib/constants'
import { MELODY_SYNTHS } from '~/lib/melody'
import { parseImport } from '~/lib/songFile'
import { STYLE_MUSIC } from '~/lib/styles'

const CONVERSOR = join(process.cwd(), 'tools/conversor/notas-a-json.mjs')
const EJEMPLOS = join(process.cwd(), 'tools/conversor/ejemplos')
const run = (...args: string[]) => execFileSync(process.execPath, [CONVERSOR, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

interface Capacidades { estilos: Record<string, number>; demos: Record<string, Record<string, string>>; sintes: string[] }
const cap: Capacidades = JSON.parse(run('--capacidades'))

// Sintes de la app que el conversor NO ofrece como «sinte:» de la melodía, y por qué. Un sinte nuevo en la app obliga a decidir:
// o se añade al conversor (SINTES en notas-a-json.mjs) o se apunta aquí con su motivo.
const NO_SE_ESCRIBEN_COMO_MELODIA: Record<string, string> = {
  riser: 'efectos: (riser)', crash: 'efectos: (crash)', boom: 'efectos: (boom)', impacto: 'efectos: (impacto)', downlifter: 'efectos: (downlifter)',
  rim: 'percu: (rim)', click: 'percu: (click)', cowbell: 'percu: (cowbell)', tom: 'percu: (tom)', shaker: 'percu: (shaker)',
  hat: 'charle: y redoble: (sinte de los redobles del drill)', hatOpen: 'charle-abierto: (charles abierto del drill)',
  drone: 'interno del motor (nota larga de fondo)', bass: 'lo escribe «bajo:»', keys: 'interno del motor',
}

describe('conversor ↔ app: estilos', () => {
  it('conoce todos los estilos de la app, con su tempo', () => {
    for (const s of Object.values(STYLES)) expect(cap.estilos[s.id], `falta el estilo «${s.id}» en el conversor`).toBe(s.bpm)
  })
  it('no inventa estilos que la app no tiene', () => {
    for (const id of Object.keys(cap.estilos)) expect(STYLES, `estilo «${id}» del conversor no existe en la app`).toHaveProperty(id)
  })
  it('usa el mismo patrón de batería que la app (bombo, caja, charles), salvo los estilos «de antes»', () => {
    // `house` y `techno` (legacy) solo se aceptan para canciones viejas y el conversor los trata como house2/techno2
    for (const s of Object.values(STYLES).filter((x) => !x.legacy)) {
      const t = STYLE_MUSIC[s.id].templates
      expect(cap.demos[s.id], `patrones de «${s.id}»`).toEqual({ bd: t.bd, sd: t.sd, hh: t.hh })
    }
  })
})

describe('conversor ↔ app: sintes', () => {
  it('todo sinte de la app o se ofrece o está justificado', () => {
    for (const sy of MELODY_SYNTHS) {
      const ofrecido = cap.sintes.includes(sy)
      const justificado = sy in NO_SE_ESCRIBEN_COMO_MELODIA
      expect(ofrecido || justificado, `el sinte «${sy}» de la app no está en el conversor ni justificado en esta prueba`).toBe(true)
    }
  })
  it('no ofrece sintes que la app no conoce', () => {
    for (const sy of cap.sintes) expect(MELODY_SYNTHS as readonly string[], `sinte «${sy}» del conversor`).toContain(sy)
  })
})

// hashes de lo que sale hoy de cada ejemplo: si cambian sin querer, el conversor ha roto algo; si cambian a propósito, se actualizan aquí
const GOLDEN: Record<string, string> = {
  'ejemplo-melodia.txt': '96a1f63e5337ba55f914b9869226f5c86c7e51f146707a3ad4d886fe5144ceea',
  'minimal-ejemplo.txt': 'e7a7f1d415049eb5d79d0e419bfce25f57f876138fb64254a782c0d40132eb6a',
  'dub-ejemplo.txt': 'bce9c3f6f6add94499440f04cf71e2fd3548a0c788dea823fa1a8e803e4a3461',
  'drill-ejemplo.txt': '3294c635dbd63ea67733a63cd8faedb41722e6d63444e0215a9d03d1d8691499',
}

describe('ejemplos del conversor', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'conv-'))
  const ejemplos = readdirSync(EJEMPLOS).filter((f) => f.endsWith('.txt')).sort()

  it('hay ejemplos y todos tienen su hash', () => {
    expect(ejemplos.length).toBeGreaterThanOrEqual(4)
    for (const f of ejemplos) expect(GOLDEN, `falta el hash de ${f}`).toHaveProperty(f)
  })

  for (const f of ejemplos) {
    it(`${f}: convierte, da siempre el mismo .json y la app lo acepta`, async () => {
      const out = join(tmp, f.replace(/\.txt$/, '.json'))
      run(join(EJEMPLOS, f), out)
      const json = readFileSync(out, 'utf8')
      expect(createHash('sha256').update(json).digest('hex')).toBe(GOLDEN[f])
      const r = await parseImport(json)
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.songs.length).toBeGreaterThan(0)
        expect(r.rejected).toBe(0)
      }
    })
  }

  it('el estilo drill se pide por nombre (--estilo drill) y sale a 140 bpm', async () => {
    const txt = join(tmp, 'sin-estilo.txt')
    execFileSync('node', ['-e', `require('fs').writeFileSync(${JSON.stringify(txt)}, 'nombre: Sin estilo\\nparte: A\\nmelodia:\\n  D4:16\\n')`])
    const out = join(tmp, 'sin-estilo.json')
    run(txt, out, '--estilo', 'drill')
    const a = JSON.parse(readFileSync(out, 'utf8'))
    expect(a.s).toBe('drill')
    expect((await parseImport(JSON.stringify(a))).ok).toBe(true)
    rmSync(tmp, { recursive: true, force: true })
  })
})
