/** @type {import('tailwindcss').Config} */
const c = (name) => `rgb(var(--${name}) / <alpha-value>)`

module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Superfícies (do mais fundo para o mais elevado)
        bg: c('bg'),
        surface: c('surface'),
        raised: c('raised'),
        hover: c('hover'),
        // Bordas
        line: c('line'),
        lineStrong: c('line-strong'),
        // Texto
        ink: c('ink'),
        ink2: c('ink-2'),
        mute: c('mute'),
        // Marca e estados
        red: {
          DEFAULT: c('red'),
          bright: c('red-bright'),
          dark: c('red-dark'),
        },
        ok: c('ok'),
        warn: c('warn'),
        info: c('info'),
        // Aliases antigos (evitam quebrar classes legadas)
        bgElevated: c('surface'),
        bgCard: c('raised'),
        paper: c('ink'),
        paperDim: c('ink-2'),
        muted: c('mute'),
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        // Anton fica reservada ao nome do bar (marca). O resto da interface é Inter.
        display: ['Anton', 'Impact', 'sans-serif'],
      },
      borderRadius: {
        xl: '14px',
        '2xl': '18px',
        '3xl': '24px',
      },
      keyframes: {
        'sheet-in': {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.96) translateY(8px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'sheet-in': 'sheet-in 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)',
        'pop-in': 'pop-in 0.18s cubic-bezier(0.2, 0.8, 0.2, 1)',
        'fade-in': 'fade-in 0.15s ease-out',
      },
    },
  },
  plugins: [],
}
