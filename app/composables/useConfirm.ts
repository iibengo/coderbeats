/**
 * Confirmación propia de la app (en vez de `window.confirm`): los cuadros nativos pueden bloquearse o suprimirse en el móvil («evitar más cuadros de esta página»),
 * y entonces la acción no hacía nada sin avisar. Devuelve una promesa: `true` si se acepta. Un solo cuadro a la vez (el nuevo cancela el anterior).
 */
import { reactive } from 'vue'

const state = reactive<{ open: boolean; message: string; ok: string }>({ open: false, message: '', ok: 'Continuar' })
let resolver: ((v: boolean) => void) | null = null

export const useConfirmState = () => state

export function askConfirm(message: string, ok = 'Continuar'): Promise<boolean> {
  resolver?.(false)
  state.message = message
  state.ok = ok
  state.open = true
  return new Promise((resolve) => (resolver = resolve))
}

export function answerConfirm(v: boolean) {
  state.open = false
  const r = resolver
  resolver = null
  r?.(v)
}
