export interface CentroDigitalCarpeta {
  id: string;
  nombre: string;
  descripcion: string | null;
  todas_oficinas: boolean;
  todos_roles: boolean;
  creado_por: string | null;
  oficina_id: string | null;
  activa: boolean;
  enable_chava_ai: boolean;
  external_chava_access: boolean;
  auto_index: boolean;
  knowledge_priority: number;
  parent_id: string | null;
  created_at: string;
  updated_at: string;

  creador?: {
    nombre_completo: string;
  };
  oficina?: {
    nombre: string;
  };
  oficinas_permitidas?: { oficina_id: string }[];
  roles_permitidos?: { rol: string }[];

  total_archivos?: number;
}

export interface CentroDigitalArchivo {
  id: string;
  carpeta_id: string;
  nombre: string;
  nombre_original: string;
  ruta_storage: string;
  tipo_mime: string | null;
  tamano_bytes: number | null;
  estado: 'activo' | 'papelera';
  cargado_por: string | null;
  eliminado_por: string | null;
  fecha_eliminacion: string | null;
  visible_para_todos: boolean;
  visible_para_oficina: string | null;
  created_at: string;
  updated_at: string;

  cargador?: {
    nombre_completo: string;
  };
  eliminador?: {
    nombre_completo: string;
  };
  carpeta?: {
    nombre: string;
  };
  usuarios_con_permiso?: { usuario_id: string }[];
}

export interface CentroDigitalAuditoria {
  id: string;
  accion: string;
  carpeta_id: string | null;
  archivo_id: string | null;
  usuario_id: string | null;
  detalles: Record<string, any> | null;
  created_at: string;

  usuario?: {
    nombre_completo: string;
  };
  carpeta?: {
    nombre: string;
  };
  archivo?: {
    nombre: string;
  };
}

export interface CarpetaFormData {
  nombre: string;
  descripcion: string;
  todas_oficinas: boolean;
  todos_roles: boolean;
  oficinas_seleccionadas: string[];
  roles_seleccionados: string[];
  enable_chava_ai: boolean;
  external_chava_access: boolean;
  auto_index: boolean;
  knowledge_priority: number;
}

export interface ArchivoUpload {
  file: File;
  nombre: string;
  carpeta_id: string;
  visible_para_todos?: boolean;
  visible_para_oficina?: string | null;
  usuarios_con_permiso?: string[];
}

export const ROLES_DISPONIBLES = [
  'Administrador',
  'Gerente',
  'Empleado',
  'Agente'
] as const;

export const ACCIONES_AUDITORIA: Record<string, string> = {
  carpeta_creada: 'Carpeta creada',
  carpeta_editada: 'Carpeta editada',
  carpeta_eliminada: 'Carpeta eliminada',
  archivo_subido: 'Archivo subido',
  archivo_editado: 'Archivo editado',
  archivo_eliminado: 'Archivo eliminado',
  archivo_restaurado: 'Archivo restaurado',
  archivo_descargado: 'Archivo descargado',
  archivo_reparado: 'Archivo reparado (sin respaldo en Storage)',
  integridad_verificada: 'Integridad verificada',
};
