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
    ] = await Promise.allSettled([
      getProduccionData(userId),
      getTareasData(userId),
      getCotizacionesData(userId),
      getEventosProximos(userId),
      getComisionesData(userId),
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

    console.log('✅ Contexto recopilado:', {
      nombre: context.nombre,
      rol: context.rol,
      oficina: context.oficina,
      tareas_pendientes: context.tareas_pendientes,
      cotizaciones_activas: context.cotizaciones_activas,
      produccion_mes_actual: context.produccion_mes_actual,
      comisiones_mes_actual: context.comisiones_mes_actual,
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
      .eq('usuario_id', userId)
      .eq('estado', 'pendiente');

    // Tareas vencidas
    const { count: vencidas } = await supabase
      .from('crm_tareas')
      .select('*', { count: 'exact', head: true })
      .eq('usuario_id', userId)
      .eq('estado', 'pendiente')
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
      .eq('usuario_id', userId)
      .eq('estado', 'activa');

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
