import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import type { ChavaUser, ChavaTerms } from './types';

interface ChavaAgenteContextValue {
  chavaUser: ChavaUser | null;
  terms: ChavaTerms | null;
  loading: boolean;
  login: (email: string) => Promise<{ email_sent: boolean; whatsapp_sent: boolean; masked_email: string | null }>;
  register: (data: RegisterData) => Promise<{ email_sent: boolean; whatsapp_sent: boolean; masked_email: string | null; direct_access?: boolean }>;
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
    // Load from unified platform_terms
    const { data } = await supabase
      .from('platform_terms')
      .select('*')
      .eq('activo', true)
      .eq('tipo', 'terminos')
      .limit(1)
      .maybeSingle();
    if (data) {
      // Map to ChavaTerms interface for backward compatibility
      setTerms({
        id: data.id,
        version: String(data.version),
        titulo: data.titulo,
        contenido_terminos: data.contenido_html,
        contenido_privacidad: '',
        activo: data.activo,
        created_at: data.created_at,
      } as ChavaTerms);
    }
    // Also load privacy for the sub-modal
    const { data: privData } = await supabase
      .from('platform_terms')
      .select('contenido_html')
      .eq('activo', true)
      .eq('tipo', 'privacidad')
      .limit(1)
      .maybeSingle();
    if (privData && data) {
      setTerms(prev => prev ? { ...prev, contenido_privacidad: privData.contenido_html } : prev);
    }
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
    // Create or get the Supabase auth user
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: data.email.trim().toLowerCase(),
      password: crypto.randomUUID(),
      options: { emailRedirectTo: undefined },
    });
    // Ignore "already registered" errors
    if (signUpError && !signUpError.message.toLowerCase().includes('already')) {
      throw signUpError;
    }

    // Get the auth user id — either from signUp or from existing session
    let authUserId: string | null = signUpData?.user?.id ?? null;
    if (!authUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      authUserId = user?.id ?? null;
    }

    // Create a provisional chava_agente_users record so send-login-code can find the user
    if (authUserId) {
      const { data: existing } = await supabase
        .from('chava_agente_users')
        .select('id')
        .eq('auth_user_id', authUserId)
        .maybeSingle();

      if (!existing) {
        await supabase.from('chava_agente_users').insert({
          auth_user_id: authUserId,
          nombre_completo: data.nombre_completo,
          email: data.email.trim().toLowerCase(),
          whatsapp: data.whatsapp || null,
          estado: data.estado || null,
          codigo_postal: data.codigo_postal || null,
          tipo_usuario: data.tipo_usuario,
          plataforma_origen: 'externo',
          terminos_aceptados: true,
          terminos_version: data.terms_version,
          terminos_fecha: new Date().toISOString(),
          estatus: 'activo',
        });
      }
    }

    // If Supabase already issued a session (email confirmation disabled), grant direct access
    if (signUpData?.session && authUserId) {
      await loadChavaUser(authUserId);
      return { direct_access: true, email_sent: false, whatsapp_sent: false, masked_email: null };
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
      // Legacy audit
      await supabase.from('chava_agente_user_terms').upsert({
        chava_user_id: newUser.id,
        terms_id: undefined,
        version: pending.terms_version,
        accepted_at: new Date().toISOString(),
        ip_address: pending.terms_ip || null,
      }, { onConflict: 'chava_user_id,version' });

      // Unified platform terms acceptance
      const { data: activeTerms } = await supabase
        .from('platform_terms')
        .select('id, version, tipo')
        .eq('activo', true);

      if (activeTerms && activeTerms.length > 0) {
        const records = activeTerms.map(t => ({
          usuario_id: authUserId,
          terms_id: t.id,
          terms_version: t.version,
          terms_tipo: t.tipo,
          platform: 'chava' as const,
          ip_address: pending.terms_ip || null,
          user_agent: navigator.userAgent,
        }));
        await supabase.from('platform_terms_acceptance').insert(records);
      }
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

      if (existing) {
        // Legacy audit
        await supabase.from('chava_agente_user_terms').upsert({
          chava_user_id: existing.id,
          version: pending.terms_version,
          accepted_at: new Date().toISOString(),
          ip_address: pending.terms_ip || null,
        }, { onConflict: 'chava_user_id,version' });

        // Unified platform terms acceptance
        const { data: activeTerms } = await supabase
          .from('platform_terms')
          .select('id, version, tipo')
          .eq('activo', true);

        if (activeTerms && activeTerms.length > 0) {
          const records = activeTerms.map(t => ({
            usuario_id: user.id,
            terms_id: t.id,
            terms_version: t.version,
            terms_tipo: t.tipo,
            platform: 'chava' as const,
            ip_address: pending.terms_ip || null,
            user_agent: navigator.userAgent,
          }));
          await supabase.from('platform_terms_acceptance').insert(records);
        }
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
