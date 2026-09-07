import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: (...args: Parameters<typeof fetch>) => fetch(...args).catch((err) => {
      const input = args[0];
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : '';
      if (url?.includes('/auth/v1/token')) {
        console.warn('[Supabase] Token refresh network error suppressed:', err?.message);
        return new Response(JSON.stringify({ error: 'network_error' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw err;
    }),
  },
});
