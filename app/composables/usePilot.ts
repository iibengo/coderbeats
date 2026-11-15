/**
 * El conductor del piloto automático (spec 009 §4): ejecuta un guion con un dedo fantasma que **fabrica eventos de puntero reales** sobre los
 * elementos de la pantalla (los manejadores de siempre los reciben como si fueran de una persona; no se llama a ninguna función de edición).
 * Lo único falso es lo que «oyó» el micro: la boca mete golpes por el mismo camino que el worker de análisis (`engine.pilot.hear`).
 */
import { reactive } from 'vue'
import { imperfections, pause, rng, trajectory, type Pt } from '~/lib/pilot'
import { outcomeOf, PILOT_SCRIPTS, type PilotScript, type PilotStep, type PilotTarget } from '~/lib/pilotScripts'
import type { Voice } from '~/lib/palette'

interface StageApi {
  pointOf: (voice: Voice, step: number) => { x: number; y: number } | null
  rootEl: () => HTMLElement | null
}

/** Estado visible (lo pinta `PilotLayer`). Compartido: solo hay un piloto. */
const state = reactive({
  active: false,
  paused: false,
  finger: { x: -100, y: -100, down: false, shown: false },
  caption: '',
  bubble: '',
  captions: true,
  reduced: false,
  step: 0,
  total: 0,
})

const POINTER_ID = 9001
/** radio (px) que el imán de la app corrige: el desvío del dedo no pasa de 0,6 de esto */
const MAGNET_PX = 20
let cancelled = false
let running = false
let saved: ReturnType<ReturnType<typeof useAudioEngine>['pilot']['begin']> | null = null

export function usePilotState() {
  return state
}

export function usePilot(getStage: () => StageApi | null) {
  const engine = useAudioEngine()

  const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))
  const wait = async (ms: number) => {
    const end = performance.now() + ms
    while (performance.now() < end && !cancelled) {
      await new Promise((r) => setTimeout(r, 30))
      // en pausa se congela todo (el reloj de la espera también)
      while (state.paused && !cancelled) await new Promise((r) => setTimeout(r, 80))
    }
  }

  function targetPoint(t: PilotTarget): { p: Pt; el: Element | null; width: number } | null {
    if (t.t === 'play') {
      const el = document.querySelector('button[aria-label="tocar"], button[aria-label="parar"]')
      return el ? { p: center(el), el, width: 90 } : null
    }
    if (t.t === 'ball') {
      const el = document.querySelector(`.bg-ball[aria-label^="${t.part === 'bass' ? 'bajo' : 'acordes'}"]`)
      return el ? { p: center(el), el, width: 44 } : null
    }
    const stage = getStage()
    const p = stage?.pointOf(t.voice as Voice, t.step)
    return p && stage ? { p, el: stage.rootEl(), width: 30 } : null
  }

  const center = (el: Element): Pt => {
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  }

  function fire(el: Element, type: string, p: Pt) {
    el.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true, cancelable: true, composed: true, pointerId: POINTER_ID, pointerType: 'touch', isPrimary: true,
        clientX: p.x, clientY: p.y, button: 0, buttons: type === 'pointerup' ? 0 : 1,
      }),
    )
  }

  /** Mueve el dedo (con curva, aceleración y frenado) hasta `to`. Con movimiento reducido, salta. */
  async function moveTo(to: Pt, rand: () => number, width: number, overshoot: boolean) {
    const from = state.finger.shown ? { x: state.finger.x, y: state.finger.y } : { x: to.x + (rand() < 0.5 ? -1 : 1) * 160, y: to.y + 220 }
    state.finger.shown = true
    if (state.reduced) {
      state.finger.x = to.x
      state.finger.y = to.y
      await wait(250)
      return
    }
    const m = trajectory(from, to, rand, { width, overshoot })
    const t0 = performance.now()
    for (;;) {
      if (cancelled) return
      while (state.paused && !cancelled) await new Promise((r) => setTimeout(r, 80))
      const t = (performance.now() - t0) / 1000
      const p = m.at(Math.min(t, m.duration))
      state.finger.x = p.x
      state.finger.y = p.y
      if (t >= m.duration) break
      await frame()
    }
  }

  async function tap(target: PilotTarget, rand: () => number) {
    // el objetivo se resuelve ahora (puede aparecer con una transición): se espera un poco a que exista
    let at = targetPoint(target)
    for (let i = 0; i < 20 && !at && !cancelled; i++) {
      await wait(150)
      at = targetPoint(target)
    }
    if (!at || cancelled) return
    const im = imperfections(rand, MAGNET_PX)
    // el desvío solo vale donde manda el imán (el aro); un botón se toca en su centro
    const off = target.t === 'strip' && im.offset ? im.offset : { x: 0, y: 0 }
    await moveTo(at.p, rand, at.width, im.overshoot)
    if (cancelled) return
    if (im.hesitate) await wait(im.hesitate * 1000)
    const hit = { x: at.p.x + off.x, y: at.p.y + off.y }
    state.finger.down = true
    if (at.el) fire(at.el, 'pointerdown', hit)
    await wait(70)
    if (at.el) {
      fire(at.el, 'pointerup', hit)
      if (target.t !== 'strip') at.el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: hit.x, clientY: hit.y }))
    }
    state.finger.down = false
  }

  /** «Con la boca»: el bocadillo y los golpes empiezan en la línea de compás (lo que hace la app con la voz de verdad). */
  async function mouth(step: Extract<PilotStep, { do: 'mouth' }>) {
    const c = engine.pilot.clock()
    if (!c) return
    // el compás entero que viene (si falta poco para la línea, el siguiente)
    const bar = c.at(c.bar) - c.now < 0.6 ? c.bar + 1 : c.bar
    const t0 = c.at(bar)
    for (const s of step.steps) {
      const T = t0 + s * c.stepSec
      const ms = engine.pilot.msUntil(T)
      setTimeout(() => {
        if (cancelled) return
        engine.pilot.hear(step.instrument, T)
        state.bubble = step.says
        setTimeout(() => (state.bubble = ''), 220)
      }, Math.max(0, ms + 40))
    }
    // se espera a que termine el compás
    await wait(engine.pilot.msUntil(t0 + 16 * c.stepSec) + 200)
  }

  async function runStep(step: PilotStep, rand: () => number) {
    if (step.do === 'caption') state.caption = step.text
    else if (step.do === 'tap') {
      if (step.caption) state.caption = step.caption
      await tap(step.on, rand)
    } else if (step.do === 'mouth') {
      if (step.caption) state.caption = step.caption
      await mouth(step)
    } else if (step.do === 'wait') {
      const c = engine.pilot.clock()
      await wait(c ? step.bars * c.stepSec * 16 * 1000 : step.bars * 2000)
    }
  }

  /** El estado de partida: el estilo y el kit del guion, sin loops y parado. */
  async function prepare(script: PilotScript) {
    engine.stop()
    engine.clearAll()
    engine.setStyle(script.style)
    engine.setKit(script.kit)
    engine.setMode('jugar')
    // el fondo apagado: las bolas «bajo» y «acordes» se encienden con el dedo
    engine.setBackgroundMode('manual')
    engine.setBackgroundManual({ bass: false, chords: false })
    await wait(300)
  }

  function stop(reason: 'user' | 'end' = 'end') {
    cancelled = true
    state.active = false
    state.paused = false
    state.finger.shown = false
    state.finger.down = false
    state.bubble = ''
    state.caption = ''
    window.removeEventListener('pointerdown', onUserTouch, true)
    window.removeEventListener('keydown', onUserTouch, true)
    void reason
  }

  /** Cualquier toque o tecla **del usuario** lo detiene; los eventos fabricados no son de confianza (`isTrusted`), y la barra del piloto no cuenta. */
  function onUserTouch(e: Event) {
    if (!e.isTrusted) return
    if ((e.target as Element | null)?.closest?.('[data-pilot-bar]')) return
    stop('user')
  }

  async function start(seed = 1, id = engine.style.value) {
    const script = PILOT_SCRIPTS[id as keyof typeof PILOT_SCRIPTS]
    if (!script || running) return false
    running = true
    cancelled = false
    state.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    state.active = true
    state.paused = false
    state.total = script.steps.length
    state.step = 0
    window.addEventListener('pointerdown', onUserTouch, true)
    window.addEventListener('keydown', onUserTouch, true)
    try {
      saved = engine.pilot.begin()
      await prepare(script)
      const rand = rng(seed)
      for (const [i, step] of script.steps.entries()) {
        if (cancelled) break
        state.step = i
        await runStep(step, rand)
        // pausa entre acciones de duración variable (más larga ante un cambio de sección: una espera)
        if (!cancelled && step.do !== 'wait' && step.do !== 'caption') await wait(pause('between', rand) * 1000)
      }
      // al terminar entero: la canción debe ser idéntica a la demo (si no, se corrige y queda en el registro)
      if (!cancelled) engine.pilot.verify(script)
    } finally {
      running = false
      if (saved) engine.pilot.end(saved)
      saved = null
      stop('end')
    }
    return !cancelled
  }

  /** «Saltar al final»: la demo del estilo (lo único que no es un gesto); suelta el control. */
  async function skip() {
    cancelled = true
    if (saved) engine.pilot.end(saved)
    saved = null
    await engine.pilot.skipToEnd()
    stop('end')
  }

  return { start, skip, stop, togglePause: () => (state.paused = !state.paused), available: (style: string) => style in PILOT_SCRIPTS, outcomeOf }
}
