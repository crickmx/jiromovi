// Motor compartido: crear trámites automáticos desde una regla ("trigger").
//
// MOVI Store lo dispara cuando un pedido cambia de estatus; Marketing Admin
// cuando el Plan Premium de un agente se activa, se desactiva o cambia. Eran
// dos funciones de ~150 líneas casi idénticas, en archivos distintos, y las
// diferencias entre ellas no eran decisiones: eran despistes de la copia.
//
// Lo que de verdad cambia entre los dos módulos queda como parámetro: de dónde
// salen las reglas, cómo se resuelven las plantillas, cómo se sabe si ya hay un
// trámite para esto, y qué documento se adjunta. Todo lo demás —resolver el
// equipo responsable, llenar los campos de sistema, guardar las respuestas,
// juntar errores sin tumbar el resto— es igual y vive aquí una sola vez.

import { supabase } from './supabase';
import { construirRespuesta, type RespuestaTramite } from './tramiteRespuestas';
import type { TriggerBase, MapeoCampoTrigger, ResultadoTriggers } from './tramiteTriggerFiltro';

export * from './tramiteTriggerFiltro';

/** Campos activos del tipo de trámite, en su orden. */
export async function camposDelTipo(tramiteTipoId: string) {
  const { data, error } = await supabase
    .from('tramite_tipo_campos')
    .select('*')
    .eq('tramite_tipo_id', tramiteTipoId)
    .eq('activo', true)
    .order('display_order');
  if (error) throw error;
  return data ?? [];
}

interface CampoTipo { id: string; tipo: string; sistema_key: string | null }

export interface OpcionesMotor<T extends TriggerBase> {
  /** Reglas ya filtradas por el evento/estatus que las dispara. */
  triggers: T[];
  /** Mapeo de campos configurado por el admin para esa regla. */
  mapeoDe: (triggerId: string) => Promise<MapeoCampoTrigger[]>;
  /** Resuelve `{{placeholders}}` con los datos del módulo. */
  resolverPlantilla: (texto: string, trigger: T) => string;
  /** Usuario cuyas reglas de asignación deciden el equipo responsable. */
  agenteId: string | null;
  /** Quién disparó la acción. */
  usuarioId: string;
  usuarioNombre?: string | null;
  /** Columnas extra del ticket propias del módulo (`store_pedido_id`, etc.). */
  columnasExtra?: Record<string, unknown>;
  /** ¿Ya existe un trámite para esto? Devuelve su folio para poder omitirlo. */
  yaExiste: (tipoValue: string) => Promise<{ folio: string } | null>;
  /** Texto de respaldo cuando no hay plantilla configurada. */
  descripcionPorDefecto: (trigger: T) => string;
  /** Adjunta un documento al trámite recién creado, si la regla lo pide. */
  adjuntar?: (ctx: { trigger: T; mapeo: MapeoCampoTrigger[]; ticketId: string; folio: string; tipoLabel: string }) => Promise<void>;
}

/**
 * Crea un trámite por cada regla. Un error en una no tumba a las demás: se
 * junta y se reporta al final, que es lo que permite decir en pantalla qué se
 * creó y qué no.
 */
export async function crearTramitesDesdeTriggers<T extends TriggerBase>(
  opciones: OpcionesMotor<T>,
): Promise<ResultadoTriggers> {
  const { triggers } = opciones;
  const resultado: ResultadoTriggers = {
    creados: [], omitidos: [], errores: [],
    totalTriggers: triggers.length, triggersAplicados: triggers.length,
  };
  if (triggers.length === 0) return resultado;

  const { data: estatusIniciado } = await supabase
    .from('ticket_estatus').select('id').eq('nombre', 'Iniciado').maybeSingle();
  if (!estatusIniciado) {
    resultado.errores.push({ nombre: '(config)', error: 'No se encontró el estatus "Iniciado" en el sistema' });
    return resultado;
  }

  for (const trigger of triggers) {
    const tipo = trigger.ticket_tipos;
    try {
      const campos = (await camposDelTipo(tipo.id)) as unknown as CampoTipo[];
      const mapeo = await opciones.mapeoDe(trigger.id);

      // Equipo y ejecutivo según las reglas de asignación del tipo. El RPC
      // devuelve una TABLA: leer `.grupo_id` sobre el arreglo da undefined, y un
      // arreglo vacío es truthy, así que el error pasa en silencio. Ya costó que
      // ningún trámite hijo recibiera equipo durante semanas.
      const { data: grupoRow } = await supabase.rpc('get_grupo_para_ticket', {
        p_agente_id: opciones.agenteId,
        p_tipo_tramite: tipo.value,
      });
      const grupo = Array.isArray(grupoRow) && grupoRow.length > 0
        ? grupoRow[0] as { grupo_id: string; ejecutivo_id: string | null }
        : null;

      let nombreGrupo: string | null = null;
      if (grupo?.grupo_id) {
        const { data } = await supabase
          .from('tramites_grupos_visualizacion').select('nombre').eq('id', grupo.grupo_id).maybeSingle();
        nombreGrupo = data?.nombre ?? null;
      }
      let nombreEjecutivo: string | null = null;
      if (grupo?.ejecutivo_id) {
        const { data } = await supabase
          .from('usuarios').select('nombre_completo, nombre').eq('id', grupo.ejecutivo_id).maybeSingle();
        nombreEjecutivo = data?.nombre_completo || data?.nombre || null;
      }

      // "Descripción / Notas" mapeada a mano gana sobre la plantilla de la regla.
      const campoDescripcion = campos.find(c => c.sistema_key === 'descripcion');
      const mapeoDescripcion = campoDescripcion ? mapeo.find(m => m.campo_id === campoDescripcion.id) : undefined;
      const instrucciones = (mapeoDescripcion?.fuente === 'template' && mapeoDescripcion.valor_template)
        ? opciones.resolverPlantilla(mapeoDescripcion.valor_template, trigger)
        : (opciones.resolverPlantilla(trigger.descripcion_template, trigger) || opciones.descripcionPorDefecto(trigger));

      const existente = await opciones.yaExiste(tipo.value);
      if (existente) {
        resultado.omitidos.push({ folio: existente.folio, tipoLabel: tipo.label });
        continue;
      }

      const { data: ticket, error: errTicket } = await supabase.from('tickets').insert({
        tipo_tramite: tipo.value,
        estatus_id: estatusIniciado.id,
        prioridad: 'Media',
        instrucciones,
        creado_por: opciones.usuarioId,
        modificado_por: opciones.usuarioId,
        agente_id: opciones.agenteId,
        assigned_to_user_id: grupo?.ejecutivo_id ?? null,
        grupo_asignado_id: grupo?.grupo_id ?? null,
        ...(opciones.columnasExtra ?? {}),
      }).select().single();
      if (errTicket || !ticket) throw errTicket;

      // Campos fijos del FormBuilder, mismo criterio que "Nuevo Trámite".
      const respuestas: RespuestaTramite[] = [];
      const poner = (key: string, valor: string | null | undefined) => {
        const campo = campos.find(c => c.sistema_key === key);
        if (campo && valor) respuestas.push(construirRespuesta(ticket.id, campo.id, campo.tipo, valor));
      };
      poner('area', tipo.area);
      poner('equipo', nombreGrupo);
      poner('creado_por', opciones.usuarioNombre);
      poner('asignado_a', nombreEjecutivo);

      for (const m of mapeo) {
        if (m.fuente !== 'template' || !m.valor_template) continue;
        const campo = campos.find(c => c.id === m.campo_id);
        respuestas.push(construirRespuesta(
          ticket.id, m.campo_id, campo?.tipo ?? 'texto_corto',
          opciones.resolverPlantilla(m.valor_template, trigger),
        ));
      }
      if (respuestas.length > 0) {
        await supabase.from('tramite_respuestas').insert(respuestas);
      }

      if (opciones.adjuntar) {
        await opciones.adjuntar({ trigger, mapeo, ticketId: ticket.id, folio: ticket.folio, tipoLabel: tipo.label });
      }

      resultado.creados.push({ folio: ticket.folio, tipoLabel: tipo.label });
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : 'error desconocido';
      console.error(`[triggers] Error creando el trámite de "${trigger.nombre}":`, err);
      resultado.errores.push({ nombre: trigger.nombre, error: mensaje });
    }
  }
  return resultado;
}
