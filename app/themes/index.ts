import type { VisualTheme } from './types'
import { createWaterCanvas2D } from './water/canvas2d'
import { createWaterWebGL2 } from './water/webgl2'

export interface ThemeEntry {
  id: string
  label: string
  /** crea el tema eligiendo el mejor modo de dibujo disponible */
  create(opts: { reducedMotion: boolean }): VisualTheme
}

/** Registro de temas (§16.14). Para añadir uno: una entrada más aquí. */
export const THEMES: ThemeEntry[] = [
  {
    id: 'water',
    label: 'Agua',
    create: ({ reducedMotion }) => (reducedMotion ? null : createWaterWebGL2()) ?? createWaterCanvas2D(),
  },
]

export const DEFAULT_THEME = 'water'
export const themeById = (id: string): ThemeEntry => THEMES.find((t) => t.id === id) ?? THEMES[0]!
