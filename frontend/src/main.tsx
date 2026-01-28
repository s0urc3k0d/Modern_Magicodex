import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles-mtg.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'
import ErrorBoundary from './components/ErrorBoundary'

// --- Runtime diagnostic for missing React.createContext (stale SW chunk scenario) ---
// If a stale service worker serves an old query chunk that imports a *new* react chunk hash
// (or vice versa), the imported binding can become undefined, producing the observed
// "Cannot read properties of undefined (reading 'createContext')" at startup.
// We proactively detect this and log guidance before React Query initializes.
// This does not cost much and is stripped/minified in production.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const reactGlobal: any = (globalThis as any).React || undefined;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (reactGlobal && typeof reactGlobal.createContext !== 'function') {
  // eslint-disable-next-line no-console
  console.warn('[Startup Diagnostic] React global detected but createContext missing. Service worker cache might be stale. Forcing cache purge...');
  if ('caches' in window) {
    caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
  }
}

// Additional integrity probe: dynamically import current react entry and record keys.
// This helps detect if network returns a truncated/HTML response masquerading as JS.
// We run it ASAP but after static imports so bundler includes the chunk.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(async () => {
  try {
    const mod = await import('react');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const snapshot: any = {
      keys: Object.keys(mod).slice(0, 30),
      hasCreateContext: typeof (mod as any).createContext === 'function',
      hasForwardRef: typeof (mod as any).forwardRef === 'function',
      hasUseState: typeof (mod as any).useState === 'function',
      ts: Date.now()
    };
    // @ts-expect-error attach debug
    window.__reactIntegrity = snapshot;
    if (!snapshot.hasCreateContext || !snapshot.hasForwardRef) {
      // eslint-disable-next-line no-console
      console.error('[React Integrity] Missing core exports', snapshot);
    } else {
      // eslint-disable-next-line no-console
      console.log('[React Integrity] OK', snapshot);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[React Integrity] Dynamic import failed', e);
  }
})();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

// Register PWA service worker only if not explicitly disabled (VITE_PWA=false)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pwaFlag = (import.meta as any).env?.VITE_PWA;
if (pwaFlag !== 'false') {
  registerSW({ immediate: true });
} else {
  // Attempt to unregister existing SW when debugging
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
  }
}
