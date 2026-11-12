export interface EchoGateOptions {
  /** latencia de ida y vuelta del sistema (salida → micro), en segundos */
  roundTrip: number
  /** RMS con el que llega el eco de un clic al micro */
  echoLevel: number
  /** ventana alrededor de la llegada esperada del eco, en segundos */
  window: number
  /** un golpe que supera el eco en estos dB se acepta aunque coincida */
  marginDb: number
}

export const DEFAULT_ECHO_GATE: Omit<EchoGateOptions, 'roundTrip' | 'echoLevel'> = {
  window: 0.025,
  marginDb: 10,
}

/**
 * Descarta onsets que son el eco de algo que la propia app ha sonado (clic o sample).
 * Los tiempos están en la escala del AudioContext.
 */
export class EchoGate {
  private events: number[] = []
  readonly o: EchoGateOptions

  constructor(options: Pick<EchoGateOptions, 'roundTrip' | 'echoLevel'> & Partial<EchoGateOptions>) {
    this.o = { ...DEFAULT_ECHO_GATE, ...options }
  }

  /** Registra que la app sonará algo en el tiempo `time`. */
  addOutput(time: number) {
    this.events.push(time)
  }

  /** Olvida eventos anteriores a `time` (para no crecer sin límite). */
  prune(time: number) {
    const limit = time - this.o.roundTrip - 1
    this.events = this.events.filter((t) => t >= limit)
  }

  isEcho(onsetTime: number, strength: number): boolean {
    if (strength > this.o.echoLevel * 10 ** (this.o.marginDb / 20)) return false
    return this.events.some((t) => Math.abs(onsetTime - (t + this.o.roundTrip)) <= this.o.window)
  }
}

export interface EchoTestResult {
  /** el micro oye la salida */
  bleed: boolean
  roundTrip: number
  echoLevel: number
  matched: number
}

/**
 * Prueba de eco: dados los tiempos de los clics emitidos y los onsets oídos (misma escala),
 * decide si hay fuga y mide la latencia pura del sistema (mediana) y el nivel del eco.
 */
export function analyzeEchoTest(clickTimes: number[], onsets: { time: number; strength: number }[]): EchoTestResult {
  const delays: number[] = []
  const levels: number[] = []
  for (const c of clickTimes) {
    const hit = onsets.find((o) => o.time - c >= 0 && o.time - c <= 0.3)
    if (hit) {
      delays.push(hit.time - c)
      levels.push(hit.strength)
    }
  }
  const med = (v: number[]) => {
    const s = [...v].sort((a, b) => a - b)
    return s.length ? s[s.length >> 1]! : 0
  }
  return {
    bleed: clickTimes.length > 0 && delays.length >= Math.ceil(clickTimes.length / 2),
    roundTrip: med(delays),
    echoLevel: med(levels),
    matched: delays.length,
  }
}
