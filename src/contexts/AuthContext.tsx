import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type Usuario = Database['public']['Tables']['usuarios']['Row'];

interface AuthContextType {
  user: User | null;
  usuario: Usuario | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  refreshUsuario: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUsuario = async (userId: string) => {
    try {
      console.log('[AuthContext] Fetching usuario for ID:', userId);

      const { data, error } = await supabase
        .from('usuarios')
        .select(`
          *,
          oficina:oficinas(id, nombre),
          regimen_fiscal:commission_fiscal_regimes(id, name)
        `)
        .eq('id', userId)
        .eq('activo', true)
        .eq('is_deleted', false)
        .maybeSingle();

      if (error) {
        console.error('[AuthContext] Error fetching usuario:', error);
        console.error('[AuthContext] Error details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        setUsuario(null);
        return;
      }

      if (!data) {
        console.warn('[AuthContext] Usuario not found or not active:', userId);
        console.warn('[AuthContext] This usually means:');
        console.warn('  1. User does not exist in usuarios table');
        console.warn('  2. User activo field is false');
        console.warn('  3. User was deleted');

        await supabase.auth.signOut();
        setUsuario(null);
        return;
      }

      console.log('[AuthContext] Usuario loaded successfully:', {
        id: data.id,
        nombre: data.nombre,
        apellidos: data.apellidos,
        rol: data.rol,
        email_laboral: data.email_laboral
      });

      setUsuario(data);
    } catch (err) {
      console.error('[AuthContext] Unexpected error fetching usuario:', err);
      setUsuario(null);
    }
  };

  const refreshUsuario = async () => {
    if (user) {
      await fetchUsuario(user.id);
    }
  };

  useEffect(() => {
    console.log('[AuthContext] Initializing...');

    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[AuthContext] Initial session check:', session?.user?.email || 'No session');
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUsuario(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AuthContext] Auth state changed:', event, session?.user?.email || 'No session');
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchUsuario(session.user.id);
        } else {
          setUsuario(null);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    console.log('[AuthContext] Attempting sign in for:', email);
    console.log('[AuthContext] Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
    console.log('[AuthContext] Has Anon Key:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('[AuthContext] Sign in failed:', error);
        console.error('[AuthContext] Error details:', {
          message: error.message,
          status: error.status,
          name: error.name,
          code: error.code
        });
        return { error };
      }

      console.log('[AuthContext] Sign in successful:', {
        userId: data.user?.id,
        email: data.user?.email
      });

      // CRITICAL: Esperar a que el usuario se cargue antes de retornar
      // Esto previene la race condition donde navegamos antes de que fetchUsuario termine
      if (data.user) {
        console.log('[AuthContext] Waiting for usuario to load...');
        setUser(data.user);
        await fetchUsuario(data.user.id);
        console.log('[AuthContext] Usuario loaded, ready to navigate');
      }

      return { error: null };
    } catch (err: any) {
      console.error('[AuthContext] Network or unexpected error:', {
        message: err.message,
        name: err.name,
        stack: err.stack
      });

      const networkError: AuthError = {
        name: 'NetworkError',
        message: err.message || 'Error de conexión. Verifica tu conexión a internet y que la URL de Supabase sea correcta.',
        status: 0,
      } as AuthError;

      return { error: networkError };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUsuario(null);
  };

  const value = {
    user,
    usuario,
    loading,
    signIn,
    signOut,
    refreshUsuario,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
}
