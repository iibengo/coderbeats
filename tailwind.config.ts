import type { Config } from 'tailwindcss'
import { INK, VOICE_HEX } from './app/lib/palette'

export default {
  theme: {
    extend: {
      colors: {
        ink: INK,
        bd: VOICE_HEX.bd,
        sd: VOICE_HEX.sd,
        hh: VOICE_HEX.hh,
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      gridTemplateColumns: {
        16: 'repeat(16, minmax(0, 1fr))',
      },
    },
  },
} satisfies Partial<Config>
