import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { cargarPermisosAdicionales } from '../lib/permisosUtils';
import { applyTheme } from '../lib/themeUtils';
import type { Database } from '../lib/database.types';

// ── Platform detection ──────────────────────────────────────────────────────
const _hostname = window.location.hostname;
const _SEGUWALLET = ['seguwallet.mx', 'www.seguwallet.mx', 'app.seguwallet.mx'];
const _CHAVA = ['agentedeseguros.ai', 'www.agentedeseguros.ai'];
export const isMoviPlatform = !_SEGUWALLET.includes(_hostname) && !_CHAVA.includes(_hostname);

// ── Types ────────────────────────────────────────────────────────────────────
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

interface SwCustomer {
  id: string;
  auth_user_id: string;
  agent_user_id: string | null;
  email: string;
  full_name: string;
  phone: string | null;
  whatsapp: string | null;
  status: string;
  profile_completed: boolean;
}

interface AgentInfo {
  id: string;
  nombre: string;
  apellidos: string;
  celular_laboral: string | null;
  celular_personal: string | null;
  email_laboral: string | null;
  imagen_perfil_url: string | null;
  url_web_jiro: string | null;
  oficina_id: string | null;
}

interface OfficeInfo {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  logo_url: string | null;
  accent_color: string | null;
  whatsapp: string | null;
  sitio_web: string | null;
  domicilio: string | null;
}

interface AuthCtx {
  // MOVI fields
  usuario: Usuario | null;
  realUsuario: Usuario | null;
  // Seguwallet fields
  customer: SwCustomer | null;
  agent: AgentInfo | null;
  office: OfficeInfo | null;
  // Shared
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  reloadUsuario: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({} as AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [customer, setCustomer] = useState<SwCustomer | null>(null);
  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [office, setOffice] = useState<OfficeInfo | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadMoviProfile(userId: string) {
    const { data } = await supabase
      .from('usuarios')
      .select(`
        *,
        oficina:oficinas(id, nombre, accent_color, logo_url, whatsapp, telefono, email, domicilio),
        regimen_fiscal:commission_fiscal_regimes(id, name)
      `)
      .eq('id', userId)
      .maybeSingle();

    if (!data) { setLoading(false); return; }

    let u: Usuario = data as Usuario;
    if (u.rol === 'Gerente') {
      const permisos = await cargarPermisosAdicionales(u.id);
      u = { ...u, permisosAdicionales: permisos };
    }

    if (u.oficina?.accent_color) applyTheme(u.oficina.accent_color);

    setUsuario(u);
    setLoading(false);
  }

  async function loadSwProfile(userId: string) {
    const { data: cust } = await supabase
      .from('seguwallet_customers')
      .select('*')
      .eq('auth_user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    if (!cust) { setLoading(false); return; }
    setCustomer(cust);

    if (cust.agent_user_id) {
      const { data: ag } = await supabase
        .from('usuarios')
        .select('id,nombre,apellidos,celular_laboral,celular_personal,email_laboral,imagen_perfil_url,url_web_jiro,oficina_id')
        .eq('id', cust.agent_user_id)
        .maybeSingle();
      if (ag) {
        setAgent(ag);
        if (ag.oficina_id) {
          const { data: of } = await supabase
            .from('oficinas')
            .select('id,nombre,telefono,email,logo_url,accent_color,whatsapp,sitio_web,domicilio')
            .eq('id', ag.oficina_id)
            .maybeSingle();
          if (of) setOffice(of as OfficeInfo);
        }
      }
    }
    setLoading(false);
  }

  async function loadProfile(userId: string) {
    if (isMoviPlatform) await loadMoviProfile(userId);
    else await loadSwProfile(userId);
  }

  async function reloadUsuario() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) await loadMoviProfile(session.user.id);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) loadProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        (() => { loadProfile(session.user.id); })();
      } else if (event === 'SIGNED_OUT') {
        setUsuario(null);
        setCustomer(null);
        setAgent(null);
        setOffice(null);
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
    setUsuario(null);
    setCustomer(null);
    setAgent(null);
    setOffice(null);
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{
      usuario,
      realUsuario: usuario,
      customer,
      agent,
      office,
      loading,
      signIn,
      signOut,
      reloadUsuario,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
