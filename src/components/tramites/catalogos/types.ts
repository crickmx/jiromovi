// ── Shared types & constants for the Catálogos module ─────────────────────

export interface InsuranceType {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

export interface TicketTipo {
  id: string;
  value: string;
  label: string;
  area: string;
  color: string;
  activo: boolean;
  is_custom: boolean;
  orden: number;
  updated_at?: string;
}

export type CampoTipo =
  | 'texto_corto' | 'texto_largo' | 'numerico' | 'adjunto'
  | 'estatus' | 'fecha' | 'booleano' | 'dropdown' | 'seleccion_multiple'
  | 'aseguradora' | 'ramo' | 'rfc' | 'codigo_postal'
  | 'telefono' | 'email' | 'curp' | 'porcentaje'
  // ── Campos Sistema (Sección 1 fija) ────────────────────────────────────────
  | 'area' | 'equipo' | 'agente_vendedor' | 'oficina_jiro'
  | 'fecha_creacion' | 'fecha_finalizacion';

export const SISTEMA_TIPO_META: Partial<Record<CampoTipo, { icon: string; desc: string; badge: string }>> = {
  area:               { icon: 'AR', desc: 'Área del tipo de trámite, asignada automáticamente',     badge: 'Autofill' },
  equipo:             { icon: 'EQ', desc: 'Equipo responsable, auto-asignado al crear el trámite',  badge: 'Autofill' },
  estatus:            { icon: '≡',  desc: 'Estado del trámite — define inicio y terminación',       badge: 'Configurable' },
  agente_vendedor:    { icon: 'UA', desc: 'Usuario asignado al trámite, del catálogo de personas',   badge: 'Catálogo' },
  oficina_jiro:       { icon: 'OJ', desc: 'Oficina/despacho JIRO, filtrada por agente seleccionado', badge: 'Catálogo' },
  fecha_creacion:     { icon: 'FC', desc: 'Fecha y hora de creación, auto-capturada al crear',      badge: 'Autofill' },
  fecha_finalizacion: { icon: 'FF', desc: 'Fecha y hora de cierre, auto-capturada al terminar',     badge: 'Autofill' },
};

export interface TipoCampo {
  id: string;
  tramite_tipo_id: string;
  key: string;
  label: string;
  tipo: CampoTipo;
  requerido: boolean;
  ayuda: string | null;
  display_order: number;
  config: Record<string, any>;
  activo: boolean;
  is_sistema: boolean;
  sistema_key: string | null;
}

export interface EquipoMiembro {
  usuario_id: string;
  nombre_completo: string;
}

export interface Equipo {
  id: string;
  nombre: string;
  miembros: EquipoMiembro[];
}

export interface Permiso {
  id: string;
  user_id: string;
  team_id: string;
  tramite_tipo_id: string;
  permiso: 'crear_tramite' | 'editar_tramite';
}

export interface RolPermiso {
  rol: string;
  puede_crear: boolean;
  puede_ver: boolean;
  puede_editar: boolean;
}

export interface UsuarioOverride {
  user_id: string;
  nombre_completo: string;
  puede_crear: boolean | null;
  puede_ver: boolean | null;
  puede_editar: boolean | null;
}

export const AREAS = ['Comercial', 'Operaciones', 'Mercadotecnia', 'Administración', 'Otro'] as const;
export type Area = typeof AREAS[number];

export const COLOR_SWATCHES = [
  '#0369a1', '#1d4ed8', '#0891b2', '#6366f1',
  '#7c3aed', '#9333ea', '#db2777', '#e11d48',
  '#dc2626', '#ea580c', '#b45309', '#d97706',
  '#65a30d', '#16a34a', '#059669', '#374151',
  '#64748b', '#78716c',
];

export const CAMPO_TIPOS: { tipo: CampoTipo; label: string; icon: string; desc: string; grupo: string }[] = [
  // ── Texto ─────────────────────────────────────────────────────────────────
  { tipo: 'texto_corto',        label: 'Texto corto',         icon: 'Aa',  desc: 'Una línea, hasta 250 chars',           grupo: 'Texto' },
  { tipo: 'texto_largo',        label: 'Texto largo',         icon: '¶',   desc: 'Párrafo u observaciones',              grupo: 'Texto' },
  { tipo: 'email',              label: 'Email',               icon: '✉',   desc: 'Validación de correo en tiempo real',  grupo: 'Texto' },
  { tipo: 'telefono',           label: 'Teléfono',            icon: '☎',   desc: '10 dígitos, formato MX o intl.',       grupo: 'Texto' },
  { tipo: 'rfc',                label: 'RFC',                 icon: 'RF',  desc: 'Persona física (13) o moral (12)',     grupo: 'Texto' },
  { tipo: 'curp',               label: 'CURP',                icon: 'CU',  desc: '18 chars, formato oficial',            grupo: 'Texto' },
  // ── Número ────────────────────────────────────────────────────────────────
  { tipo: 'numerico',           label: 'Numérico',            icon: '#',   desc: 'Decimal, entero o moneda MXN',         grupo: 'Número' },
  { tipo: 'porcentaje',         label: 'Porcentaje',          icon: '%',   desc: 'Valor 0–100 con símbolo %',            grupo: 'Número' },
  { tipo: 'codigo_postal',      label: 'Código Postal',       icon: 'CP',  desc: '5 dígitos, valida vs catálogo CP',     grupo: 'Número' },
  // ── Fecha ─────────────────────────────────────────────────────────────────
  { tipo: 'fecha',              label: 'Fecha',               icon: 'D',   desc: 'Selector de fecha con límites',        grupo: 'Fecha' },
  // ── Selección ─────────────────────────────────────────────────────────────
  { tipo: 'booleano',           label: 'Casilla Sí/No',       icon: 'v',   desc: 'Binario, una sola casilla',            grupo: 'Selección' },
  { tipo: 'dropdown',           label: 'Dropdown',            icon: '▾',   desc: 'Selección única de lista',             grupo: 'Selección' },
  { tipo: 'seleccion_multiple', label: 'Selección múltiple',  icon: '☑',   desc: 'Varias opciones de lista',             grupo: 'Selección' },
  { tipo: 'estatus',            label: 'Estatus',             icon: '=',   desc: 'Lista con clasificación inicio/fin',   grupo: 'Selección' },
  // ── Catálogo ──────────────────────────────────────────────────────────────
  { tipo: 'aseguradora',        label: 'Aseguradora',         icon: 'As',  desc: 'Catálogo activo de aseguradoras',      grupo: 'Catálogo' },
  { tipo: 'ramo',               label: 'Ramo',                icon: 'Rm',  desc: 'Cascada desde campo aseguradora',      grupo: 'Catálogo' },
  // ── Archivo ───────────────────────────────────────────────────────────────
  { tipo: 'adjunto',            label: 'Adjunto',             icon: '@',   desc: 'Archivos con filtro de tipo y peso',   grupo: 'Archivo' },
];

export const MIME_OPTIONS = [
  { label: 'PDF',  value: 'application/pdf' },
  { label: 'PNG',  value: 'image/png' },
  { label: 'JPG',  value: 'image/jpeg' },
  { label: 'DOCX', value: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  { label: 'XLSX', value: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  { label: 'XML',  value: 'application/xml' },
];

export function slugify(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s_]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}
