import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { cargarPermisosAdicionales } from '../lib/permisosUtils';
import { applyTheme } from '../lib/themeUtils';
import type { Database } from '../lib/database.types';

type UsuarioRow = Database['public']['Tables']['usuarios']['Row'];

export type Usuario = UsuarioRow & {
  permisosAdicionales?: string[];
  oficina?: {
    id: string;
    nombre: string;
    accent_color: string | null;
    logo_url: string | null;
    whatsapp: string | null;
    telefono: string | null;
    email: string | null;
    domicilio: string | null;
  } | null;
  regimen_fiscal?: { id: string; name: string } | null;
};

interface MoviAuthCtx {
  usuario: Usuario | null;
  realUsuario: Usuario | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  reloadUsuario: () => Promise<void>;
}

const MoviAuthContext = createContext<MoviAuthCtx>({} as MoviAuthCtx);

export function MoviAuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string, isInitial = false) {
    console.log('[MoviAuth] loadProfile userId=', userId);
    const { data } = await supabase
      .from('usuarios')
      .select(`
        *,
        oficina:oficinas(id, nombre, accent_color, logo_url, whatsapp, telefono, email, domicilio),
        regimen_fiscal:commission_fiscal_regimes(id, name)
      `)
      .eq('id', userId)
      .maybeSingle();

    if (!data) {
      console.log('[MoviAuth] No usuario found for userId=', userId);
      // Only clear the user on an initial load — never during a silent refresh
      if (isInitial) {
        setUsuario(null);
        setLoading(false);
      }
      return;
    }

    let u: Usuario = data as Usuario;
    if (u.rol === 'Gerente') {
      const permisos = await cargarPermisosAdicionales(u.id);
      u = { ...u, permisosAdicionales: permisos };
    }

    if (u.oficina?.accent_color) applyTheme(u.oficina.accent_color);

    console.log('[MoviAuth] Usuario loaded:', u.nombre, u.apellidos, 'rol=', u.rol);
    setUsuario(u);
    setLoading(false);
  }

  async function reloadUsuario() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) await loadProfile(session.user.id);
  }

  useEffect(() => {
    console.log('[MoviAuth] init');
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        console.log('[MoviAuth] initial session found, userId=', session.user.id);
        loadProfile(session.user.id, true);
      } else {
        console.log('[MoviAuth] no initial session');
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[MoviAuth] onAuthStateChange event=', event, 'hasSession=', !!session);
      if (event === 'SIGNED_IN' && session) {
        // Only show the full loader on the very first sign-in (no user loaded yet).
        // On tab-focus Supabase re-fires SIGNED_IN for an already-authenticated session;
        // setting loading=true in that case unmounts the page and causes a blank screen.
        setUsuario(prev => {
          if (!prev) setLoading(true);
          return prev;
        });
        (async () => { await loadProfile(session.user.id); })();
      } else if (
        (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') &&
        session
      ) {
        // Silent refresh — never touch loading state
        (async () => { await loadProfile(session.user.id); })();
      } else if (event === 'SIGNED_OUT') {
        console.log('[MoviAuth] signed out');
        setUsuario(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }

  async function signOut() {
    console.log('[MoviAuth] signing out');
    setUsuario(null);
    await supabase.auth.signOut();
  }

  return (
    <MoviAuthContext.Provider value={{
      usuario,
      realUsuario: usuario,
      loading,
      signIn,
      signOut,
      reloadUsuario,
    }}>
      {children}
    </MoviAuthContext.Provider>
  );
}

export const useMoviAuth = () => useContext(MoviAuthContext);
