import { describe, expect, it } from 'vitest'
import { clampTempo, effectiveBpm, isValidBpm, tempoFromTaps, TEMPO_TAPS } from '../../app/lib/tempo'

/** toques cada `ms` milisegundos */
const taps = (ms: number, n = 4, t0 = 1000) => Array.from({ length: n }, (_, i) => t0 + i * ms)

describe('tempo fácil: cuatro toques', () => {
  it('la media de los 3 intervalos, redondeada a un BPM entero', () => {
    expect(tempoFromTaps(taps(500), 124)).toBe(120)
    expect(tempoFromTaps(taps(480), 124)).toBe(125) // 125 exacto
    // intervalos irregulares: 500, 520, 480 → media 500 → 120
    expect(tempoFromTaps([0, 500, 1020, 1500], 124)).toBe(120)
    // 60000 / 497 = 120,72 → 121
    expect(tempoFromTaps(taps(497), 124)).toBe(121)
  })

  it('faltan toques o no van en orden: nada', () => {
    expect(tempoFromTaps(taps(500, 3), 124)).toBeNull()
    expect(tempoFromTaps([], 124)).toBeNull()
    expect(tempoFromTaps([0, 500, 500, 1500], 124)).toBeNull()
    expect(tempoFromTaps([0, 500, 400, 900], 124)).toBeNull()
    expect(TEMPO_TAPS).toBe(4)
  })

  it('con más de cuatro toques cuentan los cuatro últimos', () => {
    expect(tempoFromTaps([0, 1000, 5000, 5500, 6000, 6500], 124)).toBe(120)
  })

  it('queda dentro de ±25 % del tempo del estilo', () => {
    expect(tempoFromTaps(taps(250), 90)).toBe(113) // 240 bpm → tope 112,5 → 113
    expect(tempoFromTaps(taps(1500), 90)).toBe(68) // 40 bpm → suelo 67,5 → 68
    expect(clampTempo(174, 174)).toBe(174)
    expect(clampTempo(200, 174)).toBe(200) // dentro del rango se respeta
    expect(clampTempo(300, 174)).toBe(218)
    expect(clampTempo(60, 174)).toBe(131)
  })

  it('el tempo efectivo es el de la canción o, si no tiene, el del estilo', () => {
    expect(effectiveBpm(null, 124)).toBe(124)
    expect(effectiveBpm(undefined, 124)).toBe(124)
    expect(effectiveBpm(117, 124)).toBe(117)
  })

  it('valida lo que se lee del almacenamiento', () => {
    expect(isValidBpm(120)).toBe(true)
    for (const v of ['120', NaN, Infinity, 5, 900, null, undefined]) expect(isValidBpm(v)).toBe(false)
  })
})
