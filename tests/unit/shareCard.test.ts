import { describe, expect, it } from 'vitest'
import { LAB_REMIXES } from '../../app/lib/labRemixes'
import { MAX_LINK_CHARS, encodeShare } from '../../app/lib/shareLink'
import { MAX_BY, cardMeta, hasVoiceLoops, cardHash, cardUrl, cleanBy, parseCardHash, resolveCard } from '../../app/lib/shareCard'
import { STYLES } from '../../app/lib/constants'
import { songFromLoops } from '../../app/lib/cells'

const fx = { filter: 1, space: 0.3, warmth: 0 }
const snapOf = (r: (typeof LAB_REMIXES)[number]) => ({ style: r.style, kit: r.kit, bgMode: 'manual' as const, fx, song: r.song })
const ch = (...codes: number[]) => String.fromCharCode(...codes)

describe('enlace de la tarjeta (spec 061)', () => {
  it('ida y vuelta de un remix de la app, con y sin firma', () => {
    expect(parseCardHash(cardHash({ kind: 'r', id: 'lacrimosa-drill' }))).toEqual({ kind: 'r', id: 'lacrimosa-drill' })
    expect(parseCardHash(cardHash({ kind: 'r', id: 'lacrimosa-drill', by: 'Ion' }))).toEqual({ kind: 'r', id: 'lacrimosa-drill', by: 'Ion' })
    expect(cardHash({ kind: 'r', id: 'wow-techno-2' })).toBe('#r=wow-techno-2')
    expect(cardUrl('https://coderbeats.vercel.app/', { kind: 'r', id: 'wow-techno-2' })).toBe('https://coderbeats.vercel.app/s#r=wow-techno-2')
  })

  it('todos los ids de los remixes de la app valen como enlace corto', () => {
    for (const r of LAB_REMIXES) expect(parseCardHash(`#r=${r.id}`), r.id).toEqual({ kind: 'r', id: r.id })
  })

  it('ida y vuelta de una canción propia: los mismos datos, con el mismo canal de siempre', async () => {
    const r = LAB_REMIXES.find((x) => x.id === 'korobeiniki-techno')!
    const payload = await encodeShare(snapOf(r), 'Mi canción')
    const ref = parseCardHash(cardHash({ kind: 'c', payload, by: 'Ana' }))
    expect(ref).toEqual({ kind: 'c', payload, by: 'Ana' })
    const card = await resolveCard(ref!)
    expect(card?.title).toBe('Mi canción')
    expect(card?.by).toBe('Ana')
    expect(card?.style).toBe(r.style)
    expect(card?.song.cells.length).toBe(r.song.cells.length)
    expect(card?.bpm).toBe(r.song.bpm ?? STYLES[r.style].bpm)
  })

  it('un remix de la app se resuelve por su id: título, compositor y tempo', async () => {
    const card = await resolveCard({ kind: 'r', id: 'lacrimosa-drill' })
    expect(card?.remixId).toBe('lacrimosa-drill')
    expect(card?.composer).toBeTruthy()
    expect(card?.by).toBeUndefined() // sin firma, sin autor: nada de «anónimo»
    expect(await resolveCard({ kind: 'r', id: 'no-existe' })).toBeNull()
  })

  it('TAMAÑO: la canción más grande que tenemos, comprimida, cabe de sobra en un enlace corto (< 8 KB)', async () => {
    let worst = { id: '', chars: 0 }
    for (const r of LAB_REMIXES) {
      const payload = await encodeShare(snapOf(r), r.title)
      const url = cardUrl('https://coderbeats.vercel.app', { kind: 'c', payload, by: 'Una firma de 24 caracteres' })
      if (url.length > worst.chars) worst = { id: r.id, chars: url.length }
    }
    console.log(`el enlace más largo: ${worst.id}, ${worst.chars} caracteres`)
    expect(worst.chars).toBeLessThan(8_000)
  })

  it('la firma: se limpia, se corta a 24 caracteres enteros y vacía no es «anónimo»', () => {
    expect(cleanBy('')).toBeUndefined()
    expect(cleanBy('   ')).toBeUndefined()
    expect(cleanBy(undefined)).toBeUndefined()
    expect(cleanBy('  Ion   Lancer ')).toBe('Ion Lancer')
    expect(Array.from(cleanBy('a'.repeat(100))!).length).toBe(MAX_BY)
    expect(Array.from(cleanBy('🎧'.repeat(40))!).length).toBe(MAX_BY) // ningún emoji partido por la mitad
    expect(cleanBy(`Ion${ch(0x202e)}${ch(0x200b)}${ch(0)}x`)).toBe('Ion x')
    expect(parseCardHash('#r=lacrimosa-drill&f=')).toEqual({ kind: 'r', id: 'lacrimosa-drill' })
  })

  it('un enlace roto o hostil da null, y la firma nunca es código', () => {
    const malos = [
      '', '#', '#r=', '#c=', '#x=abc', '#r=Lacrimosa', '#r=../etc/passwd', '#r=a b', '#r=a&f=1&g=2', '#r=a?x=1', 'r=a', '#R=a',
      `#r=${'a'.repeat(49)}`, '#r=-malo', '#c=abc def', '#c=<script>', `#c=${'A'.repeat(MAX_LINK_CHARS + 1)}`, '#r=ok&f=%E0%A4%A',
    ]
    for (const h of malos) expect(parseCardHash(h), h).toBeNull()
    const f = parseCardHash('#r=lacrimosa-drill&f=' + encodeURIComponent('<img src=x onerror=alert(1)>'))
    expect(f && 'by' in f ? f.by : '').toBe('<img src=x onerror=alert(1)>'.slice(0, MAX_BY)) // es texto: se pinta como texto, nunca como HTML
  })

  it('datos que no son una canción dan null al resolver (nunca se evalúa nada)', async () => {
    expect(await resolveCard({ kind: 'c', payload: 'zAAAA' })).toBeNull()
    expect(await resolveCard({ kind: 'c', payload: 'jeyJ2IjoxfQ' })).toBeNull()
    expect(await resolveCard({ kind: 'c', payload: 'j' + 'A'.repeat(50) })).toBeNull()
  })

  it('la línea en mono sin firma es «estilo · bpm», sin separador suelto delante', () => {
    expect(cardMeta({ style: 'techno2' }, '132 bpm')).toBe('techno · 132 bpm')
    expect(cardMeta({ style: 'techno2', by: '' }, '132 bpm')).toBe('techno · 132 bpm')
    expect(cardMeta({ style: 'techno2', by: 'Ionias' }, '132 bpm')).toBe('Ionias · techno · 132 bpm')
    expect(cardMeta({ style: 'techno2' }, '132 bpm').startsWith(' ')).toBe(false)
    expect(cardMeta({ style: 'techno2' }, '132 bpm').startsWith('·')).toBe(false)
  })

  it('avisa de las grabaciones de voz como audio, que no viajan en el enlace', () => {
    const base = { id: 1, instrument: 'bd', bars: 1, phaseBar: 0, muted: false, bornAt: 0, fromTemplate: false, hits: [{ pos: 0, strength: 1 }] }
    const sin = songFromLoops({ nextId: 2, loops: [base] as never })
    const con = songFromLoops({ nextId: 3, loops: [base, { ...base, id: 2, instrument: 'voice', hits: [], voice: { audio: 'v-abc', bpm: 120, sampleRate: 48000 } }] as never })
    expect(hasVoiceLoops(sin)).toBe(false)
    expect(hasVoiceLoops(con)).toBe(true)
    for (const r of LAB_REMIXES) expect(hasVoiceLoops(r.song), r.id).toBe(false) // los remixes de la app no llevan
  })
})
