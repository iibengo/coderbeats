/** Aviso de la voz con cascos Bluetooth (spec 007 §5.2): la ida y vuelta calibrada es grande y variable, y la voz queda desalineada del compás. */
export const BLUETOOTH_ROUNDTRIP_MS = 120

/** El aviso, o `null` si la ida y vuelta es corta (con cable). Se puede grabar igualmente. */
export function bluetoothWarning(roundTripMs: number): string | null {
  return Number.isFinite(roundTripMs) && roundTripMs > BLUETOOTH_ROUNDTRIP_MS
    ? `Tu ida y vuelta de audio es de ${Math.round(roundTripMs)} ms (¿cascos Bluetooth?): la voz puede quedar desalineada. Con cable cae en el compás.`
    : null
}
