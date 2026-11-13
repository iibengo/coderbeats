import { describe, expect, it } from 'vitest'
import {
  AUTO_MIN_MS,
  autoImageDelayMs,
  FINE_MAX_MS,
  FINE_MIN_MS,
  IMAGE_MAX_MS,
  imageDelayMs,
  restoreImageDelay,
  sanitizeFine,
} from '../../app/lib/imageDelay'

describe('retraso automático (de la calibración de palmadas)', () => {
  it('con cascos Bluetooth: ida y vuelta de ~230 ms y salida informada de 18 ms → unos 180 ms', () => {
    expect(autoImageDelayMs(230, 18)).toBe(182)
    expect(autoImageDelayMs(250, 18)).toBe(202)
  })

  it('en el PC o con altavoces (la ida y vuelta casi se explica sola) no corrige nada', () => {
    expect(autoImageDelayMs(60, 20)).toBe(0)
    expect(autoImageDelayMs(90, 25)).toBe(0)
    expect(autoImageDelayMs(95, 20)).toBe(45) // ya sobra más de lo que da la medida
    expect(autoImageDelayMs(85, 20)).toBe(0)
  })

  it('el margen mínimo separa la imprecisión de un Bluetooth', () => {
    const rt = 30 + 18 + AUTO_MIN_MS
    expect(autoImageDelayMs(rt, 18)).toBe(AUTO_MIN_MS)
    expect(autoImageDelayMs(rt - 1, 18)).toBe(0)
  })

  it('sin calibración, o con datos raros, nada', () => {
    expect(autoImageDelayMs(0, 18)).toBe(0)
    expect(autoImageDelayMs(-5, 18)).toBe(0)
    expect(autoImageDelayMs(NaN, 18)).toBe(0)
  })

  it('una salida informada negativa no suma de más', () => {
    expect(autoImageDelayMs(230, -50)).toBe(autoImageDelayMs(230, 0))
  })
})

describe('ajuste fino guardado', () => {
  it('se limpia: entero, múltiplo de 5 y dentro del rango; lo roto es 0', () => {
    expect(sanitizeFine(40)).toBe(40)
    expect(sanitizeFine(42)).toBe(40)
    expect(sanitizeFine(43)).toBe(45)
    expect(sanitizeFine(1000)).toBe(FINE_MAX_MS)
    expect(sanitizeFine(-1000)).toBe(FINE_MIN_MS)
    for (const v of ['20', NaN, Infinity, null, undefined, {}]) expect(sanitizeFine(v)).toBe(0)
  })
})

describe('retraso de imagen total', () => {
  const bt = { roundTripMs: 230, reportedOutputMs: 18 }

  it('automático + ajuste fino', () => {
    expect(imageDelayMs({ auto: true, fineMs: 0, ...bt })).toBe(182)
    expect(imageDelayMs({ auto: true, fineMs: 20, ...bt })).toBe(202)
    expect(imageDelayMs({ auto: true, fineMs: -30, ...bt })).toBe(152)
  })

  it('sin automático, solo lo que pongas a mano (nunca negativo)', () => {
    expect(imageDelayMs({ auto: false, fineMs: 120, ...bt })).toBe(120)
    expect(imageDelayMs({ auto: false, fineMs: -50, ...bt })).toBe(0)
    expect(imageDelayMs({ auto: false, fineMs: 0, ...bt })).toBe(0)
  })

  it('en el PC (sin Bluetooth) no cambia nada con todo por defecto', () => {
    expect(imageDelayMs({ auto: true, fineMs: 0, roundTripMs: 60, reportedOutputMs: 20 })).toBe(0)
    expect(imageDelayMs({ auto: true, fineMs: 0, roundTripMs: 0, reportedOutputMs: 0 })).toBe(0)
  })

  it('no pasa de 500 ms y un ajuste roto no rompe el cálculo', () => {
    expect(imageDelayMs({ auto: true, fineMs: FINE_MAX_MS, roundTripMs: 900, reportedOutputMs: 18 })).toBe(IMAGE_MAX_MS)
    expect(imageDelayMs({ auto: true, fineMs: NaN, ...bt })).toBe(182)
  })
})

describe('lo guardado por dispositivo', () => {
  it('recupera lo guardado', () => {
    expect(restoreImageDelay({ imageAuto: false, imageFineMs: 120 })).toEqual({ auto: false, fineMs: 120 })
    expect(restoreImageDelay({ imageAuto: true, imageFineMs: -40 })).toEqual({ auto: true, fineMs: -40 })
  })
  it('sin nada guardado (antes de E6) o con valores rotos: automático y sin ajuste', () => {
    expect(restoreImageDelay({})).toEqual({ auto: true, fineMs: 0 })
    expect(restoreImageDelay({ imageAuto: 'no', imageFineMs: 'mucho' })).toEqual({ auto: true, fineMs: 0 })
    expect(restoreImageDelay({ imageAuto: undefined, imageFineMs: 99999 })).toEqual({ auto: true, fineMs: 300 })
  })
})
