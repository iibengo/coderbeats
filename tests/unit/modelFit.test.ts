import { describe, expect, it } from 'vitest'
import { BLUETOOTH_LATENCY_MS, DEFAULT_LATENCY_MS, fallbackLatencyMs, looksBluetooth } from '../../app/lib/defaultLatency'
import { FIT_MIN, FIT_POOR, FitMonitor, MIX_MIN, MixMonitor } from '../../app/lib/modelFit'

describe('FitMonitor: ¿acierta poco el modelo por defecto?', () => {
  it('no opina con pocos golpes', () => {
    const m = new FitMonitor()
    for (let i = 0; i < FIT_MIN - 1; i++) m.push(5)
    expect(m.poor()).toBe(false)
    expect(m.median()).toBeNull()
  })
  it('beatbox normal (fit ~0,1) no lo salta; voz que no encaja (fit ~1) sí', () => {
    const ok = new FitMonitor()
    for (let i = 0; i < 20; i++) ok.push(0.1 + (i % 3) * 0.05)
    expect(ok.poor()).toBe(false)
    const bad = new FitMonitor()
    for (let i = 0; i < 12; i++) bad.push(1.1)
    expect(bad.poor()).toBe(true)
  })
  it('un par de golpes raros no basta (mediana); los desconocidos cuentan como muy lejos', () => {
    const m = new FitMonitor()
    for (let i = 0; i < 10; i++) m.push(0.1)
    m.push(3)
    m.push(3)
    expect(m.poor()).toBe(false)
    const u = new FitMonitor()
    for (let i = 0; i < 10; i++) u.push(null)
    expect(u.poor()).toBe(true)
    u.reset()
    expect(u.median()).toBeNull()
    expect(FIT_POOR).toBeGreaterThan(0.1)
  })
  it('se queda con los últimos golpes: si mejora, deja de ser «poco»', () => {
    const m = new FitMonitor()
    for (let i = 0; i < 12; i++) m.push(1)
    expect(m.poor()).toBe(true)
    for (let i = 0; i < 12; i++) m.push(0.1)
    expect(m.poor()).toBe(false)
  })
})

describe('latencia por defecto (spec 001)', () => {
  it('la medida manda; sin medir, una razonable; con Bluetooth, una mayor', () => {
    expect(fallbackLatencyMs(42)).toBe(42)
    expect(fallbackLatencyMs(null)).toBe(DEFAULT_LATENCY_MS)
    expect(fallbackLatencyMs(0)).toBe(DEFAULT_LATENCY_MS)
    expect(fallbackLatencyMs(-30)).toBe(DEFAULT_LATENCY_MS)
    expect(fallbackLatencyMs(undefined, { outputLabels: ['AirPods de Ion'] })).toBe(BLUETOOTH_LATENCY_MS)
    expect(fallbackLatencyMs(null, { reportedOutputMs: 200 })).toBe(BLUETOOTH_LATENCY_MS)
    expect(fallbackLatencyMs(null, { outputLabels: ['Altavoces integrados'], reportedOutputMs: 20 })).toBe(DEFAULT_LATENCY_MS)
    expect(BLUETOOTH_LATENCY_MS).toBeGreaterThan(DEFAULT_LATENCY_MS)
  })
  it('reconoce nombres de salida Bluetooth y no confunde los de cable', () => {
    for (const l of ['Bluetooth Headset', 'WH-1000XM4', 'Galaxy Buds2', 'JBL Wireless']) expect(looksBluetooth([l]), l).toBe(true)
    for (const l of ['Altavoces', 'Auriculares con cable', 'Built-in Output', '']) expect(looksBluetooth([l]), l).toBe(false)
    expect(looksBluetooth([])).toBe(false)
  })
})

describe('MixMonitor: todo lo que no es bombo sale como caja', () => {
  it('no opina con pocos golpes; con 10 cajas seguidas sí; un platillo lo desmiente; bombos y desconocidos no cuentan', () => {
    const m = new MixMonitor()
    for (let i = 0; i < MIX_MIN - 1; i++) m.push('sd')
    expect(m.allSnare()).toBe(false)
    m.push('bd')
    m.push('unknown')
    expect(m.allSnare()).toBe(false)
    m.push('sd')
    expect(m.allSnare()).toBe(true)
    m.push('hh')
    expect(m.allSnare()).toBe(false)
    for (let i = 0; i < MIX_MIN; i++) m.push('sd') // el platillo sale de la ventana
    expect(m.allSnare()).toBe(true)
    m.reset()
    expect(m.allSnare()).toBe(false)
  })
})
