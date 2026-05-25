import { supabase } from '../../lib/supabase';

export interface SeguwalletCustomer {
  id: string;
  auth_user_id: string;
  agent_user_id: string;
  email: string;
  full_name: string;
  phone: string;
  status: 'active' | 'inactive' | 'blocked';
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function seguwalletSignIn(email: string, password: string) {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) throw authError;

  const { data: customer, error: customerError } = await supabase
    .from('seguwallet_customers')
    .select('*')
    .eq('auth_user_id', authData.user.id)
    .maybeSingle();

  if (customerError) throw customerError;
  if (!customer) {
    await supabase.auth.signOut();
    throw new Error('Esta cuenta no tiene acceso a Seguwallet.');
  }

  if (customer.status === 'blocked') {
    await supabase.auth.signOut();
    throw new Error('Tu cuenta está bloqueada. Contacta a tu agente.');
  }

  if (customer.status === 'inactive') {
    await supabase.auth.signOut();
    throw new Error('Tu cuenta está inactiva. Contacta a tu agente.');
  }

  await supabase
    .from('seguwallet_customers')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', customer.id);

  await supabase.from('seguwallet_access_logs').insert({
    seguwallet_customer_id: customer.id,
    event_type: 'login_success',
  });

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
    .select('id, nombre, apellidos, email, celular_laboral, nombre_publico, imagen_perfil_url, oficina_id, oficinas(nombre)')
    .eq('id', agentUserId)
    .maybeSingle();

  return data;
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
