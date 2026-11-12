// Tipos mínimos de @strudel/web 1.3.0 (el paquete no publica tipos).
// Solo la superficie verificada en el spike A3.0 (§16.12 de la spec).
declare module '@strudel/web' {
  export function initStrudel(options?: { prebake?: () => Promise<void> | void }): Promise<unknown>
  /** Evalúa código Strudel (transpilado) y lo pone a sonar si `autoplay`. */
  export function evaluate(code: string, autoplay?: boolean): Promise<unknown>
  export function hush(): void
  /** Carga los AudioWorklets de superdough (djf, shape…). Strudel solo lo hace en el primer mousedown. */
  export function initAudio(options?: { maxPolyphony?: number }): Promise<void>
  export function setAudioContext(ctx: AudioContext): AudioContext
  export function getAudioContext(): AudioContext
  export function getSuperdoughAudioController(): {
    output: {
      /** nodo maestro de superdough → destination (sobrevive a hush/play) */
      destinationGain: GainNode
    }
  }
}
