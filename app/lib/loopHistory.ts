/**
 * El deshacer de la portada (spec 016 §3): una historia de lo que se ha hecho con los loops (un golpe, una frase entera de la voz, una melodía), para ir atrás y adelante con ↶ ↷.
 * Solo guarda **fotos** del estado (los loops son inmutables, no se copian), y solo cuando algo cambia de verdad (no cuando el motor reescribe el compás de nacimiento). Puro.
 */
import type { FreeLoop, LoopsState } from './freeLoops'

export const HISTORY_MAX = 30

/** Lo que identifica el contenido de los loops (sin `bornAt` ni lo que solo vale mientras suena). */
export function loopsSignature(s: LoopsState): string {
  return JSON.stringify(s.loops.map((l: FreeLoop) => [l.id, l.instrument, l.bars, l.phaseBar, l.muted, l.synth ?? null, l.hits.map((h) => [h.pos, (h as { midi?: number }).midi ?? 0, +(h.strength ?? 0).toFixed(2)])]))
}

export class LoopHistory {
  private past: LoopsState[] = []
  private future: LoopsState[] = []
  private current: LoopsState | null = null
  private sig = ''

  /** El estado cambió (por lo que sea menos por deshacer/rehacer): se guarda lo de antes. Si el contenido es el mismo, no cuenta. */
  record(now: LoopsState): void {
    const sig = loopsSignature(now)
    if (this.current === null) {
      this.current = now
      this.sig = sig
      return
    }
    if (sig === this.sig) {
      this.current = now // mismo contenido, otro objeto: se queda con el último (bornAt al día)
      return
    }
    this.past.push(this.current)
    if (this.past.length > HISTORY_MAX) this.past.shift()
    this.future = []
    this.current = now
    this.sig = sig
  }

  get canUndo(): boolean {
    return this.past.length > 0
  }
  get canRedo(): boolean {
    return this.future.length > 0
  }

  /** Vuelve a lo anterior; devuelve el estado a poner (o null). */
  undo(): LoopsState | null {
    const prev = this.past.pop()
    if (!prev || !this.current) return null
    this.future.push(this.current)
    this.current = prev
    this.sig = loopsSignature(prev)
    return prev
  }

  redo(): LoopsState | null {
    const next = this.future.pop()
    if (!next || !this.current) return null
    this.past.push(this.current)
    this.current = next
    this.sig = loopsSignature(next)
    return next
  }
}
