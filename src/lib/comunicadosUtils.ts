import { supabase } from './supabase';
import type { ComunicadoPublicacion, ComunicadoCategoria, ComunicadoAdjunto } from './comunicadosTypes';

// ============================================
// CATEGORÍAS
// ============================================

export const obtenerCategoriasActivas = async (): Promise<ComunicadoCategoria[]> => {
  const { data, error } = await supabase
    .from('comunicados_categorias')
    .select('*')
    .eq('activo', true)
    .order('nombre');

  if (error) throw error;
  return data || [];
};

export const obtenerTodasCategorias = async (): Promise<ComunicadoCategoria[]> => {
  const { data, error } = await supabase
    .from('comunicados_categorias')
    .select('*')
    .order('nombre');

  if (error) throw error;
  return data || [];
};

export const crearCategoria = async (categoria: Partial<ComunicadoCategoria>) => {
  const { data, error } = await supabase
    .from('comunicados_categorias')
    .insert(categoria)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const actualizarCategoria = async (id: string, categoria: Partial<ComunicadoCategoria>) => {
  const { data, error } = await supabase
    .from('comunicados_categorias')
    .update(categoria)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const eliminarCategoria = async (id: string) => {
  const { error } = await supabase
    .from('comunicados_categorias')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

// ============================================
// COMUNICADOS
// ============================================

export const obtenerComunicados = async (
  limit: number = 10,
  offset: number = 0
): Promise<ComunicadoPublicacion[]> => {
  const { data, error } = await supabase
    .from('comunicados_publicaciones')
    .select(`
      *,
      categoria:comunicados_categorias(id, nombre, descripcion),
      creador:usuarios!comunicados_publicaciones_creado_por_fkey(id, nombre, apellidos, imagen_perfil_url),
      adjuntos:comunicados_adjuntos(*)
    `)
    .eq('publicado', true)
    .lte('fecha_publicacion', new Date().toISOString())
    .order('fijado', { ascending: false })
    .order('fecha_publicacion', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data || [];
};

export const obtenerComunicadoFijado = async (): Promise<ComunicadoPublicacion | null> => {
  const { data, error } = await supabase
    .from('comunicados_publicaciones')
    .select(`
      *,
      categoria:comunicados_categorias(id, nombre, descripcion),
      creador:usuarios!comunicados_publicaciones_creado_por_fkey(id, nombre, apellidos, imagen_perfil_url),
      adjuntos:comunicados_adjuntos(*)
    `)
    .eq('publicado', true)
    .eq('fijado', true)
    .lte('fecha_publicacion', new Date().toISOString())
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const obtenerComunicadoPorId = async (id: string): Promise<ComunicadoPublicacion | null> => {
  const { data, error } = await supabase
    .from('comunicados_publicaciones')
    .select(`
      *,
      categoria:comunicados_categorias(id, nombre, descripcion),
      creador:usuarios!comunicados_publicaciones_creado_por_fkey(id, nombre, apellidos, imagen_perfil_url),
      adjuntos:comunicados_adjuntos(*),
      visibilidad:comunicados_visibilidad(*)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const obtenerTodosComunicadosAdmin = async (): Promise<ComunicadoPublicacion[]> => {
  const { data, error } = await supabase
    .from('comunicados_publicaciones')
    .select(`
      *,
      categoria:comunicados_categorias(id, nombre, descripcion),
      creador:usuarios!comunicados_publicaciones_creado_por_fkey(id, nombre, apellidos, imagen_perfil_url)
    `)
    .order('fecha_creacion', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const crearComunicado = async (
  comunicado: Partial<ComunicadoPublicacion>
): Promise<ComunicadoPublicacion> => {
  const { data, error } = await supabase
    .from('comunicados_publicaciones')
    .insert(comunicado)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const actualizarComunicado = async (
  id: string,
  comunicado: Partial<ComunicadoPublicacion>
): Promise<ComunicadoPublicacion> => {
  const { data, error } = await supabase
    .from('comunicados_publicaciones')
    .update(comunicado)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const eliminarComunicado = async (id: string) => {
  const { error } = await supabase
    .from('comunicados_publicaciones')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

// ============================================
// ADJUNTOS
// ============================================

export const agregarAdjunto = async (adjunto: Partial<ComunicadoAdjunto>) => {
  const { data, error } = await supabase
    .from('comunicados_adjuntos')
    .insert(adjunto)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const eliminarAdjunto = async (id: string) => {
  const { error } = await supabase
    .from('comunicados_adjuntos')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

export const obtenerAdjuntos = async (comunicadoId: string): Promise<ComunicadoAdjunto[]> => {
  const { data, error } = await supabase
    .from('comunicados_adjuntos')
    .select('*')
    .eq('comunicado_id', comunicadoId)
    .order('created_at');

  if (error) throw error;
  return data || [];
};

// ============================================
// VISIBILIDAD
// ============================================

export const establecerVisibilidad = async (
  comunicadoId: string,
  visibilidad: {
    roles?: string[];
    oficinas?: string[];
    usuarios?: string[];
  }
) => {
  // Primero eliminar visibilidad existente
  await supabase
    .from('comunicados_visibilidad')
    .delete()
    .eq('comunicado_id', comunicadoId);

  const registros: any[] = [];

  // Agregar roles
  if (visibilidad.roles && visibilidad.roles.length > 0) {
    visibilidad.roles.forEach(rol => {
      registros.push({
        comunicado_id: comunicadoId,
        rol: rol,
        oficina_id: null,
        usuario_id: null
      });
    });
  }

  // Agregar oficinas
  if (visibilidad.oficinas && visibilidad.oficinas.length > 0) {
    visibilidad.oficinas.forEach(oficina => {
      registros.push({
        comunicado_id: comunicadoId,
        rol: null,
        oficina_id: oficina,
        usuario_id: null
      });
    });
  }

  // Agregar usuarios
  if (visibilidad.usuarios && visibilidad.usuarios.length > 0) {
    visibilidad.usuarios.forEach(usuario => {
      registros.push({
        comunicado_id: comunicadoId,
        rol: null,
        oficina_id: null,
        usuario_id: usuario
      });
    });
  }

  if (registros.length > 0) {
    const { error } = await supabase
      .from('comunicados_visibilidad')
      .insert(registros);

    if (error) throw error;
  }
};

export const verificarVisibilidad = async (
  comunicadoId: string,
  usuarioId: string
): Promise<boolean> => {
  const { data, error } = await supabase
    .rpc('usuario_puede_ver_comunicado', {
      p_comunicado_id: comunicadoId,
      p_usuario_id: usuarioId
    });

  if (error) {
    console.error('Error verificando visibilidad:', error);
    return false;
  }

  return data || false;
};

// ============================================
// STORAGE
// ============================================

export const subirImagenComunicado = async (file: File): Promise<string> => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
  const filePath = `imagenes/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('comunicados')
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from('comunicados')
    .getPublicUrl(filePath);

  return data.publicUrl;
};

export const subirAdjuntoComunicado = async (file: File): Promise<string> => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
  const filePath = `adjuntos/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('comunicados')
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from('comunicados')
    .getPublicUrl(filePath);

  return data.publicUrl;
};

// ============================================
// UTILIDADES
// ============================================

export const extraerTextoPlano = (html: string, maxLength: number = 150): string => {
  const div = document.createElement('div');
  div.innerHTML = html;
  const text = div.textContent || div.innerText || '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
};

export const formatearFecha = (fecha: string): string => {
  const date = new Date(fecha);
  return date.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

export const formatearFechaHora = (fecha: string): string => {
  const date = new Date(fecha);
  return date.toLocaleString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const esProgramado = (comunicado: ComunicadoPublicacion): boolean => {
  if (!comunicado.fecha_publicacion) return false;
  return new Date(comunicado.fecha_publicacion) > new Date();
};
