/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0c0909',
        bgElevated: '#171111',
        bgCard: '#1c1515',
        red: {
          DEFAULT: '#c81d25',
          bright: '#e8323a',
          dark: '#6e0f14',
        },
        paper: '#f2ece2',
        paperDim: '#cfc3b4',
        muted: '#8a7a78',
        line: '#2c2020',
      },
      fontFamily: {
        display: ['Anton', 'sans-serif'],
        body: ['Oswald', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
