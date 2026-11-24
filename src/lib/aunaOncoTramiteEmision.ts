// Crea el trámite de EMISIÓN (tipo `nuevo_emision`, área Comercial) a partir de
// una cotización Auna guardada y su solicitud completa. Lleva adjuntos los dos
// PDF (cotización y solicitud) y en las instrucciones el resumen que la mesa
// necesita para emitir sin abrir los PDF.
//
// Replica solo el subconjunto del alta de NuevoTramiteModal que aplica aquí
// (mismo criterio que SolicitudBetaModal): campos de sistema, motor de
// asignación, aviso de trámite nuevo y la alarma a Administradores si no cae
// en ninguna regla.
import { supabase } from './supabase';
import { avisarPorEvento, crearNotificacion } from './notificationHelpers';
import type { Asegurado, ResultadoCotizacion } from './aunaOncoCotizador';
import type { Solicitud } from './aunaOncoSolicitud';

const TIPO_VALUE = 'nuevo_emision';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

export interface TramiteEmisionCreado {
  id: string;
  folio: string;
}

interface Entrada {
  cotizacion: { id: string; folio: string };
  /** Dueño de la cotización: es el solicitante (agente) del trámite. */
  agenteId: string;
  /** Quien lo levanta (puede ser el mismo agente o alguien de su equipo). */
  creadoPorId: string;
  creadoPorNombre: string;
  cliente: string;
  solicitud: Solicitud;
  asegurados: Asegurado[];
  resultado: ResultadoCotizacion;
  pdfCotizacion: { blob: Blob; nombre: string };
  pdfSolicitud: { blob: Blob; nombre: string };
}

export function instruccionesEmision(e: Pick<Entrada, 'cotizacion' | 'cliente' | 'solicitud' | 'asegurados' | 'resultado'>): string {
  const c = e.solicitud.contratante;
  const r = e.resultado;
  const nombreContratante = c.tipoPersona === 'fisica'
    ? [c.nombres, c.apellidoPaterno, c.apellidoMaterno].filter(Boolean).join(' ')
    : c.nombres;
  const lineas = [
    `Emisión Auna Oncosalud Plus · cotización ${e.cotizacion.folio}`,
    `Contratante: ${nombreContratante.toUpperCase()} · RFC ${c.rfc.toUpperCase()} · ${c.telefono} · ${c.email}`,
    `Forma de pago: ${r.formaPago === 'anual' ? 'Anual' : 'Mensual'} · Prima total ${fmt(r.primaTotal)} · 1er recibo ${fmt(r.primerRecibo)}${r.reciboSubsecuente != null ? ` · subsecuentes ${fmt(r.reciboSubsecuente)}` : ''}`,
    `Asegurados (${e.asegurados.length}):`,
    ...e.asegurados.map((a, i) => {
      const l = r.lineas[i];
      const da = e.solicitud.asegurados[a.id];
      const nombre = da ? [da.nombres, da.apellidoPaterno, da.apellidoMaterno].filter(Boolean).join(' ') : a.nombre;
      const extra = l?.extraprima ? ` · extraprima ${Math.round(l.extraprimaPct * 100)}%` : '';
      return `  ${i + 1}. ${nombre.toUpperCase()} (${da?.parentesco || '—'}) · ${a.sexo} · ${a.fechaNacimiento} · prima neta ${fmt(l?.primaNeta ?? 0)}${extra}`;
    }),
  ];
  if (r.requiereSuscripcion) lineas.push('⚠️ Hay respuestas afirmativas en el cuestionario médico: requiere valoración de suscripción.');
  lineas.push('Se adjuntan la cotización y la solicitud de emisión en PDF (sin firmar).');
  return lineas.join('\n');
}

async function subirPdf(ticketId: string, usuarioId: string, pdf: { blob: Blob; nombre: string }) {
  const ruta = `${ticketId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;
  const { error: upErr } = await supabase.storage.from('ticket-archivos').upload(ruta, pdf.blob, { contentType: 'application/pdf' });
  if (upErr) throw new Error(`No se pudo subir ${pdf.nombre}: ${upErr.message}`);
  const { data: { publicUrl } } = supabase.storage.from('ticket-archivos').getPublicUrl(ruta);
  const { error } = await supabase.from('ticket_archivos').insert({
    ticket_id: ticketId,
    usuario_id: usuarioId,
    nombre: pdf.nombre,
    url: publicUrl,
    tipo: 'application/pdf',
    tamano: pdf.blob.size,
  });
  if (error) throw new Error(`No se pudo registrar ${pdf.nombre}: ${error.message}`);
}

export async function crearTramiteEmision(e: Entrada): Promise<TramiteEmisionCreado> {
  const [{ data: tipo }, { data: estatusIniciado }, { data: agente }] = await Promise.all([
    supabase.from('ticket_tipos').select('id, area, label').eq('value', TIPO_VALUE).single(),
    supabase.from('ticket_estatus').select('id').eq('nombre', 'Iniciado').single(),
    supabase.from('usuarios').select('id, nombre, apellidos, oficina:oficinas!oficina_id(nombre)').eq('id', e.agenteId).maybeSingle(),
  ]);
  if (!tipo) throw new Error('No existe el tipo de trámite "Emisión"');
  if (!estatusIniciado) throw new Error('No existe el estatus "Iniciado"');

  const { data: grupoData, error: grupoErr } = await supabase.rpc('get_grupo_para_ticket', {
    p_agente_id: e.agenteId,
    p_tipo_tramite: TIPO_VALUE,
  });
  if (grupoErr) console.error('[emision] get_grupo_para_ticket:', grupoErr.message);
  // Devuelve una TABLA: siempre arreglo.
  const grupo = Array.isArray(grupoData) && grupoData.length > 0
    ? (grupoData[0] as { grupo_id: string | null; ejecutivo_id: string | null })
    : null;
  const grupoId = grupo?.grupo_id ?? null;
  const responsableId = grupo?.ejecutivo_id ?? null;

  const instrucciones = instruccionesEmision(e);
  const { data: ticket, error: ticketErr } = await supabase
    .from('tickets')
    .insert({
      tipo_tramite: TIPO_VALUE,
      estatus_id: estatusIniciado.id,
      prioridad: 'Media',
      instrucciones,
      creado_por: e.creadoPorId,
      modificado_por: e.creadoPorId,
      agente_id: e.agenteId,
      assigned_to_user_id: responsableId,
      grupo_asignado_id: grupoId,
    })
    .select('id, folio')
    .single();
  if (ticketErr) throw ticketErr;

  // Campos de sistema del formulario, para que el detalle se vea completo.
  const { data: campos } = await supabase
    .from('tramite_tipo_campos')
    .select('id, tipo, sistema_key, config')
    .eq('tramite_tipo_id', tipo.id)
    .eq('activo', true);
  const campo = (k: string) => campos?.find(c => c.sistema_key === k);
  const respuestas: { tramite_id: string; campo_id: string; valor_texto?: string; valor_json?: unknown }[] = [];
  const push = (k: string, valor_texto: string | null | undefined) => {
    const c = campo(k);
    if (c && valor_texto) respuestas.push({ tramite_id: ticket.id, campo_id: c.id, valor_texto });
  };
  const agenteRow = agente as { oficina?: { nombre?: string } | null } | null;
  push('area', tipo.area);
  push('fecha_creacion', new Date().toISOString());
  push('creado_por', e.creadoPorNombre);
  push('agente_vendedor', e.agenteId);
  push('oficina_jiro', agenteRow?.oficina?.nombre ?? null);
  if (grupoId) {
    const { data: g } = await supabase.from('tramites_grupos_visualizacion').select('nombre').eq('id', grupoId).maybeSingle();
    push('equipo', g?.nombre ?? null);
  }
  const estatusCampo = campos?.find(c => c.tipo === 'estatus');
  if (estatusCampo) {
    respuestas.push({ tramite_id: ticket.id, campo_id: estatusCampo.id, valor_json: 'iniciado' });
    const opcion = ((estatusCampo.config as { opciones?: { slug: string; label: string }[] })?.opciones ?? []).find(o => o.slug === 'iniciado');
    if (opcion) await supabase.from('tickets').update({ custom_estatus_label: opcion.label, custom_estatus_color: '#3B82F6' }).eq('id', ticket.id);
  }
  if (respuestas.length) {
    const { error } = await supabase.from('tramite_respuestas').insert(respuestas);
    if (error) console.error('[emision] tramite_respuestas:', error.message);
  }

  await subirPdf(ticket.id, e.creadoPorId, e.pdfCotizacion);
  await subirPdf(ticket.id, e.creadoPorId, e.pdfSolicitud);

  // La cotización recuerda su trámite, para no levantar dos.
  const { data: cot } = await supabase.from('cotizaciones').select('datos, resumen').eq('id', e.cotizacion.id).single();
  if (cot) {
    await supabase.from('cotizaciones').update({
      datos: { ...(cot.datos as object), tramiteEmision: { id: ticket.id, folio: ticket.folio } },
      resumen: { ...(cot.resumen as object), tramite_folio: ticket.folio },
    }).eq('id', e.cotizacion.id);
  }

  // Avisos: los destinatarios los decide la base (resolver_destinatarios_aviso).
  const aviso = `Nuevo trámite ${ticket.folio} (Emisión Auna Oncosalud) de ${e.cliente}, cotización ${e.cotizacion.folio}.`;
  const { data: dest } = await supabase.rpc('resolver_destinatarios_aviso', { p_ticket_id: ticket.id, p_codigo_tipo: 'nuevo_tramite' });
  for (const destinatarioId of (dest as string[] | null) ?? []) {
    await avisarPorEvento({
      eventKey: 'nuevo_tramite',
      ticketId: ticket.id,
      destinatarioId,
      disparadoPor: e.creadoPorId,
      variables: {
        folio: ticket.folio ?? '',
        solicitante: [((agente as { nombre?: string } | null)?.nombre), ((agente as { apellidos?: string } | null)?.apellidos)].filter(Boolean).join(' ') || '—',
        oficina: agenteRow?.oficina?.nombre || '—',
        prioridad: 'Media',
        instrucciones: `Emisión Auna Oncosalud · cotización ${e.cotizacion.folio}`,
        tipo_tramite: tipo.label,
      },
      respaldo: {
        user_id: destinatarioId,
        titulo: destinatarioId === responsableId ? 'Nuevo trámite asignado' : 'Nuevo trámite en tu equipo',
        mensaje: aviso,
        modulo: 'Tramites',
        icono: 'clipboard-list',
        accion_url: `/tramites/${ticket.id}`,
        accion_texto: 'Ver trámite',
      },
    });
  }
  if (!responsableId && !grupoId) {
    const { data: admins } = await supabase.from('usuarios').select('id').eq('rol', 'Administrador').eq('activo', true);
    for (const adm of admins ?? []) {
      await crearNotificacion({
        user_id: adm.id,
        titulo: 'Trámite sin equipo asignado',
        mensaje: `${aviso}\n\nNo cayó en ninguna regla de asignación. Requiere asignarlo a mano.`,
        modulo: 'Tramites',
        icono: 'alert-triangle',
        accion_url: `/tramites/${ticket.id}`,
        accion_texto: 'Ver trámite',
      });
    }
  }

  return { id: ticket.id, folio: ticket.folio };
}
