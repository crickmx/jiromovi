import { supabase } from './supabase';

/**
 * La tabla `usuarios` se lee por columnas, no con `select('*')`.
 *
 * Desde la migración 20261023000005, a los usuarios con sesión se les retiró la lectura
 * directa de los datos bancarios y de la contraseña del correo (ver USUARIO_COLUMNAS_PRIVADAS).
 * Un `select('*')` sobre `usuarios` truena con "permission denied", porque pide también esas.
 *
 * - Para traer "todo el perfil" se usa USUARIO_COLUMNAS (todas las demás).
 * - Los datos privados se piden aparte con obtenerDatosPrivados(), que solo los devuelve
 *   a la persona misma, al Administrador y al Gerente de su oficina.
 *
 * ⚠️ Si se agrega una columna a `usuarios`, hay que agregarla aquí Y darle grant en la base:
 *     grant select (columna_nueva) on public.usuarios to authenticated;
 */
export const USUARIO_COLUMNAS_PRIVADAS = [
  'banco',
  'cuenta_banco',
  'clabe',
  'clabe_interbancaria',
  'numero_tarjeta',
  'email_password',
] as const;

export const USUARIO_COLUMNAS = [
  'id', 'username', 'rol', 'nombre', 'apellidos', 'puesto', 'oficina_id', 'fecha_nacimiento',
  'fecha_ingreso', 'celular_personal', 'email_personal', 'celular_laboral', 'email_laboral',
  'extension_telefonica', 'url_web_jiro', 'url_web_multicotizador', 'imagen_perfil_url', 'activo',
  'created_at', 'updated_at', 'email_cuenta', 'email_verificado', 'estado',
  'dias_vacaciones_disponibles', 'dias_vacaciones_usados', 'email_ultima_verificacion',
  'email_error_mensaje', 'regimen_fiscal_id', 'production_office_id', 'is_deleted', 'deleted_at',
  'deleted_by_user_id', 'name_norm', 'name_tokens', 'name_signature', 'nombre_completo_norm',
  'mi_logotipo_url', 'web_slug', 'equipo_computo', 'equipo_celular', 'nombre_completo',
  'plan_mkt_premium', 'nombre_sicas', 'id_sicas', 'status', 'equipo_computo_marca',
  'equipo_computo_modelo', 'equipo_celular_marca', 'equipo_celular_modelo', 'created_by',
  'password_generated_at', 'fecha_ingreso_jiro', 'nombre_publico', 'mkt_premium_fecha_inicio',
  'mkt_premium_fecha_pago', 'mkt_premium_plan', 'mkt_premium_metodo_pago', 'apellido', 'email',
  'ubicacion_lat', 'ubicacion_lng', 'ubicacion_direccion_manual', 'ubicacion_metodo',
  'ubicacion_updated_at', 'seguros_express_habilitado', 'rol_id', 'mkt_premium_parcialidades',
  'cedula_cnsf', 'mkt_premium_folio', 'mkt_premium_frecuencia_pago', 'es_bot',
].join(', ');

export interface DatosPrivadosUsuario {
  id: string;
  banco: string | null;
  cuenta_banco: string | null;
  clabe: string | null;
  clabe_interbancaria: string | null;
  numero_tarjeta: string | null;
  /** La contraseña nunca viaja al navegador; solo se sabe si ya está configurada. */
  tiene_email_password: boolean;
}

/**
 * Datos bancarios de los usuarios indicados, solo de los que el usuario actual puede ver
 * (él mismo, o cualquiera si es Administrador, o los de sus oficinas si es Gerente).
 * Los que no puede ver simplemente no vienen en el resultado.
 */
export async function obtenerDatosPrivados(ids: string[]): Promise<Map<string, DatosPrivadosUsuario>> {
  const unicos = Array.from(new Set(ids.filter(Boolean)));
  const mapa = new Map<string, DatosPrivadosUsuario>();
  if (unicos.length === 0) return mapa;

  const { data, error } = await supabase.rpc('get_datos_privados_usuarios', { p_ids: unicos });
  if (error) {
    console.error('[usuarioColumnas] No se pudieron leer los datos privados:', error.message);
    return mapa;
  }
  for (const fila of (data || []) as DatosPrivadosUsuario[]) mapa.set(fila.id, fila);
  return mapa;
}

/**
 * Le pega a un usuario sus datos bancarios, si el usuario actual tiene permiso de verlos.
 * `email_password` nunca se llena: en su lugar va `tiene_email_password`.
 */
export async function conDatosPrivados<T extends { id: string }>(usuario: T): Promise<T & Partial<DatosPrivadosUsuario>> {
  const mapa = await obtenerDatosPrivados([usuario.id]);
  const privados = mapa.get(usuario.id);
  if (!privados) return usuario;
  const { id: _id, ...resto } = privados;
  return { ...usuario, ...resto };
}
