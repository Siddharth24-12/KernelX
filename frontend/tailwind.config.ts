import type { Config } from 'tailwindcss'
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: { colors: { graphite: '#20221F', cloud: '#F3F2EC', sun: '#F5D547' }, fontFamily: { display: ['Space Grotesk', 'sans-serif'], sans: ['Inter', 'sans-serif'], mono: ['JetBrains Mono', 'monospace'] } } },
  plugins: [],
} satisfies Config
