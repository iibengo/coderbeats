import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]))
const LAB = [...files('app/components/lab'), 'app/pages/lab/index.vue', 'app/composables/useLab.ts', 'app/lib/lab.ts']
// lo que es de la interfaz del Estudio y el Laboratorio no puede usar
const ESTUDIO = /components\/(Studio|Portada|SettingsSheet|LibrarySheet|PadsRow|VideoSheet|visual\/)/

describe('frontera del motor (spec 017)', () => {
  it('el Laboratorio no importa componentes del Estudio', () => {
    for (const f of LAB) {
      const src = readFileSync(f, 'utf8')
      const imports = [...src.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]!)
      for (const i of imports) expect(i, `${f} importa ${i}`).not.toMatch(ESTUDIO)
    }
  })
  it('la frontera exporta el motor', () => {
    const src = readFileSync('app/engine/index.ts', 'utf8')
    for (const n of ['useAudioEngine', 'STYLES', 'KITS', 'tunesFor', 'useVideoExport']) expect(src).toContain(n)
  })
})
