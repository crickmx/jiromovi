import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from './supabase';
import type { AgentePremiumContext, FormPremiumContext } from './mktPremiumTriggers';

const METODO_LABELS: Record<string, string> = {
  deposito_jiro: 'Depósito a cuenta Jiro',
  bono_anual: 'Descuento de bono anual',
  comisiones: 'Descuento a comisiones',
};

const PLAN_LABELS: Record<string, string> = {
  mensual: 'Mensual ($200 MXN/mes)',
  anual: 'Anual ($2,000 MXN/año)',
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
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('COMPROBANTE DE TRÁMITE', pageWidth / 2, y, { align: 'center' });
  y += 8;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Marketing Premium · MOVI', pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.setLineWidth(0.5);
  doc.line(14, y, pageWidth - 14, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Folio:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(folio, 45, y);
  doc.setFont('helvetica', 'bold');
  doc.text('Fecha:', pageWidth / 2, y);
  doc.setFont('helvetica', 'normal');
  doc.text(format(new Date(fechaCreacion), "d 'de' MMMM yyyy", { locale: es }), pageWidth / 2 + 16, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Tipo de trámite:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(tipoLabel, 45, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Estatus:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(estatusLabel || '—', 45, y);
  y += 12;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('DATOS DEL AGENTE', 14, y);
  y += 2;
  doc.setLineWidth(0.3);
  doc.line(14, y, pageWidth - 14, y);
  y += 8;
  doc.setFontSize(10);

  const camposAgente: [string, string][] = [
    ['Nombre:', `${agente.nombre} ${agente.apellidos}`],
    ['Oficina:', agente.oficina?.nombre || '—'],
    ['Plan:', PLAN_LABELS[form.mkt_premium_plan] || form.mkt_premium_plan || '—'],
    ['Método de pago:', METODO_LABELS[form.mkt_premium_metodo_pago] || form.mkt_premium_metodo_pago || '—'],
  ];
  if (form.mkt_premium_parcialidades) {
    camposAgente.push(['Parcialidades:', form.mkt_premium_parcialidades]);
  }
  if (form.mkt_premium_fecha_inicio) {
    camposAgente.push(['Fecha de inicio:', format(new Date(form.mkt_premium_fecha_inicio), "d 'de' MMMM yyyy", { locale: es })]);
  }
  if (form.mkt_premium_fecha_pago) {
    camposAgente.push(['Fecha de pago:', format(new Date(form.mkt_premium_fecha_pago), "d 'de' MMMM yyyy", { locale: es })]);
  }

  for (const [label, value] of camposAgente) {
    doc.setFont('helvetica', 'bold');
    doc.text(label, 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, 60, y);
    y += 6;
  }
  y += 6;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('GENERADO POR', 14, y);
  y += 2;
  doc.line(14, y, pageWidth - 14, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Responsable:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(creadorNombre, 60, y);
  y += 16;

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    `Generado el ${format(new Date(), "d 'de' MMMM yyyy 'a las' HH:mm", { locale: es })}`,
    pageWidth / 2,
    y,
    { align: 'center' }
  );

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
    const nombre = `Comprobante_MKT_Premium_${params.folio}.pdf`;
    const path = `${params.ticketId}/${Date.now()}-comprobante-premium.pdf`;

    const { error: upErr } = await supabase.storage
      .from('ticket-archivos')
      .upload(path, blob, { contentType: 'application/pdf' });
    if (upErr) {
      console.error('[MKT] Error subiendo comprobante PDF:', upErr);
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
      console.error('[MKT] Error guardando comprobante en DB:', dbErr);
    }
  } catch (err) {
    console.error('[MKT] Error adjuntando comprobante premium:', err);
  }
}
