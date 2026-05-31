import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import type { ChavaUser, ChavaTerms } from './types';

interface ChavaAgenteContextValue {
  chavaUser: ChavaUser | null;
  terms: ChavaTerms | null;
  loading: boolean;
  login: (email: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export interface RegisterData {
  nombre_completo: string;
  email: string;
  whatsapp: string;
  estado: string;
  codigo_postal: string;
  tipo_usuario: string;
  terms_version: string;
  terms_ip?: string;
}

const ChavaAgenteContext = createContext<ChavaAgenteContextValue | null>(null);

export function ChavaAgenteProvider({ children }: { children: ReactNode }) {
  const [chavaUser, setChavaUser] = useState<ChavaUser | null>(null);
  const [terms, setTerms] = useState<ChavaTerms | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTerms();
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadChavaUser(session.user.id);
      } else {
        setChavaUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadTerms() {
    const { data } = await supabase
      .from('chava_agente_terms')
      .select('*')
      .eq('activo', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) setTerms(data as ChavaTerms);
  }

  async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await loadChavaUser(session.user.id);
    } else {
      setLoading(false);
    }
  }

  async function loadChavaUser(authUserId: string) {
    const { data } = await supabase
      .from('chava_agente_users')
      .select('*')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    setChavaUser(data as ChavaUser | null);
    setLoading(false);
  }

  async function login(email: string) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (error) throw error;
  }

  async function register(data: RegisterData) {
    // Sign up with OTP — creates auth user if not exists
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: data.email,
      options: { shouldCreateUser: true },
    });
    if (otpError) throw otpError;
    // After OTP verification the edge function or trigger will create chava_agente_users row.
    // We store registration data in sessionStorage so we can finalize after OTP.
    sessionStorage.setItem('chava_pending_registration', JSON.stringify(data));
  }

  async function createChavaUserAfterAuth(authUserId: string, pending: RegisterData) {
    // Insert chava user
    const { data: newUser, error } = await supabase
      .from('chava_agente_users')
      .insert({
        auth_user_id: authUserId,
        nombre_completo: pending.nombre_completo,
        email: pending.email,
        whatsapp: pending.whatsapp,
        estado: pending.estado,
        codigo_postal: pending.codigo_postal,
        tipo_usuario: pending.tipo_usuario,
        plataforma_origen: 'externo',
        terminos_aceptados: true,
        terminos_version: pending.terms_version,
        terminos_fecha: new Date().toISOString(),
        estatus: 'activo',
      })
      .select('*')
      .single();

    if (error && error.code !== '23505') throw error; // ignore duplicate

    // Record terms acceptance
    if (newUser) {
      await supabase.from('chava_agente_user_terms').upsert({
        chava_user_id: newUser.id,
        terms_id: undefined,
        version: pending.terms_version,
        accepted_at: new Date().toISOString(),
        ip_address: pending.terms_ip || null,
      }, { onConflict: 'chava_user_id,version' });
    }

    return newUser;
  }

  async function refreshUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check if pending registration needs to be finalized
    const pendingRaw = sessionStorage.getItem('chava_pending_registration');
    if (pendingRaw) {
      const pending: RegisterData = JSON.parse(pendingRaw);
      const { data: existing } = await supabase
        .from('chava_agente_users')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (!existing) {
        await createChavaUserAfterAuth(user.id, pending);
      }
      sessionStorage.removeItem('chava_pending_registration');
    }

    await loadChavaUser(user.id);
  }

  async function logout() {
    await supabase.auth.signOut();
    setChavaUser(null);
  }

  return (
    <ChavaAgenteContext.Provider value={{ chavaUser, terms, loading, login, register, logout, refreshUser }}>
      {children}
    </ChavaAgenteContext.Provider>
  );
}

export function useChavaAgente() {
  const ctx = useContext(ChavaAgenteContext);
  if (!ctx) throw new Error('useChavaAgente must be used inside ChavaAgenteProvider');
  return ctx;
}
