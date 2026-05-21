import { supabase } from './supabase';

export interface SharedQuoteFormLink {
  id: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  agent_id: string;
  agent_slug: string;
  office_id: string | null;
  quote_form_template_id: string | null;
  intelligent_agent_id: string | null;
  form_type: string;
  form_slug: string;
  form_title: string;
  unique_code: string;
  slug: string;
  public_url: string;
  status: 'active' | 'inactive' | 'expired' | 'deprecated';
  brand_config_json: Record<string, any>;
  submissions_count: number;
  last_submission_at: string | null;
  expires_at: string | null;
  metadata_json: Record<string, any>;
}

const FORM_TYPE_TO_SLUG: Record<string, string> = {
  auto_individual: 'auto',
  auto_residente: 'auto',
  flotilla_autos: 'flotilla',
  gmm_individual: 'gmm',
  gmm_colectivo_empresarial: 'gmm-colectivo',
  vida_individual: 'vida',
  vida_grupo_colectivo: 'vida-grupo',
  ap_individual: 'ap',
  ap_colectivo: 'ap-colectivo',
  salud_gastos_menores: 'salud',
  dental_vision: 'dental',
  hogar_casa_habitacion: 'hogar',
  empresa_paquete_empresarial: 'empresa',
  pyme_comercio: 'pyme',
  rc_general: 'rc-general',
  rc_productos: 'rc-productos',
  rc_profesional: 'rc-profesional',
  rc_transportistas: 'rc-transportistas',
  fianzas: 'fianzas',
  caucion: 'caucion',
  credito_comercial: 'credito',
  cyber_riesgos_ciberneticos: 'cyber',
  d_o: 'do',
  responsabilidad_laboral: 'resp-laboral',
  fidelidad_empleados: 'fidelidad',
  crime_empresarial: 'crime',
  transporte_carga: 'transporte',
  transporte_maritimo: 'maritimo',
  transporte_valores: 'valores',
  obra_civil: 'obra-civil',
  todo_riesgo_construccion: 'construccion',
  equipo_contratistas: 'equipo',
  maquinaria_equipo_electronico: 'maquinaria',
  calderas_maquinas: 'calderas',
  seguro_agricola: 'agricola',
  seguro_ganadero: 'ganadero',
  maquinaria_agricola: 'maq-agricola',
  eventos: 'evento',
  mascotas: 'mascota',
  arrendamiento: 'arrendamiento',
  condominal: 'condominal',
  obras_arte: 'arte',
};

function generateUniqueCode(length = 7): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function nameToSlug(name: string): string {
  const clean = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();

  const parts = clean.split(/\s+/);
  if (parts.length >= 2) {
    // Use first letter of first name + last name
    return (parts[0][0] + parts[parts.length - 1]).substring(0, 12);
  }
  return parts[0]?.substring(0, 12) || 'agente';
}

async function resolveAgentSlug(agentId: string): Promise<string> {
  try {
    const { data: user } = await supabase
      .from('usuarios')
      .select('nombre, apellido_paterno, apellido_materno, nombre_publico, slug')
      .eq('id', agentId)
      .maybeSingle();

    if (!user) return 'agente';

    // Priority: slug field → nombre_publico slug → name-derived
    if ((user as any).slug) return (user as any).slug;

    const fullName = [user.nombre, user.apellido_paterno].filter(Boolean).join(' ');
    return nameToSlug(fullName) || 'agente';
  } catch {
    return 'agente';
  }
}

export async function createSharedLink(
  agentId: string,
  officeId: string | null,
  formType: string,
  formTitle: string,
  templateId: string | null
): Promise<SharedQuoteFormLink> {
  const agentSlug = await resolveAgentSlug(agentId);
  const formSlug = FORM_TYPE_TO_SLUG[formType] || formType.replace(/_/g, '-').substring(0, 20);

  // Try up to 5 times to find a unique code
  let slug = '';
  let attempts = 0;
  while (attempts < 5) {
    const code = generateUniqueCode(7);
    slug = `${agentSlug}-${formSlug}-${code}`;
    const { data: existing } = await supabase
      .from('shared_quote_form_links')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!existing) break;
    attempts++;
  }

  // Fetch brand config
  const { data: brandData } = await supabase
    .rpc('get_agent_brand_config', { p_agent_id: agentId });

  const publicUrl = `https://agentedeseguros.website/cotizar/${slug}`;

  const { data, error } = await supabase
    .from('shared_quote_form_links')
    .insert({
      created_by: agentId,
      agent_id: agentId,
      agent_slug: agentSlug,
      office_id: officeId,
      quote_form_template_id: templateId,
      form_type: formType,
      form_slug: formSlug,
      form_title: formTitle,
      unique_code: slug.split('-').pop()!,
      slug,
      public_url: publicUrl,
      status: 'active',
      brand_config_json: brandData || {},
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function fetchAgentSharedLinks(agentId: string): Promise<SharedQuoteFormLink[]> {
  const { data, error } = await supabase
    .from('shared_quote_form_links')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchSharedLinkByFormType(
  agentId: string,
  formType: string
): Promise<SharedQuoteFormLink | null> {
  const { data } = await supabase
    .from('shared_quote_form_links')
    .select('*')
    .eq('agent_id', agentId)
    .eq('form_type', formType)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function deactivateSharedLink(linkId: string): Promise<void> {
  const { error } = await supabase
    .from('shared_quote_form_links')
    .update({ status: 'inactive' })
    .eq('id', linkId);
  if (error) throw error;
}

export async function regenerateSharedLink(
  linkId: string,
  agentId: string
): Promise<SharedQuoteFormLink> {
  // Deprecate old link
  await supabase
    .from('shared_quote_form_links')
    .update({ status: 'deprecated' })
    .eq('id', linkId);

  // Fetch old link data
  const { data: old } = await supabase
    .from('shared_quote_form_links')
    .select('*')
    .eq('id', linkId)
    .maybeSingle();

  if (!old) throw new Error('Link no encontrado');

  return createSharedLink(agentId, old.office_id, old.form_type, old.form_title, old.quote_form_template_id);
}
