import { supabase } from './supabase';
import type {
  CentroDigitalCarpeta,
  CentroDigitalArchivo,
  CentroDigitalAuditoria,
  CarpetaFormData,
  ArchivoUpload
} from './centroDigitalTypes';

export async function obtenerCarpetas(): Promise<CentroDigitalCarpeta[]> {
  const { data, error } = await supabase
    .from('centro_digital_carpetas')
    .select(`
      *,
      creador:usuarios!creado_por(nombre_completo),
      oficina:oficinas(nombre),
      oficinas_permitidas:centro_digital_carpetas_oficinas(oficina_id),
      roles_permitidos:centro_digital_carpetas_roles(rol)
    `)
    .eq('activa', true)
    .order('nombre');

  if (error) throw error;
  return data || [];
}

export async function obtenerCarpetaPorId(
  carpetaId: string
): Promise<CentroDigitalCarpeta | null> {
  const { data, error } = await supabase
    .from('centro_digital_carpetas')
    .select(`
      *,
      creador:usuarios!creado_por(nombre_completo),
      oficina:oficinas(nombre),
      oficinas_permitidas:centro_digital_carpetas_oficinas(oficina_id),
      roles_permitidos:centro_digital_carpetas_roles(rol)
    `)
    .eq('id', carpetaId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function crearCarpeta(
  formData: CarpetaFormData
): Promise<CentroDigitalCarpeta> {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('oficina_id')
    .eq('id', user.id)
    .single();

  const { data: carpeta, error: carpetaError } = await supabase
    .from('centro_digital_carpetas')
    .insert({
      nombre: formData.nombre,
      descripcion: formData.descripcion,
      todas_oficinas: formData.todas_oficinas,
      todos_roles: formData.todos_roles,
      creado_por: user.id,
      oficina_id: usuario?.oficina_id || null,
      enable_chava_ai: formData.enable_chava_ai ?? false,
      external_chava_access: formData.external_chava_access ?? false,
      auto_index: formData.auto_index ?? true,
      knowledge_priority: formData.knowledge_priority ?? 1
    })
    .select()
    .single();

  if (carpetaError) throw carpetaError;

  if (!formData.todas_oficinas && formData.oficinas_seleccionadas.length > 0) {
    const oficinas = formData.oficinas_seleccionadas.map((oficina_id) => ({
      carpeta_id: carpeta.id,
      oficina_id
    }));

    const { error: oficinasError } = await supabase
      .from('centro_digital_carpetas_oficinas')
      .insert(oficinas);

    if (oficinasError) throw oficinasError;
  }

  if (!formData.todos_roles && formData.roles_seleccionados.length > 0) {
    const roles = formData.roles_seleccionados.map((rol) => ({
      carpeta_id: carpeta.id,
      rol
    }));

    const { error: rolesError } = await supabase
      .from('centro_digital_carpetas_roles')
      .insert(roles);

    if (rolesError) throw rolesError;
  }

  await registrarAuditoria('carpeta_creada', carpeta.id, null, {
    nombre: carpeta.nombre
  });

  return carpeta;
}

export async function actualizarCarpeta(
  carpetaId: string,
  formData: CarpetaFormData
): Promise<void> {
  const { error: updateError } = await supabase
    .from('centro_digital_carpetas')
    .update({
      nombre: formData.nombre,
      descripcion: formData.descripcion,
      todas_oficinas: formData.todas_oficinas,
      todos_roles: formData.todos_roles,
      enable_chava_ai: formData.enable_chava_ai ?? false,
      external_chava_access: formData.external_chava_access ?? false,
      auto_index: formData.auto_index ?? true,
      knowledge_priority: formData.knowledge_priority ?? 1
    })
    .eq('id', carpetaId);

  if (updateError) throw updateError;

  await supabase
    .from('centro_digital_carpetas_oficinas')
    .delete()
    .eq('carpeta_id', carpetaId);

  if (!formData.todas_oficinas && formData.oficinas_seleccionadas.length > 0) {
    const oficinas = formData.oficinas_seleccionadas.map((oficina_id) => ({
      carpeta_id: carpetaId,
      oficina_id
    }));

    await supabase.from('centro_digital_carpetas_oficinas').insert(oficinas);
  }

  await supabase
    .from('centro_digital_carpetas_roles')
    .delete()
    .eq('carpeta_id', carpetaId);

  if (!formData.todos_roles && formData.roles_seleccionados.length > 0) {
    const roles = formData.roles_seleccionados.map((rol) => ({
      carpeta_id: carpetaId,
      rol
    }));

    await supabase.from('centro_digital_carpetas_roles').insert(roles);
  }

  await registrarAuditoria('carpeta_editada', carpetaId, null, {
    nombre: formData.nombre
  });
}

export async function eliminarCarpeta(carpetaId: string): Promise<void> {
  const { error } = await supabase
    .from('centro_digital_carpetas')
    .update({ activa: false })
    .eq('id', carpetaId);

  if (error) throw error;

  await registrarAuditoria('carpeta_eliminada', carpetaId, null, {});
}

export async function obtenerArchivos(
  carpetaId: string,
  incluirPapelera = false
): Promise<CentroDigitalArchivo[]> {
  let query = supabase
    .from('centro_digital_archivos')
    .select(`
      *,
      cargador:usuarios!cargado_por(nombre_completo),
      eliminador:usuarios!eliminado_por(nombre_completo)
    `)
    .eq('carpeta_id', carpetaId)
    .order('created_at', { ascending: false });

  if (!incluirPapelera) {
    query = query.eq('estado', 'activo');
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function obtenerArchivosPapelera(): Promise<CentroDigitalArchivo[]> {
  const { data, error } = await supabase
    .from('centro_digital_archivos')
    .select(`
      *,
      cargador:usuarios!cargado_por(nombre_completo),
      eliminador:usuarios!eliminado_por(nombre_completo),
      carpeta:centro_digital_carpetas(nombre)
    `)
    .eq('estado', 'papelera')
    .order('fecha_eliminacion', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function subirArchivo(upload: ArchivoUpload): Promise<void> {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  const timestamp = Date.now();
  const extension = upload.file.name.split('.').pop();
  const rutaStorage = `${upload.carpeta_id}/${timestamp}_${Math.random().toString(36).substring(7)}.${extension}`;

  const { error: storageError } = await supabase.storage
    .from('centro-digital-files')
    .upload(rutaStorage, upload.file);

  if (storageError) throw storageError;

  const { data: archivo, error: dbError } = await supabase
    .from('centro_digital_archivos')
    .insert({
      carpeta_id: upload.carpeta_id,
      nombre: upload.nombre,
      nombre_original: upload.file.name,
      ruta_storage: rutaStorage,
      tipo_mime: upload.file.type,
      tamano_bytes: upload.file.size,
      cargado_por: user.id,
      estado: 'activo',
      visible_para_todos: upload.visible_para_todos || false,
      visible_para_oficina: upload.visible_para_oficina || null
    })
    .select()
    .single();

  if (dbError) {
    await supabase.storage.from('centro-digital-files').remove([rutaStorage]);
    throw dbError;
  }

  if (upload.usuarios_con_permiso && upload.usuarios_con_permiso.length > 0) {
    const permisos = upload.usuarios_con_permiso.map(usuario_id => ({
      archivo_id: archivo.id,
      usuario_id
    }));

    const { error: permisosError } = await supabase
      .from('centro_digital_archivos_usuarios')
      .insert(permisos);

    if (permisosError) {
      console.error('Error al asignar permisos:', permisosError);
    }
  }
}

export async function descargarArchivo(archivo: CentroDigitalArchivo): Promise<void> {
  const { data, error } = await supabase.storage
    .from('centro-digital-files')
    .download(archivo.ruta_storage);

  if (error) throw error;

  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = archivo.nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  await registrarAuditoria('archivo_descargado', archivo.carpeta_id, archivo.id, {
    nombre: archivo.nombre
  });
}

export async function actualizarNombreArchivo(
  archivoId: string,
  nuevoNombre: string
): Promise<void> {
  const { error } = await supabase
    .from('centro_digital_archivos')
    .update({ nombre: nuevoNombre })
    .eq('id', archivoId);

  if (error) throw error;

  await registrarAuditoria('archivo_editado', null, archivoId, {
    nombre: nuevoNombre
  });
}

export async function eliminarArchivo(archivoId: string): Promise<void> {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  const { error } = await supabase
    .from('centro_digital_archivos')
    .update({
      estado: 'papelera',
      eliminado_por: user.id,
      fecha_eliminacion: new Date().toISOString()
    })
    .eq('id', archivoId);

  if (error) throw error;
}

export async function restaurarArchivo(archivoId: string): Promise<void> {
  const { error } = await supabase
    .from('centro_digital_archivos')
    .update({
      estado: 'activo',
      eliminado_por: null,
      fecha_eliminacion: null
    })
    .eq('id', archivoId);

  if (error) throw error;
}

export async function eliminarArchivoDefinitivamente(
  archivoId: string
): Promise<void> {
  const { data: archivo } = await supabase
    .from('centro_digital_archivos')
    .select('ruta_storage')
    .eq('id', archivoId)
    .single();

  if (archivo) {
    await supabase.storage
      .from('centro-digital-files')
      .remove([archivo.ruta_storage]);
  }

  const { error } = await supabase
    .from('centro_digital_archivos')
    .delete()
    .eq('id', archivoId);

  if (error) throw error;
}

export async function obtenerAuditoria(
  limit = 100
): Promise<CentroDigitalAuditoria[]> {
  const { data, error } = await supabase
    .from('centro_digital_auditoria')
    .select(`
      *,
      usuario:usuarios(nombre_completo),
      carpeta:centro_digital_carpetas(nombre),
      archivo:centro_digital_archivos(nombre)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

async function registrarAuditoria(
  accion: string,
  carpetaId: string | null,
  archivoId: string | null,
  detalles: Record<string, any>
): Promise<void> {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  await supabase.from('centro_digital_auditoria').insert({
    accion,
    carpeta_id: carpetaId,
    archivo_id: archivoId,
    usuario_id: user?.id || null,
    detalles
  });
}

export function formatearTamano(bytes: number | null): string {
  if (!bytes) return '0 B';

  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

export function obtenerIconoArchivo(tipoMime: string | null): string {
  if (!tipoMime) return 'File';

  if (tipoMime.startsWith('image/')) return 'Image';
  if (tipoMime.startsWith('video/')) return 'Video';
  if (tipoMime.startsWith('audio/')) return 'Music';
  if (tipoMime.includes('pdf')) return 'FileText';
  if (
    tipoMime.includes('word') ||
    tipoMime.includes('document') ||
    tipoMime.includes('text')
  )
    return 'FileText';
  if (tipoMime.includes('sheet') || tipoMime.includes('excel')) return 'FileSpreadsheet';
  if (tipoMime.includes('presentation') || tipoMime.includes('powerpoint'))
    return 'Presentation';
  if (tipoMime.includes('zip') || tipoMime.includes('rar') || tipoMime.includes('tar'))
    return 'Archive';

  return 'File';
}
