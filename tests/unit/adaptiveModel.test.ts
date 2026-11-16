import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AdaptiveClassifier, brightness, findCenters } from '../../app/lib/adaptiveModel'
import { defaultClassifier, PROTOTYPES } from '../../app/lib/defaultModel'
import { extractFeatures } from '../../app/lib/features'
import { detectOnsets } from '../../app/lib/onsets'
import { repeatPattern, sequenceScore } from '../../app/lib/sequenceScore'
import type { FeatureVector, Instrument } from '../../app/lib/types'
import { decodeWav } from '../../app/lib/wav'

/** un micro que quita agudos: todo se corre hacia lo grave (`t` 0 = igual, 0,5 = un escalón entero) */
function tilt(f: FeatureVector, t: number): FeatureVector {
  const b = f.bands
  const bands: FeatureVector['bands'] = [(1 - t) * b[0] + t * b[1], (1 - t) * b[1] + t * b[2], (1 - t) * b[2] + t * b[3], (1 - t) * b[3]]
  return { ...f, centroid: f.centroid * (1 - t * 0.7), zcr: f.zcr * (1 - t * 0.7), bands }
}
const proto = (i: Instrument, jit = 0): FeatureVector => ({ centroid: PROTOTYPES[i].centroid + jit * 0.01, bands: PROTOTYPES[i].bands, mfcc: new Array<number>(13).fill(0), zcr: PROTOTYPES[i].zcr + jit * 0.01, rms: 0.1 })

/** Tu registro real del iPhone sin calibrar (centroide, cruces, graves de cada golpe): lo claramente bombo y lo demás */
const IPHONE: { c: number; z: number; low: number }[] = [
  { c: 0.09, z: 0.08, low: 0.14 }, { c: 0.1, z: 0.08, low: 0.12 }, { c: 0.09, z: 0.07, low: 0.07 }, { c: 0.09, z: 0.08, low: 0.15 }, { c: 0.09, z: 0.08, low: 0.06 },
  { c: 0.05, z: 0.02, low: 0.99 }, { c: 0.05, z: 0.02, low: 0.98 }, { c: 0.05, z: 0.02, low: 0.97 }, { c: 0.07, z: 0.05, low: 0.47 }, { c: 0.05, z: 0.02, low: 0.96 },
  { c: 0.06, z: 0.02, low: 0.99 }, { c: 0.05, z: 0.01, low: 1.0 }, { c: 0.07, z: 0.05, low: 0.58 },
  { c: 0.09, z: 0.09, low: 0.09 }, { c: 0.14, z: 0.1, low: 0.03 }, { c: 0.11, z: 0.09, low: 0.06 }, { c: 0.1, z: 0.08, low: 0.2 }, { c: 0.1, z: 0.09, low: 0.13 },
  { c: 0.1, z: 0.09, low: 0.07 }, { c: 0.1, z: 0.07, low: 0.08 }, { c: 0.11, z: 0.08, low: 0.12 }, { c: 0.12, z: 0.09, low: 0.19 }, { c: 0.11, z: 0.08, low: 0.25 },
  { c: 0.12, z: 0.09, low: 0.06 }, { c: 0.12, z: 0.1, low: 0.09 },
]
const asFeat = (x: { c: number; z: number; low: number }): FeatureVector => ({ centroid: x.c, zcr: x.z, bands: [x.low / 2, x.low / 2, (1 - x.low) * 0.7, (1 - x.low) * 0.3], mfcc: new Array<number>(13).fill(0), rms: 0.1 })

describe('modelo adaptativo (spec 001 §17.8)', () => {
  it('findCenters: dos grupos claros sí; uno solo, ruido continuo o pocos golpes no', () => {
    const c = findCenters([0.09, 0.1, 0.09, 0.1, 0.09, 0.14, 0.15, 0.14, 0.15])!
    expect(c[0]).toBeCloseTo(0.094, 2)
    expect(c[1]).toBeCloseTo(0.145, 2)
    expect(findCenters([0.4, 0.41, 0.42, 0.4, 0.41, 0.42, 0.4, 0.41, 0.42, 0.4])).toBeNull()
    expect(findCenters(Array.from({ length: 24 }, (_, i) => 0.4 + i * 0.02))).toBeNull() // continuo: no hay grupos
    expect(findCenters([0.4, 0.6])).toBeNull()
  })
  it('el bombo se reconoce por sus graves en cualquier micro: laboratorio, iPhone y micros que apagan agudos', () => {
    const a = new AdaptiveClassifier()
    for (const low of [0.47, 0.58, 0.75, 0.99]) expect(a.classify({ ...asFeat({ c: 0.05, z: 0.02, low }) }).instrument, `graves ${low}`).toBe('bd')
    for (const x of IPHONE) expect(a.classify(asFeat(x)).instrument === 'bd', JSON.stringify(x)).toBe(x.low >= 0.42)
  })
  it('con el registro real del iPhone: lo que no es bombo no es bombo (antes, dos de ellos salían bombo)', () => {
    const notBd = IPHONE.filter((x) => x.low < 0.42)
    expect(notBd.length).toBe(IPHONE.length - 8)
    const a = new AdaptiveClassifier()
    expect(notBd.filter((x) => a.classify(asFeat(x)).instrument === 'bd')).toHaveLength(0)
  })
  it('sin haber visto dos grupos, caja o platillo se decide por los prototipos del laboratorio', () => {
    const a = new AdaptiveClassifier()
    expect(a.classify({ ...proto('sd'), bands: [0, 0.05, 0.55, 0.4] }).instrument).toBe('sd')
    expect(a.classify({ ...proto('hh'), bands: [0, 0, 0.01, 0.99] }).instrument).toBe('hh')
  })
  it('con un micro apagado (todo mucho más grave): aprende el orden de caja y platillo tras oír los dos', () => {
    const feat = (c: number, z: number): FeatureVector => ({ centroid: c, zcr: z, bands: [0.02, 0.03, 0.7, 0.25], mfcc: new Array<number>(13).fill(0), rms: 0.1 })
    const a = new AdaptiveClassifier()
    // pff (c 0,09–0,10) y ts (c 0,13–0,15), mezclados como en una frase
    const seq: ['sd' | 'hh', number, number][] = []
    for (let k = 0; k < 10; k++) seq.push(['sd', 0.09 + (k % 3) * 0.005, 0.075], ['hh', 0.14 + (k % 3) * 0.005, 0.1])
    const out = seq.map(([, c, z]) => a.classify(feat(c, z)).instrument)
    const tail = out.slice(10)
    expect(tail.filter((o, k) => o === seq[10 + k]![0]).length / tail.length).toBeGreaterThanOrEqual(0.9)
    expect(a.learned()).not.toBeNull()
  })
  it('los centros aprendidos se pueden guardar y reusar; los absurdos se ignoran', () => {
    const a = new AdaptiveClassifier([0.17, 0.25])
    expect(a.learned()).toEqual([0.17, 0.25])
    expect(a.classify({ ...asFeat({ c: 0.13, z: 0.1, low: 0.05 }) }).instrument).toBe('hh')
    for (const bad of [[0.25, 0.17], [0.3], [0.1, 0.2, 0.3], [Number.NaN, 1], [0, 1], null]) expect(new AdaptiveClassifier(bad as never).learned()).toBeNull()
  })
  it('la claridad sube de caja a platillo', () => {
    expect(brightness(proto('sd'))).toBeLessThan(brightness(proto('hh')))
  })
})

// Con tus tomas del laboratorio («Beatbox solo»: bum pff ts en bucle), tal cual y con el micro simulado más apagado: fijo contra adaptativo.
const take = join(__dirname, '..', 'fixtures', 'voice', 't8-beatbox_pc_141159.wav')
describe.skipIf(!existsSync(take))('con tus tomas: modelo fijo contra adaptativo, con micros simulados', () => {
  it('el adaptativo no empeora el micro del laboratorio y mejora con micros que apagan los agudos', () => {
    const w = decodeWav(readFileSync(take).buffer.slice(0) as ArrayBuffer)!
    const feats = detectOnsets(w.samples, w.sampleRate).map((o) => extractFeatures(w.samples, w.sampleRate, o.time * w.sampleRate))
    const exp = repeatPattern<Instrument>(['bd', 'sd', 'hh'], 10)
    const run = (t: number, adaptive: boolean) => {
      const clf = adaptive ? new AdaptiveClassifier() : defaultClassifier()
      const pred = feats.map((f) => clf.classify(tilt(f, t)).instrument).filter((i): i is Instrument => i !== 'unknown')
      return sequenceScore(pred, exp)
    }
    const rows: string[] = []
    const res: Record<string, { fixed: number; adaptive: number }> = {}
    for (const t of [0, 0.25, 0.5, 0.6]) {
      const f = run(t, false)
      const a = run(t, true)
      res[t] = { fixed: f.precision, adaptive: a.precision }
      rows.push(`micro ×${t}: fijo ${(f.precision * 100).toFixed(0)} %/${(f.coverage * 100).toFixed(0)} % · adaptativo ${(a.precision * 100).toFixed(0)} %/${(a.coverage * 100).toFixed(0)} %`)
    }
    // eslint-disable-next-line no-console
    console.info(`[adaptativo] precisión/cobertura con t8\n${rows.join('\n')}`)
    expect(res[0]!.adaptive).toBeGreaterThanOrEqual(0.6)
    expect(res[0.5]!.adaptive).toBeGreaterThanOrEqual(res[0.5]!.fixed)
  })
})
