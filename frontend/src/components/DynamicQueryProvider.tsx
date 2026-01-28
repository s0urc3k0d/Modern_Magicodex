import React, { useEffect, useState, type ReactNode } from 'react';

type QueryLib = typeof import('@tanstack/react-query');

interface DynamicQueryProviderProps {
  children: ReactNode;
}

export function DynamicQueryProvider({ children }: DynamicQueryProviderProps) {
  const [lib, setLib] = useState<QueryLib | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        // Sanity check React before importing react-query
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const reactAny: any = React;
        if (!reactAny || typeof reactAny.createContext !== 'function') {
          throw new Error('React.createContext indisponible avant import de react-query (chunk React corrompu)');
        }
        const mod = await import('@tanstack/react-query');
        if (!cancelled) setLib(mod);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return (
      <div className="p-6">
        <div className="text-red-400 font-semibold mb-2">Echec initial react-query</div>
        <p className="text-sm opacity-80 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-xs"
        >Recharger</button>
      </div>
    );
  }

  if (!lib) {
    return <div className="p-8 text-center text-gray-400">Initialisation…</div>;
  }

  const { QueryClient, QueryClientProvider } = lib;
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        retry: 2,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: 1 },
    },
  }));

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export default DynamicQueryProvider;
