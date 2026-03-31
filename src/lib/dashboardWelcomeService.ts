import { supabase } from './supabase';

export interface UserWelcomeContext {
  nombre: string;
  rol: string;
  oficina?: string;
  produccion_mes_actual?: number;
  produccion_mes_anterior?: number;
  posicion_nacional?: number;
  posicion_oficina?: number;
  tareas_pendientes?: number;
  tareas_vencidas?: number;
  cotizaciones_activas?: number;
  eventos_proximos?: number;
  crm_contactos_sin_seguimiento?: number;
  ultimo_acceso?: string;
  comisiones_mes_actual?: number;
  comisiones_mes_anterior?: number;

  // Gamificación
  nivel_actual?: number;
  xp_actual?: number;
  xp_para_siguiente_nivel?: number;
  jiro_coins?: number;
  posicion_ranking?: number;
  logros_recientes?: number;
  dias_racha?: number;

  // Seguros Education
  cursos_en_progreso?: number;
  cursos_completados?: number;
  horas_capacitacion_mes?: number;
  proximas_sesiones_live?: number;
  cursos_nuevos_disponibles?: number;
  ultimo_curso_completado?: string;

  // Comunicados
  comunicados_sin_leer?: number;
  ultimo_comunicado_titulo?: string;
  ultimo_comunicado_fecha?: string;

  // Sistema general
  tramites_pendientes_atencion?: number;
  documentos_por_revisar?: number;
  reservas_proximas?: number;
}

/**
 * Recopila el contexto completo del usuario para generar el mensaje de bienvenida
 */
export async function getUserWelcomeContext(userId: string): Promise<UserWelcomeContext> {
  try {
    console.log('📊 Recopilando contexto para usuario:', userId);

    // Información básica del usuario
    const { data: usuario, error: usuarioError } = await supabase
      .from('usuarios')
      .select(`
        nombre_completo,
        rol,
        updated_at,
        oficina_id,
        oficinas(nombre)
      `)
      .eq('id', userId)
      .maybeSingle();

    if (usuarioError) {
      console.error('❌ Error consultando usuario:', usuarioError);
      throw new Error('Error consultando usuario: ' + usuarioError.message);
    }

    if (!usuario) {
      console.error('❌ Usuario no encontrado');
      throw new Error('Usuario no encontrado');
    }

    console.log('👤 Usuario encontrado:', usuario.nombre_completo, '-', usuario.rol);

    const context: UserWelcomeContext = {
      nombre: usuario.nombre_completo || 'Usuario',
      rol: usuario.rol || 'Agente',
      oficina: usuario.oficinas?.nombre,
      ultimo_acceso: usuario.updated_at,
    };

    // Ejecutar todas las consultas en paralelo para mayor eficiencia
    const [
      produccionData,
      tareasData,
      cotizacionesData,
      eventosData,
      comisionesData,
      gamificacionData,
      educationData,
      comunicadosData,
      tramitesData,
      reservasData,
    ] = await Promise.allSettled([
      getProduccionData(userId),
      getTareasData(userId),
      getCotizacionesData(userId),
      getEventosProximos(userId),
      getComisionesData(userId),
      getGamificacionData(userId),
      getSegurosEducationData(userId),
      getComunicadosData(userId),
      getTramitesData(userId),
      getReservasData(userId),
    ]);

    // Agregar datos de producción si están disponibles
    if (produccionData.status === 'fulfilled' && produccionData.value) {
      Object.assign(context, produccionData.value);
    }

    // Agregar datos de tareas si están disponibles
    if (tareasData.status === 'fulfilled' && tareasData.value) {
      Object.assign(context, tareasData.value);
    }

    // Agregar datos de cotizaciones si están disponibles
    if (cotizacionesData.status === 'fulfilled' && cotizacionesData.value) {
      Object.assign(context, cotizacionesData.value);
    }

    // Agregar eventos próximos si están disponibles
    if (eventosData.status === 'fulfilled' && eventosData.value) {
      Object.assign(context, eventosData.value);
    }

    // Agregar datos de comisiones si están disponibles
    if (comisionesData.status === 'fulfilled' && comisionesData.value) {
      Object.assign(context, comisionesData.value);
    }

    // Agregar datos de gamificación si están disponibles
    if (gamificacionData.status === 'fulfilled' && gamificacionData.value) {
      Object.assign(context, gamificacionData.value);
    }

    // Agregar datos de educación si están disponibles
    if (educationData.status === 'fulfilled' && educationData.value) {
      Object.assign(context, educationData.value);
    }

    // Agregar datos de comunicados si están disponibles
    if (comunicadosData.status === 'fulfilled' && comunicadosData.value) {
      Object.assign(context, comunicadosData.value);
    }

    // Agregar datos de trámites si están disponibles
    if (tramitesData.status === 'fulfilled' && tramitesData.value) {
      Object.assign(context, tramitesData.value);
    }

    // Agregar datos de reservas si están disponibles
    if (reservasData.status === 'fulfilled' && reservasData.value) {
      Object.assign(context, reservasData.value);
    }

    console.log('✅ Contexto recopilado:', {
      nombre: context.nombre,
      rol: context.rol,
      oficina: context.oficina,
      tareas_pendientes: context.tareas_pendientes,
      cotizaciones_activas: context.cotizaciones_activas,
      produccion_mes_actual: context.produccion_mes_actual,
      comisiones_mes_actual: context.comisiones_mes_actual,
      nivel_actual: context.nivel_actual,
      cursos_en_progreso: context.cursos_en_progreso,
      comunicados_sin_leer: context.comunicados_sin_leer,
      keys: Object.keys(context).length,
    });

    return context;
  } catch (error) {
    console.error('❌ Error obteniendo contexto del usuario:', error);
    throw error;
  }
}

/**
 * Obtiene datos de producción del usuario
 */
async function getProduccionData(userId: string) {
  try {
    const now = new Date();
    const mesActual = now.getMonth() + 1;
    const anioActual = now.getFullYear();
    const mesAnterior = mesActual === 1 ? 12 : mesActual - 1;
    const anioAnterior = mesActual === 1 ? anioActual - 1 : anioActual;

    // Obtener nombres de vendedor mapeados a este usuario
    const { data: vendorMappings } = await supabase
      .from('production_vendors_cache')
      .select('vendor_nombre')
      .eq('movi_user_id', userId);

    if (!vendorMappings || vendorMappings.length === 0) {
      return {
        produccion_mes_actual: 0,
        produccion_mes_anterior: 0,
      };
    }

    const vendorNames = vendorMappings.map(v => v.vendor_nombre);

    // Producción mes actual
    const { data: produccionActual } = await supabase
      .from('production_records')
      .select('prima_ponderada')
      .in('agente_nombre', vendorNames)
      .eq('mes', mesActual)
      .eq('anio', anioActual);

    // Producción mes anterior
    const { data: produccionAnterior } = await supabase
      .from('production_records')
      .select('prima_ponderada')
      .in('agente_nombre', vendorNames)
      .eq('mes', mesAnterior)
      .eq('anio', anioAnterior);

    const totalActual = produccionActual?.reduce((sum, p) => sum + (p.prima_ponderada || 0), 0) || 0;
    const totalAnterior = produccionAnterior?.reduce((sum, p) => sum + (p.prima_ponderada || 0), 0) || 0;

    return {
      produccion_mes_actual: Math.round(totalActual),
      produccion_mes_anterior: Math.round(totalAnterior),
    };
  } catch (error) {
    console.error('Error obteniendo producción:', error);
    return null;
  }
}

/**
 * Obtiene datos de tareas del usuario
 */
async function getTareasData(userId: string) {
  try {
    const now = new Date().toISOString();

    // Tareas pendientes
    const { count: pendientes } = await supabase
      .from('crm_tareas')
      .select('*', { count: 'exact', head: true })
      .eq('creado_por', userId)
      .eq('estatus', 'pendiente');

    // Tareas vencidas
    const { count: vencidas } = await supabase
      .from('crm_tareas')
      .select('*', { count: 'exact', head: true })
      .eq('creado_por', userId)
      .eq('estatus', 'pendiente')
      .lt('fecha_vencimiento', now);

    // Contactos sin seguimiento reciente (más de 30 días)
    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);

    const { data: contactos } = await supabase
      .from('crm_contactos')
      .select('id, actualizado_en')
      .eq('creado_por', userId);

    const sinSeguimiento = contactos?.filter(c => {
      const ultimaActualizacion = new Date(c.actualizado_en);
      return ultimaActualizacion < hace30Dias;
    }).length || 0;

    return {
      tareas_pendientes: pendientes || 0,
      tareas_vencidas: vencidas || 0,
      crm_contactos_sin_seguimiento: sinSeguimiento,
    };
  } catch (error) {
    console.error('Error obteniendo tareas:', error);
    return null;
  }
}

/**
 * Obtiene datos de cotizaciones activas del usuario
 */
async function getCotizacionesData(userId: string) {
  try {
    const { count } = await supabase
      .from('crm_cotizaciones')
      .select('*', { count: 'exact', head: true })
      .eq('creado_por', userId)
      .eq('estatus_cotizacion', 'activa');

    return {
      cotizaciones_activas: count || 0,
    };
  } catch (error) {
    console.error('Error obteniendo cotizaciones:', error);
    return null;
  }
}

/**
 * Obtiene eventos próximos del usuario
 */
async function getEventosProximos(userId: string) {
  try {
    const hoy = new Date().toISOString().split('T')[0];
    const en7Dias = new Date();
    en7Dias.setDate(en7Dias.getDate() + 7);
    const fechaEn7Dias = en7Dias.toISOString().split('T')[0];

    const { count } = await supabase
      .from('aula_eventos')
      .select('*', { count: 'exact', head: true })
      .gte('fecha', hoy)
      .lte('fecha', fechaEn7Dias)
      .or(`creado_por.eq.${userId},visible_para_todos.eq.true`);

    return {
      eventos_proximos: count || 0,
    };
  } catch (error) {
    console.error('Error obteniendo eventos:', error);
    return null;
  }
}

/**
 * Obtiene datos de comisiones del usuario
 */
async function getComisionesData(userId: string) {
  try {
    const now = new Date();
    const mesActual = now.getMonth() + 1;
    const anioActual = now.getFullYear();
    const mesAnterior = mesActual === 1 ? 12 : mesActual - 1;
    const anioAnterior = mesActual === 1 ? anioActual - 1 : anioActual;

    // Calcular rangos de fechas para mes actual
    const primerDiaMesActual = new Date(anioActual, mesActual - 1, 1).toISOString().split('T')[0];
    const ultimoDiaMesActual = new Date(anioActual, mesActual, 0).toISOString().split('T')[0];

    // Calcular rangos de fechas para mes anterior
    const primerDiaMesAnterior = new Date(anioAnterior, mesAnterior - 1, 1).toISOString().split('T')[0];
    const ultimoDiaMesAnterior = new Date(anioAnterior, mesAnterior, 0).toISOString().split('T')[0];

    // Comisiones mes actual - obtener desde batches que caen en el mes actual
    const { data: batchesActuales } = await supabase
      .from('commission_batches')
      .select('id')
      .gte('date_from', primerDiaMesActual)
      .lte('date_from', ultimoDiaMesActual);

    const batchIdsActuales = batchesActuales?.map(b => b.id) || [];

    let totalActual = 0;
    if (batchIdsActuales.length > 0) {
      const { data: comisionesActuales } = await supabase
        .from('commission_details')
        .select('commission_neta')
        .eq('usuario_id', userId)
        .in('batch_id', batchIdsActuales);

      totalActual = comisionesActuales?.reduce((sum, c) => sum + (c.commission_neta || 0), 0) || 0;
    }

    // Comisiones mes anterior
    const { data: batchesAnteriores } = await supabase
      .from('commission_batches')
      .select('id')
      .gte('date_from', primerDiaMesAnterior)
      .lte('date_from', ultimoDiaMesAnterior);

    const batchIdsAnteriores = batchesAnteriores?.map(b => b.id) || [];

    let totalAnterior = 0;
    if (batchIdsAnteriores.length > 0) {
      const { data: comisionesAnteriores } = await supabase
        .from('commission_details')
        .select('commission_neta')
        .eq('usuario_id', userId)
        .in('batch_id', batchIdsAnteriores);

      totalAnterior = comisionesAnteriores?.reduce((sum, c) => sum + (c.commission_neta || 0), 0) || 0;
    }

    return {
      comisiones_mes_actual: Math.round(totalActual),
      comisiones_mes_anterior: Math.round(totalAnterior),
    };
  } catch (error) {
    console.error('Error obteniendo comisiones:', error);
    return null;
  }
}

/**
 * Genera un mensaje de bienvenida personalizado usando ChatGPT
 */
export async function generateWelcomeMessage(
  context: UserWelcomeContext,
  forceRegenerate: boolean = false
): Promise<string> {
  try {
    console.log('🎯 Iniciando generación de mensaje de bienvenida...');
    console.log('🔄 Force regenerate:', forceRegenerate);

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      console.error('❌ No hay sesión activa');
      throw new Error('No active session');
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const apiUrl = `${supabaseUrl}/functions/v1/generate-welcome-message`;

    console.log('📍 API URL:', apiUrl);

    // Preparar el contexto limpio (solo datos que existen)
    const contextData: Record<string, any> = {};
    Object.entries(context).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        contextData[key] = value;
      }
    });

    // Agregar timestamp único para forzar variación en cada llamada
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);

    console.log('📦 Contexto enviado:', {
      nombre: contextData.nombre,
      rol: contextData.rol,
      keys: Object.keys(contextData),
      timestamp,
      randomId,
      forceRegenerate,
    });

    console.log('🔑 Enviando petición a Edge Function...');
    const startTime = Date.now();

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        context: contextData,
        force_regenerate: forceRegenerate,
        timestamp,
      }),
    });

    const duration = Date.now() - startTime;
    console.log(`📡 Response status: ${response.status} (${duration}ms)`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error response:', errorText);
      console.error('❌ Status code:', response.status);
      console.error('❌ Status text:', response.statusText);
      throw new Error(`Error al generar mensaje: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('📦 Response data:', {
      success: data.success,
      message_length: data.message?.length,
      request_id: data.request_id,
      tokens_used: data.tokens_used,
    });

    if (!data.success) {
      console.error('❌ Edge Function reportó error:', data.error);
      throw new Error(data.error || 'Error desconocido');
    }

    if (!data.message || data.message.trim().length === 0) {
      console.error('❌ Mensaje vacío recibido');
      throw new Error('Mensaje vacío');
    }

    console.log('✅ Mensaje generado exitosamente');
    console.log('📝 Mensaje:', data.message);
    console.log('🆔 Request ID:', data.request_id);
    console.log('🔢 Tokens usados:', data.tokens_used);

    return data.message;
  } catch (error: any) {
    console.error('❌ Error generando mensaje de bienvenida:', error);
    console.error('❌ Error type:', error.constructor.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Stack:', error.stack);
    console.warn('⚠️  Usando mensaje de fallback');
    return getFallbackMessage(context);
  }
}

/**
 * Mensaje de respaldo si falla la generación con IA
 */
function getFallbackMessage(context: UserWelcomeContext): string {
  const primerNombre = context.nombre.split(' ')[0];

  const messages = [
    `Hola ${primerNombre}, todo listo para arrancar. Tu espacio de trabajo está esperándote.`,
    `Hola ${primerNombre}, bienvenido de vuelta. Las herramientas que necesitas están a tu alcance.`,
    `Hola ${primerNombre}, es un buen momento para revisar lo que tienes pendiente hoy.`,
  ];

  // Si hay tareas pendientes, usar un mensaje más específico
  if (context.tareas_pendientes && context.tareas_pendientes > 0) {
    return `Hola ${primerNombre}, tienes ${context.tareas_pendientes} tarea${context.tareas_pendientes > 1 ? 's' : ''} pendiente${context.tareas_pendientes > 1 ? 's' : ''}. Vale la pena revisarlas para mantener el ritmo.`;
  }

  // Si hay cotizaciones activas
  if (context.cotizaciones_activas && context.cotizaciones_activas > 0) {
    return `Hola ${primerNombre}, llevas ${context.cotizaciones_activas} cotización${context.cotizaciones_activas > 1 ? 'es' : ''} activa${context.cotizaciones_activas > 1 ? 's' : ''}. Darle seguimiento puede marcar la diferencia.`;
  }

  // Mensaje aleatorio de respaldo
  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Obtiene datos de gamificación del usuario
 */
async function getGamificacionData(userId: string) {
  try {
    // Obtener perfil de gamificación
    const { data: profile } = await supabase
      .from('agent_gamification_profile')
      .select('nivel_actual, xp_actual, xp_proximo_nivel, jiro_coins, dias_racha')
      .eq('user_id', userId)
      .maybeSingle();

    if (!profile) {
      return null;
    }

    // Obtener posición en ranking (solo si está activo)
    const { data: ranking } = await supabase
      .rpc('fn_obtener_ranking_nacional', {
        p_limit: 100,
      });

    const posicion = ranking?.findIndex((entry: any) => entry.user_id === userId) ?? -1;

    // Obtener logros recientes (últimos 7 días)
    const hace7Dias = new Date();
    hace7Dias.setDate(hace7Dias.getDate() - 7);

    const { count: logrosRecientes } = await supabase
      .from('agent_gamification_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', hace7Dias.toISOString())
      .gt('xp_delta', 0);

    return {
      nivel_actual: profile.nivel_actual,
      xp_actual: profile.xp_actual,
      xp_para_siguiente_nivel: profile.xp_proximo_nivel - profile.xp_actual,
      jiro_coins: profile.jiro_coins,
      posicion_ranking: posicion >= 0 ? posicion + 1 : undefined,
      logros_recientes: logrosRecientes || 0,
      dias_racha: profile.dias_racha || 0,
    };
  } catch (error) {
    console.error('Error obteniendo gamificación:', error);
    return null;
  }
}

/**
 * Obtiene datos de Seguros Education del usuario
 */
async function getSegurosEducationData(userId: string) {
  try {
    // Obtener información del usuario para filtrar por oficina
    const { data: userData } = await supabase
      .from('usuarios')
      .select('oficina_id')
      .eq('id', userId)
      .maybeSingle();

    if (!userData) return null;

    // Cursos en progreso (iniciados pero no completados)
    const { count: enProgreso } = await supabase
      .from('seguros_progress')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('completado', false)
      .gt('progreso', 0);

    // Cursos completados
    const { count: completados } = await supabase
      .from('seguros_progress')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('completado', true);

    // Horas de capacitación este mes
    const primerDiaMes = new Date();
    primerDiaMes.setDate(1);
    primerDiaMes.setHours(0, 0, 0, 0);

    const { data: progresoMes } = await supabase
      .from('seguros_progress')
      .select(`
        seguros_lessons(duracion)
      `)
      .eq('user_id', userId)
      .eq('completado', true)
      .gte('updated_at', primerDiaMes.toISOString());

    const horasTotales = progresoMes?.reduce((sum: number, p: any) => {
      return sum + ((p.seguros_lessons?.duracion || 0) / 3600);
    }, 0) || 0;

    // Próximas sesiones live (próximos 7 días)
    const hoy = new Date().toISOString().split('T')[0];
    const en7Dias = new Date();
    en7Dias.setDate(en7Dias.getDate() + 7);
    const fechaEn7Dias = en7Dias.toISOString().split('T')[0];

    const { count: sesionesProximas } = await supabase
      .from('seguros_sessions')
      .select('*', { count: 'exact', head: true })
      .gte('fecha', hoy)
      .lte('fecha', fechaEn7Dias);

    // Cursos nuevos disponibles (últimos 30 días que no ha visto)
    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);

    const { data: cursosNuevos } = await supabase
      .from('seguros_lessons')
      .select('id')
      .gte('created_at', hace30Dias.toISOString());

    const cursosNuevosIds = cursosNuevos?.map(c => c.id) || [];

    let cursosNuevosNoVistos = 0;
    if (cursosNuevosIds.length > 0) {
      const { data: vistos } = await supabase
        .from('seguros_progress')
        .select('lesson_id')
        .eq('user_id', userId)
        .in('lesson_id', cursosNuevosIds);

      const vistosIds = vistos?.map(v => v.lesson_id) || [];
      cursosNuevosNoVistos = cursosNuevosIds.filter(id => !vistosIds.includes(id)).length;
    }

    // Último curso completado
    const { data: ultimoCurso } = await supabase
      .from('seguros_progress')
      .select(`
        seguros_lessons(titulo)
      `)
      .eq('user_id', userId)
      .eq('completado', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      cursos_en_progreso: enProgreso || 0,
      cursos_completados: completados || 0,
      horas_capacitacion_mes: Math.round(horasTotales * 10) / 10,
      proximas_sesiones_live: sesionesProximas || 0,
      cursos_nuevos_disponibles: cursosNuevosNoVistos,
      ultimo_curso_completado: ultimoCurso?.seguros_lessons?.titulo,
    };
  } catch (error) {
    console.error('Error obteniendo datos de educación:', error);
    return null;
  }
}

/**
 * Obtiene datos de comunicados del usuario
 */
async function getComunicadosData(userId: string) {
  try {
    // Obtener información del usuario
    const { data: userData } = await supabase
      .from('usuarios')
      .select('oficina_id, rol')
      .eq('id', userId)
      .maybeSingle();

    if (!userData) return null;

    // Comunicados sin leer
    const { data: comunicados } = await supabase
      .from('comunicados')
      .select(`
        id,
        titulo,
        fecha_publicacion,
        comunicados_visibilidad(usuario_id, area_id, oficina_id, para_todos)
      `)
      .eq('publicado', true)
      .order('fecha_publicacion', { ascending: false });

    if (!comunicados) return null;

    // Filtrar comunicados relevantes para el usuario
    const comunicadosRelevantes = comunicados.filter((c: any) => {
      const visibilidad = c.comunicados_visibilidad;
      if (!visibilidad || visibilidad.length === 0) return false;

      return visibilidad.some((v: any) =>
        v.para_todos ||
        v.usuario_id === userId ||
        v.oficina_id === userData.oficina_id
      );
    });

    // Verificar cuáles no ha leído
    const { data: lecturas } = await supabase
      .from('comunicados_lecturas')
      .select('comunicado_id')
      .eq('usuario_id', userId);

    const leidos = new Set(lecturas?.map(l => l.comunicado_id) || []);
    const sinLeer = comunicadosRelevantes.filter(c => !leidos.has(c.id));

    // Último comunicado relevante
    const ultimoComunicado = comunicadosRelevantes[0];

    return {
      comunicados_sin_leer: sinLeer.length,
      ultimo_comunicado_titulo: ultimoComunicado?.titulo,
      ultimo_comunicado_fecha: ultimoComunicado?.fecha_publicacion,
    };
  } catch (error) {
    console.error('Error obteniendo comunicados:', error);
    return null;
  }
}

/**
 * Obtiene datos de trámites del usuario
 */
async function getTramitesData(userId: string) {
  try {
    // Trámites asignados al usuario que están pendientes o en proceso
    const { count: pendientes } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('agente_id', userId)
      .in('estatus', ['abierto', 'en_proceso']);

    // Documentos del Centro Digital que necesitan revisión (si es admin/gerente)
    const { data: userData } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', userId)
      .maybeSingle();

    let documentosPorRevisar = 0;
    if (userData?.rol === 'Administrador' || userData?.rol === 'Gerente') {
      // Documentos subidos recientemente (últimos 7 días)
      const hace7Dias = new Date();
      hace7Dias.setDate(hace7Dias.getDate() - 7);

      const { count } = await supabase
        .from('centro_digital_archivos')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', hace7Dias.toISOString());

      documentosPorRevisar = count || 0;
    }

    return {
      tramites_pendientes_atencion: pendientes || 0,
      documentos_por_revisar: documentosPorRevisar,
    };
  } catch (error) {
    console.error('Error obteniendo trámites:', error);
    return null;
  }
}

/**
 * Obtiene datos de reservas del usuario
 */
async function getReservasData(userId: string) {
  try {
    // Reservas próximas (próximos 7 días)
    const hoy = new Date().toISOString().split('T')[0];
    const en7Dias = new Date();
    en7Dias.setDate(en7Dias.getDate() + 7);
    const fechaEn7Dias = en7Dias.toISOString().split('T')[0];

    const { count } = await supabase
      .from('reservas_espacio')
      .select('*', { count: 'exact', head: true })
      .eq('reservado_por', userId)
      .gte('fecha', hoy)
      .lte('fecha', fechaEn7Dias)
      .in('estado', ['confirmada', 'pendiente']);

    return {
      reservas_proximas: count || 0,
    };
  } catch (error) {
    console.error('Error obteniendo reservas:', error);
    return null;
  }
}
