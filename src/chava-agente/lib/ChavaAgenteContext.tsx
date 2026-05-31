import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import type { ChavaUser, ChavaTerms } from './types';

interface ChavaAgenteContextValue {
  chavaUser: ChavaUser | null;
  terms: ChavaTerms | null;
  loading: boolean;
  login: (email: string) => Promise<{ email_sent: boolean; whatsapp_sent: boolean; masked_email: string | null }>;
  register: (data: RegisterData) => Promise<{ email_sent: boolean; whatsapp_sent: boolean; masked_email: string | null }>;
  verifyCode: (email: string, code: string) => Promise<void>;
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

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

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

  async function sendCode(email: string) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-login-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ email: email.trim().toLowerCase(), platform: 'chava' }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Error al enviar el código');
    return {
      email_sent: json.email_sent as boolean,
      whatsapp_sent: json.whatsapp_sent as boolean,
      masked_email: json.masked_email as string | null,
    };
  }

  async function login(email: string) {
    return sendCode(email);
  }

  async function register(data: RegisterData) {
    // First ensure the auth user exists via signUp (no email confirmation needed)
    const { error: signUpError } = await supabase.auth.signUp({
      email: data.email.trim().toLowerCase(),
      password: crypto.randomUUID(), // random password — user never uses it
      options: { emailRedirectTo: undefined },
    });
    // Ignore "already registered" errors
    if (signUpError && !signUpError.message.toLowerCase().includes('already')) {
      throw signUpError;
    }

    // Store pending registration data to finalize after code verification
    sessionStorage.setItem('chava_pending_registration', JSON.stringify(data));

    // Send OTP code via MOVI channels
    return sendCode(data.email);
  }

  async function verifyCode(email: string, code: string) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-login-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim().toUpperCase(), platform: 'chava' }),
    });
    const json = await res.json();
    if (!res.ok) {
      const err: any = new Error(json.error || 'Código inválido');
      err.code = json.code;
      err.remaining_attempts = json.remaining_attempts;
      throw err;
    }

    // Verify session using the hashed token returned from the edge function
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: json.token_hash,
      type: 'magiclink',
    });
    if (verifyError) throw verifyError;

    await refreshUser();
  }

  async function createChavaUserAfterAuth(authUserId: string, pending: RegisterData) {
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

    if (error && error.code !== '23505') throw error;

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
    <ChavaAgenteContext.Provider value={{ chavaUser, terms, loading, login, register, verifyCode, logout, refreshUser }}>
      {children}
    </ChavaAgenteContext.Provider>
  );
}

export function useChavaAgente() {
  const ctx = useContext(ChavaAgenteContext);
  if (!ctx) throw new Error('useChavaAgente must be used inside ChavaAgenteProvider');
  return ctx;
}
