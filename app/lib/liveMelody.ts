/**
 * Melodía en vivo (spec 002, §4): altura en continuo y registro de notas. Puro (sin worker ni DOM): el worker de
 * análisis le pasa el audio del micro y le pregunta. "Notas primero" (§4.3): se siguen las notas de la voz y un
 * onset de batería es melodía si cae dentro de una.
 */
import { FLOOR_CAP, lowPercentile, melodicOnsets, segmentNotes, type Note, type NoteOptions } from './notes'
import { DEFAULT_PITCH_OPTIONS, medianTrack, YinEstimator, type PitchTrack } from './pitch'

/** Cuánto hay que esperar tras un onset para saber si es melodía (s): consonante + 0,1 s de nota. */
export const MELODY_DECISION_SEC = 0.35
/** Margen (s) por delante del inicio de una nota en el que un onset cuenta como su ataque. */
export const ONSET_LEAD_SEC = 0.2

const WINDOW_SEC = 3
const KEEP_SEC = 20
const SCAN_EVERY_SEC = 0.05
/**
 * Una nota se avisa en cuanto existe (≥ 0,1 s). Alguna avisada será un fragmento de entrada que luego se absorbe: solo
 * cuenta como actividad de la frase; lo que se usa al nacer el loop es el registro final (`notesBetween`).
 */
const ANNOUNCE_AFTER_SEC = 0.1

export type LiveNote = Note

export class LiveMelody {
  private readonly yin: YinEstimator
  private readonly frame = DEFAULT_PITCH_OPTIONS.frame
  private readonly hop = DEFAULT_PITCH_OPTIONS.hop
  private buf = new Float32Array(1 << 16)
  private bufStart = 0
  private len = 0
  private nextStart = 0
  private started = false

  private times: number[] = []
  private midi: number[] = []
  private prob: number[] = []
  private rms: number[] = []
  private onsets: number[] = []
  private log: LiveNote[] = []
  /** inicios de las notas ya avisadas (para avisar una sola vez, aunque la nota se rehaga al llegar más audio) */
  private announced: number[] = []
  private lastScan = -Infinity

  constructor(
    readonly sampleRate: number,
    private readonly noteOptions: Partial<NoteOptions> = {},
  ) {
    this.yin = new YinEstimator(sampleRate, DEFAULT_PITCH_OPTIONS)
  }

  /** Último instante (s) con altura calculada. */
  get time(): number {
    return this.times.length ? this.times[this.times.length - 1]! : 0
  }

  /** Audio del micro: `frame` es el índice absoluto de la primera muestra (como el contexto de audio). */
  push(frame: number, data: Float32Array): void {
    if (!this.started) {
      this.started = true
      this.bufStart = frame
      this.nextStart = frame
      this.len = 0
    }
    // hueco en el stream (no debería pasar): se rellena con silencio para no desalinear los tiempos
    const end = this.bufStart + this.len
    if (frame > end) this.append(new Float32Array(Math.min(frame - end, this.sampleRate)))
    this.append(data)
    while (this.nextStart + this.frame <= this.bufStart + this.len) {
      const r = this.yin.estimate(this.buf, this.nextStart - this.bufStart)
      this.times.push((this.nextStart + this.frame / 2) / this.sampleRate)
      this.midi.push(r.midi)
      this.prob.push(r.prob)
      this.rms.push(r.rms)
      this.nextStart += this.hop
    }
    // se tira lo ya analizado
    const used = this.nextStart - this.bufStart
    if (used > 1 << 14) {
      this.buf.copyWithin(0, used, this.len)
      this.len -= used
      this.bufStart = this.nextStart
    }
    this.trim()
  }

  private append(d: Float32Array) {
    if (this.len + d.length > this.buf.length) {
      const bigger = new Float32Array(Math.max(this.buf.length * 2, this.len + d.length))
      bigger.set(this.buf.subarray(0, this.len))
      this.buf = bigger
    }
    this.buf.set(d, this.len)
    this.len += d.length
  }

  private trim() {
    const cut = this.time - KEEP_SEC
    let k = 0
    while (k < this.times.length && this.times[k]! < cut) k++
    if (k > 2000) {
      this.times.splice(0, k)
      this.midi.splice(0, k)
      this.prob.splice(0, k)
      this.rms.splice(0, k)
    }
    this.onsets = this.onsets.filter((t) => t >= cut)
    this.log = this.log.filter((n) => n.end >= cut)
    this.announced = this.announced.filter((t) => t >= cut)
  }

  /** Un onset de energía (s): ayuda a separar notas repetidas y da su inicio. */
  addOnset(time: number): void {
    this.onsets.push(time)
  }

  private track(from: number): PitchTrack {
    const i = Math.max(0, this.times.findIndex((t) => t >= from))
    const sl = <T>(a: T[]) => a.slice(i)
    const midi = Float32Array.from(sl(this.midi))
    const prob = Float32Array.from(sl(this.prob))
    return {
      sampleRate: this.sampleRate,
      hop: this.hop,
      times: Float32Array.from(sl(this.times)),
      midi: medianTrack(midi, prob, DEFAULT_PITCH_OPTIONS.median),
      prob,
      rms: Float32Array.from(sl(this.rms)),
    }
  }

  /**
   * Revisa las notas de los últimos segundos y rehace el registro de la ventana (lo anterior queda congelado: no
   * puede cambiar). Rehacer, y no solo añadir, deja que un fragmento de entrada (la voz que sube a la nota) se
   * absorba cuando llega la nota larga. Devuelve las notas que acaban de nacer (para avisar de la melodía); cada una
   * se avisa una sola vez. Se limita a una vez cada 50 ms de audio.
   */
  scan(): LiveNote[] {
    if (this.time - this.lastScan < SCAN_EVERY_SEC || this.times.length < 8) return []
    this.lastScan = this.time
    const from = this.time - WINDOW_SEC
    const floor = Math.min(lowPercentile(this.rms, 0.05), FLOOR_CAP)
    const found = segmentNotes(this.track(from), this.onsets.filter((t) => t >= from - 0.1), { ...this.noteOptions, floor })
    // lo que empezó antes de la ventana queda congelado (la ventana ya no lo ve entero); lo demás se rehace
    const keep = this.log.filter((n) => n.start < from).map((n) => ({ ...n }))
    const next: LiveNote[] = []
    for (const n of found) {
      const last = keep[keep.length - 1]
      // la ventana ve la cola de una nota congelada como una nota que empieza en `from`: se une a ella
      if (next.length === 0 && last && n.start <= from + 0.15 && last.end >= n.start - 0.1 && Math.abs(n.midi - last.midi) < 1) last.end = Math.max(last.end, n.end)
      else next.push(n)
    }
    this.log = [...keep, ...next].sort((a, b) => a.start - b.start)
    const born = next.filter((n) => n.end - n.start >= ANNOUNCE_AFTER_SEC && !this.announced.some((t) => Math.abs(t - n.start) < 0.15))
    for (const n of born) this.announced.push(n.start)
    return born
  }

  /** ¿Cae el onset dentro de una nota (con margen para el ataque)? Hay que haber hecho `scan` tras `onset + MELODY_DECISION_SEC`. */
  isMelodic(onset: number): boolean {
    return melodicOnsets([onset], this.log, ONSET_LEAD_SEC)[0]!
  }

  /** Notas del registro que se solapan con [from, to] (s). */
  notesBetween(from: number, to: number): Note[] {
    return this.log.filter((n) => n.end >= from && n.start <= to).map((n) => ({ ...n }))
  }

  reset(): void {
    this.started = false
    this.len = 0
    this.times = []
    this.midi = []
    this.prob = []
    this.rms = []
    this.onsets = []
    this.log = []
    this.lastScan = -Infinity
  }
}
