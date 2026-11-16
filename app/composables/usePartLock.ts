// Parte fija mientras se edita (spec 024 §2): al abrir un editor de una parte (Órgano, Batería) la parte se queda en bucle y la canción no avanza;
// 🔒 la suelta o la vuelve a fijar; al cerrar el editor se deja como estaba. Usa el bucle que ya existe (`loopHere` / `resume`): no toca el reloj del motor.
// Si la persona ya había puesto un bucle, se respeta (no se suelta al cerrar); sin canción de varias partes o sin música, no hace nada.
const locked = ref(false) // lo que ve el botón 🔒
let held = false // el bucle lo pusimos nosotros
let users = 0 // editores abiertos

export function usePartLock() {
  const engine = useAudioEngine()
  function acquire() {
    if (!engine.multi.value || !engine.playing.value || engine.loopTarget.value !== null) return
    engine.loopHere()
    held = true
    locked.value = true
  }
  function release() {
    if (held) engine.resume()
    held = false
    locked.value = false
  }
  return {
    locked,
    /** un editor se abre */
    enter() {
      users++
      if (users === 1) acquire()
    },
    /** un editor se cierra */
    leave() {
      users = Math.max(0, users - 1)
      if (users === 0) release()
    },
    /** el botón 🔒 */
    toggle() {
      if (held) release()
      else acquire()
    },
    /** ¿hay algo que fijar? (si no, el botón no se enseña) */
    available: computed(() => engine.multi.value && engine.playing.value),
  }
}
