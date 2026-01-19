import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { QuoteOptionResult } from './gmmTypes';

function formatCurrency(value: number | null | undefined): string {
  const numValue = typeof value === 'number' && !isNaN(value) ? value : 0;
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numValue);
}

function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
}

function safeNumber(value: any, defaultValue: number = 0): number {
  const num = typeof value === 'number' ? value : parseFloat(value);
  return !isNaN(num) && isFinite(num) ? num : defaultValue;
}

function safeString(value: any, defaultValue: string = '-'): string {
  return value != null && String(value).trim() !== '' ? String(value) : defaultValue;
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

const COBERTURAS_ADICIONALES = [
  {
    key: 'maternidad',
    label: 'Maternidad',
    description: 'Gastos de parto y complicaciones'
  },
  {
    key: 'reconocimiento_antiguedad',
    label: 'Reconocimiento de antigüedad',
    description: 'Periodo de espera reducido'
  },
  {
    key: 'medicamentos_fuera',
    label: 'Medicamentos ambulatorios',
    description: 'Reembolso fuera del hospital'
  },
  {
    key: 'complicaciones_no_amparadas',
    label: 'Complicaciones no amparadas',
    description: 'Derivadas de padecimientos excluidos'
  },
  {
    key: 'padecimientos_preexistentes',
    label: 'Padecimientos preexistentes',
    description: 'Previos a la póliza'
  },
  {
    key: 'eliminacion_deducible_accidente',
    label: 'Sin deducible por accidente',
    description: 'Elimina deducible en accidentes'
  },
  {
    key: 'multiregion',
    label: 'Multiregión',
    description: 'Diferentes estados de la república'
  },
  {
    key: 'vip',
    label: 'Beneficio VIP',
    description: 'Servicios premium'
  },
  {
    key: 'emergencia_medica_extranjero',
    label: 'Emergencias en extranjero',
    description: 'Cobertura internacional de urgencias'
  },
  {
    key: 'enfermedades_graves_extranjero',
    label: 'Enf. graves en extranjero',
    description: 'Tratamiento fuera de México'
  },
  {
    key: 'cobertura_internacional',
    label: 'Cobertura internacional',
    description: 'Atención en cualquier país'
  },
  {
    key: 'ampliacion_servicios',
    label: 'Ampliación de servicios',
    description: 'Servicios médicos adicionales'
  },
  {
    key: 'ayuda_diaria',
    label: 'Ayuda diaria hospitalización',
    description: 'Pago por día hospitalizado'
  },
  {
    key: 'indemnizacion_eg',
    label: 'Indemnización enf. graves',
    description: 'Pago único al diagnóstico'
  },
  {
    key: 'xtensuz',
    label: 'Xtensuz',
    description: 'Extensión de servicios'
  }
];

/**
 * Genera PDF comparativo de cotizaciones GMM - DISEÑO TABLA COMPARATIVA
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
  const margin = 8;
  const contentWidth = pageWidth - (margin * 2);
  let yPos = margin;

  const numOptions = Math.min(options.length, 3);

  // ============================================
  // HEADER: Logo, Título y Folio
  // ============================================
  const headerHeight = 18;

  // Logo (izquierda)
  if (logoUrl) {
    const logoBase64 = await loadImageAsBase64(logoUrl);
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', margin, yPos, 25, 12);
      } catch (error) {
        console.error('Error adding logo:', error);
      }
    }
  }

  // Título principal (centro)
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 51, 102);
  doc.text('Comparativo de Opciones Únikuz Bx+', pageWidth / 2, yPos + 7, { align: 'center' });

  // Folio y fecha (derecha)
  doc.setFontSize(7);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(80);
  const infoX = pageWidth - margin;
  if (quoteInfo.folio) {
    doc.text(`Folio: ${quoteInfo.folio}`, infoX, yPos + 4, { align: 'right' });
  }
  doc.text(`${formatDate(quoteInfo.created_at)}`, infoX, yPos + 8, { align: 'right' });

  yPos += headerHeight;

  // Línea separadora
  doc.setDrawColor(0, 51, 102);
  doc.setLineWidth(0.4);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 3;

  // ============================================
  // TABLA COMPARATIVA PRINCIPAL
  // ============================================

  // Determinar mejor precio
  const bestIndex = options.reduce((minIdx, opt, idx) => {
    const currentTotal = safeNumber(opt.totales?.total_pagar);
    const minTotal = safeNumber(options[minIdx]?.totales?.total_pagar);
    return currentTotal < minTotal ? idx : minIdx;
  }, 0);

  // Preparar datos de la tabla
  const tableData: any[][] = [];

  // ============================================
  // SECCIÓN 1: INFORMACIÓN DEL PLAN
  // ============================================

  // Fila: Encabezado de sección
  const headerRow = ['INFORMACIÓN DEL PLAN'];
  for (let i = 0; i < numOptions; i++) {
    const isBest = numOptions > 1 && i === bestIndex;
    headerRow.push(isBest ? `★ OPCIÓN ${String.fromCharCode(65 + i)}` : `OPCIÓN ${String.fromCharCode(65 + i)}`);
  }
  tableData.push(headerRow);

  // Fila: Estado y Nivel
  const estadoRow = ['Estado y Nivel'];
  options.slice(0, numOptions).forEach(opt => {
    estadoRow.push(`${safeString(opt.plan?.estado)}\n${safeString(opt.plan?.nivel_hospitalario)}`);
  });
  tableData.push(estadoRow);

  // Fila: Suma Asegurada
  const sumaRow = ['Suma Asegurada'];
  options.slice(0, numOptions).forEach(opt => {
    const sumaValue = safeString(opt.plan?.suma_asegurada);
    // Si el valor es numérico, formatearlo como moneda
    if (sumaValue !== '-' && !sumaValue.includes('$') && !isNaN(parseFloat(sumaValue.replace(/,/g, '')))) {
      const numValue = parseFloat(sumaValue.replace(/,/g, ''));
      sumaRow.push(formatCurrency(numValue));
    } else {
      sumaRow.push(sumaValue);
    }
  });
  tableData.push(sumaRow);

  // Fila: Deducible
  const deducibleRow = ['Deducible'];
  options.slice(0, numOptions).forEach(opt => {
    const deducibleValue = safeString(opt.plan?.deducible);
    // Si el valor es numérico, formatearlo como moneda
    if (deducibleValue !== '-' && !deducibleValue.includes('$') && !isNaN(parseFloat(deducibleValue.replace(/,/g, '')))) {
      const numValue = parseFloat(deducibleValue.replace(/,/g, ''));
      deducibleRow.push(formatCurrency(numValue));
    } else {
      deducibleRow.push(deducibleValue);
    }
  });
  tableData.push(deducibleRow);

  // Fila: Coaseguro
  const coaseguroRow = ['Coaseguro'];
  options.slice(0, numOptions).forEach(opt => {
    const coaseguroValue = safeString(opt.plan?.coaseguro);
    // Agregar % si no lo tiene
    const formattedCoaseguro = coaseguroValue.includes('%') ? coaseguroValue : coaseguroValue !== '-' ? `${coaseguroValue}%` : '-';
    coaseguroRow.push(formattedCoaseguro);
  });
  tableData.push(coaseguroRow);

  // Fila: Tope de Coaseguro
  const topeRow = ['Tope de Coaseguro'];
  options.slice(0, numOptions).forEach(opt => {
    const tope = opt.tope_coaseguro ? formatCurrency(opt.tope_coaseguro) : '-';
    topeRow.push(tope);
  });
  tableData.push(topeRow);

  // ============================================
  // SECCIÓN 2: ASEGURADOS
  // ============================================

  // Encontrar el máximo número de asegurados
  const maxInsureds = Math.max(...options.slice(0, numOptions).map(opt => opt.insureds?.length || 0));

  if (maxInsureds > 0) {
    // Header de asegurados
    const aseguradosHeaderRow = ['ASEGURADOS'];
    for (let i = 0; i < numOptions; i++) {
      aseguradosHeaderRow.push('');
    }
    tableData.push(aseguradosHeaderRow);

    // Una fila por cada asegurado
    for (let i = 0; i < maxInsureds; i++) {
      const insuredRow = [`Asegurado ${i + 1}`];

      options.slice(0, numOptions).forEach(opt => {
        const insured = opt.insureds?.[i];
        if (insured) {
          const nombre = safeString(insured.nombre, 'Sin nombre');
          const edad = safeNumber(insured.edad, 0);
          const sexo = safeString(insured.sexo, 'N/A');
          const prima = formatCurrency(safeNumber(insured.prima_neta, 0));
          insuredRow.push(`${nombre}\n${sexo}, ${edad} años\nPrima: ${prima}`);
        } else {
          insuredRow.push('-');
        }
      });

      tableData.push(insuredRow);
    }
  }

  // ============================================
  // SECCIÓN 3: COBERTURAS BÁSICAS
  // ============================================

  const coberturasBasicasRow = ['COBERTURAS BÁSICAS'];
  for (let i = 0; i < numOptions; i++) {
    coberturasBasicasRow.push('');
  }
  tableData.push(coberturasBasicasRow);

  // Lista completa de coberturas básicas en una sola celda
  const coberturasBasicasTexto = [
    '✓ Hospitalización',
    '✓ Honorarios médicos',
    '✓ Medicamentos en hospital',
    '✓ Cirugías',
    '✓ Análisis clínicos',
    '✓ Estudios de gabinete',
    '✓ Ambulancias terrestre y aérea',
    '✓ Terapias físicas',
    '✓ Enfermería privada',
    '✓ Urgencias por accidente',
    '✓ Urgencias por enfermedad',
    '✓ Gastos funerarios',
    '✓ Segunda opinión médica'
  ].join('\n');

  // Agregar todas las coberturas básicas en una sola fila
  const cobBasicaRow = [coberturasBasicasTexto];
  for (let i = 0; i < numOptions; i++) {
    cobBasicaRow.push('✓ INCLUIDAS');
  }
  tableData.push(cobBasicaRow);

  // ============================================
  // SECCIÓN 4: COBERTURAS ADICIONALES
  // ============================================

  const coberturasAddHeaderRow = ['COBERTURAS ADICIONALES'];
  for (let i = 0; i < numOptions; i++) {
    coberturasAddHeaderRow.push('');
  }
  tableData.push(coberturasAddHeaderRow);

  // Una fila por cada cobertura adicional
  COBERTURAS_ADICIONALES.forEach(cobertura => {
    const cobRow = [`${cobertura.label}\n${cobertura.description}`];

    options.slice(0, numOptions).forEach(opt => {
      // Buscar en opt.coberturas en lugar de en opt directamente
      const coberturas = (opt as any).coberturas || {};
      const isIncluded = coberturas[cobertura.key] === true || coberturas[cobertura.key] === 'true';
      cobRow.push(isIncluded ? '✓ SÍ' : '✗ NO');
    });

    tableData.push(cobRow);
  });

  // ============================================
  // SECCIÓN 5: TOTAL Y FORMA DE PAGO
  // ============================================

  const totalHeaderRow = ['TOTAL A PAGAR'];
  for (let i = 0; i < numOptions; i++) {
    totalHeaderRow.push('');
  }
  tableData.push(totalHeaderRow);

  const totalRow = ['Prima Total'];
  options.slice(0, numOptions).forEach(opt => {
    const total = formatCurrency(safeNumber(opt.totales?.total_pagar, 0));
    totalRow.push(total);
  });
  tableData.push(totalRow);

  const formaPagoRow = ['Forma de Pago'];
  options.slice(0, numOptions).forEach(opt => {
    formaPagoRow.push(safeString(opt.totales?.forma_pago, 'Anual'));
  });
  tableData.push(formaPagoRow);

  // ============================================
  // GENERAR TABLA CON AUTOTABLE
  // ============================================

  // Calcular anchos de columna
  const labelColWidth = 70;

  // Si solo hay 1 opción, usar solo 33% del ancho disponible
  const availableWidth = contentWidth - labelColWidth;
  const optionColWidth = numOptions === 1
    ? availableWidth * 0.33  // Solo 33% para una opción
    : availableWidth / numOptions;

  const columnStyles: any = {
    0: {
      cellWidth: labelColWidth,
      fontStyle: 'bold',
      fontSize: 6.5,
      fillColor: [240, 240, 245]
    }
  };

  for (let i = 1; i <= numOptions; i++) {
    columnStyles[i] = {
      cellWidth: optionColWidth,
      halign: 'center',
      fontSize: 6.5
    };
  }

  autoTable(doc, {
    startY: yPos,
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 5.5,
      cellPadding: 1.5,
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
      valign: 'middle',
      overflow: 'linebreak',
      cellWidth: 'wrap'
    },
    columnStyles,
    margin: { left: margin, right: margin },
    didParseCell: function(data) {
      const rowText = String(data.cell.raw || '');

      // Header de secciones (INFORMACIÓN DEL PLAN, ASEGURADOS, etc.)
      if (data.column.index === 0 && (rowText.includes('INFORMACIÓN') ||
          rowText.includes('ASEGURADOS') ||
          rowText.includes('COBERTURAS BÁSICAS') ||
          rowText.includes('COBERTURAS ADICIONALES') ||
          rowText.includes('TOTAL A PAGAR'))) {
        data.cell.styles.fillColor = [0, 51, 102];
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 7;
        data.cell.styles.cellPadding = 1.5;
      }

      // Opciones en header (★ OPCIÓN A, OPCIÓN B, etc.)
      if (data.row.index === 0 && data.column.index > 0) {
        const isBest = rowText.includes('★');
        data.cell.styles.fillColor = isBest ? [0, 153, 51] : [0, 102, 204];
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 7.5;
      }

      // Coberturas básicas: lista completa en columna izquierda
      if (data.column.index === 0 && rowText.includes('✓ Hospitalización')) {
        data.cell.styles.textColor = [0, 153, 51];
        data.cell.styles.fontSize = 5.5;
        data.cell.styles.valign = 'top';
        data.cell.styles.cellPadding = 2;
      }

      // Coberturas básicas: "✓ INCLUIDAS" en columnas de opciones
      if (data.column.index > 0 && rowText === '✓ INCLUIDAS') {
        data.cell.styles.textColor = [0, 153, 51];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 7;
        data.cell.styles.halign = 'center';
        data.cell.styles.valign = 'middle';
      }

      // Coberturas adicionales: colorear ✓ SÍ y ✗ NO
      if (data.column.index > 0 && (rowText.includes('✓ SÍ') || rowText.includes('✗ NO'))) {
        if (rowText.includes('✓ SÍ')) {
          data.cell.styles.textColor = [0, 153, 51];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 6;
        } else if (rowText.includes('✗ NO')) {
          data.cell.styles.textColor = [200, 50, 50];
          data.cell.styles.fontSize = 6;
        }
      }

      // Total a pagar: resaltar
      if (rowText.includes('Prima Total')) {
        data.cell.styles.fillColor = [255, 250, 230];
      }
      if (data.row.section === 'body' && data.cell.raw && String(data.cell.raw).includes('$') &&
          String(tableData[data.row.index]?.[0]).includes('Prima Total')) {
        data.cell.styles.fillColor = [255, 250, 230];
        data.cell.styles.textColor = [0, 102, 51];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 8;
      }

      // Asegurados: resaltar nombre
      if (data.column.index === 0 && rowText.includes('Asegurado')) {
        data.cell.styles.fillColor = [245, 245, 250];
      }

      // Coberturas adicionales: descripción más pequeña
      if (data.column.index === 0 && rowText.includes('\n') && !rowText.includes('COBERT') && !rowText.includes('ASEGURADOS')) {
        const lines = rowText.split('\n');
        if (lines.length === 2) {
          data.cell.styles.fontSize = 5;
          data.cell.styles.textColor = [100, 100, 100];
        }
      }
    },
    didDrawCell: function(data) {
      // Agregar borde más grueso a las mejores opciones
      if (data.row.index === 0 && data.column.index > 0) {
        const cellText = String(data.cell.raw || '');
        if (cellText.includes('★')) {
          doc.setDrawColor(0, 153, 51);
          doc.setLineWidth(0.6);
          doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height);
        }
      }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY;

  // ============================================
  // FOOTER: Notas y Contacto
  // ============================================

  const footerStartY = pageHeight - margin - 10;

  // Si la tabla es muy larga, ajustar
  if (finalY < footerStartY - 2) {
    yPos = finalY + 2;
  } else {
    yPos = footerStartY - 2;
  }

  // Línea separadora
  doc.setDrawColor(200);
  doc.setLineWidth(0.2);
  doc.line(margin, footerStartY - 2, pageWidth - margin, footerStartY - 2);

  // Notas
  doc.setFontSize(4.5);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(60);
  doc.text('Notas importantes:', margin, footerStartY + 1);

  doc.setFontSize(4);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(100);
  const notaText = 'Cotización válida 15 días. Aceptación sujeta a políticas de suscripción. Coberturas según Condiciones Generales CNSF. Documento ilustrativo, no contractual.';
  const notaLines = doc.splitTextToSize(notaText, contentWidth);
  let notaY = footerStartY + 3;
  notaLines.forEach((line: string) => {
    doc.text(line, margin, notaY);
    notaY += 2;
  });

  // Contacto del asesor
  const contactY = pageHeight - margin - 2;
  doc.setDrawColor(220);
  doc.setLineWidth(0.1);
  doc.line(margin, contactY - 1.5, pageWidth - margin, contactY - 1.5);

  doc.setFontSize(6);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 51, 102);

  const contactParts: string[] = [];
  if (asesor.nombre) contactParts.push(asesor.nombre);
  if (asesor.web_slug) contactParts.push(`agentedeseguros.website/${asesor.web_slug}`);
  if (asesor.celular) contactParts.push(asesor.celular);

  const contactText = contactParts.join('  |  ');
  doc.text(contactText, pageWidth / 2, contactY, { align: 'center' });

  return doc.output('blob');
}
