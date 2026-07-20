/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      // Taktwerk-Token (CSS-Variablen in index.css; Light/Dark-Paare)
      colors: {
        grund: 'var(--grund)',
        ebene: 'var(--ebene)',
        'ebene-2': 'var(--ebene-2)',
        rail: 'var(--rail)',
        kontur: 'var(--kontur)',
        'kontur-soft': 'var(--kontur-soft)',
        wash: 'var(--wash)',
        schrift: 'var(--schrift)',
        'schrift-2': 'var(--schrift-2)',
        'schrift-3': 'var(--schrift-3)',
        glut: 'var(--glut)',
        'glut-flaeche': 'var(--glut-flaeche)',
        'glut-ink': 'var(--glut-ink)',
        signal: 'var(--signal)',
        'signal-flaeche': 'var(--signal-flaeche)',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SF Mono', 'Cascadia Mono', 'Consolas', 'monospace'],
      },
      borderRadius: { cell: '3px', ui: '6px', panel: '8px' },
      boxShadow: {
        overlay: '0 14px 40px rgba(0,0,0,.18)',
        'overlay-dark': '0 14px 40px rgba(0,0,0,.5)',
      },
      keyframes: {
        slideIn: {
          from: { transform: 'translateX(120%)', opacity: '0' },
          to:   { transform: 'translateX(0)',    opacity: '1' },
        },
      },
      animation: {
        slideIn: 'slideIn 0.2s ease-out',
      },
    },
  },
  plugins: [],
}
