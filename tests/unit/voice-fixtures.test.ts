// Tus tomas del laboratorio (spec 002, §9.3): mide la precisión con lo que grabaste. Se salta si no hay tomas
// locales (tests/fixtures/voice/ está en .gitignore). En la fase 0 solo informa; los umbrales de fallo se
// ponen con tus datos en la fase 1.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { segmentNotes, toneGate } from '../../app/lib/notes'
import { parseExpected, scoreNotes } from '../../app/lib/noteScore'
import { detectOnsets } from '../../app/lib/onsets'
import { trackPitch } from '../../app/lib/pitch'
import { decodeWav } from '../../app/lib/wav'

const DIR = join(__dirname, '..', 'fixtures', 'voice')
const names = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)) : []
const STEP = 60 / 90 / 4

describe.skipIf(!names.length)('tomas de voz locales', () => {
  for (const name of names) {
    it(`${name}`, () => {
      const meta = JSON.parse(readFileSync(join(DIR, `${name}.json`), 'utf8')) as { expected?: string; takeId?: number }
      const w = decodeWav(readFileSync(join(DIR, `${name}.wav`)).buffer.slice(0) as ArrayBuffer)
      expect(w).not.toBeNull()
      const { samples, sampleRate } = w!
      const track = trackPitch(samples, sampleRate)
      const onsets = detectOnsets(samples, sampleRate).map((o) => o.time)
      const notes = segmentNotes(track, onsets)
      const passes = onsets.filter((t) => toneGate(track, t).pass).length
      const exp = parseExpected(meta.expected ?? '') ?? []
      const s = exp.length ? scoreNotes(exp, notes, STEP, 0) : null
      const f = (v: number | null | undefined) => (v == null ? '—' : `${Math.round(v * 100)} %`)
      console.info(
        `[voz] ${name}: onsets ${onsets.length}, pasan la puerta ${passes}, notas ${notes.length}` +
          (s ? ` · clase ${f(s.pitchClassRate)} · exacta ${f(s.exactRate)} · inicio ${f(s.startRate)}` : ''),
      )
    })
  }
})
