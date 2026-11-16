import { describe, expect, it } from 'vitest'
import en from '../../i18n/locales/en.json'
import es from '../../i18n/locales/es.json'
import eu from '../../i18n/locales/eu.json'

type Tree = { [k: string]: string | Tree }
const flat = (t: Tree, p = ''): Record<string, string> => Object.entries(t).reduce<Record<string, string>>((o, [k, v]) => (typeof v === 'string' ? { ...o, [p + k]: v } : { ...o, ...flat(v, `${p}${k}.`) }), {})
const vars = (s: string): string[] => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort()

describe('idiomas (spec 025): las tres lenguas tienen las mismas claves y las mismas variables', () => {
  const base = flat(es as Tree)
  for (const [name, other] of [['en', en], ['eu', eu]] as const) {
    const f = flat(other as Tree)
    it(`${name}: mismas claves que el español`, () => {
      expect(Object.keys(f).sort()).toEqual(Object.keys(base).sort())
    })
    it(`${name}: mismas variables {x} en cada texto y ningún texto vacío`, () => {
      for (const k of Object.keys(base)) {
        expect(vars(f[k]!), k).toEqual(vars(base[k]!))
        expect(f[k]!.trim().length, k).toBeGreaterThan(0)
      }
    })
  }
  it('lo que no se traduce se queda igual: el código Strudel y los nombres propios no están en los textos', () => {
    for (const v of Object.values(base)) expect(v).not.toMatch(/setcpm|\.orbit\(|note\("/)
  })
})
