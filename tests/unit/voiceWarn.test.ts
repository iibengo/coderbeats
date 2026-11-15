import { describe, expect, it } from 'vitest'
import { BLUETOOTH_ROUNDTRIP_MS, bluetoothWarning } from '../../app/lib/voiceWarn'

describe('aviso de Bluetooth para la voz', () => {
  it('con cable (ida y vuelta corta) no avisa', () => {
    expect(bluetoothWarning(30)).toBeNull()
    expect(bluetoothWarning(BLUETOOTH_ROUNDTRIP_MS)).toBeNull()
  })
  it('con retraso grande avisa con la cifra', () => {
    expect(bluetoothWarning(240)).toMatch(/240 ms/)
  })
  it('un valor no válido no avisa', () => {
    expect(bluetoothWarning(Number.NaN)).toBeNull()
  })
})
