import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CREDITS, LICENSE_ID, LICENSE_URL, SOURCE_URL } from '../../app/lib/about'

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8')

describe('Acerca de: licencia y créditos', () => {
  it('la licencia coincide con package.json y con el archivo LICENSE', () => {
    expect(JSON.parse(read('package.json')).license).toBe(LICENSE_ID)
    expect(read('LICENSE')).toContain('GNU AFFERO GENERAL PUBLIC LICENSE')
    expect(LICENSE_URL).toMatch(/agpl-3\.0/)
  })
  it('el código fuente apunta al origen del repositorio', () => {
    expect(SOURCE_URL.startsWith('https://')).toBe(true)
  })
  it('acredita todo lo que declara el README y los kits de samples', () => {
    const names = CREDITS.map((c) => c.name).join(' ')
    for (const n of ['Strudel', 'Meyda', 'uzu-drumkit', 'Fischer', 'Boochi44', 'Karoryfer']) expect(names).toContain(n)
    const samples = read('public/samples/CREDITS.md')
    expect(samples).toContain('uzu-drumkit')
    expect(samples).toContain('sounds-tr808-fischer')
    expect(samples).toContain('Boochi44')
    expect(samples).toContain('karoryfer.big-rusty-drums')
    for (const c of CREDITS) {
      expect(c.url.startsWith('https://')).toBe(true)
      expect(c.license.length).toBeGreaterThan(0)
    }
  })
  it('lo que acredita Strudel como dependencia es real', () => {
    const pkg = JSON.parse(read('package.json'))
    expect(pkg.dependencies['@strudel/web']).toBeDefined()
    expect(pkg.dependencies.meyda).toBeDefined()
  })
})
