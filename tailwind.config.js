/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        canvas: '#F8F5EF',
        surface: '#FFFFFF',
        sunken: '#F2EDE4',
        line: { DEFAULT: '#E7E0D3', strong: '#D6CCBA' },
        ink: { DEFAULT: '#1E1C19', 2: '#4A4640', 3: '#7A736A', 4: '#A39C91' },
        gold: {
          50: '#FBF7EC',
          100: '#F5ECD3',
          200: '#EBDAB0',
          300: '#D9BF82',
          500: '#B08A3E',
          600: '#94722D',
          700: '#735823',
        },
        ok: { DEFAULT: '#2E7350', bg: '#EAF3EE', line: '#C5DFCF' },
        warn: { DEFAULT: '#9A5B00', bg: '#FDF3E0', line: '#F0D6A6' },
        bad: { DEFAULT: '#B0322A', bg: '#FBECEA', line: '#F0C6C1' },
        info: { DEFAULT: '#33598A', bg: '#EDF2F8', line: '#C9D7EA' },
      },
      boxShadow: {
        card: '0 1px 2px rgba(30,28,25,0.04), 0 1px 1px rgba(30,28,25,0.03)',
        pop: '0 12px 32px -8px rgba(30,28,25,0.18), 0 2px 6px rgba(30,28,25,0.06)',
      },
      borderRadius: { xl: '0.875rem', '2xl': '1.125rem' },
    },
  },
  plugins: [],
};
