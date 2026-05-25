import { supabase } from '../../lib/supabase';

export interface SeguwalletCustomer {
  id: string;
  auth_user_id: string;
  agent_user_id: string;
  email: string;
  full_name: string;
  phone: string;
  whatsapp: string | null;
  status: 'active' | 'inactive' | 'blocked';
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  profile_updated_at: string | null;
  // Profile photo
  profile_photo_url: string | null;
  profile_photo_path: string | null;
  // Profile completion
  state: string | null;
  municipality: string | null;
  birth_date: string | null;
  gender: 'masculino' | 'femenino' | 'no_binario' | 'prefiero_no_decir' | null;
  profile_completed: boolean;
  profile_completed_at: string | null;
  // Terms acceptance
  terms_accepted: boolean;
  terms_accepted_at: string | null;
  terms_version_accepted: string | null;
  terms_id_accepted: string | null;
}

export interface SeguwalletTerms {
  id: string;
  title: string;
  version: string;
  content: string;
  published_at: string | null;
}

export async function getActiveSeguwalletTerms(): Promise<SeguwalletTerms | null> {
  const { data } = await supabase.rpc('get_active_seguwallet_terms');
  if (!data || data.length === 0) return null;
  return data[0] as SeguwalletTerms;
}

export async function seguwalletSignIn(email: string, password: string) {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) throw authError;

  // Verify this auth user has a Seguwallet customer record
  const { data: customer, error: customerError } = await supabase
    .from('seguwallet_customers')
    .select('*')
    .eq('auth_user_id', authData.user.id)
    .maybeSingle();

  if (customerError) {
    await supabase.auth.signOut();
    throw new Error('Error al verificar tu cuenta. Intenta de nuevo.');
  }
  if (!customer) {
    await supabase.auth.signOut();
    throw new Error('Esta cuenta no tiene acceso a Seguwallet.');
  }
  if (customer.status === 'blocked') {
    await supabase.auth.signOut();
    throw new Error('Tu cuenta esta bloqueada. Contacta a tu agente.');
  }
  if (customer.status === 'inactive') {
    await supabase.auth.signOut();
    throw new Error('Tu cuenta esta inactiva. Contacta a tu agente.');
  }

  return { user: authData.user, customer };
}

export async function seguwalletSignOut() {
  await supabase.auth.signOut();
}

export async function getSeguwalletCustomer(authUserId: string): Promise<SeguwalletCustomer | null> {
  const { data } = await supabase
    .from('seguwallet_customers')
    .select('*')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  return data;
}

export async function getSeguwalletSicasClients(customerId: string) {
  const { data } = await supabase
    .from('seguwallet_customer_sicas_clients')
    .select('*')
    .eq('seguwallet_customer_id', customerId)
    .order('sicas_client_name');

  return data || [];
}

export async function getAgentInfo(agentUserId: string) {
  const { data } = await supabase
    .from('usuarios')
    .select('id, nombre, apellidos, celular_laboral, nombre_publico, imagen_perfil_url, oficina_id, oficinas(nombre)')
    .eq('id', agentUserId)
    .maybeSingle();

  return data;
}

export interface SicasClientResult {
  sicas_client_id: string;
  client_name: string;
  rfc: string;
  vend_id: string;
  poliza_count?: number;
}

// Get SICAS clients for an agent using the server-side RPC (fast, server-side dedup)
export async function getAgentSicasClients(
  agentUserId: string,
  query = '',
  limit = 200,
  offset = 0,
): Promise<SicasClientResult[]> {
  const { data, error } = await supabase.rpc('search_sicas_clients_for_agent', {
    p_agent_user_id: agentUserId,
    p_query: query,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    console.error('search_sicas_clients_for_agent error:', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    sicas_client_id: row.sicas_client_id,
    client_name: row.client_name,
    rfc: '',
    vend_id: row.vend_id,
    poliza_count: Number(row.poliza_count),
  }));
}

// Search SICAS clients (admin, all vendors) using server-side RPC
export async function searchSicasClientsAdmin(
  query = '',
  limit = 200,
  offset = 0,
): Promise<SicasClientResult[]> {
  const { data, error } = await supabase.rpc('search_sicas_clients_admin', {
    p_query: query,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    console.error('search_sicas_clients_admin error:', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    sicas_client_id: row.sicas_client_id,
    client_name: row.client_name,
    rfc: '',
    vend_id: row.vend_id,
    poliza_count: Number(row.poliza_count),
  }));
}

export async function logDownload(customerId: string, doc: {
  document_id?: string;
  document_type?: string;
  document_name?: string;
  policy_number?: string;
}) {
  await supabase.from('seguwallet_download_logs').insert({
    seguwallet_customer_id: customerId,
    document_id: doc.document_id || '',
    document_type: doc.document_type || '',
    document_name: doc.document_name || '',
    policy_number: doc.policy_number || '',
  });
}

export function isSeguwallet(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname === 'app.seguwallet.mx' || hostname === 'seguwallet.mx';
}

export function isSeguwalletRoute(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.startsWith('/seguwallet');
}
