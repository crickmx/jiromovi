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
  'Hospitalización por enfermedad o accidente',
  'Honorarios médicos',
  'Medicamentos durante la hospitalización',
  'Estudios de laboratorio y gabinete',
  'Cirugías y procedimientos quirúrgicos',
  'Honorarios de anestesiólogo',
  'Terapias físicas y de rehabilitación',
  'Ambulancia terrestre',
  'Sala de urgencias'
];

/**
 * Genera PDF unificado de cotización GMM
 * Funciona tanto para modo simple (1 opción) como comparativo (2-3 opciones)
 */
export async function generateUnifiedQuotePDF(
  options: QuoteOptionResult[],
  quoteInfo: QuoteInfo,
  asesor: AsesorInfo,
  logoUrl?: string
): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 15;
  const marginRight = 15;
  const contentWidth = pageWidth - marginLeft - marginRight;
  let yPosition = 20;

  // ============================================
  // LOGO (jerarquía: Mi Logotipo → Oficina → JIRO)
  // ============================================
  if (logoUrl) {
    const logoBase64 = await loadImageAsBase64(logoUrl);
    if (logoBase64) {
      try {
        const logoWidth = 35;
        const logoHeight = 23;
        doc.addImage(logoBase64, 'PNG', marginLeft, yPosition - 5, logoWidth, logoHeight);
      } catch (error) {
        console.error('Error adding logo to PDF:', error);
      }
    }
  }

  // ============================================
  // ENCABEZADO
  // ============================================
  doc.setFontSize(22);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 51, 102);
  doc.text('Cotización Únikuz Bx+', pageWidth / 2, yPosition + 3, { align: 'center' });

  yPosition += 10;

  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(80);
  doc.text(`Fecha de cotización: ${formatDate(quoteInfo.created_at)}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 4;

  if (quoteInfo.folio) {
    doc.text(`Folio: ${quoteInfo.folio}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 4;
  }

  if (quoteInfo.asegurado_principal) {
    doc.text(`Cliente: ${quoteInfo.asegurado_principal}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 4;
  }

  yPosition += 5;
  doc.setDrawColor(0, 51, 102);
  doc.setLineWidth(0.5);
  doc.line(marginLeft, yPosition, pageWidth - marginRight, yPosition);
  yPosition += 10;

  // ============================================
  // OPCIONES DE COTIZACIÓN (1 a 3 opciones)
  // ============================================
  const numOptions = Math.min(options.length, 3);

  // Determinar mejor precio
  const bestIndex = options.reduce((minIdx, opt, idx) =>
    opt.totales.total_pagar < options[minIdx].totales.total_pagar ? idx : minIdx
  , 0);

  if (numOptions > 1) {
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 51, 102);
    doc.text('COMPARATIVO DE OPCIONES', marginLeft, yPosition);
    yPosition += 8;
  }

  // Calcular ancho de tarjetas según número de opciones
  const cardGap = 4;
  const totalGapWidth = (numOptions - 1) * cardGap;
  const cardWidth = (contentWidth - totalGapWidth) / numOptions;
  const startY = yPosition;

  // Dibujar tarjetas de opciones
  for (let i = 0; i < numOptions; i++) {
    const opt = options[i];
    const cardX = marginLeft + (i * (cardWidth + cardGap));
    const isBest = numOptions > 1 && i === bestIndex;

    yPosition = startY;

    // Borde de la tarjeta
    if (isBest) {
      doc.setDrawColor(0, 153, 51);
      doc.setLineWidth(1);
      doc.roundedRect(cardX, yPosition, cardWidth, 110, 2, 2, 'S');
    } else {
      doc.setFillColor(250, 250, 252);
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.3);
      doc.roundedRect(cardX, yPosition, cardWidth, 110, 2, 2, 'FD');
    }

    yPosition += 5;

    // Título de la opción
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 51, 102);
    const optionLabel = numOptions > 1 ? `Opción ${String.fromCharCode(65 + i)}` : 'Cotización';
    doc.text(optionLabel, cardX + cardWidth / 2, yPosition, { align: 'center' });
    yPosition += 4;

    // Badge de mejor precio
    if (isBest) {
      doc.setFontSize(7);
      doc.setTextColor(0, 153, 51);
      doc.setFont(undefined, 'bold');
      doc.text('★ MEJOR PRECIO', cardX + cardWidth / 2, yPosition, { align: 'center' });
      yPosition += 3;
    }

    yPosition += 3;

    // Datos del plan
    doc.setFontSize(7.5);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(60);

    const planDetails = [
      { label: 'Estado:', value: opt.plan.estado || '-' },
      { label: 'Nivel:', value: opt.plan.nivel_hospitalario || '-' },
      { label: 'Tabulador:', value: opt.plan.tabulador || '-' },
      { label: 'Suma Aseg:', value: opt.plan.suma_asegurada || '-' },
      { label: 'Deducible:', value: opt.plan.deducible || '-' },
      { label: 'Coaseguro:', value: opt.plan.coaseguro || '-' },
      { label: 'Tope Coas:', value: opt.tope_coaseguro ? formatCurrency(opt.tope_coaseguro) : '-' }
    ];

    planDetails.forEach(detail => {
      doc.setFont(undefined, 'bold');
      doc.text(detail.label, cardX + 3, yPosition);
      doc.setFont(undefined, 'normal');
      const valueText = String(detail.value);
      const maxWidth = cardWidth - 6;
      const truncatedValue = valueText.length > 15 ? valueText.substring(0, 13) + '..' : valueText;
      doc.text(truncatedValue, cardX + cardWidth - 3, yPosition, { align: 'right' });
      yPosition += 3.5;
    });

    yPosition += 2;

    // Separador
    doc.setDrawColor(200);
    doc.setLineWidth(0.2);
    doc.line(cardX + 3, yPosition, cardX + cardWidth - 3, yPosition);
    yPosition += 4;

    // Total
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 102, 51);
    doc.text('TOTAL:', cardX + 3, yPosition);
    doc.text(formatCurrency(opt.totales.total_pagar), cardX + cardWidth - 3, yPosition, { align: 'right' });
    yPosition += 5;

    // Forma de pago
    doc.setFontSize(6.5);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(80);
    doc.text(`Pago: ${opt.totales.forma_pago || 'Anual'}`, cardX + cardWidth / 2, yPosition, { align: 'center' });
  }

  yPosition = startY + 115;

  // ============================================
  // ASEGURADOS POR OPCIÓN
  // ============================================
  if (pageHeight - yPosition < 80) {
    doc.addPage();
    yPosition = 20;
  }

  doc.setDrawColor(0, 51, 102);
  doc.setLineWidth(0.3);
  doc.line(marginLeft, yPosition, pageWidth - marginRight, yPosition);
  yPosition += 8;

  doc.setFontSize(11);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 51, 102);
  doc.text('ASEGURADOS', marginLeft, yPosition);
  yPosition += 7;

  const colWidth = contentWidth / numOptions;
  const startYAsegurados = yPosition;

  for (let i = 0; i < numOptions; i++) {
    const opt = options[i];
    const colX = marginLeft + (i * colWidth);
    yPosition = startYAsegurados;

    // Título de la opción
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 102, 204);
    const optLabel = numOptions > 1 ? `Opción ${String.fromCharCode(65 + i)}` : '';
    if (optLabel) {
      doc.text(optLabel, colX + colWidth / 2, yPosition, { align: 'center' });
      yPosition += 5;
    }

    // Lista de asegurados
    if (opt.insureds && opt.insureds.length > 0) {
      doc.setFont(undefined, 'normal');
      doc.setTextColor(60);
      doc.setFontSize(7);

      opt.insureds.forEach((ins, idx) => {
        const primaIndividual = ins.prima_neta || 0;
        const insuredName = ins.nombre.length > 18 ? ins.nombre.substring(0, 16) + '..' : ins.nombre;

        // Nombre
        doc.setFont(undefined, 'bold');
        doc.setTextColor(40);
        doc.text(`${idx + 1}. ${insuredName}`, colX + 2, yPosition);
        yPosition += 3.5;

        // Edad y sexo
        doc.setFont(undefined, 'normal');
        doc.setTextColor(100);
        doc.setFontSize(6.5);
        doc.text(`${ins.sexo} - ${ins.edad} años`, colX + 5, yPosition);
        yPosition += 3;

        // Prima
        doc.setTextColor(0, 102, 204);
        doc.setFont(undefined, 'bold');
        doc.text(`Prima: ${formatCurrency(primaIndividual)}`, colX + 5, yPosition);
        yPosition += 5;

        doc.setFontSize(7);
      });
    }
  }

  // Calcular máxima altura de asegurados
  const maxInsuredHeight = Math.max(...options.map(opt =>
    opt.insureds ? opt.insureds.length * 11.5 : 0
  ));
  yPosition = startYAsegurados + maxInsuredHeight + 10;

  // ============================================
  // COBERTURAS BÁSICAS INCLUIDAS
  // ============================================
  if (pageHeight - yPosition < 60) {
    doc.addPage();
    yPosition = 20;
  }

  doc.setDrawColor(0, 51, 102);
  doc.setLineWidth(0.3);
  doc.line(marginLeft, yPosition, pageWidth - marginRight, yPosition);
  yPosition += 8;

  doc.setFontSize(11);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 51, 102);
  doc.text('COBERTURAS BÁSICAS INCLUIDAS', marginLeft, yPosition);
  yPosition += 7;

  doc.setFontSize(7.5);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(60);

  // Mostrar coberturas en dos columnas
  const halfBasic = Math.ceil(COBERTURAS_BASICAS.length / 2);
  const basicColWidth = contentWidth / 2;

  for (let i = 0; i < COBERTURAS_BASICAS.length; i++) {
    const xPos = i < halfBasic ? marginLeft + 2 : marginLeft + basicColWidth + 2;
    const yPos = yPosition + ((i % halfBasic) * 4);
    doc.text(`✓ ${COBERTURAS_BASICAS[i]}`, xPos, yPos);
  }
  yPosition += (halfBasic * 4) + 5;

  // ============================================
  // TABLA DE COBERTURAS ADICIONALES
  // ============================================
  if (pageHeight - yPosition < 100) {
    doc.addPage();
    yPosition = 20;
  }

  doc.setDrawColor(0, 51, 102);
  doc.setLineWidth(0.3);
  doc.line(marginLeft, yPosition, pageWidth - marginRight, yPosition);
  yPosition += 8;

  doc.setFontSize(11);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 51, 102);
  doc.text('COBERTURAS ADICIONALES', marginLeft, yPosition);
  yPosition += 7;

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

  // Calcular anchos de columna
  const nameColWidth = numOptions === 1 ? 45 : 40;
  const descColWidth = numOptions === 1 ? 95 : 80;
  const optionColWidth = (contentWidth - nameColWidth - descColWidth) / numOptions;

  const columnStyles: any = {
    0: { cellWidth: nameColWidth, fontStyle: 'bold' },
    1: { cellWidth: descColWidth, fontSize: 6 }
  };

  for (let i = 0; i < numOptions; i++) {
    columnStyles[i + 2] = {
      cellWidth: optionColWidth,
      halign: 'center',
      fontSize: 10
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
      fontSize: 8,
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 7,
      cellPadding: 2,
      lineColor: [200, 200, 200],
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

  yPosition = (doc as any).lastAutoTable.finalY + 15;

  // ============================================
  // NOTAS IMPORTANTES
  // ============================================
  if (pageHeight - yPosition < 30) {
    doc.addPage();
    yPosition = 20;
  }

  doc.setFontSize(7);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(80);
  doc.text('Notas importantes:', marginLeft, yPosition);
  yPosition += 4;

  doc.setFontSize(5.5);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(100);

  const notas = [
    '1. La presente cotización tiene vigencia de 15 días contados a partir de la fecha de cotización.',
    '2. La aceptación de los Asegurados está sujeta a las políticas de suscripción vigentes de la compañía.',
    '3. Las coberturas amparadas en la presente cotización están sujetas a las Condiciones Generales registradas ante la CNSF.',
    '4. Esta cotización es de carácter ilustrativa y no forma parte del contrato de seguro y se considerará únicamente a las personas y coberturas señaladas en este documento, por lo que no se garantiza la emisión de la póliza de seguro ni los términos y condiciones aquí sugeridos.'
  ];

  notas.forEach(nota => {
    const lines = doc.splitTextToSize(nota, contentWidth);
    lines.forEach((line: string) => {
      if (pageHeight - yPosition < 10) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text(line, marginLeft, yPosition);
      yPosition += 3;
    });
  });

  // ============================================
  // PIE DE PÁGINA (TODAS LAS PÁGINAS)
  // ============================================
  const totalPages = (doc as any).internal.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    const footerY = pageHeight - 12;

    doc.setDrawColor(0, 51, 102);
    doc.setLineWidth(0.3);
    doc.line(marginLeft, footerY - 3, pageWidth - marginRight, footerY - 3);

    doc.setFontSize(7);
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
    doc.text(footerText, pageWidth / 2, footerY + 2, { align: 'center' });
  }

  const pdfBlob = doc.output('blob');
  return pdfBlob;
}
