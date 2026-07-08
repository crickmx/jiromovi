import type { BugReportSnapshot } from './bugReportCapture';

// Campos de sistema que siempre se autollenan solos (mismo criterio que
// SISTEMA_KEYS_AUTOMATICOS en StoreAdmin.tsx) — no se ofrecen en el mapeo del admin.
export const BUG_REPORT_SISTEMA_AUTOMATICO = ['area', 'equipo', 'fecha_creacion', 'fecha_finalizacion', 'creado_por', 'estatus', 'asignado_a'];

export const PLACEHOLDERS_BUG_REPORT = [
  { key: '{{descripcion}}', label: 'Descripción que escribió el usuario' },
  { key: '{{url}}', label: 'Ruta donde ocurrió el error' },
  { key: '{{navegador}}', label: 'Navegador / user agent' },
  { key: '{{viewport}}', label: 'Tamaño de pantalla' },
  { key: '{{fecha}}', label: 'Fecha y hora del reporte' },
  { key: '{{errores_consola}}', label: 'Errores de consola capturados' },
  { key: '{{peticiones_fallidas}}', label: 'Peticiones de red fallidas' },
];

export function resolverTemplateBugReport(template: string, ctx: { descripcion: string; snapshot: BugReportSnapshot }): string {
  const erroresTexto = ctx.snapshot.errores_consola.map(e => `[${e.nivel}] ${e.mensaje}`).join(' | ') || 'Sin errores registrados';
  const peticionesTexto = ctx.snapshot.peticiones_fallidas.map(p => `${p.metodo} ${p.ruta} (${p.status ?? 'sin respuesta'})`).join(' | ') || 'Sin peticiones fallidas';

  return template
    .replace(/\{\{descripcion\}\}/g, ctx.descripcion || 'Sin descripción')
    .replace(/\{\{url\}\}/g, ctx.snapshot.url_actual)
    .replace(/\{\{navegador\}\}/g, ctx.snapshot.user_agent)
    .replace(/\{\{viewport\}\}/g, ctx.snapshot.viewport)
    .replace(/\{\{fecha\}\}/g, new Date(ctx.snapshot.capturado_en).toLocaleString('es-MX'))
    .replace(/\{\{errores_consola\}\}/g, erroresTexto)
    .replace(/\{\{peticiones_fallidas\}\}/g, peticionesTexto);
}

// Mismos "tipos de texto" que TramiteDetalle.tsx/NuevoTramiteModal.tsx usan para decidir en qué
// columna de tramite_respuestas vive el valor de cada campo del FormBuilder — si no coincide,
// el campo se guarda pero se muestra vacío.
const TEXTO_TIPOS = ['texto_corto', 'texto_largo', 'area', 'equipo',
  'agente_vendedor', 'oficina_jiro', 'fecha_creacion', 'fecha_finalizacion', 'creado_por',
  'aseguradora', 'ramo', 'email', 'telefono', 'rfc', 'curp'];

export function construirRespuestaBugReport(tramiteId: string, campoId: string, tipoCampo: string, valor: unknown) {
  return {
    tramite_id: tramiteId,
    campo_id: campoId,
    valor_texto: TEXTO_TIPOS.includes(tipoCampo) ? String(valor) : null,
    valor_numerico: ['numerico', 'porcentaje'].includes(tipoCampo) ? Number(valor) : null,
    valor_fecha: tipoCampo === 'fecha' ? String(valor) : null,
    valor_booleano: tipoCampo === 'booleano' ? Boolean(valor) : null,
    valor_json: !TEXTO_TIPOS.includes(tipoCampo) && !['numerico', 'porcentaje', 'fecha', 'booleano'].includes(tipoCampo) ? valor : null,
  };
}
