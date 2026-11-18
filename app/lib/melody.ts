/**
 * La melodía como datos (spec 002, §8.1): sinte, registro, nombres de nota y mini-notación. Puro.
 *
 * Seguridad: lo que se escribe en el código Strudel es siempre un nombre sacado de `STRUDEL_NOTE` a partir de un
 * entero validado; nunca un valor leído tal cual de lo guardado.
 */
/** `drone`: un sine con mucha reverb, para fondos (la demo del dembow); no es de los que se eligen para cantar */
/** `bass` y `keys` (spec 028 §5): el bajo y los acordes **propios de la canción**, hechos de notas (en `keys`, varias a la vez), en vez del fondo del estilo */
export type MelodySynth = 'lead' | 'piano' | 'pad' | 'drone' | 'riser' | 'crash' | 'boom' | 'impacto' | 'downlifter' | 'bass' | 'keys' | 'guitar' | 'guitarDirty' | 'guitarSample' | 'acid' | 'rim' | 'click' | 'cowbell' | 'tom' | 'shaker' | 'dub'
export const MELODY_SYNTHS: readonly MelodySynth[] = ['lead', 'piano', 'pad', 'drone', 'riser', 'crash', 'boom', 'impacto', 'downlifter', 'bass', 'keys', 'guitar', 'guitarDirty', 'guitarSample', 'acid', 'rim', 'click', 'cowbell', 'tom', 'shaker', 'dub']

/** Rango MIDI que se admite en un loop de melodía o bajo (C1–C7). */
export const MIDI_MIN = 24
export const MIDI_MAX = 96

export const isMidi = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= MIDI_MIN && v <= MIDI_MAX

const NAMES = ['c', 'db', 'd', 'eb', 'e', 'f', 'gb', 'g', 'ab', 'a', 'bb', 'b']
/** Nombre de nota de Strudel de cada MIDI válido: 60 → "c4", 58 → "bb3". */
export const STRUDEL_NOTE: Readonly<Record<number, string>> = Object.fromEntries(
  Array.from({ length: MIDI_MAX - MIDI_MIN + 1 }, (_, i) => MIDI_MIN + i).map((m) => [m, `${NAMES[m % 12]}${Math.floor(m / 12) - 1}`]),
)

/** Registro del sinte (spec 002, §5): la mediana de la melodía se coloca aquí, por octavas. */
export const REGISTER: Record<MelodySynth | 'bass', readonly [number, number]> = {
  lead: [60, 84], // C4–C6
  piano: [48, 72], // C3–C5
  pad: [48, 72], // C3–C5
  drone: [36, 60], // C2–C4
  riser: [48, 72], // ruido: la altura no cuenta (spec 008, §11)
  crash: [48, 72], // ruido: la altura no cuenta (spec 008, §12)
  boom: [24, 48], // golpes de efecto del Escenario (spec 011 §13.1): la nota es la raíz
  impacto: [24, 48],
  downlifter: [48, 72], // ruido: la altura no cuenta (spec 014 §9)
  keys: [48, 72], // acordes propios de la canción (C3–C5)
  guitar: [48, 84], // guitarra (spec 035): C3–C6
  guitarDirty: [48, 84],
  guitarSample: [52, 84], // la Hofner grabada (e3 hacia arriba)
  acid: [28, 64], // el 303: E1–E4
  rim: [24, 60], // percusión de muestra (spec 045): la altura no cuenta
  click: [24, 60],
  cowbell: [24, 60],
  tom: [24, 60],
  shaker: [24, 60],
  dub: [36, 79], // acordes de dub techno: C2–G5
  bass: [28, 52], // E1–E3
}

/** Líneas Strudel de cada sinte (sin orbit; spec 002, §6). Se afinan de oído. */
/** Lo que se muestra en strudel.cc donde el sonido es solo de la app: la guitarra eléctrica limpia de la colección General MIDI de strudel (sin oír; puede no cargar sin los soundfonts) */
export const SYNTH_SOUND_DISPLAY = { guitarSample: '.s("gm_electric_guitar_clean").release(0.1).gain(0.5)' } as const

/** Lo que va al **final** de la línea de un loop de ese sinte, después del `.gain(...)` (spec 046): el eco del dub, de corchea con puntillo (3/16 de ciclo), con tres repeticiones cada vez más oscuras y bajas. */
export const SYNTH_ECHO: Partial<Record<MelodySynth, string>> = {
  dub: '.off(3/16, x => x.lpf(650).postgain(0.6).off(3/16, y => y.lpf(480).postgain(0.6).off(3/16, z => z.lpf(340).postgain(0.6))))',
}

export const SYNTH_SOUND: Record<MelodySynth, string> = {
  piano: '.s("triangle").fm(1.5).fmh(2).decay(0.6).sustain(0.2).room(0.4)',
  lead: '.s("square").lpf(1800).decay(0.2).sustain(0.5).delay(0.25)',
  pad: '.s("supersaw").attack(0.08).release(0.6).lpf(1200).room(0.8)',
  drone: '.s("sine").room(0.9)',
  // ruido rosa para los builds (spec 008, §11): la nota solo marca cuándo suena; el filtro de la célula lo abre
  // el platillo del drop (spec 008, §12): ruido blanco de ataque inmediato y cola larga, sin graves; la nota solo marca cuándo suena
  crash: '.s("white").attack(0.001).decay(1.1).sustain(0).release(0.3).hpf(3500).gain(0.45).room(0.45)',
  // golpes de efecto del Escenario (spec 011 §13.1): un bombo de síntesis (`sbd`) muy grave; la nota es la raíz del acorde
  boom: '.s("sbd").decay(1.6).pdecay(0.35).penv(12).gain(0.8).room(0.3)',
  impacto: '.s("sbd").decay(0.9).pdecay(0.12).penv(24).shape(0.4).gain(0.9)',
  // el barrido que baja (spec 014 §9): ruido rosa con el filtro cayendo desde arriba; sin probar de oído
  downlifter: '.s("pink").attack(0.02).decay(1.6).sustain(0).release(0.2).lpf(8000).lpenv(-4).lpd(1.6).lps(0).gain(0.5).room(0.4)',
  // el bajo propio de la canción (spec 028 §5): sierra grave con el filtro que se cierra en cada nota, corto y gordo; sin probar de oído
  bass: '.s("sawtooth").lpf(420).lpenv(2).decay(0.2).sustain(0.35).gain(0.6)',
  // los acordes propios de la canción: triangular con un poco de FM, suave y con cola; varias notas a la vez; sin probar de oído
  keys: '.s("triangle").fm(0.8).decay(0.5).sustain(0.15).lpf(2600).room(0.3).gain(0.4)',
  // la guitarra (spec 035), sin samples: sierra con un filtro que se cierra tras el «pulso» (el ataque brillante y luego el cuerpo), un poco de saturación (`distort`: `shape` lo pisa la «calidez» global, que va al final del código) y
  // un decay corto para que no sea un pitido largo. Opcional: el `lead` de lo guardado no cambia. Sin probar de oído.
  guitar: '.s("sawtooth").lpf(1100).lpenv(3).lpa(0.002).lpd(0.2).lps(0.1).distort(0.5).decay(0.35).sustain(0.25).release(0.12).room(0.15).gain(0.5)',
  // la guitarra sucia (para el estribillo): más saturación (distort), más filtro abierto y más cuerpo
  guitarDirty: '.s("sawtooth").lpf(1800).lpenv(2).lpa(0.002).lpd(0.25).lps(0.25).distort(3).decay(0.5).sustain(0.45).release(0.15).room(0.1).gain(0.3)',
  // la guitarra grabada (spec 036): 7 notas de una Hofner Club (CC0) repetidas a la altura pedida; corta (las muestras duran 0,5 s). Para el sucio, `.distort(…)` por encima. Sin oír.
  guitarSample: '.s("hofner").release(0.1).gain(0.5)',
  // el ácido (spec 044), el «tiu-tiu-tiu» del 303: sierra con un filtro muy resonante (`lpq` 13) cuya envolvente se cierra rápido en cada nota, y una distorsión moderada. Opcional; sin oír.
  acid: '.s("sawtooth").lpf(700).lpq(13).lpenv(4).lpa(0.002).lpd(0.14).lps(0.05).distort(0.8).decay(0.18).sustain(0.2).release(0.05).gain(0.4)',
  // la percusión del minimal (spec 045): muestras del uzu-drumkit con los nombres de strudel (suena igual en strudel.cc); la nota (C2) solo marca cuándo suena. Sin oír.
  rim: '.s("rim").gain(0.8)',
  click: '.s("misc").n(1).gain(0.7)',
  cowbell: '.s("cb").gain(0.7)',
  tom: '.s("mt").gain(0.8)',
  shaker: '.s("sh").gain(0.7)',
  // el stab del dub techno (spec 046): dos sierras desafinadas (`supersaw` con `unison(2)`) por un filtro resonante de envolvente rápida y sustain 0, un poco de saturación y reverb larga (`room`, `roomsize`),
  // y un eco de corchea con puntillo (3/16) **con el filtro dentro**: Strudel no tiene filtro en el bucle del `delay`, así que las tres repeticiones se escriben con `.off(3/16, …)`, cada una con menos
  // `postgain` y un `lpf` más cerrado (más oscura): ese eco es `SYNTH_ECHO.dub`, que va **al final de la línea** (después del `.gain("…")` por nota, que si no recortaría las repeticiones). Recibe acordes
  // (varias notas a la vez). En el motor, `room` y `shape` los gobiernan los controles de Espacio y Calidez. Sin oír.
  dub: '.s("supersaw").unison(2).detune(0.3).spread(0.4).lpf(800).lpq(3).lpenv(3).lpa(0.003).lpd(0.18).lps(0).decay(0.3).sustain(0).release(0.15).shape(0.25).room(0.9).roomsize(8).gain(0.35)',
  riser: '.s("pink").attack(0.12).decay(0.2).sustain(0.7).release(0.05).gain(0.6).room(0.3)',
}

/** Golpe de una melodía: `pos` y `dur` en semicorcheas dentro del loop; `midi` entero. */
export interface MelodyHit {
  pos: number
  strength: number
  midi: number
  dur: number
}

const mod = (a: number, n: number) => ((a % n) + n) % n

/**
 * Mini-notación de un compás de 16 pasos: cada nota `nombre@peso`, los huecos `~@peso`. Los pesos son enteros en
 * la rejilla más gruesa que respeta inicios y duraciones (pasos, cuartos de paso con rejilla fina, o **doceavos de paso** con tresillos).
 * Varias notas que empiezan en el mismo paso suenan juntas (`[c3,e3,g3]@n`, un acorde); la duración del acorde es la de su nota más larga.
 */
function barMini(hits: readonly (MelodyHit & { full?: number })[], res: number, clip = false, value?: (h: MelodyHit) => string): string {
  const sorted = [...hits].sort((a, b) => a.pos - b.pos)
  const tokens: string[] = []
  let at = 0
  const w = (n: number) => (n === 1 ? '' : `@${n}`)
  // las notas que empiezan a la vez, juntas
  const groups: { start: number; names: string[]; dur: number; ratio: number; vals: string[] }[] = []
  for (const h of sorted) {
    const start = Math.round(h.pos * res)
    const dur = Math.max(1, Math.round(h.dur * res))
    const name = STRUDEL_NOTE[h.midi] ?? 'c4'
    const ratio = h.full && h.full > h.dur ? h.full / h.dur : 1 // una nota que cruza la línea de compás (ligadura): cuánto más dura de lo que cabe
    const last = groups[groups.length - 1]
    if (last && last.start === start) {
      if (!last.names.includes(name)) last.names.push(name)
      last.dur = Math.max(last.dur, dur)
      last.ratio = Math.max(last.ratio, ratio)
      if (value && !last.vals.includes(value(h))) last.vals.push(value(h))
    } else groups.push({ start, names: [name], dur, ratio, vals: value ? [value(h)] : [] })
  }
  groups.forEach((g, i) => {
    // una nota o un acorde no pisa a lo que viene detrás
    const next = groups[i + 1]?.start
    const dur = next !== undefined ? Math.max(1, Math.min(g.dur, next - g.start)) : g.dur
    if (g.start > at) tokens.push(`~${w(g.start - at)}`)
    // con `value` (dinámica) cada nota vale su peso; un acorde se reparte el mismo peso
    const v = value ? (g.vals.length === 1 ? g.vals[0]! : `[${g.vals.join(',')}]`) : clip ? String(Math.round(g.ratio * 1000) / 1000) : g.names.length > 1 ? `[${g.names.join(',')}]` : g.names[0]!
    tokens.push(`${v}${w(dur)}`)
    at = g.start + dur
  })
  const total = 16 * res
  if (at < total) tokens.push(`~${w(total - at)}`)
  return tokens.join(' ')
}

/** La rejilla de una melodía: pasos enteros (1), cuartos de paso (4) o, si hay tresillos, doceavos de paso (12); lo demás, como siempre, a cuartos. */
export function gridOf(hits: readonly Pick<MelodyHit, 'pos' | 'dur'>[]): 1 | 4 | 12 {
  const vals = hits.flatMap((h) => [h.pos, h.dur])
  const on = (res: number) => vals.every((v) => Math.abs(v * res - Math.round(v * res)) < 1e-6)
  if (on(1)) return 1
  if (on(4)) return 4
  if (on(12)) return 12
  return 4
}

/** Menor periodo (divisor del nº de compases) con el que se repiten los compases. */
function period(bars: string[]): number {
  for (let p = 1; p < bars.length; p++) {
    if (bars.length % p !== 0) continue
    if (bars.every((b, i) => b === bars[i % p])) return p
  }
  return bars.length
}

/**
 * Mini-notación del loop entero, con la fase como la batería: el ciclo `j` de Strudel suena el compás
 * `(j − phaseBar) mod bars` del loop. Compases repetidos colapsados. Una nota no cruza la línea de compás:
 * lo que sobre se recorta.
 */
export function melodyMini(hits: readonly MelodyHit[], bars: number, phaseBar: number): string {
  return loopMinis(hits, bars, phaseBar).mini
}

/**
 * Las ligaduras (spec 028 §2): una nota que dura más de lo que queda de compás suena en su compás recortada, y este patrón (`.clip("…")`) le **alarga la duración**
 * (`clip` = veces lo que mide su hueco). Misma estructura que `melodyMini`, con el factor de cada nota. `null` si ninguna nota cruza la línea de compás.
 */
export function melodyClip(hits: readonly MelodyHit[], bars: number, phaseBar: number): string | null {
  return loopMinis(hits, bars, phaseBar).clip
}

/**
 * Ganancia por nota (spec 029 §2): un patrón con la misma estructura que `melodyMini` pero con el volumen de cada nota.
 * `strength` 0..1 se lleva a 0.55–1 (nunca 0: una nota no se calla sola). Devuelve `null` si **todas** las notas están a
 * `1` (lo de siempre): así lo guardado y lo que no usa dinámica genera exactamente el mismo código.
 */
export function melodyGains(hits: readonly MelodyHit[], bars: number, phaseBar: number): string | null {
  const valid = hits.filter((h) => isMidi(h.midi) && Number.isFinite(h.pos) && Number.isFinite(h.dur) && h.dur > 0)
  const same = (s: unknown) => Math.abs(safeStrength(s) - 1) < 1e-6
  if (valid.every((h) => same(h.strength))) return null
  const weight = (s: unknown) => {
    const v = Math.min(1, Math.max(0, safeStrength(s)))
    return Math.round((0.55 + 0.45 * v) * 1000) / 1000
  }
  // cada nota con su peso; los acordes vuelven a repartirse el mismo peso (Strudel aplica el gain a todo el hap)
  return loopMinis(
    valid.map((h) => ({ ...h })),
    bars,
    phaseBar,
    (h) => String(weight(h.strength)),
  ).mini
}

const safeStrength = (s: unknown): number => (typeof s === 'number' && Number.isFinite(s) ? s : 1)

function loopMinis(
  hits: readonly MelodyHit[],
  bars: number,
  phaseBar: number,
  value?: (h: MelodyHit) => string,
): { mini: string; clip: string | null } {
  const valid = hits.filter((h) => isMidi(h.midi) && Number.isFinite(h.pos) && Number.isFinite(h.dur) && h.dur > 0)
  const res = gridOf(valid)
  const perBar: string[] = []
  const perClip: string[] = []
  let tied = false
  for (let b = 0; b < bars; b++) {
    const inBar = valid
      .filter((h) => Math.floor(h.pos / 16 + 1e-9) === b)
      .map((h) => ({ ...h, full: h.dur, pos: h.pos - b * 16, dur: Math.min(h.dur, (b + 1) * 16 - h.pos) }))
    if (inBar.some((h) => h.full > h.dur + 1e-9)) tied = true
    perBar.push(barMini(inBar, res, false, value))
    perClip.push(barMini(inBar, res, true))
  }
  const ph = Number.isFinite(phaseBar) ? phaseBar : 0
  const idx = (j: number) => mod(j - ph, bars)
  // los compases se repiten si lo hacen **las notas y sus factores a la vez** (así los dos patrones siguen alineados)
  const rot = Array.from({ length: bars }, (_, j) => `${perBar[idx(j)]!}|${perClip[idx(j)]!}`)
  const n = period(rot)
  const wrap = (arr: string[]) => {
    const u = Array.from({ length: n }, (_, j) => arr[idx(j)]!)
    return u.length === 1 ? u[0]! : `<${u.map((x) => `[${x}]`).join(' ')}>`
  }
  return { mini: wrap(perBar), clip: tied ? wrap(perClip) : null }
}

/**
 * Overdub de una melodía ("completa", spec 002, §5): añade las notas de `add` al loop `base`. Monofónica: una nota
 * nueva solo entra en huecos libres; si empieza dentro de una existente se descarta, y si empieza en un hueco se
 * recorta contra la siguiente (y contra la línea de compás). Si `add` es más largo, el patrón base se repite.
 */
export function mergeMelody(
  base: { bars: 1 | 2 | 4 | 8 | 16; phaseBar: number; hits: readonly MelodyHit[] },
  add: { bars: 1 | 2 | 4 | 8 | 16; phaseBar: number; hits: readonly MelodyHit[] },
): { bars: 1 | 2 | 4 | 8 | 16; phaseBar: number; hits: MelodyHit[]; added: number } {
  const bars = Math.max(base.bars, add.bars) as 1 | 2 | 4 | 8 | 16
  const total = bars * 16
  const hits: MelodyHit[] = []
  for (let k = 0; k < bars / base.bars; k++) for (const h of base.hits) hits.push({ ...h, pos: h.pos + k * base.bars * 16 })
  hits.sort((a, b) => a.pos - b.pos)
  let added = 0
  const incoming = add.hits
    .map((h) => ({ ...h, pos: mod(h.pos + (add.phaseBar - base.phaseBar) * 16, total) }))
    .sort((a, b) => a.pos - b.pos)
  for (const h of incoming) {
    // ¿empieza dentro de una nota que ya suena?
    if (hits.some((x) => x.pos <= h.pos + 1e-9 && h.pos < x.pos + x.dur - 1e-9)) continue
    const next = hits.find((x) => x.pos > h.pos)
    const barEnd = (Math.floor(h.pos / 16 + 1e-9) + 1) * 16
    const dur = Math.min(h.dur, (next?.pos ?? Infinity) - h.pos, barEnd - h.pos, total - h.pos)
    if (dur < 0.25 - 1e-9) continue
    hits.push({ ...h, dur })
    hits.sort((a, b) => a.pos - b.pos)
    added++
  }
  return { bars, phaseBar: base.phaseBar, hits, added }
}
