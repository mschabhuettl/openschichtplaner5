/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
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
