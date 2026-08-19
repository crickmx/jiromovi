// Motor de reglas configurables para Marketing Premium: cuando pasa un
// "evento" (activacion, desactivacion, cambio de metodo de pago,
// actualizacion de datos) se disparan los triggers activos configurados
// para ese evento y crean el tramite correspondiente. Mismo patron que
// storeUtils.ts (resolverTemplatePedido / dispararTriggersEstatus en
// StorePedidoDetalle.tsx), adaptado a Marketing Premium.

import { supabase } from './supabase';
import { obtenerCamposTramiteTipo } from './storeUtils';

export interface MktPremiumTrigger {
  id: string;
  nombre: string;
  evento_id: string;
  ticket_tipo_id: string;
  descripcion_template: string;
  metodo_pago_filtro: string[] | null;
  activo: boolean;
}

export interface MktPremiumEvento {
  id: string;
  key: string;
  nombre: string;
  orden: number;
  activo: boolean;
}

export interface MktPremiumTriggerCampo {
  id: string;
  trigger_id: string;
  campo_id: string;
  fuente: 'vacio' | 'template';
  valor_template: string | null;
}

export const PLACEHOLDERS_TRIGGER_PREMIUM: { key: string; label: string }[] = [
  { key: '{{nombre}}', label: 'Nombre del agente' },
  { key: '{{apellidos}}', label: 'Apellidos del agente' },
  { key: '{{nombre_completo}}', label: 'Nombre completo del agente' },
  { key: '{{oficina}}', label: 'Oficina del agente' },
  { key: '{{plan}}', label: 'Plan (mensual/anual)' },
  { key: '{{metodo_pago}}', label: 'Método de pago' },
  { key: '{{parcialidades}}', label: 'Número de parcialidades' },
  { key: '{{fecha_inicio}}', label: 'Fecha de inicio' },
  { key: '{{fecha_pago}}', label: 'Fecha de próximo pago' },
  { key: '{{evento}}', label: 'Nombre del evento que disparó la regla' },
];

const PLAN_LABELS: Record<string, string> = {
  mensual: 'Mensual — $200 MXN/mes',
  anual: 'Anual — $2,000 MXN/año',
};

const METODO_LABELS: Record<string, string> = {
  deposito_jiro: 'Depósito a cuenta Jiro',
  bono_anual: 'Descuento de bono anual',
  comisiones: 'Descuento a comisiones',
};

export interface AgentePremiumContext {
  id: string;
  nombre: string;
  apellidos: string;
  oficina?: { nombre: string } | null;
}

export interface FormPremiumContext {
  mkt_premium_plan: string;
  mkt_premium_metodo_pago: string;
  mkt_premium_parcialidades: string;
  mkt_premium_fecha_inicio: string;
  mkt_premium_fecha_pago: string;
}

export function resolverTemplatePremium(
  template: string,
  agente: AgentePremiumContext,
  form: FormPremiumContext,
  nombreEvento: string
): string {
  return (template || '')
    .replace(/\{\{nombre\}\}/g, agente.nombre)
    .replace(/\{\{apellidos\}\}/g, agente.apellidos)
    .replace(/\{\{nombre_completo\}\}/g, `${agente.nombre} ${agente.apellidos}`)
    .replace(/\{\{oficina\}\}/g, agente.oficina?.nombre || 'N/A')
    .replace(/\{\{plan\}\}/g, form.mkt_premium_plan ? (PLAN_LABELS[form.mkt_premium_plan] || form.mkt_premium_plan) : 'Sin especificar')
    .replace(/\{\{metodo_pago\}\}/g, form.mkt_premium_metodo_pago ? (METODO_LABELS[form.mkt_premium_metodo_pago] || form.mkt_premium_metodo_pago) : 'Sin especificar')
    .replace(/\{\{parcialidades\}\}/g, form.mkt_premium_parcialidades ? form.mkt_premium_parcialidades : 'N/A')
    .replace(/\{\{fecha_inicio\}\}/g, form.mkt_premium_fecha_inicio || 'Sin especificar')
    .replace(/\{\{fecha_pago\}\}/g, form.mkt_premium_fecha_pago || 'Sin especificar')
    .replace(/\{\{evento\}\}/g, nombreEvento);
}

export async function obtenerMapeoCamposTriggerPremium(triggerId: string): Promise<MktPremiumTriggerCampo[]> {
  const { data, error } = await supabase
    .from('mkt_premium_trigger_campos')
    .select('*')
    .eq('trigger_id', triggerId);
  if (error) throw error;
  return data as MktPremiumTriggerCampo[];
}

export async function guardarMapeoCampoTriggerPremium(mapeo: {
  trigger_id: string;
  campo_id: string;
  fuente: 'vacio' | 'template';
  valor_template?: string | null;
}) {
  const { error } = await supabase
    .from('mkt_premium_trigger_campos')
    .upsert(mapeo, { onConflict: 'trigger_id,campo_id' });
  if (error) throw error;
}

const TEXTO_TIPOS_TRIGGER = [
  'texto_corto', 'texto_largo', 'select', 'radio', 'checkbox',
  'aseguradora', 'ramo', 'email', 'telefono', 'rfc', 'curp',
];

function construirRespuesta(tramiteId: string, campoId: string, tipoCampo: string, valor: unknown) {
  return {
    tramite_id: tramiteId,
    campo_id: campoId,
    valor_texto: TEXTO_TIPOS_TRIGGER.includes(tipoCampo) ? String(valor) : null,
    valor_numerico: ['numerico', 'porcentaje'].includes(tipoCampo) ? Number(valor) : null,
    valor_fecha: tipoCampo === 'fecha' ? String(valor) : null,
    valor_booleano: tipoCampo === 'booleano' ? Boolean(valor) : null,
    valor_json: !TEXTO_TIPOS_TRIGGER.includes(tipoCampo) && !['numerico', 'porcentaje', 'fecha', 'booleano'].includes(tipoCampo) ? valor : null,
  };
}

export interface DispararTriggersPremiumResultado {
  creados: { folio: string; tipoLabel: string }[];
  omitidos: { folio: string; tipoLabel: string }[];
  errores: { nombre: string; error: string }[];
  totalTriggers: number;
  triggersAplicados: number;
}

export async function dispararTriggersPremium(params: {
  eventoKey: string;
  agente: AgentePremiumContext;
  form: FormPremiumContext;
  usuarioId: string;
  usuarioNombre?: string;
}): Promise<DispararTriggersPremiumResultado> {
  const resultado: DispararTriggersPremiumResultado = { creados: [], omitidos: [], errores: [], totalTriggers: 0, triggersAplicados: 0 };

  const { data: evento } = await supabase
    .from('mkt_premium_eventos')
    .select('id, nombre')
    .eq('key', params.eventoKey)
    .maybeSingle();
  if (!evento) return resultado;

  const { data: triggersRaw } = await supabase
    .from('mkt_premium_triggers')
    .select('*, ticket_tipos!inner(id, value, label, area)')
    .eq('evento_id', evento.id)
    .eq('activo', true);
  resultado.totalTriggers = triggersRaw?.length ?? 0;

  const metodoActual = params.form.mkt_premium_metodo_pago;
  const triggers = (triggersRaw ?? []).filter((t: any) =>
    !t.metodo_pago_filtro?.length || (metodoActual && t.metodo_pago_filtro.includes(metodoActual))
  );
  resultado.triggersAplicados = triggers.length;
  if (triggers.length === 0) return resultado;

  const { data: estatusIniciado } = await supabase
    .from('ticket_estatus').select('id').eq('nombre', 'Iniciado').maybeSingle();
  if (!estatusIniciado) {
    resultado.errores.push({ nombre: '(config)', error: 'No se encontró el estatus "Iniciado" en el sistema' });
    return resultado;
  }

  for (const trigger of triggers as any[]) {
    try {
      const tipoInfo = trigger.ticket_tipos as { id: string; value: string; label: string; area: string };
      const camposDelTipo = await obtenerCamposTramiteTipo(tipoInfo.id);
      const mapeo = await obtenerMapeoCamposTriggerPremium(trigger.id as string);

      const { data: grupoRow } = await supabase.rpc('get_grupo_para_ticket', {
        p_agente_id: params.agente.id,
        p_tipo_tramite: tipoInfo.value,
      });
      const grupoResult = Array.isArray(grupoRow) && grupoRow.length > 0
        ? grupoRow[0] as { grupo_id: string; ejecutivo_id: string | null }
        : null;

      let nombreGrupo: string | null = null;
      if (grupoResult?.grupo_id) {
        const { data: grupoData } = await supabase
          .from('tramites_grupos_visualizacion').select('nombre').eq('id', grupoResult.grupo_id).single();
        nombreGrupo = grupoData?.nombre ?? null;
      }
      let nombreEjecutivo: string | null = null;
      if (grupoResult?.ejecutivo_id) {
        const { data: ejecData } = await supabase
          .from('usuarios').select('nombre_completo, nombre').eq('id', grupoResult.ejecutivo_id).maybeSingle();
        nombreEjecutivo = ejecData?.nombre_completo || ejecData?.nombre || null;
      }

      const descripcionCampo = (camposDelTipo ?? []).find((c: any) => c.sistema_key === 'descripcion');
      const mapeoDescripcion = descripcionCampo ? mapeo.find(m => m.campo_id === descripcionCampo.id) : undefined;
      const instrucciones = (mapeoDescripcion?.fuente === 'template' && mapeoDescripcion.valor_template)
        ? resolverTemplatePremium(mapeoDescripcion.valor_template, params.agente, params.form, evento.nombre)
        : (resolverTemplatePremium(trigger.descripcion_template, params.agente, params.form, evento.nombre)
          || `${trigger.nombre} — ${params.agente.nombre} ${params.agente.apellidos}`);

      // Deduplicación: si ya existe un ticket abierto del mismo tipo para este agente, omitir
      const { data: existentes } = await supabase
        .from('tickets')
        .select('folio, ticket_estatus(clasificacion)')
        .eq('agente_id', params.agente.id)
        .eq('tipo_tramite', tipoInfo.value);
      const existenteActivo = (existentes ?? []).find((t: any) =>
        t.ticket_estatus?.clasificacion !== 'terminacion'
      );
      if (existenteActivo) {
        resultado.omitidos.push({ folio: existenteActivo.folio, tipoLabel: tipoInfo.label });
        continue;
      }

      const { data: ticket, error: ticketError } = await supabase.from('tickets').insert({
        tipo_tramite: tipoInfo.value,
        estatus_id: estatusIniciado.id,
        prioridad: 'Media',
        instrucciones,
        creado_por: params.usuarioId,
        modificado_por: params.usuarioId,
        agente_id: params.agente.id,
        agente_usuario_id: params.agente.id,
        assigned_to_user_id: grupoResult?.ejecutivo_id ?? null,
        grupo_asignado_id: grupoResult?.grupo_id ?? null,
      }).select().single();
      if (ticketError || !ticket) throw ticketError;

      const respuestasAuto: ReturnType<typeof construirRespuesta>[] = [];
      const areaCampo = (camposDelTipo ?? []).find((c: any) => c.sistema_key === 'area');
      if (areaCampo && tipoInfo.area) respuestasAuto.push(construirRespuesta(ticket.id, areaCampo.id, 'area', tipoInfo.area));
      const equipoCampo = (camposDelTipo ?? []).find((c: any) => c.sistema_key === 'equipo');
      if (equipoCampo && nombreGrupo) respuestasAuto.push(construirRespuesta(ticket.id, equipoCampo.id, 'equipo', nombreGrupo));
      const creadoPorCampo = (camposDelTipo ?? []).find((c: any) => c.sistema_key === 'creado_por');
      if (creadoPorCampo && params.usuarioNombre) respuestasAuto.push(construirRespuesta(ticket.id, creadoPorCampo.id, 'creado_por', params.usuarioNombre));
      const asignadoACampo = (camposDelTipo ?? []).find((c: any) => c.sistema_key === 'asignado_a');
      if (asignadoACampo && nombreEjecutivo) respuestasAuto.push(construirRespuesta(ticket.id, asignadoACampo.id, 'asignado_a', nombreEjecutivo));

      const respuestasMapeo = mapeo
        .filter(m => m.fuente === 'template' && m.valor_template)
        .map(m => {
          const campoInfo = (camposDelTipo ?? []).find((c: any) => c.id === m.campo_id);
          const valor = resolverTemplatePremium(m.valor_template as string, params.agente, params.form, evento.nombre);
          return construirRespuesta(ticket.id, m.campo_id, campoInfo?.tipo ?? 'texto_corto', valor);
        });

      const todasRespuestas = [...respuestasAuto, ...respuestasMapeo];
      if (todasRespuestas.length > 0) {
        await supabase.from('tramite_respuestas').insert(todasRespuestas);
      }

      resultado.creados.push({ folio: ticket.folio, tipoLabel: tipoInfo.label });
    } catch (err: any) {
      console.error(`[MktPremium] Error creando trámite del trigger "${trigger.nombre}":`, err);
      resultado.errores.push({ nombre: trigger.nombre as string, error: err?.message || 'error desconocido' });
    }
  }
  return resultado;
}
