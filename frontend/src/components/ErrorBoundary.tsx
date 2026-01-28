import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message?: string;
  stack?: string;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] Caught runtime error', error, info);
  }

  handleReload = () => {
    // Attempt to clear potentially stale service worker caches then reload
    if ('caches' in window) {
      // Only purge Magicodex app caches; keep third-party caches intact
      const cacheNameRegex = /^magicodex-/i;
      caches.keys().then(keys => keys.forEach(k => { if (cacheNameRegex.test(k)) caches.delete(k); }));
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="p-6 m-4 border border-red-500 rounded bg-red-950/40 text-red-200 font-mono text-sm space-y-4">
        <div className="text-lg font-semibold">Une erreur est survenue</div>
        <div className="whitespace-pre-wrap break-words">
          {this.state.message}
        </div>
        {this.state.stack && (
          <details className="max-h-64 overflow-auto">
            <summary className="cursor-pointer select-none mb-1">Stack trace</summary>
            <pre className="text-xs leading-snug">{this.state.stack}</pre>
          </details>
        )}
        <div className="space-x-2">
          <button
            onClick={this.handleReload}
            className="px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-xs"
          >
            Vider caches & recharger
          </button>
        </div>
        <p className="text-xs opacity-70">
          Si le problème persiste, un chunk de build (service worker) est peut-être obsolète. Ce bouton tente de nettoyer les caches.
        </p>
      </div>
    );
  }
}

export default ErrorBoundary;
