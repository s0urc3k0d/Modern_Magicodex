// Thin dynamic wrapper around @tanstack/react-query to avoid early static chunk evaluation
// Provides on-demand imported hooks.
import * as React from 'react';

type Lib = typeof import('@tanstack/react-query');
let cache: Lib | null = null;
async function load(): Promise<Lib> {
  if (cache) return cache;
  const mod = await import('@tanstack/react-query');
  cache = mod;
  return mod;
}

// Generic loader HOC for hooks
function useAsyncHook(
  resolver: (lib: Lib) => (...a: any[]) => any,
  args: any[],
  fallback?: unknown
): any {
  const [impl, setImpl] = React.useState<((...a: any[]) => any) | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    load().then(l => { if (!cancelled) setImpl(() => resolver(l)); });
    return () => { cancelled = true; };
  }, []);
  // @ts-expect-error runtime fallback until loaded
  return impl ? impl(...args) : (fallback as TResult);
}

// Exposed proxies (only those we use)
export function useQuery(...args: any[]) {
  return useAsyncHook(l => l.useQuery as any, args, { data: undefined, isLoading: true });
}
export function useMutation(...args: any[]) {
  return useAsyncHook(l => l.useMutation as any, args);
}
export function useQueryClient() {
  return useAsyncHook(l => l.useQueryClient as any, []);
}
