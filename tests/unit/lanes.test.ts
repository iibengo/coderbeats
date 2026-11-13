import { describe, expect, it } from 'vitest'
import { allArmed, allLanes, decideLane, toggleLane } from '../../app/lib/lanes'

describe('carriles (spec 003, E4.1)', () => {
  it('por defecto, todos encendidos', () => {
    expect(allArmed(allLanes())).toBe(true)
  })
  it('mantener un carril lo apaga y otra vez lo enciende; se pueden apagar todos', () => {
    let l = toggleLane(allLanes(), 'bd')
    expect(l.has('bd')).toBe(false)
    expect(allArmed(l)).toBe(false)
    l = toggleLane(l, 'bd')
    expect(allArmed(l)).toBe(true)
    l = toggleLane(toggleLane(toggleLane(l, 'bd'), 'sd'), 'hh')
    expect(l.size).toBe(0)
  })
  it('no cambia el conjunto de entrada', () => {
    const a = allLanes()
    toggleLane(a, 'hh')
    expect(a.size).toBe(3)
  })
})

describe('decideLane: un sonido de un carril apagado se ignora, no se reasigna (E4.2)', () => {
  const onlySd = new Set(['sd'] as const)
  it('gana uno encendido: entra', () => {
    expect(decideLane('sd', { sd: 0.7, hh: 0.3 }, onlySd)).toEqual({ kind: 'take', instrument: 'sd', confidence: 0.7 })
  })
  it('gana uno apagado con claridad: se ignora (un "ts" con el platillo apagado no va a la caja)', () => {
    expect(decideLane('hh', { hh: 1 }, onlySd)).toEqual({ kind: 'ignore', instrument: 'hh', confidence: 1 })
    expect(decideLane('hh', { hh: 0.67, sd: 0.33 }, onlySd).kind).toBe('ignore')
  })
  it('con caja y platillo apagados, un "ts" no va al bombo', () => {
    expect(decideLane('hh', { hh: 0.8, bd: 0.2 }, new Set(['bd'] as const)).kind).toBe('ignore')
  })
  it('si duda entre el apagado y uno encendido (margen pequeño), va al encendido', () => {
    expect(decideLane('hh', { hh: 0.55, sd: 0.45 }, onlySd)).toEqual({ kind: 'take', instrument: 'sd', confidence: 0.45 })
  })
  it('un encendido sin voto no cuenta como duda', () => {
    expect(decideLane('hh', { hh: 0.55, bd: 0.45 }, onlySd).kind).toBe('ignore')
  })
  it('con todos apagados, todo se ignora', () => {
    expect(decideLane('bd', { bd: 0.5, sd: 0.5 }, new Set()).kind).toBe('ignore')
  })
})
