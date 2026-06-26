import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Fallback in-memory polyfill for environments that block localStorage/sessionStorage (such as some iframes or strict browser configs)
try {
  // Test access
  const testKey = "__ls_test__";
  window.localStorage.setItem(testKey, testKey);
  window.localStorage.removeItem(testKey);
} catch (e) {
  console.warn("Storage access is denied in this environment. Instantiating memory-based fallbacks to prevent crashes:", e);
  try {
    const createMemoryStorage = () => {
      let store: Record<string, string> = {};
      return {
        getItem: (key: string) => (key in store ? store[key] : null),
        setItem: (key: string, value: string) => { store[key] = String(value); },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; },
        key: (index: number) => Object.keys(store)[index] || null,
        get length() { return Object.keys(store).length; }
      };
    };
    Object.defineProperty(window, 'localStorage', {
      value: createMemoryStorage(),
      configurable: true,
      writable: true
    });
    Object.defineProperty(window, 'sessionStorage', {
      value: createMemoryStorage(),
      configurable: true,
      writable: true
    });
  } catch (defineErr) {
    console.error("Could not override localStorage with memory fallback:", defineErr);
  }
}

// Suppress benign ResizeObserver error
window.addEventListener('error', (e) => {
  if (e.message.includes('ResizeObserver loop')) {
    e.stopImmediatePropagation();
  }
});

// Register PWA Service Worker for offline asset caching
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered successfully with scope:', registration.scope);
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

