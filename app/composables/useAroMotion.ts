import { ref } from 'vue'
import type { Tilt } from '~/lib/aro/view'

/**
 * Giroscopio para el parallax del aro (spec 003, E3.6). Opcional y apagado por defecto; se
 * activa en ⋯. En iOS el permiso se pide en ese toque y, como no dura entre sesiones, si estaba
 * activado se vuelve a pedir en el primer toque tras abrir la app. Estado compartido.
 */
const KEY = 'coderbeats:motion:v1'
const enabled = ref(false)
/** hay lecturas del giroscopio (permiso concedido y sensor presente) */
const live = ref(false)
let reading: Tilt | null = null
let listening = false
let needsPermission = false
let loaded = false

type IOSOrientation = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> }

const onOrientation = (e: DeviceOrientationEvent) => {
  if (e.beta === null || e.gamma === null) return
  reading = { beta: e.beta, gamma: e.gamma }
  live.value = true
}

function listen() {
  if (listening) return
  listening = true
  window.addEventListener('deviceorientation', onOrientation)
}

function unlisten() {
  listening = false
  window.removeEventListener('deviceorientation', onOrientation)
  reading = null
  live.value = false
}

/** Pide permiso si hace falta (debe llamarse dentro de un toque) y empieza a escuchar. */
async function start(): Promise<boolean> {
  const DOE = (window as unknown as { DeviceOrientationEvent?: IOSOrientation }).DeviceOrientationEvent
  if (!DOE) return false
  if (typeof DOE.requestPermission === 'function') {
    try {
      if ((await DOE.requestPermission()) !== 'granted') return false
    } catch {
      return false
    }
  }
  needsPermission = false
  listen()
  return true
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ enabled: enabled.value }))
  } catch {
    // sin almacenamiento: solo esta sesión
  }
}

export function useAroMotion() {
  /** el dispositivo puede usarlo: táctil y con el sensor (en escritorio no se ofrece) */
  const available = () =>
    import.meta.client && 'DeviceOrientationEvent' in window && window.matchMedia('(pointer: coarse)').matches

  if (import.meta.client && !loaded) {
    loaded = true
    try {
      enabled.value = !!(JSON.parse(localStorage.getItem(KEY) ?? 'null') as { enabled?: boolean } | null)?.enabled
    } catch {
      enabled.value = false
    }
    if (enabled.value && available()) {
      const DOE = window.DeviceOrientationEvent as IOSOrientation
      if (typeof DOE.requestPermission === 'function') needsPermission = true
      else listen()
    }
  }

  /** Interruptor de ⋯ ("Movimiento del móvil"): se llama dentro del toque. */
  async function toggle() {
    if (enabled.value) {
      enabled.value = false
      unlisten()
    } else {
      enabled.value = await start()
    }
    save()
  }

  /** Primer toque tras abrir la app (iOS): vuelve a pedir el permiso si estaba activado. */
  function onUserGesture() {
    if (enabled.value && needsPermission) {
      needsPermission = false
      void start().then((ok) => {
        if (!ok) {
          enabled.value = false
          save()
        }
      })
    }
  }

  return { enabled, live, available, toggle, onUserGesture, reading: () => reading }
}
