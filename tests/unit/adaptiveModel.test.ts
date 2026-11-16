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

describe('modelo adaptativo (spec 001 §17.8)', () => {
  it('findCenters: tres grupos claros sí; uno solo, dos o ruido continuo no', () => {
    const three = [0.4, 0.42, 0.41, 0.4, 0.62, 0.64, 0.63, 0.6, 0.95, 0.97, 0.99, 0.96]
    const c = findCenters(three)!
    expect(c[0]).toBeCloseTo(0.407, 2)
    expect(c[2]).toBeCloseTo(0.968, 2)
    expect(findCenters([0.4, 0.41, 0.42, 0.4, 0.41, 0.42, 0.4, 0.41, 0.42, 0.4])).toBeNull()
    expect(findCenters([0.4, 0.41, 0.42, 0.4, 0.9, 0.91, 0.92, 0.9, 0.91, 0.9])).toBeNull()
    expect(findCenters(Array.from({ length: 24 }, (_, i) => 0.4 + i * 0.02))).toBeNull() // continuo: no hay grupos
    expect(findCenters([0.4, 0.6])).toBeNull()
  })
  it('sin haber visto las tres clases se comporta como el modelo por defecto', () => {
    const a = new AdaptiveClassifier()
    const d = defaultClassifier()
    for (const i of ['bd', 'sd', 'hh', 'bd'] as const) expect(a.classify(proto(i)).instrument).toBe(d.classify(proto(i)).instrument)
  })
  it('con un micro que apaga los agudos, aprende el orden: tras oír bum · ts · pff, el platillo es platillo', () => {
    const t = 0.55
    const seq: Instrument[] = [...Array(5).fill('bd'), ...Array(5).fill('hh'), ...Array(5).fill('sd'), ...Array(5).fill('hh'), ...Array(5).fill('sd'), ...Array(5).fill('bd')]
    const a = new AdaptiveClassifier()
    const out = seq.map((i, k) => a.classify(tilt(proto(i, (k % 3) - 1), t)).instrument)
    // lo primero (antes de ver tres grupos) puede fallar; al final, todo bien
    const tail = out.slice(15)
    const tailOk = tail.filter((o, k) => o === seq[15 + k]).length / tail.length
    expect(tailOk).toBeGreaterThanOrEqual(0.9)
    expect(a.learned()).not.toBeNull()
    // y sin adaptarse, el modelo fijo falla con ese micro
    const d = defaultClassifier()
    const fixedOk = seq.slice(15).filter((i, k) => d.classify(tilt(proto(i, (k % 3) - 1), t)).instrument === i).length / tail.length
    expect(tailOk).toBeGreaterThan(fixedOk)
  })
  it('los centros aprendidos se pueden guardar y reusar; los absurdos se ignoran', () => {
    const a = new AdaptiveClassifier([0.3, 0.5, 0.9])
    expect(a.learned()).toEqual([0.3, 0.5, 0.9])
    expect(a.classify(proto('hh')).instrument).toBe('hh')
    for (const bad of [[0.5, 0.3, 0.9], [0.3, 0.5], [Number.NaN, 1, 2], null]) expect(new AdaptiveClassifier(bad as never).learned()).toBeNull()
  })
  it('la claridad sube de bum a pff a ts', () => {
    expect(brightness(proto('bd'))).toBeLessThan(brightness(proto('sd')))
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
    for (const t of [0, 0.25, 0.5, 0.7]) {
      const f = run(t, false)
      const a = run(t, true)
      res[t] = { fixed: f.precision, adaptive: a.precision }
      rows.push(`micro ×${t}: fijo ${(f.precision * 100).toFixed(0)} %/${(f.coverage * 100).toFixed(0)} % · adaptativo ${(a.precision * 100).toFixed(0)} %/${(a.coverage * 100).toFixed(0)} %`)
    }
    // eslint-disable-next-line no-console
    console.info(`[adaptativo] precisión/cobertura con t8\n${rows.join('\n')}`)
    expect(res[0]!.adaptive).toBeGreaterThanOrEqual(0.6)
    expect(res[0.5]!.adaptive).toBeGreaterThan(res[0.5]!.fixed)
  })
})
