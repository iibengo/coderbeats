import type { Config } from 'tailwindcss'

export default {
  theme: {
    extend: {
      colors: {
        ink: '#0B0B0F',
        bd: '#F496BC',
        sd: '#B9A6F2',
        hh: '#8ECFF2',
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
