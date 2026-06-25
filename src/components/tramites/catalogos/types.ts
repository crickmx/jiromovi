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
}

export type CampoTipo =
  | 'texto_corto' | 'texto_largo' | 'numerico' | 'adjunto'
  | 'estatus' | 'fecha' | 'booleano' | 'dropdown' | 'seleccion_multiple';

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

export const CAMPO_TIPOS: { tipo: CampoTipo; label: string; icon: string; desc: string }[] = [
  { tipo: 'texto_corto',        label: 'Texto corto',         icon: 'Aa', desc: 'Una línea de texto' },
  { tipo: 'texto_largo',        label: 'Texto largo',         icon: '¶',  desc: 'Párrafo u observaciones' },
  { tipo: 'numerico',           label: 'Numérico',            icon: '#',  desc: 'Número entero o decimal' },
  { tipo: 'fecha',              label: 'Fecha',               icon: 'D',  desc: 'Selector de fecha' },
  { tipo: 'adjunto',            label: 'Adjunto',             icon: '@',  desc: 'Archivos con filtro de tipo' },
  { tipo: 'estatus',            label: 'Estatus',             icon: '=',  desc: 'Lista de opciones personalizada' },
  { tipo: 'booleano',           label: 'Casilla',             icon: 'v',  desc: 'Sí / No' },
  { tipo: 'dropdown',           label: 'Dropdown',            icon: '▾',  desc: 'Selección única de lista' },
  { tipo: 'seleccion_multiple', label: 'Selección múltiple',  icon: '☑',  desc: 'Varias opciones de lista' },
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
