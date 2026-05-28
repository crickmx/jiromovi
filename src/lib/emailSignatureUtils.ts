import { supabase } from './supabase';

export interface SignatureData {
  templateId: string;
  templateName: string;
  html: string;
  tipoAsignacion: string;
}

export interface SignatureContext {
  // Usuario
  nombre?: string;
  apellidos?: string;
  nombre_completo?: string;
  puesto?: string;
  email_laboral?: string;
  celular_laboral?: string;
  celular_laboral_sin_formato?: string;
  whatsapp_link?: string;
  imagen_perfil?: string;
  extension_telefonica?: string;
  rol?: string;
  // Oficina
  oficina_logo?: string;
  oficina_nombre?: string;
  oficina_color_primario?: string;
  oficina_color_secundario?: string;
  oficina_telefono?: string;
  oficina_domicilio?: string;
  oficina_extension?: string;
  oficina_whatsapp?: string;
  oficina_sitio_web?: string;
  [key: string]: string | undefined;
}

export interface SignatureVariableGroup {
  group: string;
  items: { key: string; label: string }[];
}

export const SIGNATURE_VARIABLES: SignatureVariableGroup[] = [
  {
    group: 'Usuario',
    items: [
      { key: 'nombre', label: 'Nombre' },
      { key: 'apellidos', label: 'Apellidos' },
      { key: 'nombre_completo', label: 'Nombre Completo' },
      { key: 'puesto', label: 'Puesto' },
      { key: 'email_laboral', label: 'Email Laboral' },
      { key: 'celular_laboral', label: 'Celular Laboral' },
      { key: 'celular_laboral_sin_formato', label: 'Celular (sin formato)' },
      { key: 'whatsapp_link', label: 'Link WhatsApp' },
      { key: 'imagen_perfil', label: 'Imagen de Perfil (URL)' },
      { key: 'extension_telefonica', label: 'Extension' },
    ],
  },
  {
    group: 'Oficina',
    items: [
      { key: 'oficina_logo', label: 'Logo Oficina (URL)' },
      { key: 'oficina_nombre', label: 'Nombre Oficina' },
      { key: 'oficina_color_primario', label: 'Color Primario' },
      { key: 'oficina_color_secundario', label: 'Color Secundario' },
      { key: 'oficina_telefono', label: 'Telefono Oficina' },
      { key: 'oficina_domicilio', label: 'Domicilio Oficina' },
      { key: 'oficina_extension', label: 'Extension Oficina' },
      { key: 'oficina_whatsapp', label: 'WhatsApp Oficina' },
      { key: 'oficina_sitio_web', label: 'Sitio Web Oficina' },
    ],
  },
];

const SIGNATURE_MARKER = 'data-movi-email-signature="true"';

// ── Sanitization ──────────────────────────────────────────────────────────────

function sanitize(value: string | null | undefined): string {
  if (value == null) return '';
  const trimmed = String(value).trim();
  return trimmed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(value: string | null | undefined): string {
  if (value == null) return '';
  const trimmed = String(value).trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('mailto:') || trimmed.startsWith('tel:')) {
    return trimmed;
  }
  return '';
}

function stripPhoneFormat(phone: string | null | undefined): string {
  if (!phone) return '';
  return phone.replace(/[^0-9]/g, '');
}

function buildWhatsAppLink(rawPhone: string): string {
  if (!rawPhone) return '';
  let digits = rawPhone.replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.length === 10) {
    digits = '521' + digits;
  } else if (digits.length === 12 && digits.startsWith('52')) {
    digits = '521' + digits.slice(2);
  } else if (digits.length === 13 && digits.startsWith('521')) {
    // already correct
  }
  return `https://wa.me/${digits}`;
}

// ── Fetch signature template ──────────────────────────────────────────────────

export async function getUserSignature(usuarioId: string): Promise<SignatureData | null> {
  const { data, error } = await supabase.rpc('get_firma_asignada', {
    p_usuario_id: usuarioId,
  });

  if (error || !data || data.length === 0) return null;

  const row = data[0];
  return {
    templateId: row.template_id,
    templateName: row.template_nombre,
    html: row.template_html,
    tipoAsignacion: row.tipo_asignacion,
  };
}

// ── Fetch user + office context ───────────────────────────────────────────────

export async function getUserContext(usuarioId: string): Promise<SignatureContext> {
  const { data: user } = await supabase
    .from('usuarios')
    .select('nombre, apellidos, nombre_completo, email_laboral, celular_laboral, extension_telefonica, puesto, rol, imagen_perfil_url, oficina_id')
    .eq('id', usuarioId)
    .maybeSingle();

  if (!user) return {};

  let oficina: Record<string, string | null> = {};
  if (user.oficina_id) {
    const { data: ofi } = await supabase
      .from('oficinas')
      .select('nombre, domicilio, telefono, logo_url, accent_color, color_secundario, extension, whatsapp, sitio_web')
      .eq('id', user.oficina_id)
      .maybeSingle();
    if (ofi) oficina = ofi as Record<string, string | null>;
  }

  const celularRaw = user.celular_laboral || '';
  const celularSinFormato = stripPhoneFormat(celularRaw);
  const whatsappLink = buildWhatsAppLink(celularRaw);

  return {
    // Usuario
    nombre: user.nombre || '',
    apellidos: user.apellidos || '',
    nombre_completo: user.nombre_completo || `${user.nombre || ''} ${user.apellidos || ''}`.trim(),
    puesto: user.puesto || '',
    email_laboral: user.email_laboral || '',
    celular_laboral: celularRaw,
    celular_laboral_sin_formato: celularSinFormato,
    whatsapp_link: whatsappLink,
    imagen_perfil: user.imagen_perfil_url || '',
    extension_telefonica: user.extension_telefonica || '',
    rol: user.rol || '',
    // Oficina
    oficina_logo: oficina.logo_url || '',
    oficina_nombre: oficina.nombre || '',
    oficina_color_primario: oficina.accent_color || '#0E23E2',
    oficina_color_secundario: oficina.color_secundario || '',
    oficina_telefono: oficina.telefono || '',
    oficina_domicilio: oficina.domicilio || '',
    oficina_extension: oficina.extension || '',
    oficina_whatsapp: oficina.whatsapp || '',
    oficina_sitio_web: oficina.sitio_web || '',
  };
}

// ── Template rendering ────────────────────────────────────────────────────────

export function renderSignatureHtml(templateHtml: string, ctx: SignatureContext): string {
  let html = templateHtml;

  // Process nested {{#if variable}} ... {{/if}} (non-greedy, supports nesting by processing innermost first)
  let prev = '';
  while (prev !== html) {
    prev = html;
    html = html.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_match, varName, content) => {
      const raw = ctx[varName];
      const value = raw != null ? String(raw).trim() : '';
      return value ? content : '';
    });
  }

  // Replace {{variable}} placeholders with sanitized values
  html = html.replace(/\{\{(\w+)\}\}/g, (_match, varName) => {
    const raw = ctx[varName];
    if (raw == null) return '';
    const value = String(raw).trim();
    if (!value) return '';
    // URLs and colors are not HTML-escaped (they go into attributes)
    if (varName.includes('link') || varName.includes('logo') || varName.includes('imagen') || varName.includes('sitio_web') || varName.includes('color')) {
      return sanitizeUrl(value) || sanitize(value);
    }
    return sanitize(value);
  });

  return `<div ${SIGNATURE_MARKER}>${html}</div>`;
}

// ── Convenience: fetch + render in one call ───────────────────────────────────

export async function getRenderedSignature(usuarioId: string): Promise<string | null> {
  const [sig, ctx] = await Promise.all([
    getUserSignature(usuarioId),
    getUserContext(usuarioId),
  ]);

  if (!sig) return null;
  return renderSignatureHtml(sig.html, ctx);
}

// ── Signature insertion helpers ───────────────────────────────────────────────

export function stripExistingSignature(bodyHtml: string): string {
  const marker = SIGNATURE_MARKER;
  const regex = new RegExp(`<div\\s+${marker.replace(/"/g, '"')}[^>]*>[\\s\\S]*?<\\/div>\\s*$`, 'i');
  return bodyHtml.replace(regex, '').trim();
}

export function appendSignature(bodyHtml: string, signatureHtml: string): string {
  const cleaned = stripExistingSignature(bodyHtml);
  return `${cleaned}\n<br/>\n${signatureHtml}`;
}

// ── Example context (for previews) ───────────────────────────────────────────

export const EXAMPLE_CONTEXT: SignatureContext = {
  nombre: 'Juan',
  apellidos: 'Perez Martinez',
  nombre_completo: 'Juan Perez Martinez',
  puesto: 'Asesor de Seguros',
  email_laboral: 'juan.perez@movidigital.mx',
  celular_laboral: '55 1234 5678',
  celular_laboral_sin_formato: '5512345678',
  whatsapp_link: 'https://wa.me/5215512345678',
  imagen_perfil: 'https://ui-avatars.com/api/?name=JP&size=80&background=0E23E2&color=fff',
  extension_telefonica: '101',
  oficina_logo: 'https://placehold.co/200x60/0E23E2/white?text=LOGO',
  oficina_nombre: 'MOVI Digital Central',
  oficina_color_primario: '#0E23E2',
  oficina_color_secundario: '#1E40AF',
  oficina_telefono: '(55) 5555-1234',
  oficina_domicilio: 'Av. Insurgentes Sur 1234, Col. Del Valle, CDMX',
  oficina_extension: '200',
  oficina_whatsapp: '5555551234',
  oficina_sitio_web: 'https://www.movidigital.mx',
};
