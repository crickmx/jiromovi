import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../../lib/supabase';

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

interface SeguwalletAuthCtx {
  customer: SwCustomer | null;
  agent: AgentInfo | null;
  office: OfficeInfo | null;
  loading: boolean;
  signOut: () => Promise<void>;
  reloadCustomer: () => Promise<void>;
}

const SeguwalletAuthContext = createContext<SeguwalletAuthCtx>({} as SeguwalletAuthCtx);

export function SeguwalletAuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<SwCustomer | null>(null);
  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [office, setOffice] = useState<OfficeInfo | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    console.log('[SwAuth] loadProfile userId=', userId);
    const { data: cust } = await supabase
      .from('seguwallet_customers')
      .select('*')
      .eq('auth_user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    if (!cust) {
      console.log('[SwAuth] No active customer for userId=', userId);
      setCustomer(null);
      setLoading(false);
      return;
    }

    console.log('[SwAuth] Customer loaded:', cust.full_name, cust.email);
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

  async function reloadCustomer() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) await loadProfile(session.user.id);
  }

  useEffect(() => {
    console.log('[SwAuth] init');
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        console.log('[SwAuth] initial session found, userId=', session.user.id);
        loadProfile(session.user.id);
      } else {
        console.log('[SwAuth] no initial session');
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[SwAuth] onAuthStateChange event=', event, 'hasSession=', !!session);
      if (
        (event === 'SIGNED_IN' ||
          event === 'TOKEN_REFRESHED' ||
          event === 'USER_UPDATED' ||
          event === 'INITIAL_SESSION') &&
        session
      ) {
        setLoading(true);
        (async () => { await loadProfile(session.user.id); })();
      } else if (event === 'SIGNED_OUT') {
        console.log('[SwAuth] signed out');
        setCustomer(null);
        setAgent(null);
        setOffice(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    console.log('[SwAuth] signing out');
    setCustomer(null);
    setAgent(null);
    setOffice(null);
    await supabase.auth.signOut();
  }

  return (
    <SeguwalletAuthContext.Provider value={{
      customer,
      agent,
      office,
      loading,
      signOut,
      reloadCustomer,
    }}>
      {children}
    </SeguwalletAuthContext.Provider>
  );
}

export const useSeguwalletAuth = () => useContext(SeguwalletAuthContext);
