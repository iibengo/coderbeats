import { describe, expect, it } from 'vitest'
import { demoSong } from '~/lib/cells'
import { emptyLibrary, makeSaved, type SavedSong } from '~/lib/library'
import { encodeShare, shareUrl } from '~/lib/shareLink'
import { backupJson, fileNameOf, MAX_SONGS, mergeImported, parseImport, songJson } from '~/lib/songFile'

const snap = (style: 'dnb' | 'dembow' = 'dembow') => ({ style, kit: '808' as const, bgMode: 'manual' as const, fx: { filter: 1, space: 0, warmth: 0.5 }, song: demoSong(style)! })
let n = 0
const id = () => `t${n++}`
const entry = (s: SavedSong) => ({ id: s.id, name: s.name, savedAt: s.savedAt, saved: s, raw: s })

describe('Mis canciones: archivo, texto y enlace (solo datos)', () => {
  it('una canción exportada se importa igual (y con id nuevo)', async () => {
    const text = songJson(snap(), 'Mi demo')
    const r = await parseImport(text, new Date(), id)
    expect(r.ok && r.songs.length).toBe(1)
    if (r.ok) {
      expect(r.songs[0]!.name).toBe('Mi demo')
      expect(r.songs[0]!.style).toBe('dembow')
      expect(JSON.stringify(r.songs[0]!.song)).toBe(JSON.stringify(makeSaved(snap(), 'x', 'Mi demo', new Date()).song))
    }
  })
  it('una copia de seguridad de varias canciones; lo inválido se descarta y se cuenta', async () => {
    const a = makeSaved(snap('dnb'), 'a', 'A', new Date())
    const b = makeSaved(snap('dembow'), 'b', 'B', new Date())
    const copia = JSON.parse(backupJson([entry(a), entry(b)]))
    copia.canciones.push({ v: 1, n: 'rota', s: 'nada', k: 'x', b: 'y', f: 1, g: 2 })
    const r = await parseImport(JSON.stringify(copia), new Date(), id)
    expect(r.ok && r.songs.map((s) => s.name)).toEqual(['A', 'B'])
    expect(r.ok && r.rejected).toBe(1)
  })
  it('también acepta un enlace o solo su #c=', async () => {
    const payload = await encodeShare(snap(), 'Por enlace')
    for (const t of [shareUrl('https://x.test/estudio', payload), `#c=${payload}`, `c=${payload}`]) {
      const r = await parseImport(t, new Date(), id)
      expect(r.ok && r.songs[0]!.name).toBe('Por enlace')
    }
  })
  it('importar solo añade: no reescribe ni borra; lo igual se omite', async () => {
    const a = makeSaved(snap('dnb'), 'a', 'A', new Date())
    const lib = { ...emptyLibrary(), entries: [entry(a)] }
    const r = await parseImport(songJson(a, 'A'), new Date(), id)
    if (!r.ok) throw new Error('no')
    const m1 = mergeImported(lib, r.songs)
    expect(m1.added).toBe(0)
    expect(m1.skipped).toBe(1)
    expect(m1.lib.entries.length).toBe(1)
    const b = makeSaved(snap('dembow'), 'b', 'B', new Date())
    const r2 = await parseImport(songJson(b, 'B'), new Date(), () => 'a') // id que choca con una existente
    if (!r2.ok) throw new Error('no')
    const m2 = mergeImported(lib, r2.songs)
    expect(m2.added).toBe(1)
    expect(new Set(m2.lib.entries.map((e) => e.id)).size).toBe(2)
    expect(m2.lib.entries[0]!.raw).toBe(a) // lo de antes, intacto
  })
  it('hostil: texto vacío, enorme, no JSON, tipos cambiados, __proto__, scripts y números raros', async () => {
    const bad = async (t: unknown) => expect((await parseImport(t as string)).ok).toBe(false)
    await bad('')
    await bad('   ')
    await bad('no es json')
    await bad('[1,2,3]')
    await bad('null')
    await bad(42)
    await bad('{"v":2}')
    await bad('{"formato":"otra","version":1,"canciones":[]}')
    await bad('{"formato":"coderbeats-copia","version":1,"canciones":"x"}')
    await bad('{"v":1,"n":"<script>alert(1)</script>","s":"dnb","k":"808","b":"manual","f":{"filter":2,"space":0,"warmth":0},"g":{}}')
    await bad('{"__proto__":{"polluted":true},"v":1}')
    await bad('{"v":1,"s":"dnb","k":"808","b":"manual","f":{"filter":1e999,"space":0,"warmth":0},"g":{"version":1}}')
    await bad('x'.repeat(20_000_001))
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
  it('el nombre malicioso se limpia y nunca se ejecuta', async () => {
    const o = JSON.parse(songJson(snap(), 'x'))
    o.n = '<img src=x onerror=alert(1)>\n`${process.exit()}`'.padEnd(200, 'a')
    const r = await parseImport(JSON.stringify(o), new Date(), id)
    if (r.ok) expect(r.songs[0]!.name.length).toBeLessThanOrEqual(60)
  })
  it('una copia no pasa de MAX_SONGS canciones', async () => {
    const one = JSON.parse(songJson(snap(), 'x'))
    const r = await parseImport(JSON.stringify({ formato: 'coderbeats-copia', version: 1, canciones: Array.from({ length: MAX_SONGS + 50 }, () => one) }), new Date(), id)
    expect(r.ok && r.songs.length).toBe(MAX_SONGS)
  })
  it('nombre de archivo seguro', () => {
    expect(fileNameOf('Mi canción: ¡G-funk! / 94')).toBe('mi-cancion-g-funk-94.json')
    expect(fileNameOf('///')).toBe('cancion.json')
    expect(fileNameOf('a'.repeat(100)).length).toBeLessThanOrEqual(45)
  })
})
