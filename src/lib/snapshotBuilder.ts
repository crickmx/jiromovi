import { supabase } from './supabase';
import type { SnapshotData, ModuleName } from './assistantTypes';
import {
  detectModuleFromRoute,
  extractRouteParams,
  compressSnapshot,
  generateSnapshotTTL,
} from './assistantUtils';

export async function buildSnapshot(
  usuarioId: string,
  pathname: string
): Promise<SnapshotData | null> {
  try {
    const modulo = detectModuleFromRoute(pathname);
    const parametros = extractRouteParams(pathname);

    const usuario = await getUserInfo(usuarioId);
    if (!usuario) {
      throw new Error('Usuario no encontrado');
    }

    const baseSnapshot: SnapshotData = {
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre_completo || usuario.email || '',
        rol: usuario.rol || 'agente',
        oficina_nombre: usuario.oficina_nombre,
      },
      ruta: pathname,
      parametros,
      modulo,
      timestamp: new Date().toISOString(),
    };

    let datosEspecificos = {};

    switch (modulo) {
      case 'comisiones':
        datosEspecificos = await buildComisionesSnapshot(usuarioId, parametros);
        break;
      case 'produccion':
        datosEspecificos = await buildProduccionSnapshot(usuarioId);
        break;
      case 'crm':
        datosEspecificos = await buildCRMSnapshot(usuarioId, parametros);
        break;
      case 'tramites':
        datosEspecificos = await buildTramitesSnapshot(usuarioId, parametros);
        break;
      case 'dashboard':
        datosEspecificos = await buildDashboardSnapshot(usuarioId);
        break;
      default:
        datosEspecificos = {};
    }

    const fullSnapshot: SnapshotData = {
      ...baseSnapshot,
      datos_especificos: datosEspecificos,
    };

    return compressSnapshot(fullSnapshot);
  } catch (error) {
    console.error('Error building snapshot:', error);
    return null;
  }
}

async function getUserInfo(usuarioId: string) {
  const { data } = await supabase
    .from('usuarios')
    .select('id, email, nombre_completo, rol, oficina_id, oficinas(nombre)')
    .eq('id', usuarioId)
    .maybeSingle();

  if (!data) return null;

  return {
    ...data,
    oficina_nombre: data.oficinas?.nombre,
  };
}

async function buildComisionesSnapshot(usuarioId: string, parametros: Record<string, string>) {
  const { data: comisiones } = await supabase
    .from('commission_details')
    .select('*')
    .eq('movi_user_id', usuarioId)
    .order('created_at', { ascending: false })
    .limit(10);

  const mesActual = new Date().toISOString().substring(0, 7);
  const { data: resumenMes } = await supabase
    .from('commission_details')
    .select('commission_neta, commission_bruta')
    .eq('movi_user_id', usuarioId)
    .gte('created_at', `${mesActual}-01`);

  let comisionSeleccionada = null;
  if (parametros.id) {
    const { data } = await supabase
      .from('commission_details')
      .select('*')
      .eq('id', parametros.id)
      .maybeSingle();
    comisionSeleccionada = data;
  }

  const totalMes = resumenMes?.reduce((sum, c) => sum + (c.commission_neta || 0), 0) || 0;

  return {
    ultimas_comisiones: comisiones || [],
    resumen_mes_actual: {
      total: totalMes,
      cantidad: resumenMes?.length || 0,
      mes: mesActual,
    },
    comision_seleccionada: comisionSeleccionada,
  };
}

async function buildProduccionSnapshot(usuarioId: string) {
  const mesActual = new Date().toISOString().substring(0, 7);

  const { data: produccionMes } = await supabase
    .from('production_records')
    .select('importe_pesos')
    .eq('user_id', usuarioId)
    .gte('fecha', `${mesActual}-01`);

  const totalMes = produccionMes?.reduce((sum, p) => sum + (p.importe_pesos || 0), 0) || 0;

  const ultimos3Meses = [];
  for (let i = 0; i < 3; i++) {
    const fecha = new Date();
    fecha.setMonth(fecha.getMonth() - i);
    const mes = fecha.toISOString().substring(0, 7);

    const { data } = await supabase
      .from('production_records')
      .select('importe_pesos')
      .eq('user_id', usuarioId)
      .gte('fecha', `${mes}-01`)
      .lt('fecha', `${mes}-32`);

    const total = data?.reduce((sum, p) => sum + (p.importe_pesos || 0), 0) || 0;
    ultimos3Meses.push({ mes, total });
  }

  const { data: porRamo } = await supabase
    .from('production_records')
    .select('ramo_nombre, importe_pesos')
    .eq('user_id', usuarioId)
    .gte('fecha', `${mesActual}-01`);

  const ramoTotales: Record<string, number> = {};
  porRamo?.forEach((p) => {
    const ramo = p.ramo_nombre || 'Sin ramo';
    ramoTotales[ramo] = (ramoTotales[ramo] || 0) + (p.importe_pesos || 0);
  });

  const top5Ramos = Object.entries(ramoTotales)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([ramo, total]) => ({ ramo, total }));

  return {
    total_mes_actual: totalMes,
    tendencia_3_meses: ultimos3Meses,
    top_5_ramos: top5Ramos,
  };
}

async function buildCRMSnapshot(usuarioId: string, parametros: Record<string, string>) {
  const { data: tareas } = await supabase
    .from('crm_tareas')
    .select('*')
    .eq('creado_por', usuarioId)
    .eq('completada', false)
    .order('fecha_vencimiento', { ascending: true })
    .limit(10);

  const en30Dias = new Date();
  en30Dias.setDate(en30Dias.getDate() + 30);

  const { data: renovaciones } = await supabase
    .from('crm_polizas')
    .select('*, crm_contactos(*)')
    .eq('creado_por', usuarioId)
    .lte('fecha_vencimiento', en30Dias.toISOString().split('T')[0])
    .order('fecha_vencimiento', { ascending: true })
    .limit(10);

  let contactoActual = null;
  if (parametros.id) {
    const { data } = await supabase
      .from('crm_contactos')
      .select('*, crm_polizas(*), crm_cotizaciones(*)')
      .eq('id', parametros.id)
      .maybeSingle();
    contactoActual = data;
  }

  return {
    tareas_pendientes: tareas || [],
    renovaciones_proximas: renovaciones || [],
    contacto_actual: contactoActual,
  };
}

async function buildTramitesSnapshot(usuarioId: string, parametros: Record<string, string>) {
  const { data: tramites } = await supabase
    .from('tickets')
    .select('*')
    .eq('creado_por', usuarioId)
    .neq('estado', 'cerrado')
    .order('created_at', { ascending: false })
    .limit(20);

  let tramiteActual = null;
  if (parametros.id) {
    const { data } = await supabase
      .from('tickets')
      .select('*, ticket_historial(*)')
      .eq('id', parametros.id)
      .maybeSingle();
    tramiteActual = data;
  }

  const estadisticas: Record<string, number> = {};
  tramites?.forEach((t) => {
    const tipo = t.tipo || 'general';
    estadisticas[tipo] = (estadisticas[tipo] || 0) + 1;
  });

  return {
    tramites_activos: tramites || [],
    tramite_actual: tramiteActual,
    estadisticas_por_tipo: estadisticas,
  };
}

async function buildDashboardSnapshot(usuarioId: string) {
  const mesActual = new Date().toISOString().substring(0, 7);

  const { data: comisiones } = await supabase
    .from('commission_details')
    .select('commission_neta')
    .eq('movi_user_id', usuarioId)
    .gte('created_at', `${mesActual}-01`);

  const totalComisiones = comisiones?.reduce((sum, c) => sum + (c.commission_neta || 0), 0) || 0;

  const { data: produccion } = await supabase
    .from('production_records')
    .select('importe_pesos')
    .eq('user_id', usuarioId)
    .gte('fecha', `${mesActual}-01`);

  const totalProduccion = produccion?.reduce((sum, p) => sum + (p.importe_pesos || 0), 0) || 0;

  const hoy = new Date().toISOString().split('T')[0];
  const { data: tareasHoy } = await supabase
    .from('crm_tareas')
    .select('*')
    .eq('creado_por', usuarioId)
    .lte('fecha_vencimiento', hoy)
    .eq('completada', false);

  const en30Dias = new Date();
  en30Dias.setDate(en30Dias.getDate() + 30);

  const { data: renovaciones } = await supabase
    .from('crm_polizas')
    .select('*')
    .eq('creado_por', usuarioId)
    .lte('fecha_vencimiento', en30Dias.toISOString().split('T')[0]);

  return {
    comisiones_mes: totalComisiones,
    produccion_mes: totalProduccion,
    tareas_hoy: tareasHoy?.length || 0,
    renovaciones_proximas: renovaciones?.length || 0,
  };
}

export async function saveSnapshot(
  usuarioId: string,
  modulo: ModuleName,
  ruta: string,
  datosJson: SnapshotData
): Promise<string | null> {
  const expiresAt = generateSnapshotTTL(5);

  const { data, error } = await supabase
    .from('assistant_snapshots')
    .insert({
      usuario_id: usuarioId,
      modulo,
      ruta,
      datos_json: datosJson,
      expires_at: expiresAt,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error saving snapshot:', error);
    return null;
  }

  return data.id;
}

export async function getSnapshot(snapshotId: string): Promise<SnapshotData | null> {
  const { data, error } = await supabase
    .from('assistant_snapshots')
    .select('datos_json, expires_at')
    .eq('id', snapshotId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  if (new Date(data.expires_at) < new Date()) {
    return null;
  }

  return data.datos_json as SnapshotData;
}
