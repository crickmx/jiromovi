import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { QuoteOptionResult } from './gmmTypes';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
}

interface AsesorInfo {
  nombre: string;
  celular?: string;
  web_slug?: string;
}

interface QuoteInfo {
  folio?: string;
  created_at: string;
  asegurado_principal?: string;
}

/**
 * Convierte imagen a Base64 para incluir en PDF
 */
async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error loading image:', error);
    return null;
  }
}

/**
 * Lista de las 15 coberturas adicionales con descripciones
 */
const COBERTURAS_ADICIONALES = [
  {
    key: 'cob_maternidad',
    label: 'Maternidad',
    description: 'Cobertura para gastos de parto y complicaciones del embarazo'
  },
  {
    key: 'cob_reconocimiento_antiguedad',
    label: 'Reconocimiento de antigüedad',
    description: 'Periodo de espera reducido por antigüedad en seguros previos'
  },
  {
    key: 'cob_medicamentos_fuera',
    label: 'Medicamentos fuera del hospital',
    description: 'Reembolso de medicamentos prescritos para uso ambulatorio'
  },
  {
    key: 'cob_complicaciones_no_amparadas',
    label: 'Complicaciones no amparadas',
    description: 'Cubre complicaciones derivadas de padecimientos no cubiertos'
  },
  {
    key: 'cob_padecimientos_preexistentes',
    label: 'Padecimientos preexistentes',
    description: 'Cobertura para enfermedades diagnosticadas antes de la póliza'
  },
  {
    key: 'cob_eliminacion_deducible_accidente',
    label: 'Eliminación de deducible por accidente',
    description: 'Elimina el deducible en caso de accidente'
  },
  {
    key: 'cob_multiregion',
    label: 'Multiregión',
    description: 'Atención médica en diferentes estados de la república'
  },
  {
    key: 'cob_vip',
    label: 'Beneficio VIP',
    description: 'Servicios premium y atención preferente'
  },
  {
    key: 'cob_emergencia_medica_extranjero',
    label: 'Emergencia médica en el extranjero',
    description: 'Cobertura para emergencias médicas fuera de México'
  },
  {
    key: 'cob_enfermedades_graves_extranjero',
    label: 'Enfermedades graves en el extranjero',
    description: 'Tratamiento de enfermedades graves en el extranjero'
  },
  {
    key: 'cob_cobertura_internacional',
    label: 'Cobertura internacional',
    description: 'Atención médica en cualquier parte del mundo'
  },
  {
    key: 'cob_ampliacion_servicios',
    label: 'Ampliación de servicios',
    description: 'Servicios médicos adicionales no contemplados en el plan base'
  },
  {
    key: 'cob_ayuda_diaria',
    label: 'Ayuda diaria por hospitalización',
    description: 'Pago diario por cada día de hospitalización'
  },
  {
    key: 'cob_indemnizacion_eg',
    label: 'Indemnización por enfermedades graves',
    description: 'Pago único al diagnóstico de enfermedades graves'
  },
  {
    key: 'cob_xtensuz',
    label: 'Xtensuz',
    description: 'Extensión de cobertura para servicios especializados'
  }
];

/**
 * Coberturas básicas incluidas en todos los planes
 */
const COBERTURAS_BASICAS = [
  'Hospitalización',
  'Honorarios médicos',
  'Medicamentos hospitalarios',
  'Laboratorio y gabinete',
  'Cirugías',
  'Anestesia',
  'Terapias',
  'Ambulancia',
  'Urgencias'
];

/**
 * Genera PDF unificado de cotización GMM - UNA SOLA PÁGINA HORIZONTAL
 * Funciona tanto para modo simple (1 opción) como comparativo (2-3 opciones)
 */
export async function generateUnifiedQuotePDF(
  options: QuoteOptionResult[],
  quoteInfo: QuoteInfo,
  asesor: AsesorInfo,
  logoUrl?: string
): Promise<Blob> {
  // ============================================
  // CONFIGURACIÓN: A4 HORIZONTAL
  // ============================================
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
  const marginLeft = 8.5; // ~24px
  const marginRight = 8.5;
  const marginTop = 7; // ~20px
  const marginBottom = 7;
  const contentWidth = pageWidth - marginLeft - marginRight;
  let yPosition = marginTop;

  const numOptions = Math.min(options.length, 3);

  // ============================================
  // ENCABEZADO: LOGO Y TÍTULO
  // ============================================
  const headerHeight = 18;

  // Logo (izquierda)
  if (logoUrl) {
    const logoBase64 = await loadImageAsBase64(logoUrl);
    if (logoBase64) {
      try {
        const logoHeight = 12;
        const logoWidth = 24;
        doc.addImage(logoBase64, 'PNG', marginLeft, yPosition, logoWidth, logoHeight);
      } catch (error) {
        console.error('Error adding logo to PDF:', error);
      }
    }
  }

  // Título (centro)
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 51, 102);
  doc.text('Cotización Únikuz Bx+', pageWidth / 2, yPosition + 6, { align: 'center' });

  // Info adicional (derecha/centro)
  doc.setFontSize(7);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(80);
  let infoY = yPosition + 11;
  if (quoteInfo.folio) {
    doc.text(`Folio: ${quoteInfo.folio}`, pageWidth / 2, infoY, { align: 'center' });
    infoY += 3;
  }
  doc.text(`Fecha: ${formatDate(quoteInfo.created_at)}`, pageWidth / 2, infoY, { align: 'center' });

  yPosition += headerHeight;

  // Línea separadora
  doc.setDrawColor(220);
  doc.setLineWidth(0.3);
  doc.line(marginLeft, yPosition, pageWidth - marginRight, yPosition);
  yPosition += 3;

  // ============================================
  // BLOQUE DE OPCIONES CON ASEGURADOS (GRID)
  // ============================================
  const optionsBlockHeight = 75;
  const optionStartY = yPosition;

  // Calcular ancho de columnas según número de opciones
  const columnGap = 3;
  const totalGapWidth = (numOptions - 1) * columnGap;
  const columnWidth = (contentWidth - totalGapWidth) / numOptions;

  // Determinar mejor precio
  const bestIndex = options.reduce((minIdx, opt, idx) =>
    opt.totales.total_pagar < options[minIdx].totales.total_pagar ? idx : minIdx
  , 0);

  // Dibujar cada opción
  for (let i = 0; i < numOptions; i++) {
    const opt = options[i];
    const colX = marginLeft + (i * (columnWidth + columnGap));
    const isBest = numOptions > 1 && i === bestIndex;
    let colY = optionStartY;

    // Borde de la columna
    doc.setFillColor(250, 250, 252);
    doc.setDrawColor(isBest ? [0, 153, 51] : [200, 200, 200]);
    doc.setLineWidth(isBest ? 0.5 : 0.2);
    doc.roundedRect(colX, colY, columnWidth, optionsBlockHeight, 1.5, 1.5, 'FD');

    colY += 3;

    // Título de la opción
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 51, 102);
    const optionLabel = numOptions > 1 ? `Opción ${String.fromCharCode(65 + i)}` : 'Cotización';
    doc.text(optionLabel, colX + columnWidth / 2, colY, { align: 'center' });
    colY += 2;

    // Badge de mejor precio
    if (isBest) {
      doc.setFontSize(6);
      doc.setTextColor(0, 153, 51);
      doc.text('★ MEJOR PRECIO', colX + columnWidth / 2, colY, { align: 'center' });
      colY += 2;
    }

    colY += 2;

    // Datos del plan (compactos)
    doc.setFontSize(6);
    doc.setTextColor(60);

    const planInfo = [
      `${opt.plan.estado || '-'} · ${opt.plan.nivel_hospitalario || '-'}`,
      `${opt.plan.suma_asegurada || '-'} · Ded: ${opt.plan.deducible || '-'}`,
      `Coas: ${opt.plan.coaseguro || '-'} · Tope: ${opt.tope_coaseguro ? formatCurrency(opt.tope_coaseguro).replace('.00', '') : '-'}`
    ];

    planInfo.forEach(line => {
      doc.setFont(undefined, 'normal');
      doc.text(line, colX + columnWidth / 2, colY, { align: 'center', maxWidth: columnWidth - 4 });
      colY += 2.5;
    });

    colY += 1;

    // Separador
    doc.setDrawColor(220);
    doc.setLineWidth(0.1);
    doc.line(colX + 2, colY, colX + columnWidth - 2, colY);
    colY += 3;

    // ASEGURADOS
    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 51, 102);
    doc.text('ASEGURADOS', colX + columnWidth / 2, colY, { align: 'center' });
    colY += 3;

    if (opt.insureds && opt.insureds.length > 0) {
      doc.setFontSize(5.5);
      doc.setTextColor(40);

      opt.insureds.forEach((ins) => {
        const primaIndividual = ins.prima_neta || 0;
        const insuredName = ins.nombre.length > 20 ? ins.nombre.substring(0, 18) + '..' : ins.nombre;

        // Nombre
        doc.setFont(undefined, 'bold');
        doc.text(insuredName, colX + 2, colY);
        colY += 2.5;

        // Edad y sexo
        doc.setFont(undefined, 'normal');
        doc.setTextColor(100);
        doc.text(`${ins.sexo} - ${ins.edad} años`, colX + 4, colY);
        colY += 2.5;

        // Prima
        doc.setTextColor(0, 102, 204);
        doc.setFont(undefined, 'bold');
        doc.text(`Prima: ${formatCurrency(primaIndividual).replace('.00', '')}`, colX + 4, colY);
        colY += 3.5;
      });
    }

    // Separador
    colY = optionStartY + optionsBlockHeight - 12;
    doc.setDrawColor(220);
    doc.setLineWidth(0.1);
    doc.line(colX + 2, colY, colX + columnWidth - 2, colY);
    colY += 3;

    // TOTAL A PAGAR
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 102, 51);
    doc.text('TOTAL:', colX + 2, colY);
    doc.text(formatCurrency(opt.totales.total_pagar).replace('.00', ''), colX + columnWidth - 2, colY, { align: 'right' });
    colY += 3;

    // Forma de pago
    doc.setFontSize(5.5);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(80);
    doc.text(`${opt.totales.forma_pago || 'Anual'}`, colX + columnWidth / 2, colY, { align: 'center' });
  }

  yPosition = optionStartY + optionsBlockHeight + 3;

  // ============================================
  // COBERTURAS BÁSICAS INCLUIDAS (COMPACTAS)
  // ============================================
  doc.setDrawColor(220);
  doc.setLineWidth(0.2);
  doc.line(marginLeft, yPosition, pageWidth - marginRight, yPosition);
  yPosition += 3;

  doc.setFontSize(8);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 51, 102);
  doc.text('COBERTURAS BÁSICAS INCLUIDAS', marginLeft, yPosition);
  yPosition += 3.5;

  // Mostrar coberturas en línea horizontal compacta
  doc.setFontSize(6);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(60);

  const numCols = 3;
  const basicColWidth = contentWidth / numCols;
  const itemsPerCol = Math.ceil(COBERTURAS_BASICAS.length / numCols);

  for (let i = 0; i < COBERTURAS_BASICAS.length; i++) {
    const col = Math.floor(i / itemsPerCol);
    const row = i % itemsPerCol;
    const xPos = marginLeft + (col * basicColWidth) + 2;
    const yPos = yPosition + (row * 3);
    doc.text(`✓ ${COBERTURAS_BASICAS[i]}`, xPos, yPos);
  }

  yPosition += (itemsPerCol * 3) + 2;

  // ============================================
  // TABLA DE COBERTURAS ADICIONALES COMPARATIVA
  // ============================================
  doc.setDrawColor(220);
  doc.setLineWidth(0.2);
  doc.line(marginLeft, yPosition, pageWidth - marginRight, yPosition);
  yPosition += 3;

  doc.setFontSize(8);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 51, 102);
  doc.text('COBERTURAS ADICIONALES', marginLeft, yPosition);
  yPosition += 3;

  // Crear tabla de coberturas adicionales
  const tableData: any[][] = [];

  COBERTURAS_ADICIONALES.forEach(cobertura => {
    const row: any[] = [
      cobertura.label,
      cobertura.description
    ];

    // Agregar indicador para cada opción
    options.slice(0, numOptions).forEach(opt => {
      const isIncluded = (opt as any)[cobertura.key] === true || (opt as any)[cobertura.key] === 'true';
      row.push(isIncluded ? '✓' : '✗');
    });

    tableData.push(row);
  });

  // Construir headers
  const headers: any[] = ['Cobertura', 'Descripción'];
  for (let i = 0; i < numOptions; i++) {
    headers.push(numOptions > 1 ? `Opción ${String.fromCharCode(65 + i)}` : 'Incluida');
  }

  // Calcular anchos de columna dinámicamente
  const nameColWidth = 32;
  const descColWidth = contentWidth - nameColWidth - (numOptions * 15);
  const optionColWidth = 15;

  const columnStyles: any = {
    0: { cellWidth: nameColWidth, fontStyle: 'bold', fontSize: 5.5 },
    1: { cellWidth: descColWidth, fontSize: 5 }
  };

  for (let i = 0; i < numOptions; i++) {
    columnStyles[i + 2] = {
      cellWidth: optionColWidth,
      halign: 'center',
      fontSize: 8
    };
  }

  autoTable(doc, {
    startY: yPosition,
    head: [headers],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [0, 51, 102],
      textColor: 255,
      fontSize: 6.5,
      fontStyle: 'bold',
      cellPadding: 1
    },
    styles: {
      fontSize: 5.5,
      cellPadding: 1.5,
      lineColor: [220, 220, 220],
      lineWidth: 0.1
    },
    margin: { left: marginLeft, right: marginRight },
    columnStyles,
    didParseCell: function(data) {
      // Colorear indicadores
      if (data.column.index >= 2) {
        if (data.cell.text[0] === '✓') {
          data.cell.styles.textColor = [0, 153, 51];
          data.cell.styles.fontStyle = 'bold';
        } else if (data.cell.text[0] === '✗') {
          data.cell.styles.textColor = [200, 0, 0];
        }
      }
    }
  });

  yPosition = (doc as any).lastAutoTable.finalY + 2;

  // ============================================
  // NOTAS IMPORTANTES
  // ============================================
  const notasStartY = pageHeight - marginBottom - 12;

  if (yPosition > notasStartY - 2) {
    // Si no cabe, reducir espacio de tabla
    yPosition = notasStartY - 2;
  }

  doc.setDrawColor(220);
  doc.setLineWidth(0.2);
  doc.line(marginLeft, notasStartY - 2, pageWidth - marginRight, notasStartY - 2);

  doc.setFontSize(5.5);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(80);
  doc.text('Notas importantes:', marginLeft, notasStartY);

  doc.setFontSize(4.5);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(100);

  const notas = [
    '1. Cotización válida 15 días. 2. Aceptación sujeta a políticas de suscripción. 3. Coberturas sujetas a Condiciones Generales CNSF. 4. Documento ilustrativo, no contractual, no garantiza emisión de póliza.'
  ];

  let notaY = notasStartY + 3;
  notas.forEach(nota => {
    const lines = doc.splitTextToSize(nota, contentWidth);
    lines.forEach((line: string) => {
      doc.text(line, marginLeft, notaY);
      notaY += 2.5;
    });
  });

  // ============================================
  // FOOTER FIJO
  // ============================================
  const footerY = pageHeight - marginBottom - 2;

  doc.setDrawColor(220);
  doc.setLineWidth(0.2);
  doc.line(marginLeft, footerY - 2, pageWidth - marginRight, footerY - 2);

  doc.setFontSize(6);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(60);

  // Formato: Nombre | agentedeseguros.online/slug | Teléfono
  const footerParts: string[] = [];

  if (asesor.nombre) {
    footerParts.push(asesor.nombre);
  }

  if (asesor.web_slug) {
    footerParts.push(`agentedeseguros.online/${asesor.web_slug}`);
  }

  if (asesor.celular) {
    footerParts.push(asesor.celular);
  }

  const footerText = footerParts.join(' | ');
  doc.text(footerText, pageWidth / 2, footerY, { align: 'center' });

  const pdfBlob = doc.output('blob');
  return pdfBlob;
}
