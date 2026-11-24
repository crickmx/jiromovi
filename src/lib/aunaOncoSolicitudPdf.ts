// PDF de la solicitud de emisión Auna Oncosalud, con la misma marca
// compartida que la cotización. Sigue el orden de la solicitud de Dentegra
// para que la mesa de emisión la pueda transcribir sin buscar.
import { jsPDF } from 'jspdf';
import type { CellInput, RowInput } from 'jspdf-autotable';
import { AVISO_IMPORTANTE, PREGUNTAS_MEDICAS, type Asegurado, type ResultadoCotizacion } from './aunaOncoCotizador';
import { preguntasDe, afirmativas, type Solicitud } from './aunaOncoSolicitud';
import {
  autoTable, marcaCompartida, fmt, fechaLarga, fechaCorta, AUNA, NAVY, GRIS, MARGEN, type AgentePdf,
} from './aunaOncoPdf';

export interface DatosSolicitudPdf {
  folio: string;
  folioCotizacion?: string;
  fecha: Date;
  solicitud: Solicitud;
  asegurados: Asegurado[];
  resultado: ResultadoCotizacion;
  agente: AgentePdf;
}

const finY = (doc: jsPDF) => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
const v = (s: string | null | undefined) => (s && s.trim() ? s.trim() : '—');
const etiqueta = (i: number) => (i === 0 ? 'Titular' : `A${i}`);

export async function generarPdfSolicitudAuna(datos: DatosSolicitudPdf): Promise<Blob> {
  const { solicitud: s, asegurados, resultado: r, agente } = datos;
  const c = s.contratante;
  const fisica = c.tipoPersona === 'fisica';
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M = MARGEN;
  const marca = await marcaCompartida(doc, agente, datos.folio);
  const pie = marca.pie;
  // Una vez por página: las tablas que saltan de página lo piden en didDrawPage.
  const conEncabezado = new Set<number>();
  const encabezado = () => {
    const pag = doc.getCurrentPageInfo().pageNumber;
    if (conEncabezado.has(pag)) return;
    conEncabezado.add(pag);
    marca.encabezado();
  };

  let y = 36;
  const nuevaPagina = () => { doc.addPage(); encabezado(); y = 36; };
  const asegurar = (alto: number) => { if (y + alto > PH - 22) nuevaPagina(); };

  const tablaBase = {
    margin: { left: M, right: M, top: 34 },
    theme: 'grid' as const,
    styles: { lineColor: [226, 232, 240] as [number, number, number], lineWidth: 0.2, cellPadding: 1.6, fontSize: 8, textColor: [...NAVY] as [number, number, number] },
    headStyles: { fillColor: [...AUNA] as [number, number, number], textColor: 255, fontSize: 8.5 },
    didDrawPage: () => encabezado(),
  };

  const seccion = (titulo: string) => {
    asegurar(14);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...AUNA);
    doc.text(titulo.toUpperCase(), M, y);
    y += 2;
  };

  /** Pares etiqueta/valor en 4 columnas. */
  const pares = (filas: [string, string][]) => {
    const body: RowInput[] = [];
    for (let i = 0; i < filas.length; i += 2) {
      const a = filas[i], b = filas[i + 1];
      const lbl = (t: string): CellInput => ({ content: t, styles: { fontStyle: 'bold', fillColor: [241, 250, 252], textColor: [...GRIS] } });
      body.push(b ? [lbl(a[0]), a[1], lbl(b[0]), b[1]] : [lbl(a[0]), { content: a[1], colSpan: 3 }]);
    }
    autoTable(doc, { ...tablaBase, startY: y, body, columnStyles: { 0: { cellWidth: 38 }, 2: { cellWidth: 38 } } });
    y = finY(doc) + 6;
  };

  // ── Título ────────────────────────────────────────────────────────────────
  encabezado();
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...NAVY);
  doc.text('Solicitud de emisión · Oncosalud Plus', M, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GRIS);
  doc.text(`${fechaLarga(datos.fecha)}  ·  Folio ${datos.folio}`, PW - M, y, { align: 'right' });
  y += 5;
  doc.setFontSize(7.5);
  const descargo = doc.splitTextToSize('Programa Oncológico de Salud · Dentegra Seguros Dentales, S.A. Este documento sólo constituye una solicitud de seguro y, por tanto, no representa garantía alguna de que la misma será aceptada por la empresa de seguros, ni de que, en caso de aceptarse, la aceptación concuerde totalmente con los términos de la solicitud.', PW - 2 * M);
  doc.text(descargo, M, y);
  y += descargo.length * 3.2 + 5;

  // ── Datos de la póliza ───────────────────────────────────────────────────
  seccion('Datos de la póliza');
  pares([
    ['Plan', 'Oncosalud Plus (individual)'],
    ['Forma de pago', r.formaPago === 'anual' ? 'Anual (contado)' : 'Mensual (12 recibos)'],
    ['Prima neta total', fmt(r.primaNetaTotal)],
    ['Prima total (IVA incl.)', fmt(r.primaTotal)],
    [r.formaPago === 'anual' ? 'Pago único' : 'Primer recibo', fmt(r.primerRecibo)],
    ['Recibos subsecuentes', r.reciboSubsecuente != null ? `11 de ${fmt(r.reciboSubsecuente)}` : '—'],
    ['Envío de documentos', s.envio === 'digital' ? 'Digital (correo electrónico)' : 'Impresa'],
    ['Cotización de origen', v(datos.folioCotizacion)],
  ]);

  // ── Contratante ──────────────────────────────────────────────────────────
  seccion('Datos del contratante');
  const nombreContratante = fisica
    ? [c.nombres, c.apellidoPaterno, c.apellidoMaterno].filter(x => x.trim()).join(' ')
    : c.nombres;
  pares([
    ['Tipo de persona', fisica ? 'Física' : 'Moral'],
    [fisica ? 'Nombre' : 'Razón social', v(nombreContratante).toUpperCase()],
    ['RFC', v(c.rfc).toUpperCase()],
    ['CURP', v(c.curp).toUpperCase()],
    [fisica ? 'Fecha de nacimiento' : 'Fecha de constitución', v(fechaCorta(c.fechaNacimiento))],
    ['Sexo', c.sexo === 'F' ? 'Femenino' : c.sexo === 'M' ? 'Masculino' : '—'],
    ['Entidad de nacimiento', v(c.entidadNacimiento)],
    ['País de nacimiento', v(c.paisNacimiento)],
    ['Nacionalidad', v(c.nacionalidad)],
    ['Teléfono', v(c.telefono)],
    ['Correo electrónico', v(c.email)],
    ['Ocupación / actividad', v(c.ocupacion)],
    ['No. de serie FIEL', v(c.serieFiel)],
  ]);
  const d = c.domicilio;
  seccion('Domicilio particular');
  pares([
    ['Calle', v(d.calle)],
    ['No. ext. / int.', `${v(d.numExt)}${d.numInt.trim() ? ` / ${d.numInt.trim()}` : ''}`],
    ['Colonia', v(d.colonia)],
    ['C.P.', v(d.cp)],
    ['Municipio / alcaldía', v(d.municipio)],
    ['Ciudad', v(d.ciudad)],
    ['Entidad federativa', v(d.entidad)],
    ['País', v(d.pais)],
    ['Origen de los recursos', c.origenRecursos === 'actividad' ? 'Producto de su ocupación, actividad o giro' : `Otro: ${v(c.origenOtro)}`],
    ['Destino de los recursos', c.destinoRecursos === 'seguro' ? 'Contratar un seguro con Dentegra' : `Otro: ${v(c.destinoOtro)}`],
  ]);

  seccion('Reconocimiento del contratante y PEP');
  pares([
    ['Actúa a nombre de un tercero', s.tercero.actua ? 'SÍ' : 'NO'],
    ['Tercero', s.tercero.actua ? `${v(s.tercero.nombre)} · ${v(s.tercero.parentesco)} · ${v(s.tercero.actoJuridico)}` : '—'],
    ['Persona políticamente expuesta', s.pep.es ? 'SÍ' : 'NO'],
    ['Puesto, fecha y parentesco', s.pep.es ? v(s.pep.detalle) : '—'],
    ['Vínculos con sociedad', s.pep.es ? (s.pep.vinculos ? `SÍ · ${v(s.pep.sociedad)}` : 'NO') : '—'],
  ]);

  // ── Asegurados ───────────────────────────────────────────────────────────
  seccion('Datos de los asegurados');
  autoTable(doc, {
    ...tablaBase,
    startY: y,
    head: [['No.', 'Apellido paterno', 'Apellido materno', 'Nombre(s)', 'Nacimiento', 'Sexo', 'Parentesco', 'Prima neta']],
    body: asegurados.map((a, i) => {
      const da = s.asegurados[a.id];
      return [
        String(i + 1),
        v(da?.apellidoPaterno).toUpperCase(),
        v(da?.apellidoMaterno).toUpperCase(),
        v(da?.nombres).toUpperCase(),
        fechaCorta(a.fechaNacimiento),
        a.sexo,
        v(da?.parentesco),
        fmt(r.lineas[i]?.primaNeta ?? 0),
      ];
    }),
    columnStyles: { 0: { halign: 'center', cellWidth: 9 }, 4: { halign: 'center' }, 5: { halign: 'center', cellWidth: 11 }, 7: { halign: 'right' } },
  });
  y = finY(doc) + 2;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...GRIS);
  const domicilios = asegurados.map((a, i) => {
    const da = s.asegurados[a.id];
    return `${i + 1}. ${da?.mismoDomicilio !== false ? 'Mismo domicilio del contratante' : v(da?.domicilio)}`;
  }).join('   ');
  const lDom = doc.splitTextToSize(`Domicilio: ${domicilios}`, PW - 2 * M);
  doc.text(lDom, M, y + 3);
  y += lDom.length * 3.2 + 7;

  // ── Cuestionario médico ──────────────────────────────────────────────────
  nuevaPagina();
  seccion('Cuestionario médico');
  const cols = asegurados.map((_, i) => etiqueta(i));
  const body: RowInput[] = [
    ['1. Estatura (m)', ...asegurados.map(a => (a.estatura ? a.estatura.toFixed(2) : '—'))],
    ['2. Peso (kg)', ...asegurados.map(a => (a.peso ? String(a.peso) : '—'))],
    ['3. Actividad profesional', ...asegurados.map(a => v(s.asegurados[a.id]?.actividad))],
    ...PREGUNTAS_MEDICAS.map(p => [
      `${p.num}. ${p.texto}`,
      ...asegurados.map(a => {
        if (!preguntasDe(a).includes(p)) return { content: 'N/A', styles: { textColor: [...GRIS] } } as CellInput;
        const resp = a.respuestas[p.id];
        if (resp === undefined) return '—';
        if (!resp) return 'NO';
        const extra = p.num === 4 ? `: ${v(s.asegurados[a.id]?.medicamentos)}` : '';
        return { content: `SÍ${extra}`, styles: { fontStyle: 'bold', textColor: [180, 83, 9] } } as CellInput;
      }),
    ]),
  ];
  const anchoResp = Math.min(26, (PW - 2 * M - 90) / Math.max(cols.length, 1));
  autoTable(doc, {
    ...tablaBase,
    startY: y,
    head: [['Pregunta', ...cols]],
    body,
    columnStyles: Object.fromEntries(cols.map((_, i) => [i + 1, { halign: 'center', cellWidth: anchoResp }])),
  });
  y = finY(doc) + 6;

  const filasDetalle = asegurados.flatMap((a, i) => afirmativas(a).map(p => {
    const det = s.detalles.find(x => x.aseguradoId === a.id && x.pregunta === p.num);
    const da = s.asegurados[a.id];
    return [
      String(p.num),
      `${etiqueta(i)} · ${[da?.nombres, da?.apellidoPaterno].filter(Boolean).join(' ')}`,
      v(det?.diagnostico), v(det?.fecha), v(det?.medicamento), v(det?.cirugia), v(det?.clinica),
    ];
  }));
  if (filasDetalle.length) {
    seccion('Detalle de respuestas afirmativas');
    autoTable(doc, {
      ...tablaBase,
      startY: y,
      head: [['P.', 'Persona', 'Diagnóstico o dolencia', 'Fecha', 'Medicamento', 'Cirugía / procedimiento', 'Clínica / hospital']],
      body: filasDetalle,
      columnStyles: { 0: { halign: 'center', cellWidth: 8 } },
    });
    y = finY(doc) + 6;
  }

  if (s.medico.nombre.trim()) {
    seccion('Médico de cabecera o tratante');
    pares([
      ['Nombre', v(s.medico.nombre)],
      ['Especialidad', v(s.medico.especialidad)],
      ['Teléfono', v(s.medico.telefono)],
      ['Correo', v(s.medico.email)],
      ['Dirección del consultorio', v(s.medico.direccion)],
    ]);
  }

  // ── Agente, consentimiento y firmas ──────────────────────────────────────
  seccion('Agente');
  pares([
    ['Agente', v(agente.nombre)],
    ['Clave', v(s.agente.clave)],
    ['Participación', s.agente.participacion.trim() ? `${s.agente.participacion.trim()}%` : '—'],
    ['Oficina', v(agente.oficina)],
  ]);

  seccion('Consentimiento de datos personales');
  pares([
    ['Fines adicionales (promoción, encuestas)', s.aceptaMercadotecnia ? 'SÍ ACEPTO' : 'NO ACEPTO'],
  ]);

  const declaracion = 'Declaro bajo protesta de decir verdad que la información contenida en la presente solicitud y en el cuestionario médico es verídica y que en su llenado no ha mediado dolo, reticencia, omisión o inexacta declaración. La omisión o inexacta declaración de estos datos facultará a la aseguradora para considerar rescindido de pleno derecho el seguro. La información del cuestionario tiene una vigencia de treinta (30) días a partir de la fecha en que fue proporcionada.';
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8);
  const lDecl = doc.splitTextToSize(declaracion, PW - 2 * M);
  doc.setFontSize(8);
  const lAviso = doc.splitTextToSize(AVISO_IMPORTANTE, PW - 2 * M - 10);
  asegurar(lDecl.length * 3.4 + lAviso.length * 3.6 + 60);
  doc.setFontSize(7.8); doc.setTextColor(71, 85, 105);
  doc.text(lDecl, M, y);
  y += lDecl.length * 3.4 + 4;

  const avisoH = lAviso.length * 3.6 + 12;
  doc.setFillColor(255, 251, 235); doc.setDrawColor(245, 158, 11); doc.setLineWidth(0.4);
  doc.roundedRect(M, y, PW - 2 * M, avisoH, 2.5, 2.5, 'FD');
  doc.setFillColor(245, 158, 11); doc.rect(M, y, 1.6, avisoH, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(146, 64, 14);
  doc.text('Aviso importante sobre su cotización:', M + 5, y + 6);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120, 53, 15);
  doc.text(lAviso, M + 5, y + 11);
  y += avisoH + 8;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...NAVY);
  doc.text(`Lugar y fecha: ${v(s.lugar)}, a ${fechaLarga(datos.fecha)}`, M, y);
  y += 22;
  const anchoFirma = (PW - 2 * M - 20) / 2;
  doc.setDrawColor(...NAVY); doc.setLineWidth(0.3);
  doc.line(M, y, M + anchoFirma, y);
  doc.line(PW - M - anchoFirma, y, PW - M, y);
  doc.setFontSize(8);
  doc.text('Nombre y firma del CONTRATANTE', M + anchoFirma / 2, y + 4, { align: 'center' });
  doc.text(v(nombreContratante).toUpperCase(), M + anchoFirma / 2, y + 8, { align: 'center' });
  doc.text('Firma del agente', PW - M - anchoFirma / 2, y + 4, { align: 'center' });
  doc.text(v(agente.nombre), PW - M - anchoFirma / 2, y + 8, { align: 'center' });

  pie();
  return doc.output('blob');
}
