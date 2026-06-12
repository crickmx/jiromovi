import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { cargarPermisosAdicionales } from '../lib/permisosUtils';
import { applyTheme } from '../lib/themeUtils';
import { useImpersonation } from './ImpersonationContext';
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

// Inner provider — must live inside ImpersonationProvider
function MoviAuthProviderInner({ children }: { children: ReactNode }) {
  const [realUser, setRealUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const { isImpersonating, impersonatedUser } = useImpersonation();

  async function loadProfile(userId: string) {
    console.log('[MoviAuth] loadProfile userId=', userId);
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select(`
          *,
          oficina:oficinas(id, nombre, accent_color, logo_url, whatsapp, telefono, email, domicilio),
          regimen_fiscal:commission_fiscal_regimes(id, name)
        `)
        .eq('id', userId)
        .maybeSingle();

      if (!data) {
        console.log('[MoviAuth] No usuario found for userId=', userId, error?.message);
        setRealUser(null);
        setLoading(false);
        return;
      }

      let u: Usuario = data as Usuario;
      if (u.rol === 'Gerente') {
        const permisos = await cargarPermisosAdicionales(u.id);
        u = { ...u, permisosAdicionales: permisos };
      }

      if (u.oficina?.accent_color && !isImpersonating) applyTheme(u.oficina.accent_color);

      console.log('[MoviAuth] Usuario loaded:', u.nombre, u.apellidos, 'rol=', u.rol);
      setRealUser(u);
      setLoading(false);
    } catch (err: any) {
      console.warn('[MoviAuth] loadProfile failed:', err?.message);
      setRealUser(null);
      setLoading(false);
    }
  }

  async function reloadUsuario() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) await loadProfile(session.user.id);
  }

  useEffect(() => {
    console.log('[MoviAuth] init');
    let initialLoadDone = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        console.log('[MoviAuth] initial session found, userId=', session.user.id);
        initialLoadDone = true;
        loadProfile(session.user.id);
      } else {
        console.log('[MoviAuth] no initial session');
        initialLoadDone = true;
        setLoading(false);
      }
    }).catch((err) => {
      console.warn('[MoviAuth] getSession failed (network/refresh):', err?.message);
      initialLoadDone = true;
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[MoviAuth] onAuthStateChange event=', event, 'hasSession=', !!session);
      if (event === 'SIGNED_IN' && session) {
        if (!initialLoadDone) return;
        setLoading(true);
        loadProfile(session.user.id);
      } else if (
        (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') &&
        session
      ) {
        loadProfile(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        console.log('[MoviAuth] signed out');
        setRealUser(null);
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
    setRealUser(null);
    await supabase.auth.signOut();
  }

  // During impersonation, expose the masked user as `usuario`
  // but always keep `realUsuario` pointing to the authenticated admin
  const usuario = (isImpersonating && impersonatedUser)
    ? impersonatedUser as unknown as Usuario
    : realUser;

  return (
    <MoviAuthContext.Provider value={{
      usuario,
      realUsuario: realUser,
      loading,
      signIn,
      signOut,
      reloadUsuario,
    }}>
      {children}
    </MoviAuthContext.Provider>
  );
}

export function MoviAuthProvider({ children }: { children: ReactNode }) {
  return (
    <MoviAuthProviderInner>
      {children}
    </MoviAuthProviderInner>
  );
}

export const useMoviAuth = () => useContext(MoviAuthContext);

