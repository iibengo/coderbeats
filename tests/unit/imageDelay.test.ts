import { describe, expect, it } from 'vitest'
import {
  AUTO_MIN_MS,
  autoImageDelayMs,
  describeImageDelay,
  FINE_MAX_MS,
  FINE_MIN_MS,
  IMAGE_MAX_MS,
  imageDelayMs,
  restoreImageDelay,
  sanitizeFine,
  takeDue,
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

describe('prueba de sincronía: cuándo se enciende el punto', () => {
  const clicks = [1, 2, 3, 4]

  it('el punto sale cuando el reloj de la imagen (ahora − latencia) alcanza al clic', () => {
    expect(takeDue(clicks, 0.99)).toEqual({ due: 0, rest: clicks })
    expect(takeDue(clicks, 1)).toEqual({ due: 1, rest: [2, 3, 4] })
    expect(takeDue(clicks, 2.4)).toEqual({ due: 2, rest: [3, 4] })
    expect(takeDue([], 5)).toEqual({ due: 0, rest: [] })
  })

  it('con más retraso de imagen el punto llega más tarde; con menos, antes (se nota al mover el deslizador)', () => {
    const now = 2.1 // el audio va por 2,1 s
    // latencia de imagen de 50 ms: ya han vencido los clics de 1 s y de 2 s
    expect(takeDue(clicks, now - 0.05).due).toBe(2)
    // con 300 ms, el de 2 s todavía no: se enciende 250 ms más tarde
    expect(takeDue(clicks, now - 0.3).due).toBe(1)
    expect(takeDue(clicks, now - 0.1).due).toBe(2)
  })

  it('un destello por clic, aunque el reloj salte varios a la vez no se pierde ninguno', () => {
    const r = takeDue(clicks, 3.5)
    expect(r.due).toBe(3)
    expect(r.rest).toEqual([4])
  })
})

describe('línea del diagnóstico: cuánto va retrasada la imagen', () => {
  const base = { auto: true, fineMs: 0, roundTripMs: 0, reportedOutputMs: 18, savedRoundTripMs: null }

  it('el caso del registro: calibración guardada imposible y 185 ms puestos a mano', () => {
    expect(describeImageDelay({ ...base, fineMs: 185, roundTripMs: 0, savedRoundTripMs: -38 })).toBe(
      'imagen retrasada 203 ms = 18 informada + 185 de retraso (automático 0 + ajuste fino +185) · ida y vuelta calibrada 0 ms (la guardada, −38 ms, es imposible y no se usa: repite la calibración)',
    )
  })

  it('con calibración buena y Bluetooth: el automático y el ajuste se suman', () => {
    expect(describeImageDelay({ ...base, roundTripMs: 230, savedRoundTripMs: 230, fineMs: -10 })).toBe(
      'imagen retrasada 190 ms = 18 informada + 172 de retraso (automático 182 + ajuste fino −10) · ida y vuelta calibrada 230 ms',
    )
  })

  it('sin calibrar y sin ajuste (el PC): solo lo que informa el navegador', () => {
    expect(describeImageDelay({ ...base, reportedOutputMs: 20 })).toBe(
      'imagen retrasada 20 ms = 20 informada + 0 de retraso (automático 0 + ajuste fino 0) · sin calibrar',
    )
  })

  it('con el automático apagado lo dice y no lo cuenta', () => {
    expect(describeImageDelay({ ...base, auto: false, fineMs: 120, roundTripMs: 230, savedRoundTripMs: 230 })).toBe(
      'imagen retrasada 138 ms = 18 informada + 120 de retraso (automático apagado + ajuste fino +120) · ida y vuelta calibrada 230 ms',
    )
  })
})
