/**
 * El tutorial jugando (spec 001 §14.1): pasos «arrastra un golpe» y «llévalo al centro para borrarlo» con la mano fantasma del piloto, y las dos pistas en su momento
 * (una sola vez). La decisión es `lib/tutorial.ts`; esto vigila al motor, enseña la mano y guarda por dispositivo.
 */
import { computed, reactive, watch } from 'vue'
import { advanceTutorial, hintFor, HINT_TEXT, isTutorialState, markSeen, TUTORIAL_DONE, TUTORIAL_START, TUTORIAL_TEXT, type Hint, type TutorialFacts, type TutorialState } from '~/lib/tutorial'
import { readJson, writeJson } from '~/lib/storage'

const KEY = 'coderbeats:tutorial:v1'
const GUIDE_KEY = 'coderbeats:guide:v1'
const st = reactive<{ s: TutorialState; hint: Hint | null }>({ s: TUTORIAL_START, hint: null })
let loaded = false

const save = () => writeJson(KEY, st.s)
export const restartTutorial = () => {
  st.s = { ...TUTORIAL_START, seen: [] }
  st.hint = null
  save()
}
const skipTutorial = () => {
  st.s = { ...TUTORIAL_DONE }
  st.hint = null
  save()
}

export function useTutorial(getStage: () => { debugDots: () => { voice: string; x: number; y: number }[] } | null, demoHand: (from: { x: number; y: number }, to: { x: number; y: number }) => Promise<void>) {
  const engine = useAudioEngine()
  const pilot = usePilotState()
  if (!loaded && import.meta.client) {
    loaded = true
    st.s = readJson(KEY, isTutorialState) ?? { ...TUTORIAL_START, seen: [] }
  }
  const guideDone = () => !!readJson(GUIDE_KEY, (x): x is { done: true } => !!x && (x as { done?: unknown }).done === true)

  const facts = computed<TutorialFacts>(() => {
    const drums = engine.loops.value.loops.filter((l) => l.instrument !== 'mel' && l.instrument !== 'voz')
    const sig = drums.map((l) => `${l.instrument}:${l.hits.map((h) => h.pos).sort((a, b) => a - b).join(',')}`).join('|')
    return {
      ready: engine.mode.value === 'jugar' && engine.playing.value && !pilot.active && drums.length > 0 && guideDone(),
      hits: drums.reduce((n, l) => n + l.hits.length, 0),
      sig,
      loops: engine.loops.value.loops.length,
      cells: engine.song.value.cells.length,
    }
  })

  watch(facts, (f) => {
    const next = advanceTutorial(st.s, f)
    if (next !== st.s) {
      st.s = next
      save()
    }
    const h = hintFor(st.s, f)
    if (h && st.hint !== h) {
      st.hint = h
      setTimeout(() => {
        st.s = markSeen(st.s, h)
        if (st.hint === h) st.hint = null
        save()
      }, 6000)
    }
  })

  // la mano fantasma: cada 9 s enseña el gesto del paso en el que está
  let timer: ReturnType<typeof setInterval> | null = null
  const demo = async () => {
    const f = facts.value
    if (!f.ready || (st.s.step !== 'drag' && st.s.step !== 'delete')) return
    const dots = (getStage()?.debugDots() ?? []).filter((d) => d.voice === 'bd' || d.voice === 'sd' || d.voice === 'hh')
    if (dots.length < 2) return
    const a = dots[0]!
    const cx = dots.reduce((n, d) => n + d.x, 0) / dots.length
    const cy = dots.reduce((n, d) => n + d.y, 0) / dots.length
    const to = st.s.step === 'delete' ? { x: cx, y: cy } : { x: a.x + (cx - a.x) * -0.0 + 40, y: a.y + 40 }
    await demoHand({ x: a.x, y: a.y }, to)
  }
  if (import.meta.client) {
    timer = setInterval(() => void demo(), 9000)
    if (import.meta.hot) import.meta.hot.dispose(() => timer && clearInterval(timer))
  }

  const text = computed(() => {
    if (st.hint) return { big: HINT_TEXT[st.hint], count: '' }
    if (st.s.step === 'drag' || st.s.step === 'delete') return facts.value.ready && st.s.baseCount >= 0 ? TUTORIAL_TEXT[st.s.step] : null
    return null
  })
  return { text, skip: skipTutorial, restart: restartTutorial }
}
