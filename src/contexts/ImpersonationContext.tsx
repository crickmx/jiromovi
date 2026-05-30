import { createContext, useContext, useState, useCallback, useEffect, useMemo, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import { cargarPermisosAdicionales } from '../lib/permisosUtils';
import { applyTheme } from '../lib/themeUtils';

type Usuario = Database['public']['Tables']['usuarios']['Row'] & {
  permisosAdicionales?: string[];
  oficina?: { id: string; nombre: string; accent_color: string | null; logo_url: string | null } | null;
};

interface SeguwalletCustomerMinimal {
  id: string;
  auth_user_id: string;
  email: string;
  full_name: string;
  phone: string;
  whatsapp: string | null;
  status: string;
  agent_user_id: string;
}

interface ImpersonationSession {
  id: string;
  platform: 'movi' | 'seguwallet';
  impersonatedUser: Usuario | null;
  impersonatedCustomer: SeguwalletCustomerMinimal | null;
  startedAt: string;
}

interface ImpersonationContextType {
  isImpersonating: boolean;
  isReadOnly: boolean;
  session: ImpersonationSession | null;
  impersonatedUser: Usuario | null;
  impersonatedCustomer: SeguwalletCustomerMinimal | null;
  startImpersonation: (opts: {
    platform: 'movi' | 'seguwallet';
    userId?: string;
    customerId?: string;
    reason?: string;
  }) => Promise<boolean>;
  endImpersonation: () => Promise<void>;
  getDisplayName: () => string;
}

export const ImpersonationContext = createContext<ImpersonationContextType | null>(null);

const NO_OP_CONTEXT: ImpersonationContextType = {
  isImpersonating: false,
  isReadOnly: false,
  session: null,
  impersonatedUser: null,
  impersonatedCustomer: null,
  startImpersonation: async () => false,
  endImpersonation: async () => {},
  getDisplayName: () => '',
};

const STORAGE_KEY = 'movi-impersonation-session';

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ImpersonationSession | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return null;
  });

  const isImpersonating = !!session;
  const isReadOnly = isImpersonating;

  // Apply impersonated user's theme when session is active (handles page reload)
  useEffect(() => {
    if (session?.platform === 'movi' && session.impersonatedUser?.oficina) {
      const oficina = session.impersonatedUser.oficina as any;
      if (oficina?.accent_color) {
        applyTheme(oficina.accent_color);
      }
    }
  }, [session?.id]);

  const startImpersonation = useCallback(async (opts: {
    platform: 'movi' | 'seguwallet';
    userId?: string;
    customerId?: string;
    reason?: string;
  }): Promise<boolean> => {
    const { platform, userId, customerId, reason } = opts;

    let impersonatedUser: Usuario | null = null;
    let impersonatedCustomer: SeguwalletCustomerMinimal | null = null;

    if (platform === 'movi' && userId) {
      const { data, error } = await supabase
        .from('usuarios')
        .select(`
          *,
          oficina:oficinas(id, nombre, accent_color, logo_url),
          regimen_fiscal:commission_fiscal_regimes(id, name)
        `)
        .eq('id', userId)
        .is('deleted_at', null)
        .maybeSingle();

      if (error || !data) {
        console.error('[Impersonation] Error loading user:', error);
        return false;
      }

      // Block impersonating another admin
      if (data.rol === 'Administrador') {
        console.warn('[Impersonation] Cannot impersonate another admin');
        return false;
      }

      // Load additional permissions for Gerente users
      if (data.rol === 'Gerente') {
        const permisos = await cargarPermisosAdicionales(data.id);
        impersonatedUser = { ...data, permisosAdicionales: permisos } as Usuario;
      } else {
        impersonatedUser = data as Usuario;
      }
    } else if (platform === 'seguwallet' && customerId) {
      const { data, error } = await supabase
        .from('seguwallet_customers')
        .select('id, auth_user_id, email, full_name, phone, whatsapp, status, agent_user_id')
        .eq('id', customerId)
        .maybeSingle();

      if (error || !data) {
        console.error('[Impersonation] Error loading customer:', error);
        return false;
      }

      impersonatedCustomer = data;
    } else {
      return false;
    }

    // Log the session in the audit table
    const { data: sessionData, error: insertError } = await supabase
      .from('admin_impersonation_sessions')
      .insert({
        admin_user_id: (await supabase.auth.getUser()).data.user?.id,
        impersonated_user_id: platform === 'movi' ? userId : null,
        impersonated_customer_id: platform === 'seguwallet' ? customerId : null,
        platform,
        status: 'active',
        reason: reason || null,
        user_agent: navigator.userAgent,
      })
      .select('id')
      .maybeSingle();

    if (insertError) {
      console.error('[Impersonation] Error logging session:', insertError);
      // Continue anyway - audit failure shouldn't block functionality
    }

    const newSession: ImpersonationSession = {
      id: sessionData?.id || crypto.randomUUID(),
      platform,
      impersonatedUser,
      impersonatedCustomer,
      startedAt: new Date().toISOString(),
    };

    // Apply the impersonated user's office theme
    if (impersonatedUser?.oficina && typeof impersonatedUser.oficina === 'object' && 'accent_color' in impersonatedUser.oficina) {
      applyTheme((impersonatedUser.oficina as any).accent_color || '#0E23E2');
    }

    setSession(newSession);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
    return true;
  }, []);

  const endImpersonation = useCallback(async () => {
    if (!session) return;

    // Log end of session
    if (session.id) {
      await supabase
        .from('admin_impersonation_sessions')
        .update({ ended_at: new Date().toISOString(), status: 'ended' })
        .eq('id', session.id)
        .eq('status', 'active');
    }

    setSession(null);
    localStorage.removeItem(STORAGE_KEY);

    // Restore the real user's theme by reloading their office color
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: realUser } = await supabase
        .from('usuarios')
        .select('oficina:oficinas(accent_color)')
        .eq('id', user.id)
        .maybeSingle();
      const color = (realUser?.oficina as any)?.accent_color || '#0E23E2';
      applyTheme(color);
    }
  }, [session]);

  const getDisplayName = useCallback((): string => {
    if (!session) return '';
    if (session.platform === 'movi' && session.impersonatedUser) {
      const u = session.impersonatedUser;
      return `${u.nombre || ''} ${u.apellidos || ''}`.trim() || u.email_laboral || 'Usuario';
    }
    if (session.platform === 'seguwallet' && session.impersonatedCustomer) {
      return session.impersonatedCustomer.full_name || session.impersonatedCustomer.email || 'Cliente';
    }
    return 'Usuario';
  }, [session]);

  const value = useMemo(() => ({
    isImpersonating,
    isReadOnly,
    session,
    impersonatedUser: session?.impersonatedUser || null,
    impersonatedCustomer: session?.impersonatedCustomer || null,
    startImpersonation,
    endImpersonation,
    getDisplayName,
  }), [isImpersonating, isReadOnly, session, startImpersonation, endImpersonation, getDisplayName]);

  return (
    <ImpersonationContext.Provider value={value}>
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const context = useContext(ImpersonationContext);
  if (!context) return NO_OP_CONTEXT;
  return context;
}
