import { supabase } from './supabase';

export interface SignatureData {
  templateId: string;
  templateName: string;
  html: string;
  tipoAsignacion: string;
}

interface UserContext {
  nombre?: string;
  apellidos?: string;
  nombre_completo?: string;
  email_laboral?: string;
  celular_laboral?: string;
  extension_telefonica?: string;
  puesto?: string;
  rol?: string;
  imagen_perfil?: string;
  oficina_nombre?: string;
  oficina_direccion?: string;
  oficina_telefono?: string;
  oficina_logo?: string;
  [key: string]: string | undefined;
}

const SIGNATURE_MARKER = 'data-movi-email-signature="true"';

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

export async function getUserContext(usuarioId: string): Promise<UserContext> {
  const { data: user } = await supabase
    .from('usuarios')
    .select('nombre, apellidos, nombre_completo, email_laboral, celular_laboral, extension_telefonica, puesto, rol, imagen_perfil, oficina_id')
    .eq('id', usuarioId)
    .maybeSingle();

  if (!user) return {};

  let oficina: Record<string, string> = {};
  if (user.oficina_id) {
    const { data: ofi } = await supabase
      .from('oficinas')
      .select('nombre, direccion, telefono, logo_url')
      .eq('id', user.oficina_id)
      .maybeSingle();
    if (ofi) oficina = ofi;
  }

  return {
    nombre: user.nombre || '',
    apellidos: user.apellidos || '',
    nombre_completo: user.nombre_completo || `${user.nombre || ''} ${user.apellidos || ''}`.trim(),
    email_laboral: user.email_laboral || '',
    celular_laboral: user.celular_laboral || '',
    extension_telefonica: user.extension_telefonica || '',
    puesto: user.puesto || '',
    rol: user.rol || '',
    imagen_perfil: user.imagen_perfil || '',
    oficina_nombre: oficina.nombre || '',
    oficina_direccion: oficina.direccion || '',
    oficina_telefono: oficina.telefono || '',
    oficina_logo: oficina.logo_url || '',
  };
}

export function renderSignatureHtml(templateHtml: string, ctx: UserContext): string {
  let html = templateHtml;

  // Process {{#if variable}} ... {{/if}} conditionals
  html = html.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_match, varName, content) => {
    const value = ctx[varName];
    return value && value.trim() ? content : '';
  });

  // Replace {{variable}} placeholders
  html = html.replace(/\{\{(\w+)\}\}/g, (_match, varName) => {
    return ctx[varName] || '';
  });

  return `<div ${SIGNATURE_MARKER}>${html}</div>`;
}

export async function getRenderedSignature(usuarioId: string): Promise<string | null> {
  const [sig, ctx] = await Promise.all([
    getUserSignature(usuarioId),
    getUserContext(usuarioId),
  ]);

  if (!sig) return null;
  return renderSignatureHtml(sig.html, ctx);
}

export function stripExistingSignature(bodyHtml: string): string {
  const marker = SIGNATURE_MARKER;
  const regex = new RegExp(`<div\\s+${marker.replace(/"/g, '"')}[^>]*>[\\s\\S]*?<\\/div>\\s*$`, 'i');
  return bodyHtml.replace(regex, '').trim();
}

export function appendSignature(bodyHtml: string, signatureHtml: string): string {
  const cleaned = stripExistingSignature(bodyHtml);
  return `${cleaned}\n<br/>\n${signatureHtml}`;
}
