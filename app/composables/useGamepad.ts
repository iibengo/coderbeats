// El mando de consola como entrada opcional del Laboratorio (Gamepad API): avisa de los botones que acaban de pulsarse. Sin mando conectado no hace nada.
import { pressedEdges } from '~/lib/lab'

export function useGamepad(onPress: (button: number, pad: Gamepad) => void) {
  const connected = ref(false)
  let raf = 0
  let prev: boolean[] = []
  function tick() {
    raf = requestAnimationFrame(tick)
    const pads = navigator.getGamepads?.() ?? []
    const pad = [...pads].find((p): p is Gamepad => !!p && p.connected)
    connected.value = !!pad
    if (!pad) {
      prev = []
      return
    }
    const cur = pad.buttons.map((b) => b.pressed)
    for (const i of pressedEdges(prev, cur)) onPress(i, pad)
    prev = cur
  }
  onMounted(() => {
    if (typeof navigator !== 'undefined' && 'getGamepads' in navigator) tick()
  })
  onBeforeUnmount(() => cancelAnimationFrame(raf))
  return { connected }
}
