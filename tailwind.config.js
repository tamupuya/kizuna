/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,ts,js}'],
  theme: {
    extend: {
      colors: {
        'app-bg': '#1a1033',
        'app-accent': '#007AFF',
        'app-glass': 'rgba(255, 255, 255, 0.08)',
      },
      fontFamily: {
        'system': '-apple-system, BlinkMacSystemFont, "SF Pro", "Helvetica Neue", sans-serif',
      },
    },
  },
  plugins: [],
}