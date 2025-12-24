import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

async function extractTextFromPDF(buffer: Uint8Array): Promise<string> {
  try {
    console.log('🔍 Attempting to extract PDF text...');

    const pdfjsLib = await import('https://esm.sh/pdfjs-dist@3.11.174/build/pdf.min.mjs');

    pdfjsLib.GlobalWorkerOptions.workerSrc = '';

    const loadingTask = pdfjsLib.getDocument({ data: buffer });
    const pdf = await loadingTask.promise;

    console.log(`📄 PDF loaded: ${pdf.numPages} páginas`);

    let fullText = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        const pageText = textContent.items
          .map((item: any) => item.str || '')
          .join(' ');

        if (pageText.trim()) {
          fullText += `\n--- Página ${pageNum} ---\n${pageText.trim()}\n`;
        }
      } catch (pageError) {
        console.error(`Error en página ${pageNum}:`, pageError);
        fullText += `\n--- Página ${pageNum}: Error al extraer texto ---\n`;
      }
    }

    if (fullText.trim().length > 0) {
      console.log('✅ PDF text extracted successfully');
      return `📄 Contenido del PDF (${pdf.numPages} página${pdf.numPages !== 1 ? 's' : ''}):\n${fullText.trim()}`;
    } else {
      console.log('⚠️ PDF has no extractable text');
      return '[PDF sin contenido de texto extraíble - puede ser un PDF de imagen o protegido]';
    }
  } catch (error) {
    console.error('❌ Error parsing PDF:', error);
    return '[Error al extraer texto del PDF. El archivo puede estar protegido, corrupto, o ser un PDF escaneado sin texto. Por favor, describe el contenido manualmente.]';
  }
}

async function extractFileContent(fileBuffer: Uint8Array, fileName: string): Promise<string> {
  const extension = fileName.split('.').pop()?.toLowerCase();

  if (!extension) {
    return 'Archivo sin extensión válida';
  }

  try {
    if (extension === 'txt' || extension === 'csv') {
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(fileBuffer);
    }

    if (extension === 'pdf') {
      console.log('Extracting text from PDF:', fileName);
      const pdfText = await extractTextFromPDF(fileBuffer);
      return pdfText || '[PDF sin contenido de texto extraíble]';
    }

    if (['jpg', 'jpeg', 'png', 'gif'].includes(extension)) {
      return '[Imagen adjunta - nombre: ' + fileName + ']\nNota: No se puede extraer texto de imágenes automáticamente.';
    }

    if (['doc', 'docx', 'xlsx', 'xls'].includes(extension)) {
      return '[Documento Office adjunto - nombre: ' + fileName + ']\nNota: El análisis automático de documentos Office no está disponible. Por favor, describe el contenido del documento.';
    }

    return '[Archivo adjunto - nombre: ' + fileName + ', tipo: .' + extension + ']\nNota: No se puede extraer texto automáticamente de este tipo de archivo.';
  } catch (error) {
    console.error('Error extracting file content:', error);
    return '[Error al procesar archivo: ' + fileName + ']';
  }
}

interface RoutingDecision {
  selectedMode: 'chatgpt' | 'movi';
  chatgptScore: number;
  moviScore: number;
  confidence: number;
  reasoning: {
    layer1_keywords: string[];
    layer2_intent: string;
    layer3_factors: string[];
  };
}

class IntelligentRouter {
  private static readonly KEYWORD_RULES = [
    // MOVI Mode - System data
    { keywords: ['mis comisiones', 'mi comisión', 'mi pago', 'mi cuenta', 'mi saldo'], mode: 'movi', weight: 45, category: 'comisiones' },
    { keywords: ['mi producción', 'mi prima', 'mis pólizas', 'mi vendedor'], mode: 'movi', weight: 45, category: 'produccion' },
    { keywords: ['mis contactos', 'mis clientes', 'mis tareas'], mode: 'movi', weight: 45, category: 'crm' },
    { keywords: ['mis cotizaciones', 'mi cotización'], mode: 'movi', weight: 40, category: 'cotizaciones' },
    { keywords: ['mi perfil', 'mis datos', 'mi información personal'], mode: 'movi', weight: 40, category: 'perfil' },
    { keywords: ['comunicado', 'comunicados', 'notificación interna'], mode: 'movi', weight: 35, category: 'comunicados' },
    { keywords: ['directorio', 'compañeros', 'mi oficina', 'mi equipo'], mode: 'movi', weight: 35, category: 'directorio' },
    { keywords: ['mi trámite', 'mis trámites', 'mi ticket', 'mis tickets'], mode: 'movi', weight: 35, category: 'tramites' },
    { keywords: ['mi reunión', 'mis reuniones', 'mi agenda'], mode: 'movi', weight: 30, category: 'calendario' },

    // ChatGPT Mode - General insurance knowledge
    { keywords: ['teléfono', 'número', 'contacto de', 'dirección de', 'ubicación de'], mode: 'chatgpt', weight: 40, category: 'contactos_externos' },
    { keywords: ['siniestro', 'siniestros', 'reclamación', 'reclamaciones', 'ajustador'], mode: 'chatgpt', weight: 40, category: 'siniestros' },
    { keywords: ['cobertura', 'coberturas', 'qué cubre', 'qué no cubre', 'deducible'], mode: 'chatgpt', weight: 40, category: 'coberturas' },
    { keywords: ['gnp', 'qualitas', 'axa', 'mapfre', 'metlife', 'zurich', 'chubb', 'ana seguros', 'bupa', 'allianz'], mode: 'chatgpt', weight: 35, category: 'aseguradoras' },
    { keywords: ['vida', 'auto', 'gastos médicos', 'hogar', 'ahorro', 'inversión'], mode: 'chatgpt', weight: 30, category: 'ramos' },
    { keywords: ['qué es', 'cómo funciona', 'explica', 'explicar', 'definición'], mode: 'chatgpt', weight: 35, category: 'explicaciones' },
    { keywords: ['consejo', 'consejos', 'recomendación', 'sugerencia', 'estrategia'], mode: 'chatgpt', weight: 35, category: 'consejos' },
    { keywords: ['comparar', 'diferencia', 'versus', 'vs', 'mejor opción'], mode: 'chatgpt', weight: 35, category: 'comparaciones' },
    { keywords: ['tendencia', 'tendencias', 'mercado', 'industria', 'actualidad'], mode: 'chatgpt', weight: 35, category: 'tendencias' },
    { keywords: ['procedimiento', 'proceso', 'trámite de', 'requisitos', 'documentos necesarios'], mode: 'chatgpt', weight: 35, category: 'procedimientos' },
  ];

  private static readonly INTENT_PATTERNS = {
    DATA_QUERY: /^(cuánto|cuánta|cuántos|cuántas|mostrar|ver|consultar|listar|dame|obtener)/i,
    ACTION_REQUEST: /^(crear|agregar|añadir|eliminar|borrar|actualizar|modificar|cambiar)/i,
    NAVIGATION: /^(ir a|navegar a|abrir|mostrar página|llevar a|cómo llego)/i,
    EXPLANATION: /^(qué|cómo|por qué|para qué|cuál|explica|define)/i,
    COMPARISON: /^(comparar|diferencia|mejor|versus|vs|cuál es mejor)/i,
    RECOMMENDATION: /^(recomienda|sugiere|aconseja|qué debería)/i,
  };

  static route(userMessage: string, conversationHistory?: any[]): RoutingDecision {
    const normalizedMessage = userMessage.toLowerCase().trim();
    const keywordResults = this.analyzeKeywords(normalizedMessage);
    const intentAnalysis = this.classifyIntent(normalizedMessage, conversationHistory);
    return this.calculateFinalScores(keywordResults, intentAnalysis, normalizedMessage);
  }

  private static analyzeKeywords(message: string) {
    let chatgptScore = 0;
    let moviScore = 0;
    const matchedKeywords: string[] = [];

    for (const rule of this.KEYWORD_RULES) {
      for (const keyword of rule.keywords) {
        if (message.includes(keyword)) {
          if (rule.mode === 'chatgpt') {
            chatgptScore += rule.weight;
          } else {
            moviScore += rule.weight;
          }
          matchedKeywords.push(`${keyword} (${rule.category})`);
        }
      }
    }

    return { chatgptScore, moviScore, matchedKeywords };
  }

  private static classifyIntent(message: string, conversationHistory?: any[]) {
    let intent = 'GENERAL';
    let moviBoost = 0;
    let chatgptBoost = 0;

    if (this.INTENT_PATTERNS.DATA_QUERY.test(message)) {
      intent = 'DATA_QUERY';
      moviBoost = 25;
    } else if (this.INTENT_PATTERNS.ACTION_REQUEST.test(message)) {
      intent = 'ACTION_REQUEST';
      moviBoost = 30;
    } else if (this.INTENT_PATTERNS.NAVIGATION.test(message)) {
      intent = 'NAVIGATION';
      moviBoost = 35;
    } else if (this.INTENT_PATTERNS.EXPLANATION.test(message)) {
      intent = 'EXPLANATION';
      chatgptBoost = 30;
    } else if (this.INTENT_PATTERNS.COMPARISON.test(message)) {
      intent = 'COMPARISON';
      chatgptBoost = 25;
    } else if (this.INTENT_PATTERNS.RECOMMENDATION.test(message)) {
      intent = 'RECOMMENDATION';
      chatgptBoost = 25;
    }

    if (conversationHistory && conversationHistory.length > 0) {
      const recentMoviUsage = conversationHistory
        .slice(-3)
        .filter((msg: any) => msg.modo_usado === 'movi').length;

      if (recentMoviUsage >= 2) {
        moviBoost += 15;
      }
    }

    return { intent, moviBoost, chatgptBoost };
  }

  private static calculateFinalScores(keywordResults: any, intentAnalysis: any, message: string): RoutingDecision {
    let chatgptScore = keywordResults.chatgptScore + intentAnalysis.chatgptBoost;
    let moviScore = keywordResults.moviScore + intentAnalysis.moviBoost;

    // Si no hay palabras clave de MOVI, dar ventaja a ChatGPT
    if (moviScore === 0 && chatgptScore === 0) {
      chatgptScore = 50; // Base score for general questions
    }

    // Detectar preguntas que claramente son de conocimiento general
    if (message.includes('cómo') && (message.includes('usar') || message.includes('funciona'))) {
      if (keywordResults.matchedKeywords.length > 0) {
        // Si hay keywords, depende del contexto
        if (message.includes('movi') || message.includes('plataforma')) {
          moviScore += 20;
        } else {
          chatgptScore += 15;
        }
      } else {
        chatgptScore += 20;
      }
    }

    // Preguntas con "qué es" o "cuál es" sin contexto de MOVI van a ChatGPT
    if ((message.includes('qué es') || message.includes('cuál es') || message.includes('qué significa')) && moviScore < 20) {
      chatgptScore += 25;
    }

    const total = chatgptScore + moviScore;
    if (total > 0) {
      chatgptScore = (chatgptScore / total) * 100;
      moviScore = (moviScore / total) * 100;
    } else {
      // Si no hay puntaje, default a ChatGPT
      chatgptScore = 70;
      moviScore = 30;
    }

    const confidence = Math.abs(chatgptScore - moviScore);
    const selectedMode = chatgptScore > moviScore ? 'chatgpt' : 'movi';

    const factors: string[] = [];
    if (keywordResults.matchedKeywords.length > 0) {
      factors.push(`Matched ${keywordResults.matchedKeywords.length} keywords`);
    } else {
      factors.push('No specific keywords - default to general knowledge');
    }
    factors.push(`Intent: ${intentAnalysis.intent}`);
    if (confidence < 20) {
      factors.push('Low confidence - close scores');
    }

    return {
      selectedMode,
      chatgptScore: Math.round(chatgptScore),
      moviScore: Math.round(moviScore),
      confidence: Math.round(confidence),
      reasoning: {
        layer1_keywords: keywordResults.matchedKeywords,
        layer2_intent: intentAnalysis.intent,
        layer3_factors: factors
      }
    };
  }

}

interface UserContext {
  id: string;
  nombre: string;
  apellidos: string;
  email: string;
  rol: string;
  oficina_nombre?: string;
}

async function getUserContext(supabase: any, conversacionId: string): Promise<UserContext | null> {
  console.log('Getting conversation:', conversacionId);

  const { data: conv, error: convError } = await supabase
    .from('conversaciones_chatgpt')
    .select('usuario_id')
    .eq('id', conversacionId)
    .maybeSingle();

  if (convError) {
    console.error('❌ Error fetching conversation:', convError.message);
    console.error('Hint: RLS blocked conversaciones_chatgpt or table does not exist');
    return null;
  }

  if (!conv) {
    console.error('❌ Conversation not found:', conversacionId);
    console.error('Hint: conversacion_id does not exist or RLS blocked access');
    return null;
  }

  if (!conv.usuario_id) {
    console.error('❌ Conversation has no usuario_id:', conversacionId);
    return null;
  }

  console.log('Getting user:', conv.usuario_id);

  const { data: user, error: userError } = await supabase
    .from('usuarios')
    .select('id, nombre, apellidos, nombre_completo, email_laboral, email_personal, rol, oficina_id')
    .eq('id', conv.usuario_id)
    .maybeSingle();

  if (userError) {
    console.error('❌ Error fetching user:', userError.message);
    console.error('Hint: RLS blocked usuarios table. Need policy for authenticated users to read.');
    return null;
  }

  if (!user) {
    console.error('❌ User not found:', conv.usuario_id);
    console.error('Hint: usuario_id does not exist in usuarios table');
    return null;
  }

  const userEmail = user.email_laboral || user.email_personal || 'Sin email';
  console.log('✅ User found:', userEmail);

  // Get oficina name separately if needed
  let oficinaNombre = null;
  if (user.oficina_id) {
    try {
      const { data: oficina } = await supabase
        .from('oficinas')
        .select('nombre')
        .eq('id', user.oficina_id)
        .maybeSingle();

      if (oficina) {
        oficinaNombre = oficina.nombre;
      }
    } catch (e) {
      console.error('Error fetching oficina:', e);
      // Continue without oficina name
    }
  }

  return {
    id: user.id,
    nombre: user.nombre,
    apellidos: user.apellidos,
    email: userEmail,
    rol: user.rol,
    oficina_nombre: oficinaNombre
  };
}

async function getCompleteUserContext(supabase: any, userId: string) {
  const context: any = {};

  const mesActual = new Date().toISOString().substring(0, 7);
  const hoy = new Date().toISOString().split('T')[0];
  const en30Dias = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  try {
    const { data: comisiones } = await supabase
      .from('commission_details')
      .select('*')
      .eq('movi_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (comisiones && comisiones.length > 0) {
      const totalNeta = comisiones.reduce((sum: number, c: any) => sum + (c.commission_neta || 0), 0);
      const totalBruta = comisiones.reduce((sum: number, c: any) => sum + (c.commission_bruta || 0), 0);

      const comisionesMes = comisiones.filter((c: any) => c.created_at?.startsWith(mesActual));
      const totalMes = comisionesMes.reduce((sum: number, c: any) => sum + (c.commission_neta || 0), 0);

      context.comisiones = {
        total_neta_ultimas_20: totalNeta,
        total_bruta_ultimas_20: totalBruta,
        total_mes_actual: totalMes,
        cantidad_mes_actual: comisionesMes.length,
        cantidad_total: comisiones.length,
        ultimas_5: comisiones.slice(0, 5).map((c: any) => ({
          id: c.id,
          cliente: c.nombre_asegurado,
          aseguradora: c.aseguradora,
          ramo: c.ramo,
          poliza: c.poliza,
          monto_neto: c.commission_neta,
          monto_bruto: c.commission_bruta,
          fecha: c.created_at
        }))
      };
    }
  } catch (e) {
    console.error('Error fetching comisiones:', e);
  }

  try {
    const { data: produccion } = await supabase
      .from('production_records')
      .select('*')
      .eq('user_id', userId)
      .order('fecha', { ascending: false })
      .limit(20);

    if (produccion && produccion.length > 0) {
      const totalPrima = produccion.reduce((sum: number, p: any) => sum + (p.importe_pesos || 0), 0);
      const produccionMes = produccion.filter((p: any) => p.fecha?.startsWith(mesActual));
      const totalMes = produccionMes.reduce((sum: number, p: any) => sum + (p.importe_pesos || 0), 0);

      const porRamo: Record<string, number> = {};
      produccionMes.forEach((p: any) => {
        const ramo = p.ramo_nombre || 'Sin ramo';
        porRamo[ramo] = (porRamo[ramo] || 0) + (p.importe_pesos || 0);
      });

      context.produccion = {
        total_ultimas_20: totalPrima,
        total_mes_actual: totalMes,
        cantidad_mes_actual: produccionMes.length,
        por_ramo: porRamo,
        ultimas_5: produccion.slice(0, 5).map((p: any) => ({
          agente: p.agente_nombre,
          aseguradora: p.aseguradora_nombre,
          ramo: p.ramo_nombre,
          cliente: p.nombre_cliente,
          importe: p.importe_pesos,
          fecha: p.fecha
        }))
      };
    }
  } catch (e) {
    console.error('Error fetching produccion:', e);
  }

  try {
    const { data: contactos } = await supabase
      .from('crm_contactos')
      .select('*')
      .eq('creado_por', userId)
      .order('fecha_creacion', { ascending: false })
      .limit(15);

    if (contactos && contactos.length > 0) {
      const porEstatus: Record<string, number> = {};
      contactos.forEach((c: any) => {
        porEstatus[c.estatus || 'sin_estatus'] = (porEstatus[c.estatus || 'sin_estatus'] || 0) + 1;
      });

      context.crm_contactos = {
        total: contactos.length,
        por_estatus: porEstatus,
        ultimos_5: contactos.slice(0, 5).map((c: any) => ({
          id: c.id,
          nombre: c.nombre_completo,
          telefono: c.celular,
          email: c.email,
          estatus: c.estatus,
          fecha_creacion: c.fecha_creacion
        }))
      };
    }
  } catch (e) {
    console.error('Error fetching contactos:', e);
  }

  try {
    const { data: cotizacionesCrm } = await supabase
      .from('crm_cotizaciones')
      .select('*, crm_contactos(nombre_completo)')
      .eq('creado_por', userId)
      .order('fecha_cotizacion', { ascending: false })
      .limit(10);

    if (cotizacionesCrm && cotizacionesCrm.length > 0) {
      const totalMonto = cotizacionesCrm.reduce((sum: number, c: any) => sum + (c.monto || 0), 0);

      context.crm_cotizaciones = {
        total: cotizacionesCrm.length,
        monto_total: totalMonto,
        ultimas_5: cotizacionesCrm.slice(0, 5).map((c: any) => ({
          cliente: c.crm_contactos?.nombre_completo,
          aseguradora: c.aseguradora,
          ramo: c.ramo,
          monto: c.monto,
          estatus: c.estatus,
          fecha: c.fecha_cotizacion
        }))
      };
    }
  } catch (e) {
    console.error('Error fetching cotizaciones CRM:', e);
  }

  try {
    const { data: tareas } = await supabase
      .from('crm_tareas')
      .select('*')
      .eq('creado_por', userId)
      .eq('completada', false)
      .order('fecha_vencimiento', { ascending: true })
      .limit(10);

    if (tareas && tareas.length > 0) {
      const tareasHoy = tareas.filter((t: any) => t.fecha_vencimiento === hoy);
      const tareasVencidas = tareas.filter((t: any) => t.fecha_vencimiento < hoy);
      const tareasPorPrioridad: Record<string, number> = {};

      tareas.forEach((t: any) => {
        tareasPorPrioridad[t.prioridad || 'media'] = (tareasPorPrioridad[t.prioridad || 'media'] || 0) + 1;
      });

      context.crm_tareas = {
        total_pendientes: tareas.length,
        hoy: tareasHoy.length,
        vencidas: tareasVencidas.length,
        por_prioridad: tareasPorPrioridad,
        proximas_5: tareas.slice(0, 5).map((t: any) => ({
          id: t.id,
          descripcion: t.descripcion,
          tipo: t.tipo_actividad,
          vencimiento: t.fecha_vencimiento,
          prioridad: t.prioridad,
          estatus: t.estatus
        }))
      };
    }
  } catch (e) {
    console.error('Error fetching tareas:', e);
  }

  try {
    const { data: polizas } = await supabase
      .from('crm_polizas')
      .select('*, crm_contactos(nombre_completo)')
      .eq('creado_por', userId)
      .order('fecha_vencimiento', { ascending: true })
      .limit(15);

    if (polizas && polizas.length > 0) {
      const renovacionesProximas = polizas.filter((p: any) =>
        p.fecha_vencimiento && p.fecha_vencimiento <= en30Dias && p.fecha_vencimiento >= hoy
      );

      context.crm_polizas = {
        total: polizas.length,
        renovaciones_proximas_30_dias: renovacionesProximas.length,
        proximas_renovaciones: renovacionesProximas.slice(0, 5).map((p: any) => ({
          numero: p.numero_poliza,
          cliente: p.crm_contactos?.nombre_completo,
          aseguradora: p.compania_aseguradora,
          ramo: p.tipo_ramo,
          vencimiento: p.fecha_vencimiento,
          prima_total: p.prima_total
        }))
      };
    }
  } catch (e) {
    console.error('Error fetching polizas:', e);
  }

  try {
    const { data: tickets } = await supabase
      .from('tickets')
      .select('*')
      .eq('creado_por', userId)
      .neq('estado', 'cerrado')
      .order('created_at', { ascending: false })
      .limit(10);

    if (tickets && tickets.length > 0) {
      const porTipo: Record<string, number> = {};
      const porEstado: Record<string, number> = {};

      tickets.forEach((t: any) => {
        porTipo[t.tipo || 'general'] = (porTipo[t.tipo || 'general'] || 0) + 1;
        porEstado[t.estado || 'nuevo'] = (porEstado[t.estado || 'nuevo'] || 0) + 1;
      });

      context.tickets_tramites = {
        total_abiertos: tickets.length,
        por_tipo: porTipo,
        por_estado: porEstado,
        ultimos_5: tickets.slice(0, 5).map((t: any) => ({
          id: t.id,
          titulo: t.titulo,
          tipo: t.tipo,
          estado: t.estado,
          prioridad: t.prioridad,
          fecha_creacion: t.created_at
        }))
      };
    }
  } catch (e) {
    console.error('Error fetching tickets:', e);
  }

  try {
    const { data: pedidos } = await supabase
      .from('store_pedidos')
      .select('*')
      .eq('usuario_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (pedidos && pedidos.length > 0) {
      const totalGastado = pedidos.reduce((sum: number, p: any) => sum + (p.total || 0), 0);

      context.store_pedidos = {
        total_pedidos: pedidos.length,
        total_gastado: totalGastado,
        ultimo_pedido: pedidos[0] ? {
          id: pedidos[0].id,
          total: pedidos[0].total,
          estado: pedidos[0].estado,
          fecha: pedidos[0].created_at
        } : null
      };
    }
  } catch (e) {
    console.error('Error fetching pedidos:', e);
  }

  try {
    const { data: cotizaciones } = await supabase
      .from('gmm_quotations')
      .select('*')
      .eq('usuario_id', userId)
      .eq('activa', true)
      .order('created_at', { ascending: false })
      .limit(10);

    if (cotizaciones && cotizaciones.length > 0) {
      context.cotizaciones_gmm = {
        total: cotizaciones.length,
        ultimas_3: cotizaciones.slice(0, 3).map((c: any) => ({
          folio: c.folio,
          aseguradora: c.aseguradora,
          plan: c.plan,
          suma_asegurada: c.suma_asegurada,
          prima_anual: c.prima_anual,
          fecha: c.created_at
        }))
      };
    }
  } catch (e) {
    console.error('Error fetching cotizaciones GMM:', e);
  }

  try {
    const { data: reservas } = await supabase
      .from('reservas_espacio')
      .select('*, espacios_jiro(nombre)')
      .eq('creado_por', userId)
      .gte('fecha_inicio', hoy)
      .order('fecha_inicio', { ascending: true })
      .limit(5);

    if (reservas && reservas.length > 0) {
      context.reservas_espacios = {
        total: reservas.length,
        proximas: reservas.map((r: any) => ({
          espacio: r.espacios_jiro?.nombre,
          fecha: r.fecha_inicio,
          hora_inicio: r.hora_inicio,
          hora_fin: r.hora_fin,
          estado: r.estado
        }))
      };
    }
  } catch (e) {
    console.error('Error fetching reservas:', e);
  }

  try {
    const { data: notificaciones } = await supabase
      .from('notificaciones_internas')
      .select('*')
      .eq('usuario_id', userId)
      .eq('leida', false)
      .order('created_at', { ascending: false })
      .limit(5);

    if (notificaciones && notificaciones.length > 0) {
      context.notificaciones_pendientes = {
        total: notificaciones.length,
        ultimas: notificaciones.map((n: any) => ({
          titulo: n.titulo,
          mensaje: n.mensaje,
          tipo: n.tipo,
          fecha: n.created_at
        }))
      };
    }
  } catch (e) {
    console.error('Error fetching notificaciones:', e);
  }

  try {
    const { data: productos } = await supabase
      .from('store_productos')
      .select('nombre, precio, categoria, descripcion')
      .eq('disponible', true)
      .order('nombre', { ascending: true });

    if (productos && productos.length > 0) {
      context.productos_tienda = {
        total: productos.length,
        productos: productos
      };
    }
  } catch (e) {
    console.error('Error fetching productos:', e);
  }

  return context;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  let requestBody: any;

  try {
    requestBody = await req.json();
    console.log('Request received:', JSON.stringify(requestBody, null, 2));
  } catch (parseError) {
    console.error('Error parsing request body:', parseError);
    return new Response(
      JSON.stringify({ error: 'Invalid JSON in request body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { conversacion_id, mensaje, modulo, ruta, parametros, file_paths } = requestBody;

    if (!conversacion_id || !mensaje) {
      console.error('Missing required fields:', { conversacion_id, mensaje });
      return new Response(
        JSON.stringify({ error: 'conversacion_id y mensaje son requeridos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user JWT to respect RLS
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No Authorization header provided');
      return new Response(
        JSON.stringify({ error: 'No autenticado. Inicia sesión nuevamente.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Creating user client with JWT...');
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'No autenticado. Tu sesión ha expirado.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated:', user.email);

    // Create admin client for internal operations (saving messages, etc.)
    console.log('Creating admin client...');
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Saving user message...');
    const { error: userMessageError } = await supabaseAdmin
      .from('mensajes_chatgpt')
      .insert({
        conversacion_id,
        rol: 'user',
        contenido: mensaje,
      });

    if (userMessageError) {
      console.error('Error saving user message:', userMessageError);
      return new Response(
        JSON.stringify({
          error: 'No se pudo guardar el mensaje del usuario',
          details: userMessageError.message,
          table: 'mensajes_chatgpt',
          hint: 'Verifica RLS policies o que conversacion_id sea válida'
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User message saved successfully');

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    console.log('OpenAI API Key present:', !!openaiApiKey);

    let respuestaTexto = '';
    let respuestaEstructurada = null;
    let routingDecision: RoutingDecision | null = null;

    if (openaiApiKey) {
      console.log('Getting user context with admin client...');
      const userContext = await getUserContext(supabaseAdmin, conversacion_id);

      if (!userContext) {
        console.error('Failed to get user context');
        return new Response(
          JSON.stringify({
            error: 'No se pudo obtener el contexto del usuario',
            details: 'Tu perfil no está accesible. Verifica que tu usuario esté activo.',
            hint: 'Revisa RLS en tabla usuarios o que el usuario_id en conversaciones_chatgpt sea correcto'
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify that the conversation belongs to the authenticated user
      if (userContext.id !== user.id) {
        console.error('User trying to access conversation of another user');
        return new Response(
          JSON.stringify({ error: 'No tienes permiso para acceder a esta conversación.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('User context obtained:', userContext.email);

      console.log('Getting conversation history for routing...');
      const { data: conversationHistory } = await supabaseAdmin
        .from('mensajes_chatgpt')
        .select('rol, contenido, modo_usado, created_at')
        .eq('conversacion_id', conversacion_id)
        .order('created_at', { ascending: false })
        .limit(10);

      console.log('Executing intelligent router...');
      routingDecision = IntelligentRouter.route(mensaje, conversationHistory || []);
      console.log('Routing decision:', {
        mode: routingDecision.selectedMode,
        chatgptScore: routingDecision.chatgptScore,
        moviScore: routingDecision.moviScore,
        confidence: routingDecision.confidence,
        intent: routingDecision.reasoning.layer2_intent
      });

      console.log('Saving routing log...');
      await supabaseAdmin
        .from('assistant_routing_logs')
        .insert({
          conversation_id: conversacion_id,
          user_id: userContext.id,
          user_message: mensaje,
          selected_mode: routingDecision.selectedMode,
          chatgpt_score: routingDecision.chatgptScore,
          movi_score: routingDecision.moviScore,
          confidence_score: routingDecision.confidence,
          router_reasoning: routingDecision.reasoning,
          matched_keywords: routingDecision.reasoning.layer1_keywords
        });

      console.log('Getting complete user context...');
      const completeContext = await getCompleteUserContext(supabaseAdmin, userContext.id);
      console.log('Complete context obtained');

      let attachedFilesContent = '';
      if (file_paths && file_paths.length > 0) {
        console.log('Processing attached files:', file_paths.length);
        const fileContents: string[] = [];

        for (const filePath of file_paths) {
          try {
            const { data: fileData, error: downloadError } = await supabaseAdmin.storage
              .from('assistant-files')
              .download(filePath);

            if (downloadError) {
              console.error('Error downloading file:', filePath, downloadError);
              fileContents.push(`[Error al descargar archivo: ${filePath}]`);
              continue;
            }

            const arrayBuffer = await fileData.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            const fileName = filePath.split('/').pop() || 'archivo';
            const content = await extractFileContent(uint8Array, fileName);
            fileContents.push(`\n--- ARCHIVO: ${fileName} ---\n${content}\n--- FIN DEL ARCHIVO ---\n`);
          } catch (error) {
            console.error('Error processing file:', filePath, error);
            fileContents.push(`[Error al procesar archivo: ${filePath}]`);
          }
        }

        if (fileContents.length > 0) {
          attachedFilesContent = '\n\n📎 DOCUMENTOS ADJUNTOS POR EL USUARIO:\n' + fileContents.join('\n');
        }
      }

      const modeLabel = routingDecision?.selectedMode === 'chatgpt' ? 'Modo ChatGPT (Conocimiento General)' : 'Modo MOVI (Datos del Sistema)';

      const systemPrompt = `Eres Mi Asistente de MOVI Digital, un asistente virtual inteligente para agentes de seguros.

MODO ACTIVO: ${modeLabel}
${routingDecision?.selectedMode === 'chatgpt' ?
  `- Estás en modo ChatGPT: proporciona conocimiento general sobre el sector asegurador
- Puedes responder sobre: teléfonos de atención, información de aseguradoras, coberturas, procedimientos, conceptos de seguros
- Proporciona información precisa y útil basada en tu conocimiento general
- Si conoces información de contacto específica (teléfonos de siniestros, atención a clientes, etc.), compártela` :
  '- Estás en modo MOVI: enfócate en los datos específicos del usuario en el sistema (comisiones, producción, CRM, etc.)'
}

PERSONALIDAD:
- Profesional pero cercano y amigable
- Claro, conciso y orientado a la acción
- Hablas en español mexicano usando "tú"
- Proactivo: ofrece información relevante incluso si no la piden directamente

CAPACIDADES:
Tienes acceso COMPLETO a todos los datos del usuario incluyendo:
- Comisiones (últimas 20, totales, por mes)
- Producción (últimas 20, totales por mes, desglose por ramo)
- CRM (contactos, tareas, pólizas, cotizaciones)
- Trámites/Tickets abiertos
- Pedidos de la tienda
- Cotizaciones GMM
- Reservas de espacios
- Notificaciones pendientes
- Productos disponibles en tienda

REGLAS ESTRICTAS:
1. ANALIZA toda la información disponible en el CONTEXTO COMPLETO DE DATOS
2. Responde con DATOS REALES y específicos (números, nombres, fechas exactas)
3. Si tienes datos, responde directamente - NO digas "no tengo acceso" si los datos están en el contexto
4. Si NO tienes los datos exactos que busca el usuario, guíalo a la sección correcta
5. Sé PROACTIVO: si ves algo relevante en los datos (como tareas vencidas, renovaciones próximas, etc.), menciónalo
6. Responde SOLO con JSON válido, sin texto adicional, sin markdown, sin bloques de código
7. NO uses \`\`\`json, responde únicamente el JSON puro
8. Incluye acciones concretas y relevantes
9. USA ÚNICAMENTE las rutas de la lista RUTAS DISPONIBLES (abajo)
10. NUNCA INVENTES INFORMACIÓN - Solo usa los datos del contexto proporcionado
11. NO CONFUNDAS tareas del CRM con pólizas reales:
    - crm_tareas = tareas/pendientes del usuario (NO son pólizas)
    - crm_polizas = pólizas reales registradas en el sistema
12. Si el usuario pregunta por pólizas, SOLO menciona las que están en crm_polizas.proximas_renovaciones
13. Si solo hay tareas relacionadas a pólizas pero NO pólizas reales, di: "Tienes tareas pendientes relacionadas con pólizas"
14. DOCUMENTOS ADJUNTOS: Si el usuario adjunta archivos (PDFs, imágenes, etc.), encontrarás su contenido en la sección DOCUMENTOS ADJUNTOS del prompt
15. Si el usuario pregunta sobre archivos adjuntos, analiza el contenido proporcionado y responde en base a él
16. Para PDFs y documentos complejos, analiza la información disponible y proporciona insights útiles

RUTAS DISPONIBLES EN LA PLATAFORMA:
- /dashboard - Panel principal
- /perfil - Perfil del usuario
- /mi-crm/contactos - Lista de contactos
- /mi-crm/tareas - Tareas y seguimientos
- /mi-crm/reportes - Reportes de CRM
- /mi-produccion - Mi producción personal
- /mis-comisiones - Mis comisiones
- /produccion/por-vendedor - Producción del equipo (gerentes/admin)
- /tramites - Trámites
- /comunicados - Comunicados
- /store - Tienda
- /espacio-jiro - Reservas de espacios
- /vacaciones - Solicitudes de vacaciones
- /seguros-education - Academia digital
- /gmm/cotizador - Cotizador GMM
- /directorio - Directorio de usuarios

FORMATO DE RESPUESTA:
Siempre responde con JSON con esta estructura:
{
  "type": "text",
  "text": "Tu respuesta conversacional aquí",
  "actions": [
    {"type": "navigate", "label": "Ver [Sección]", "destination": "/ruta", "icon": "IconName"}
  ]
}

NOTA SOBRE ACTIONS:
- En modo MOVI: SIEMPRE incluye acciones relevantes para navegar
- En modo ChatGPT: incluye acciones SOLO si son relevantes (puede ser un array vacío [])

ICONOS DISPONIBLES (Lucide React):
Home, Users, DollarSign, TrendingUp, CheckSquare, FileText, Briefcase, Calendar, GraduationCap, Calculator, BookOpen, Bell, Settings`;

      const { data: fullUserProfile } = await supabaseAdmin
        .from('usuarios')
        .select('*')
        .eq('id', userContext.id)
        .single();

      let userPrompt = '';

      if (routingDecision?.selectedMode === 'chatgpt') {
        // Modo ChatGPT - Preguntas generales
        userPrompt = `INFORMACIÓN DEL USUARIO:
- Nombre: ${userContext.nombre} ${userContext.apellidos}
- Rol: ${userContext.rol}

PREGUNTA DEL USUARIO: ${mensaje}${attachedFilesContent}

INSTRUCCIONES:
1. Responde la pregunta usando tu conocimiento general sobre seguros
2. Si es una pregunta sobre contactos, teléfonos o información de aseguradoras, proporciona datos específicos si los conoces
3. Sé claro, preciso y útil
4. Formato: JSON puro sin markdown
5. Incluye actions SOLO si son relevantes

EJEMPLO:
{
  "type": "text",
  "text": "El teléfono de siniestros de Qualitas es 800 800 4000, disponible 24/7. También puedes reportar siniestros a través de su app móvil o en su sitio web.",
  "actions": []
}`;
      } else {
        // Modo MOVI - Datos del sistema
        userPrompt = `INFORMACIÓN PERSONAL DEL USUARIO:
- Nombre completo: ${userContext.nombre} ${userContext.apellidos}
- Email: ${userContext.email}
- Rol: ${userContext.rol}
- Oficina: ${userContext.oficina_nombre || 'No asignada'}
- Teléfono: ${fullUserProfile?.celular_personal || fullUserProfile?.celular_laboral || 'No registrado'}
- Puesto: ${fullUserProfile?.puesto || 'No especificado'}
- Régimen Fiscal: ${fullUserProfile?.regimen_fiscal || 'No especificado'}
- Banco: ${fullUserProfile?.banco || 'No registrado'}

CONTEXTO COMPLETO DE DATOS DEL USUARIO:
${JSON.stringify(completeContext, null, 2)}

INFORMACIÓN DE NAVEGACIÓN:
- Módulo actual: ${modulo}
- Ruta actual: ${ruta}

PREGUNTA DEL USUARIO: ${mensaje}${attachedFilesContent}

INSTRUCCIONES FINALES:
1. REVISA cuidadosamente el CONTEXTO COMPLETO arriba - ahí están TODOS los datos reales
2. Si el usuario pregunta por comisiones, producción, tareas, etc., busca esa información en el contexto
3. RESPONDE con datos específicos: montos exactos, nombres de clientes, fechas, números
4. Si ves información relevante adicional (ej: tareas vencidas, renovaciones próximas), menciónala
5. Formato de respuesta: JSON puro sin markdown
6. SIEMPRE incluye acciones útiles para que el usuario navegue

EJEMPLO DE RESPUESTA ESPERADA:
{
  "type": "text",
  "text": "Este mes has generado $45,230 en comisiones netas, con 12 registros. Tu última comisión fue de GNP por $3,450 del cliente Juan Pérez. También tienes 3 tareas vencidas que requieren atención.",
  "actions": [
    {"type": "navigate", "label": "Ver mis comisiones", "destination": "/mis-comisiones", "icon": "DollarSign"},
    {"type": "navigate", "label": "Ver tareas pendientes", "destination": "/mi-crm/tareas", "icon": "CheckSquare"}
  ]
}`;
      }

      console.log('Calling OpenAI API...');
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 1500,
        }),
      });

      console.log('OpenAI response status:', openaiResponse.status);

      if (openaiResponse.ok) {
        const data = await openaiResponse.json();
        const rawContent = data.choices?.[0]?.message?.content;

        if (!rawContent) {
          console.error('OpenAI returned no content');
          throw new Error('OpenAI no devolvió contenido en la respuesta');
        }

        console.log('OpenAI response received');
        respuestaTexto = rawContent;

        try {
          let jsonText = respuestaTexto.trim();

          const markdownMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (markdownMatch) {
            jsonText = markdownMatch[1].trim();
          }

          const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonText = jsonMatch[0];
          }

          respuestaEstructurada = JSON.parse(jsonText);

          if (respuestaEstructurada && respuestaEstructurada.type) {
            respuestaTexto = getTextFromStructuredResponse(respuestaEstructurada);
          }
        } catch (e) {
          console.error('Error parsing JSON:', e);
          console.log('Raw response:', respuestaTexto);
          respuestaEstructurada = {
            type: 'text',
            text: respuestaTexto,
            actions: []
          };
        }
      } else {
        const errorData = await openaiResponse.json().catch(() => ({}));
        console.error('OpenAI API error:', errorData);
        throw new Error(`Error de OpenAI: ${openaiResponse.status} - ${JSON.stringify(errorData)}`);
      }
    } else {
      respuestaTexto = 'Por favor configura la API de OpenAI para usar el asistente.';
      respuestaEstructurada = {
        type: 'text',
        text: respuestaTexto,
        actions: []
      };
    }

    console.log('Saving assistant message...');
    const { data: mensajeData, error: mensajeError } = await supabaseAdmin
      .from('mensajes_chatgpt')
      .insert({
        conversacion_id,
        rol: 'assistant',
        contenido: respuestaTexto,
        modo_usado: routingDecision?.selectedMode || 'chatgpt',
        router_confidence: routingDecision?.confidence || 0
      })
      .select()
      .single();

    if (mensajeError) {
      console.error('Error saving assistant message:', mensajeError);
      return new Response(
        JSON.stringify({
          error: 'No se pudo guardar la respuesta del asistente',
          details: mensajeError.message,
          table: 'mensajes_chatgpt',
          hint: 'Verifica RLS policies para INSERT en mensajes_chatgpt'
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Assistant message saved, updating conversation...');
    await supabaseAdmin
      .from('conversaciones_chatgpt')
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversacion_id);

    console.log('Sending successful response');
    return new Response(
      JSON.stringify({
        conversacion_id,
        mensaje_id: mensajeData.id,
        respuesta: respuestaTexto,
        respuesta_estructurada: respuestaEstructurada,
        modo_usado: routingDecision?.selectedMode || 'chatgpt',
        router_confidence: routingDecision?.confidence || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in assistant-send-message:', error);
    console.error('Error stack:', error.stack);
    return new Response(
      JSON.stringify({
        error: error.message || 'Unknown error',
        details: error.stack || 'No stack trace available'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getTextFromStructuredResponse(response: any): string {
  if (response.type === 'text' && response.text) {
    return response.text;
  }
  return 'Respuesta generada.';
}