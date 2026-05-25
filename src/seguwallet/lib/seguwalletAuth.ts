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

  // Verify this auth user has a Seguwallet customer record
  const { data: customer, error: customerError } = await supabase
    .from('seguwallet_customers')
    .select('id, status, email, full_name, auth_user_id, agent_user_id, phone, last_login_at, created_at, updated_at')
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

// Get SICAS clients available for an agent's portfolio
// Queries sicas_mapeo_vendedor_usuario to find the agent's vend_ids,
// then gets distinct clients from sicas_documents
export async function getAgentSicasClients(agentUserId: string): Promise<Array<{
  sicas_client_id: string;
  client_name: string;
  rfc: string;
  vend_id: string;
}>> {
  // Get the agent's SICAS vendor IDs
  const { data: mappings } = await supabase
    .from('sicas_mapeo_vendedor_usuario')
    .select('id_sicas_vendedor')
    .eq('movi_user_id', agentUserId);

  if (!mappings || mappings.length === 0) {
    // If no mapping found, try querying all vendors for admin use
    // Return distinct clients from all documents scoped to agent
    return [];
  }

  const vendIds = mappings.map(m => m.id_sicas_vendedor);

  // Get distinct clients from sicas_documents by vend_id
  const { data: docs } = await supabase
    .from('sicas_documents')
    .select('cliente, vend_id, desp_id')
    .in('vend_id', vendIds)
    .not('cliente', 'is', null)
    .order('cliente');

  if (!docs) return [];

  // Deduplicate by cliente name
  const seen = new Set<string>();
  const clients: Array<{ sicas_client_id: string; client_name: string; rfc: string; vend_id: string }> = [];

  for (const doc of docs) {
    if (!doc.cliente || seen.has(doc.cliente)) continue;
    seen.add(doc.cliente);
    clients.push({
      sicas_client_id: doc.cliente, // use client name as ID since no numeric client ID
      client_name: doc.cliente,
      rfc: '',
      vend_id: doc.vend_id,
    });
  }

  return clients;
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
