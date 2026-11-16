import type { Config } from 'tailwindcss'
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: { colors: { graphite: '#101820', cloud: '#E9EEF5', sun: '#F4BD62', mint: '#55D6BE', surface: '#17232D', elevated: '#202C38', muted: '#A5B3C2' }, fontFamily: { display: ['Space Grotesk', 'sans-serif'], sans: ['Inter', 'sans-serif'], mono: ['JetBrains Mono', 'monospace'] } } },
  plugins: [],
} satisfies Config
