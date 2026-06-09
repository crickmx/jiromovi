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
    fetch: (...args) => fetch(...args).catch((err) => {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
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
