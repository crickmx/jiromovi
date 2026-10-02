// Orden de Compra de un servicio: el Marketing Premium contratado.
//
// Antes era un "Comprobante de Trámite" en texto corrido: no decía qué incluía
// el plan, ni cuánto se iba a descontar cada vez, y se parecía demasiado a la
// Orden de Compra de artículos. Ahora es el mismo documento que el de Store
// —misma franja, mismo desglose, mismo bloque de cobro— pero en lila y diciendo
// SERVICIO desde el primer renglón.

import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from './supabase';
import type { AgentePremiumContext, FormPremiumContext } from './mktPremiumTriggers';
import { montoDelPlan, type PlanPremium } from './mktPremiumPagos';
import { planDeCobro } from './cobroDesglose';
import { dibujarFranja, tablaConceptos, bloqueCobro, bloqueDatos, pieDocumento } from './ordenCompraPdf';

const METODO_LABELS: Record<string, string> = {
  deposito_jiro: 'Depósito a cuenta Jiro',
  bono_anual: 'Descuento de bono anual',
  comisiones: 'Descuento a comisiones',
};

const PLAN_LABELS: Record<string, string> = {
  mensual: 'Plan Mensual',
  anual: 'Plan Anual',
};

/** Cada cuándo se cobra si nadie eligió una frecuencia: la del propio plan. */
const FRECUENCIA_DEL_PLAN: Record<string, string> = {
  mensual: 'Mensual',
  anual: 'Anual',
};

export function construirPDFComprobantePremium(params: {
  folio: string;
  fechaCreacion: string;
  tipoLabel: string;
  estatusLabel: string;
  agente: AgentePremiumContext;
  form: FormPremiumContext;
  creadorNombre: string;
}): jsPDF {
  const { folio, fechaCreacion, tipoLabel, estatusLabel, agente, form, creadorNombre } = params;
  const doc = new jsPDF();

  let y = dibujarFranja(doc, {
    tipo: 'servicio',
    folio,
    cargoA: `${agente.nombre} ${agente.apellidos}`.trim(),
    oficina: agente.oficina?.nombre,
    fecha: fechaCreacion,
  });

  const plan = (form.mkt_premium_plan || '') as PlanPremium;
  const total = montoDelPlan(plan);
  const planLabel = PLAN_LABELS[plan] || plan || 'Plan sin especificar';

  y = tablaConceptos(doc, y, 'servicio', [{
    concepto: `Marketing Premium — ${planLabel}`,
    detalle: 'Diseños semanales, logotipo y material de publicidad personalizado.',
    cantidad: 1,
    precioUnitario: total,
  }]);

  const parcialidades = parseInt(form.mkt_premium_parcialidades || '', 10) || 1;
  const frecuencia = form.mkt_premium_frecuencia_pago?.trim() || FRECUENCIA_DEL_PLAN[plan] || null;

  y = bloqueCobro(doc, y, 'servicio', {
    plan: planDeCobro(total, parcialidades, frecuencia),
    metodo: METODO_LABELS[form.mkt_premium_metodo_pago] || form.mkt_premium_metodo_pago || null,
    responsable: `${agente.nombre} ${agente.apellidos}`.trim(),
  });

  const fecha = (v?: string) => (v ? format(new Date(v), "d 'de' MMMM yyyy", { locale: es }) : '—');
  bloqueDatos(doc, y, 'servicio', 'VIGENCIA Y SEGUIMIENTO', [
    ['Inicio del servicio:', fecha(form.mkt_premium_fecha_inicio)],
    ['Próximo pago:', fecha(form.mkt_premium_fecha_pago)],
    ['Trámite:', tipoLabel],
    ['Estatus:', estatusLabel || '—'],
  ]);

  pieDocumento(doc, creadorNombre);
  return doc;
}

export async function adjuntarComprobantePremium(params: {
  ticketId: string;
  folio: string;
  fechaCreacion: string;
  tipoLabel: string;
  agente: AgentePremiumContext;
  form: FormPremiumContext;
  usuarioId: string;
  creadorNombre: string;
}): Promise<void> {
  try {
    const doc = construirPDFComprobantePremium({
      folio: params.folio,
      fechaCreacion: params.fechaCreacion,
      tipoLabel: params.tipoLabel,
      estatusLabel: 'Iniciado',
      agente: params.agente,
      form: params.form,
      creadorNombre: params.creadorNombre,
    });

    const blob = doc.output('blob');
    const nombre = `Orden_Compra_Servicio_${params.folio}.pdf`;
    const path = `${params.ticketId}/${Date.now()}-orden-compra-servicio.pdf`;

    const { error: upErr } = await supabase.storage
      .from('ticket-archivos')
      .upload(path, blob, { contentType: 'application/pdf' });
    if (upErr) {
      console.error('[MKT] Error subiendo la orden de compra PDF:', upErr);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('ticket-archivos').getPublicUrl(path);

    const { error: dbErr } = await supabase.from('ticket_archivos').insert({
      ticket_id: params.ticketId,
      usuario_id: params.usuarioId,
      nombre,
      url: publicUrl,
      tipo: 'application/pdf',
      tamano: blob.size,
    });
    if (dbErr) {
      console.error('[MKT] Error guardando la orden de compra en DB:', dbErr);
    }
  } catch (err) {
    console.error('[MKT] Error adjuntando la orden de compra premium:', err);
  }
}
