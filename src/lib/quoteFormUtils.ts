import { supabase } from './supabase';
import type { QuoteForm, QuoteFormTemplate, QuoteFormStatus, QuoteFormAttachment, QuoteFormHistoryEntry } from './quoteFormTypes';

export async function fetchQuoteFormTemplates(): Promise<QuoteFormTemplate[]> {
  const { data, error } = await supabase
    .from('quote_form_templates')
    .select('*')
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('title', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchQuoteForms(filters?: {
  status?: string;
  form_type?: string;
  agent_id?: string;
  office_id?: string;
  search?: string;
  priority?: string;
}): Promise<QuoteForm[]> {
  let query = supabase
    .from('quote_forms')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.form_type) query = query.eq('form_type', filters.form_type);
  if (filters?.agent_id) query = query.eq('agent_id', filters.agent_id);
  if (filters?.office_id) query = query.eq('office_id', filters.office_id);
  if (filters?.priority) query = query.eq('priority', filters.priority);
  if (filters?.search) {
    query = query.or(`folio.ilike.%${filters.search}%,client_name.ilike.%${filters.search}%,client_rfc.ilike.%${filters.search}%`);
  }

  const { data, error } = await query.limit(100);
  if (error) throw error;
  return data || [];
}

export async function fetchQuoteFormById(id: string): Promise<QuoteForm | null> {
  const { data, error } = await supabase
    .from('quote_forms')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createQuoteForm(formData: Partial<QuoteForm>): Promise<QuoteForm> {
  const { data, error } = await supabase
    .from('quote_forms')
    .insert(formData)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateQuoteForm(id: string, updates: Partial<QuoteForm>): Promise<QuoteForm> {
  const { data, error } = await supabase
    .from('quote_forms')
    .update(updates)
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Formulario no encontrado. Es posible que haya sido eliminado.');
  return data;
}

export async function submitQuoteForm(id: string, userId: string): Promise<{ quoteForm: QuoteForm; ticketId: string | null }> {
  const form = await fetchQuoteFormById(id);
  if (!form) throw new Error('Formulario no encontrado');

  // Update form status to enviado
  const updated = await updateQuoteForm(id, {
    status: 'enviado',
    submitted_at: new Date().toISOString(),
  });

  // Look up "Iniciado" estatus
  const { data: estatusIniciado } = await supabase
    .from('ticket_estatus')
    .select('id')
    .eq('nombre', 'Iniciado')
    .eq('activo', true)
    .maybeSingle();

  if (!estatusIniciado) throw new Error('No se encontro el estatus Iniciado');

  // Build rich instructions from form data
  const instrucciones = buildQuoteFormInstrucciones(form);

  // Map priority
  const prioridad = form.priority === 'urgente' ? 'Alta' : form.priority === 'alta' ? 'Alta' : form.priority === 'baja' ? 'Baja' : 'Media';

  // Create linked ticket
  const agentId = form.agent_id || userId;
  const { data: ticket, error: ticketErr } = await supabase
    .from('tickets')
    .insert({
      folio: '',
      tipo_tramite: 'formulario_cotizacion',
      estatus_id: estatusIniciado.id,
      prioridad,
      instrucciones,
      creado_por: userId,
      modificado_por: userId,
      agente_id: agentId,
      agente_usuario_id: agentId,
      assigned_to_user_id: userId,
      quote_form_id: id,
    })
    .select('id')
    .single();

  if (ticketErr) throw ticketErr;

  const ticketId = ticket.id;
  await updateQuoteForm(id, { ticket_id: ticketId });

  // Copy attachments from quote form to the ticket
  const attachments = await fetchQuoteFormAttachments(id);
  if (attachments.length > 0) {
    const ticketArchivos = attachments.map(att => ({
      ticket_id: ticketId,
      nombre: att.file_name,
      url: att.file_url,
      tipo: att.file_type || 'application/octet-stream',
      tamano: att.file_size || 0,
      usuario_id: userId,
    }));
    await supabase.from('ticket_archivos').insert(ticketArchivos);
  }

  // Record in history
  await addQuoteFormHistory(id, userId, 'formulario_enviado', 'Formulario de cotizacion enviado', 'borrador', 'enviado', ticketId);

  return { quoteForm: updated, ticketId };
}

function buildQuoteFormInstrucciones(form: QuoteForm): string {
  const parts: string[] = [];
  parts.push(`[COT] ${form.form_title} - ${form.client_name}`);
  parts.push('');

  if (form.client_name) parts.push(`Cliente: ${form.client_name}`);
  if (form.client_type && form.client_type !== 'no_especificado') parts.push(`Tipo: ${form.client_type}`);
  if (form.client_phone) parts.push(`Telefono: ${form.client_phone}`);
  if (form.client_email) parts.push(`Email: ${form.client_email}`);
  if (form.client_whatsapp) parts.push(`WhatsApp: ${form.client_whatsapp}`);
  if (form.client_rfc) parts.push(`RFC: ${form.client_rfc}`);
  if (form.client_address_compact) parts.push(`Domicilio: ${form.client_address_compact}`);
  if (form.risk_location_compact) parts.push(`Ubicacion riesgo: ${form.risk_location_compact}`);
  if (form.currency) parts.push(`Moneda: ${form.currency}`);
  if (form.payment_frequency) parts.push(`Frecuencia pago: ${form.payment_frequency}`);
  if (form.start_date) parts.push(`Vigencia desde: ${form.start_date}`);
  if (form.end_date) parts.push(`Vigencia hasta: ${form.end_date}`);
  if (form.notes) parts.push(`Notas: ${form.notes}`);

  // Include any extra data from data_json
  if (form.data_json && typeof form.data_json === 'object') {
    const extras = Object.entries(form.data_json).filter(
      ([k, v]) => v && typeof v === 'string' && v.trim() !== '' && !k.startsWith('client_')
    );
    if (extras.length > 0) {
      parts.push('');
      parts.push('--- Datos adicionales ---');
      for (const [key, val] of extras) {
        parts.push(`${key.replace(/_/g, ' ')}: ${val}`);
      }
    }
  }

  return parts.join('\n');
}

export async function addQuoteFormHistory(
  quoteFormId: string,
  userId: string,
  eventType: string,
  description: string,
  oldStatus?: string | null,
  newStatus?: string | null,
  ticketId?: string | null,
  metadata?: Record<string, any>
): Promise<void> {
  await supabase.from('quote_form_history').insert({
    quote_form_id: quoteFormId,
    user_id: userId,
    event_type: eventType,
    event_description: description,
    old_status: oldStatus || null,
    new_status: newStatus || null,
    ticket_id: ticketId || null,
    metadata_json: metadata || {},
  });
}

export async function fetchQuoteFormHistory(quoteFormId: string): Promise<QuoteFormHistoryEntry[]> {
  const { data, error } = await supabase
    .from('quote_form_history')
    .select('*')
    .eq('quote_form_id', quoteFormId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchQuoteFormAttachments(quoteFormId: string): Promise<QuoteFormAttachment[]> {
  const { data, error } = await supabase
    .from('quote_form_attachments')
    .select('*')
    .eq('quote_form_id', quoteFormId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function changeQuoteFormStatus(
  id: string,
  userId: string,
  newStatus: QuoteFormStatus,
  notes?: string
): Promise<QuoteForm> {
  const form = await fetchQuoteFormById(id);
  if (!form) throw new Error('Formulario no encontrado');

  const updates: Partial<QuoteForm> = { status: newStatus };
  if (newStatus === 'en_revision') updates.reviewed_at = new Date().toISOString();

  const updated = await updateQuoteForm(id, updates);

  await addQuoteFormHistory(
    id, userId,
    'estatus_cambiado',
    notes || `Estatus cambiado de ${form.status} a ${newStatus}`,
    form.status,
    newStatus,
    form.ticket_id
  );

  return updated;
}
