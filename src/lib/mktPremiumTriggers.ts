// Motor de reglas configurables para Marketing Premium: cuando pasa un
// "evento" (activacion, desactivacion, cambio de metodo de pago,
// actualizacion de datos) se disparan los triggers activos configurados
// para ese evento y crean el tramite correspondiente. Mismo patron que
// storeUtils.ts (resolverTemplatePedido / dispararTriggersEstatus en
// StorePedidoDetalle.tsx), adaptado a Marketing Premium.

import { supabase } from './supabase';
import {
  crearTramitesDesdeTriggers, filtrarTriggersPorPago,
  type TriggerBase, type ResultadoTriggers,
} from './tramiteTriggers';
import { adjuntarComprobantePremium } from './mktPremiumPdf';

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

export type DispararTriggersPremiumResultado = ResultadoTriggers;

export async function dispararTriggersPremium(params: {
  eventoKey: string;
  agente: AgentePremiumContext;
  form: FormPremiumContext;
  usuarioId: string;
  usuarioNombre?: string;
}): Promise<ResultadoTriggers> {
  const vacio: ResultadoTriggers = { creados: [], omitidos: [], errores: [], totalTriggers: 0, triggersAplicados: 0 };

  const { data: evento } = await supabase
    .from('mkt_premium_eventos')
    .select('id, nombre')
    .eq('key', params.eventoKey)
    .maybeSingle();
  if (!evento) return vacio;

  const { data: triggersRaw } = await supabase
    .from('mkt_premium_triggers')
    .select('*, ticket_tipos!inner(id, value, label, area)')
    .eq('evento_id', evento.id)
    .eq('activo', true);

  const todos = (triggersRaw ?? []) as unknown as TriggerBase[];
  const triggers = filtrarTriggersPorPago(todos, {
    metodo: params.form.mkt_premium_metodo_pago,
    forma: params.form.mkt_premium_plan,
  });

  const resultado = await crearTramitesDesdeTriggers({
    triggers,
    mapeoDe: obtenerMapeoCamposTriggerPremium,
    resolverPlantilla: (texto) => resolverTemplatePremium(texto, params.agente, params.form, evento.nombre),
    agenteId: params.agente.id,
    usuarioId: params.usuarioId,
    usuarioNombre: params.usuarioNombre,
    columnasExtra: { agente_usuario_id: params.agente.id },
    descripcionPorDefecto: (t) => `${t.nombre} — ${params.agente.nombre} ${params.agente.apellidos}`,
    // Un Premium se cobra una vez por periodo: si ya hay un trámite abierto de
    // ese tipo para el agente, no se levanta otro.
    yaExiste: async (tipoValue) => {
      const { data } = await supabase
        .from('tickets')
        .select('folio, ticket_estatus(clasificacion)')
        .eq('agente_id', params.agente.id)
        .eq('tipo_tramite', tipoValue);
      type FilaTicket = { folio: string; ticket_estatus?: { clasificacion?: string | null } | null };
      const abierto = (data as FilaTicket[] | null ?? []).find(t => t.ticket_estatus?.clasificacion !== 'terminacion');
      return abierto ? { folio: abierto.folio as string } : null;
    },
    adjuntar: async ({ ticketId, folio, tipoLabel }) => {
      // Fuera del await a propósito: si la generación del PDF falla, el trámite
      // ya quedó creado y no tiene por qué perderse.
      adjuntarComprobantePremium({
        ticketId,
        folio,
        fechaCreacion: new Date().toISOString(),
        tipoLabel,
        agente: params.agente,
        form: params.form,
        usuarioId: params.usuarioId,
        creadorNombre: params.usuarioNombre || '—',
      }).catch(err => console.error('[MKT] adjuntarComprobantePremium:', err));
    },
  });

  // `totalTriggers` cuenta las del evento, aplicadas o no: es lo que la pantalla
  // usa para decir "ninguna regla aplicó por el método de pago".
  resultado.totalTriggers = todos.length;
  return resultado;
}
