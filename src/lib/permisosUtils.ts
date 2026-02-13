import { supabase } from './supabase';

/**
 * Códigos de módulos del sistema
 */
export const MODULOS = {
  // RRHH
  VACACIONES: 'vacaciones',
  USUARIOS: 'usuarios',
  DIRECTORIO: 'directorio',

  // Ventas y Comisiones
  COMISIONES: 'comisiones',
  PRODUCCION: 'produccion',
  CRM: 'crm',

  // Operaciones
  TRAMITES: 'tramites',
  STORE: 'store',
  ESPACIO_JIRO: 'espaciojiro',

  // Educación y Capacitación
  SEGUROS_EDUCATION: 'seguros_education',
  CEDULA_A: 'cedula_a',
  AULA_VIRTUAL: 'aula_virtual',

  // Marketing y Comunicación
  PUBLICIDAD: 'publicidad',
  COMUNICADOS: 'comunicados',
  MI_PAGINA_WEB: 'mi_pagina_web',

  // Accesos y Configuración
  ACCESOS_NACIONAL: 'accesos_nacional',
  NOTIFICACIONES: 'notificaciones',
  CORREOS: 'correos',
  OFICINAS: 'oficinas',

  // Otros
  CENTRO_DIGITAL: 'centro_digital',
  GMM_COTIZADOR: 'gmm_cotizador',
  MULTICOTIZADOR: 'multicotizador',
  SICAS: 'sicas',
} as const;

export type ModuloCodigo = typeof MODULOS[keyof typeof MODULOS];

/**
 * Interface para usuario con permisos
 */
export interface UsuarioConPermisos {
  id: string;
  rol: 'Administrador' | 'Gerente' | 'Empleado' | 'Agente';
  permisosAdicionales?: string[]; // Lista de códigos de módulos con permisos admin
}

/**
 * Verifica si un usuario tiene permisos de administrador en un módulo específico
 *
 * @param usuario - Usuario a verificar
 * @param moduloCodigo - Código del módulo
 * @returns true si el usuario tiene permisos admin en el módulo
 */
export function tienePermisoAdminEnModulo(
  usuario: UsuarioConPermisos | null,
  moduloCodigo: ModuloCodigo
): boolean {
  if (!usuario) return false;

  // Si es Administrador, siempre tiene permisos
  if (usuario.rol === 'Administrador') {
    return true;
  }

  // Si NO es Gerente, no tiene permisos adicionales
  if (usuario.rol !== 'Gerente') {
    return false;
  }

  // Si es Gerente, verificar si tiene permiso adicional en ese módulo
  return usuario.permisosAdicionales?.includes(moduloCodigo) || false;
}

/**
 * Carga los permisos adicionales de un usuario desde la base de datos
 *
 * @param usuarioId - ID del usuario
 * @returns Array de códigos de módulos con permisos admin
 */
export async function cargarPermisosAdicionales(usuarioId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase.rpc('get_permisos_adicionales_usuario', {
      p_usuario_id: usuarioId
    });

    if (error) {
      console.error('Error loading additional permissions:', error);
      return [];
    }

    return data?.map((p: any) => p.codigo) || [];
  } catch (err) {
    console.error('Error loading additional permissions:', err);
    return [];
  }
}

/**
 * Verifica si un usuario tiene permisos de administrador en un módulo (con consulta a DB)
 *
 * @param usuarioId - ID del usuario
 * @param moduloCodigo - Código del módulo
 * @returns true si el usuario tiene permisos admin en el módulo
 */
export async function verificarPermisoAdminEnModulo(
  usuarioId: string,
  moduloCodigo: ModuloCodigo
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('tiene_permiso_admin_en_modulo', {
      p_usuario_id: usuarioId,
      p_modulo_codigo: moduloCodigo
    });

    if (error) {
      console.error('Error checking permission:', error);
      return false;
    }

    return data || false;
  } catch (err) {
    console.error('Error checking permission:', err);
    return false;
  }
}

/**
 * Hook para verificar permisos de forma síncrona usando datos en memoria
 * (Requiere que los permisos adicionales ya estén cargados en el usuario)
 */
export function usePermisoModulo(
  usuario: UsuarioConPermisos | null,
  moduloCodigo: ModuloCodigo
): boolean {
  return tienePermisoAdminEnModulo(usuario, moduloCodigo);
}

/**
 * Obtiene la lista completa de módulos del sistema
 */
export async function obtenerModulosSistema() {
  const { data, error } = await supabase
    .from('modulos_sistema')
    .select('*')
    .eq('activo', true)
    .order('orden, nombre');

  if (error) {
    console.error('Error fetching modules:', error);
    return [];
  }

  return data || [];
}
