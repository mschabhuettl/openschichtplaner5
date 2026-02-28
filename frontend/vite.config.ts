import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2020',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          // Router (react-dom is included in index.js as entry-point dependency)
          'vendor-router': ['react-router-dom'],
          // Schedule is the largest single page — keep isolated
          'pages-schedule': [
            './src/pages/Schedule',
          ],
          // Einsatzplan + Jahresuebersicht are also complex
          'pages-planning-views': [
            './src/pages/Einsatzplan',
            './src/pages/Jahresuebersicht',
            './src/pages/Urlaub',
            './src/pages/Schichtmodell',
          ],
          // Remaining planning utilities
          'pages-planning-utils': [
            './src/pages/Personaltabelle',
            './src/pages/Statistiken',
            './src/pages/Personalbedarf',
            './src/pages/Jahresabschluss',
            './src/pages/Zeitkonto',
            './src/pages/Ueberstunden',
            './src/pages/Kontobuchungen',
            './src/pages/Notizen',
          ],
          // Reports & data exchange pages
          'pages-reports': [
            './src/pages/Berichte',
            './src/pages/Export',
            './src/pages/Import',
          ],
          // Master data pages
          'pages-stammdaten': [
            './src/pages/Employees',
            './src/pages/Groups',
            './src/pages/Shifts',
            './src/pages/LeaveTypes',
            './src/pages/Holidays',
            './src/pages/Workplaces',
            './src/pages/Extracharges',
            './src/pages/Einschraenkungen',
          ],
          // Admin pages
          'pages-admin': [
            './src/pages/Benutzerverwaltung',
            './src/pages/Backup',
            './src/pages/Perioden',
            './src/pages/Einstellungen',
            './src/pages/Protokoll',
          ],
        },
      },
    },
  },
})
