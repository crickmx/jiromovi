/**
 * Types for the Quote Forms (Formularios de Cotizacion) submodule
 */

export type QuoteFormStatus =
  | 'borrador'
  | 'enviado'
  | 'en_revision'
  | 'informacion_incompleta'
  | 'cotizado'
  | 'rechazado'
  | 'emitido'
  | 'cancelado';

export type QuoteFormPriority = 'normal' | 'alta' | 'urgente';

export type ClientType = 'fisica' | 'moral' | 'no_especificado';

export type FormCategory =
  | 'Personas'
  | 'Hogar'
  | 'Empresarial'
  | 'Responsabilidad Civil'
  | 'Transportes'
  | 'Ingenieria';

export interface QuoteFormTemplate {
  id: string;
  form_type: string;
  title: string;
  description: string;
  category: FormCategory;
  icon: string;
  estimated_minutes: number;
  is_active: boolean;
  requires_risk_location: boolean;
  schema_json: { steps: string[] };
}

export interface QuoteForm {
  id: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  office_id: string | null;
  agent_id: string | null;
  ticket_id: string | null;
  folio: string;
  form_type: string;
  form_title: string;
  status: QuoteFormStatus;
  priority: QuoteFormPriority;
  client_name: string;
  client_type: ClientType;
  client_rfc: string | null;
  client_phone: string | null;
  client_email: string | null;
  client_whatsapp: string | null;
  client_reference: string | null;
  client_notes: string | null;
  client_address_compact: string | null;
  risk_location_compact: string | null;
  currency: string | null;
  payment_frequency: string | null;
  start_date: string | null;
  end_date: string | null;
  data_json: Record<string, any>;
  required_missing_json: string[];
  attachments_count: number;
  submitted_at: string | null;
  reviewed_at: string | null;
  assigned_to: string | null;
  notes: string | null;
}

export interface QuoteFormAttachment {
  id: string;
  quote_form_id: string;
  ticket_id: string | null;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number;
  uploaded_by: string | null;
  category: string;
  created_at: string;
}

export interface QuoteFormHistoryEntry {
  id: string;
  quote_form_id: string;
  ticket_id: string | null;
  user_id: string | null;
  event_type: string;
  event_description: string | null;
  old_status: string | null;
  new_status: string | null;
  metadata_json: Record<string, any>;
  created_at: string;
}

export const STATUS_CONFIG: Record<QuoteFormStatus, { label: string; color: string; bg: string; border: string }> = {
  borrador:                 { label: 'Borrador',              color: 'text-gray-700',   bg: 'bg-gray-100',   border: 'border-gray-300' },
  enviado:                  { label: 'Enviado',              color: 'text-blue-700',   bg: 'bg-blue-100',   border: 'border-blue-300' },
  en_revision:              { label: 'En revision',          color: 'text-amber-700',  bg: 'bg-amber-100',  border: 'border-amber-300' },
  informacion_incompleta:   { label: 'Info incompleta',      color: 'text-orange-700', bg: 'bg-orange-100', border: 'border-orange-300' },
  cotizado:                 { label: 'Cotizado',             color: 'text-emerald-700',bg: 'bg-emerald-100',border: 'border-emerald-300' },
  rechazado:                { label: 'Rechazado',            color: 'text-red-700',    bg: 'bg-red-100',    border: 'border-red-300' },
  emitido:                  { label: 'Emitido',             color: 'text-violet-700', bg: 'bg-violet-100', border: 'border-violet-300' },
  cancelado:                { label: 'Cancelado',            color: 'text-gray-500',   bg: 'bg-gray-50',    border: 'border-gray-200' },
};

export const PRIORITY_CONFIG: Record<QuoteFormPriority, { label: string; color: string; bg: string }> = {
  normal:  { label: 'Normal',  color: 'text-gray-600',  bg: 'bg-gray-100' },
  alta:    { label: 'Alta',    color: 'text-amber-700', bg: 'bg-amber-100' },
  urgente: { label: 'Urgente', color: 'text-red-700',   bg: 'bg-red-100' },
};

export const CATEGORY_CONFIG: Record<FormCategory, { color: string; bg: string; border: string }> = {
  Personas:               { color: 'text-rose-700',    bg: 'bg-rose-50',    border: 'border-rose-200' },
  Hogar:                  { color: 'text-sky-700',     bg: 'bg-sky-50',     border: 'border-sky-200' },
  Empresarial:            { color: 'text-teal-700',    bg: 'bg-teal-50',    border: 'border-teal-200' },
  'Responsabilidad Civil':{ color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  Transportes:            { color: 'text-cyan-700',    bg: 'bg-cyan-50',    border: 'border-cyan-200' },
  Ingenieria:             { color: 'text-slate-700',   bg: 'bg-slate-50',   border: 'border-slate-200' },
};

export const CURRENCY_OPTIONS = [
  { value: 'MXN', label: 'Pesos Mexicanos' },
  { value: 'USD', label: 'Dolares' },
  { value: 'no_especificada', label: 'No especificada' },
];

export const PAYMENT_FREQUENCY_OPTIONS = [
  { value: 'anual', label: 'Anual' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'mensual', label: 'Mensual' },
  { value: 'contado', label: 'Contado' },
  { value: 'otra', label: 'Otra' },
  { value: 'no_especificada', label: 'No especificada' },
];

export const CLIENT_TYPE_OPTIONS = [
  { value: 'fisica', label: 'Persona Fisica' },
  { value: 'moral', label: 'Persona Moral' },
  { value: 'no_especificado', label: 'No especificado' },
];

export const ATTACHMENT_CATEGORIES = [
  'identificacion', 'comprobante_domicilio', 'constancia_fiscal', 'relacion_bienes',
  'relacion_equipo', 'relacion_maquinaria', 'reporte_siniestralidad', 'fotografias',
  'factura', 'avaluo', 'contrato', 'planos', 'cronograma', 'caratula_poliza',
  'factura_xml', 'factura_pdf', 'listado_participantes', 'otro',
];

export function getAttachmentCategoryLabel(cat: string): string {
  const labels: Record<string, string> = {
    identificacion: 'Identificacion', comprobante_domicilio: 'Comprobante de domicilio',
    constancia_fiscal: 'Constancia fiscal', relacion_bienes: 'Relacion de bienes',
    relacion_equipo: 'Relacion de equipo', relacion_maquinaria: 'Relacion de maquinaria',
    reporte_siniestralidad: 'Reporte de siniestralidad', fotografias: 'Fotografias',
    factura: 'Factura', avaluo: 'Avaluo', contrato: 'Contrato', planos: 'Planos',
    cronograma: 'Cronograma', caratula_poliza: 'Caratula de poliza',
    factura_xml: 'Factura XML', factura_pdf: 'Factura PDF',
    listado_participantes: 'Listado de participantes', otro: 'Otro',
  };
  return labels[cat] || cat;
}
