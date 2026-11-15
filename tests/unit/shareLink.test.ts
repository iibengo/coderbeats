import { describe, expect, it } from 'vitest'
import { demoSong, emptySong, type Song } from '../../app/lib/cells'
import { storableSnapshot, type SongSnapshot } from '../../app/lib/library'
import { REMIXES } from '../../app/lib/remixes'
import { songCode } from '../../app/lib/song'
import { decodeShare, encodeShare, MAX_LINK_CHARS, payloadFromHash, shareUrl } from '../../app/lib/shareLink'

const fx = { filter: 1, space: 0.2, warmth: 0.1 }
const snap = (song: Song, style: SongSnapshot['style'] = 'dnb', kit: SongSnapshot['kit'] = 'electro'): SongSnapshot => ({ style, kit, bgMode: 'manual', fx, song })
const b64 = (o: unknown) => 'j' + Buffer.from(JSON.stringify(o)).toString('base64url')
const EVIL = '"); hush(); //'

describe('compartir por enlace: solo datos (spec 006)', () => {
  it('ida y vuelta: la canción sale idéntica (demos y todos los remixes)', async () => {
    const all: [string, SongSnapshot][] = [['demo dnb', snap(demoSong('dnb')!)], ['demo dembow', snap(demoSong('dembow')!, 'dembow', '808')], ...REMIXES.map((r) => [r.id, snap(r.build(), r.style, r.kit)] as [string, SongSnapshot])]
    for (const [name, s] of all) {
      const link = await encodeShare(s, name)
      const back = (await decodeShare(link))!
      expect(back, name).not.toBeNull()
      expect(back.song).toEqual(storableSnapshot(s).song)
      expect(back.style).toBe(s.style)
      expect(back.kit).toBe(s.kit)
      expect(back.name).toBe(name)
    }
  })
  it('el enlace va comprimido y cabe: la Sinfonía 40 en menos de unos 40 KB de texto', async () => {
    const r = REMIXES.find((x) => x.id.includes('sinfonia'))!
    const link = await encodeShare(snap(r.build(), r.style, r.kit), r.title)
    expect(link.length).toBeLessThan(40_000)
  })
  it('el fragmento de la dirección: solo `#c=` con caracteres seguros', async () => {
    const link = await encodeShare(snap(emptySong()), 'x')
    expect(payloadFromHash(`#c=${link}`)).toBe(link)
    expect(payloadFromHash('#c=')).toBeNull()
    expect(payloadFromHash('#c=a b')).toBeNull()
    expect(payloadFromHash('#otra=1')).toBeNull()
    expect(shareUrl('https://x.test/app#viejo', link)).toBe(`https://x.test/app#c=${link}`)
  })
  it('lo roto no se abre y no tira', async () => {
    for (const bad of ['', 'z', 'zzzz', 'j', 'jAAAA', 'x1234', 'j{no es base64}', 'j' + Buffer.from('{ no json').toString('base64url'), b64(null), b64([]), b64('hola'), b64({ v: 2 }), 'z' + Buffer.from('no deflate').toString('base64url')])
      expect(await decodeShare(bad), bad).toBeNull()
  })
  it('un enlace gigante se rechaza antes de mirarlo', async () => {
    expect(await decodeShare('j' + 'A'.repeat(MAX_LINK_CHARS))).toBeNull()
  })
  it('una bomba de descompresión se corta', async () => {
    const bomb = await (async () => {
      const cs = new CompressionStream('deflate-raw')
      const w = cs.writable.getWriter()
      void w.write(new Uint8Array(20 * 1024 * 1024)).then(() => w.close())
      const parts: Uint8Array[] = []
      const r = cs.readable.getReader()
      for (;;) { const { done, value } = await r.read(); if (done) break; parts.push(value) }
      return Buffer.concat(parts).toString('base64url')
    })()
    expect(await decodeShare('z' + bomb)).toBeNull()
  })
  it('estilo, kit, fondo y efectos desconocidos o fuera de rango no pasan', async () => {
    const base = { v: 1, n: 'x', s: 'dnb', k: 'electro', b: 'manual', f: fx, g: emptySong() }
    expect(await decodeShare(b64(base))).not.toBeNull()
    for (const patch of [{ s: 'hack' }, { s: '__proto__' }, { k: 'nada' }, { b: 'raro' }, { f: { filter: 5, space: 0, warmth: 0 } }, { f: null }, { g: { cells: [] } }, { g: null }])
      expect(await decodeShare(b64({ ...base, ...patch })), JSON.stringify(patch)).toBeNull()
  })
  it('inyección: nombres, ids y números hostiles no llegan al código; el código de lo recibido es el de una canción normal', async () => {
    const s = emptySong()
    s.cells[0]!.name = EVIL
    s.cells[0]!.loops = [{ id: 1, instrument: 'bd', bars: 1, phaseBar: 0, hits: [{ pos: 0, strength: 1 }], muted: false, bornAt: 0, fromTemplate: false }]
    const back = (await decodeShare(b64({ v: 1, n: EVIL + '\n// ' + EVIL, s: 'techno', k: 'electro', b: 'manual', f: fx, g: s })))!
    expect(back).not.toBeNull()
    expect(back.name).not.toContain('\n')
    const code = songCode({ loops: [], style: 'techno', kit: 'electro', background: { mode: 'manual', parts: { bass: false, chords: false } }, metronome: false, fx, cells: { list: back.song.cells, order: back.song.order, window: [] } }, 'display')
    expect(code).not.toContain('hush')
    // números, ids y campos de más
    const evilLoop = { ...s.cells[0]!.loops[0]!, id: EVIL }
    for (const g of [{ ...s, cells: [{ ...s.cells[0]!, loops: [evilLoop] }] }, { ...s, nextCellId: EVIL }, { ...s, cells: [{ ...s.cells[0]!, turns: EVIL }] }, { ...s, version: EVIL }])
      expect(await decodeShare(b64({ v: 1, n: 'x', s: 'techno', k: 'electro', b: 'manual', f: fx, g })), JSON.stringify(g).slice(0, 60)).toBeNull()
  })
  it('un loop de voz hostil (identificador con código) no pasa', async () => {
    const s = emptySong()
    s.cells[0]!.loops = [{ id: 1, instrument: 'voz', bars: 2, phaseBar: 0, hits: [], muted: false, bornAt: 0, fromTemplate: false, voice: { audio: EVIL, bpm: 120, sampleRate: 24000 } } as never]
    expect(await decodeShare(b64({ v: 1, n: 'x', s: 'techno', k: 'electro', b: 'manual', f: fx, g: s }))).toBeNull()
  })
  it('los ids de lo recibido son nuevos (no pisan una guardada)', async () => {
    const link = await encodeShare(snap(emptySong()), 'x')
    const a = (await decodeShare(link))!, c = (await decodeShare(link))!
    expect(a.id).not.toBe(c.id)
  })
})
