import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CarrierResult, QuotePerson, FormaPago } from './types';
import { PRODUCT_LABELS, PRODUCT_COLORS, PAYMENT_FACTORS } from './types';

const FORMAS_PAGO: FormaPago[] = ['Anual', 'Semestral', 'Trimestral', 'Mensual'];

function fmt(n: number): string {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export async function generateMultiGmmPdf(
  results: CarrierResult[],
  people: QuotePerson[],
  clientName: string,
  usuario: any
): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;

  const validResults = results.filter(r => !r.error);

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(23, 23, 23);
  doc.text('Multicotizador GMM', margin, y + 6);
  y += 10;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Comparativa de Gastos Medicos Mayores', margin, y + 4);
  y += 10;

  // Client info
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'bold');
  doc.text('Cliente:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(clientName || 'Sin nombre', margin + 18, y);

  const fecha = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
  doc.setFont('helvetica', 'bold');
  doc.text('Fecha:', pageWidth - margin - 60, y);
  doc.setFont('helvetica', 'normal');
  doc.text(fecha, pageWidth - margin - 60 + 15, y);
  y += 5;

  if (usuario?.nombre) {
    doc.setFont('helvetica', 'bold');
    doc.text('Agente:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(usuario.nombre, margin + 18, y);
    y += 5;
  }

  y += 4;

  // Insureds table
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(23, 23, 23);
  doc.text('Asegurados', margin, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [['Nombre', 'Parentesco', 'Genero', 'Edad']],
    body: people.map(p => [p.name, p.relation, p.gender, String(p.age)]),
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [15, 148, 136], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // Comparison by forma de pago
  if (validResults.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(23, 23, 23);
    doc.text('Comparativa por Forma de Pago', margin, y);
    y += 4;

    const headers = ['Forma de Pago', ...validResults.map(r => PRODUCT_LABELS[r.product])];
    const body = FORMAS_PAGO.map(fp => {
      const row: string[] = [fp];
      for (const r of validResults) {
        if (!r.totals || !r.totals[fp]) {
          row.push('-');
        } else {
          row.push(fmt(r.totals[fp].total));
        }
      }
      return row;
    });

    autoTable(doc, {
      startY: y,
      head: [headers],
      body,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [15, 148, 136], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: Object.fromEntries(
        validResults.map((_, i) => [i + 1, { halign: 'right' as const }])
      ),
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Per-person breakdown
  if (validResults.length > 0 && y < 220) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(23, 23, 23);
    doc.text('Desglose por Asegurado (Prima Anual)', margin, y);
    y += 4;

    const headers = ['Asegurado', 'Edad', ...validResults.map(r => PRODUCT_LABELS[r.product])];
    const body = people.map((p, pIdx) => {
      const row: string[] = [p.name, String(p.age)];
      for (const r of validResults) {
        const pr = r.people_results[pIdx];
        let amount = 0;
        if (pr) {
          if ('discounted_rate' in pr) amount = (pr as any).discounted_rate;
          else if ('annual_premium' in pr) amount = (pr as any).annual_premium;
          else if ('prima_total' in pr) amount = (pr as any).prima_total;
        }
        row.push(amount > 0 ? fmt(amount) : '-');
      }
      return row;
    });

    body.push(['Total', '', ...validResults.map(r => fmt(r.prima_anual_total))]);

    autoTable(doc, {
      startY: y,
      head: [headers],
      body,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [15, 148, 136], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: Object.fromEntries(
        validResults.map((_, i) => [i + 2, { halign: 'right' as const }])
      ),
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 10;
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.setFont('helvetica', 'normal');
  doc.text('Cotizacion generada por MOVI - Multicotizador GMM. Las primas son informativas y estan sujetas a cambios sin previo aviso.', margin, footerY);

  return doc.output('blob');
}
