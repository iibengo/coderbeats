import { ref } from 'vue'
import { isCompact } from '~/lib/aro/zoom'

/** Móvil en horizontal (spec 003, E2.1): controles a los lados. Estado compartido. */
const compact = ref(false)
let bound = false

function update() {
  compact.value = isCompact(window.innerWidth, window.innerHeight, window.matchMedia('(pointer: coarse)').matches)
}

export function useLayoutMode() {
  if (import.meta.client && !bound) {
    bound = true
    update()
    window.addEventListener('resize', update)
  }
  return { compact }
}
