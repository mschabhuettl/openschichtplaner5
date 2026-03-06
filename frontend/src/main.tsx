import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Global handler for unhandled Promise rejections
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  console.error('[UnhandledRejection]', reason);
  // Best-effort: report to backend error endpoint
  try {
    const body = JSON.stringify({
      error: reason instanceof Error
        ? reason.message + '\n' + (reason.stack ?? '')
        : String(reason),
      type: 'unhandledrejection',
      url: window.location.href,
      user_agent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });
    fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }).catch(() => { /* best effort */ });
  } catch {
    // ignore serialization errors
  }
});

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((_reg) => { /* SW registered */ })
      .catch((err) => console.warn('[SW] Registration failed:', err));
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
