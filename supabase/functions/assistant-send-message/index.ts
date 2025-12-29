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
      return `📄 Contenido del PDF (${pdf.numPages} página${pdf.numPages !== 1 ? 's' : ''}

):\n${fullText.trim()}`;
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
    { keywords: ['mis mensajes', 'mis conversaciones', 'mi chat', 'mis chats', 'conversaciones del chat'], mode: 'movi', weight: 45, category: 'chat' },
    { keywords: ['comunicado', 'comunicados', 'notificación interna'], mode: 'movi', weight: 35, category: 'comunicados' },
    { keywords: ['directorio', 'compañeros', 'mi oficina', 'mi equipo'], mode: 'movi', weight: 35, category: 'directorio' },
    { keywords: ['mi trámite', 'mis trámites', 'mi ticket', 'mis tickets'], mode: 'movi', weight: 35, category: 'tramites' },
    { keywords: ['mi reunión', 'mis reuniones', 'mi agenda'], mode: 'movi', weight: 30, category: 'calendario' },

    // MOVI Mode - Institutional (NEVER web search)
    { keywords: ['jiro', 'jiro y asociados', 'agente total', 'promotoría', 'promotoria', 'respaldo institucional'], mode: 'movi', weight: 50, category: 'institucional' },
    { keywords: ['quiénes somos', 'quienes somos', 'qué empresa', 'que empresa', 'relación entre'], mode: 'movi', weight: 45, category: 'institucional' },

    // MOVI Mode - Directory (internal data)
    { keywords: ['teléfono de', 'telefono de', 'tel de', 'extensión de', 'extension de'], mode: 'movi', weight: 48, category: 'directorio' },
    { keywords: ['correo de', 'mail de', 'email de', 'contacto de', 'celular de'], mode: 'movi', weight: 48, category: 'directorio' },
    { keywords: ['oficina', 'sucursal', 'domicilio de oficina', 'dirección de oficina'], mode: 'movi', weight: 46, category: 'directorio' },
    { keywords: ['gerente de', 'quien es el gerente', 'gerente de la oficina'], mode: 'movi', weight: 46, category: 'directorio' },
    { keywords: ['directorio', 'empleados', 'compañeros de trabajo'], mode: 'movi', weight: 44, category: 'directorio' },

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

    if (moviScore === 0 && chatgptScore === 0) {
      chatgptScore = 50;
    }

    if (message.includes('cómo') && (message.includes('usar') || message.includes('funciona'))) {
      if (keywordResults.matchedKeywords.length > 0) {
        if (message.includes('movi') || message.includes('plataforma')) {
          moviScore += 20;
        } else {
          chatgptScore += 15;
        }
      } else {
        chatgptScore += 20;
      }
    }

    if ((message.includes('qué es') || message.includes('cuál es') || message.includes('qué significa')) && moviScore < 20) {
      chatgptScore += 25;
    }

    const total = chatgptScore + moviScore;
    if (total > 0) {
      chatgptScore = (chatgptScore / total) * 100;
      moviScore = (moviScore / total) * 100;
    } else {
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
  console.log('📊 Fetching complete user context for:', userId);

  try {
    const { data: fullContext, error } = await supabase.rpc('get_user_full_context', {
      p_usuario_id: userId
    });

    if (error) {
      console.error('❌ Error fetching full context via RPC:', error);
      return await getCompleteUserContextFallback(supabase, userId);
    }

    if (!fullContext) {
      console.warn('⚠️ No context returned from RPC');
      return {};
    }

    console.log('✅ Full context fetched successfully');
    console.log('📊 Context includes:', Object.keys(fullContext));

    return fullContext;
  } catch (e) {
    console.error('❌ Exception fetching full context:', e);
    return await getCompleteUserContextFallback(supabase, userId);
  }
}

async function getCompleteUserContextFallback(supabase: any, userId: string) {
  console.log('🔄 Using fallback context fetch...');
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

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'No autenticado. Tu sesión ha expirado.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated:', user.email);

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
- Chat interno (conversaciones activas y últimos mensajes de cada chat)
- Comisiones (últimas 20, totales, por mes)
- Producción (últimas 20, totales por mes, desglose por ramo)
- CRM (contactos, tareas, pólizas, cotizaciones)
- Trámites/Tickets abiertos
- Pedidos de la tienda
- Cotizaciones GMM
- Reservas de espacios
- Notificaciones pendientes
- Productos disponibles en tienda
- Directorio interno completo (empleados, gerentes, agentes)
- Catálogo de oficinas y sus datos de contacto

CONOCIMIENTO INSTITUCIONAL VALIDADO:

JIRO y Asociados:
- Empresa mexicana intermediaria de seguros
- Más de 50 años de experiencia en el sector asegurador
- Opera en todos los ramos de seguros
- Brinda respaldo institucional, relación con aseguradoras y soporte operativo
- Sitio oficial: https://www.jiro.mx

Agente Total:
- Plataforma y promotoría de seguros para agentes y promotorías
- Modelo híbrido: promotoría + tecnología + mercadotecnia
- Ofrece alta directa en aseguradoras, soporte de back office, comisiones, capacitación, publicidad y herramientas digitales
- Tres modelos: Agente Individual, Promotoría Asociada y Promotor Agente Total
- Usa MOVI Digital como plataforma tecnológica
- Sitio oficial: https://www.promotoriadeseguros.com.mx

Relación entre marcas:
- JIRO y Asociados es el respaldo institucional
- Agente Total es el modelo de negocio para agentes
- MOVI Digital es la plataforma tecnológica que centraliza la operación

REGLAS INSTITUCIONALES:
- NO inventes información sobre JIRO, Agente Total o MOVI
- Si una pregunta institucional no está cubierta aquí, di: "No tengo esa información específica. Te sugiero consultar [sitio oficial] o contactar a un ejecutivo"
- NUNCA contradigas la información oficial de estos sitios
- Mantén tono institucional, claro y confiable cuando hables de las marcas

REGLAS DE DIRECTORIO Y OFICINAS:
- BÚSQUEDA INTELIGENTE: Si el usuario busca "Ale", busca nombres que empiecen con "Ale" o "Alejandra/Alejandro"
- Si el usuario busca "Abarca", busca apellidos que CONTENGAN "Abarca" (puede ser "Abarca García", "Abarca López", etc.)
- Si el usuario busca "Ale Abarca", busca personas donde el nombre contenga "Ale" Y el apellido contenga "Abarca"
- Usa búsqueda PARCIAL y FLEXIBLE - no requieras coincidencia exacta
- REVISA TODO el array directorio_empleados en el contexto - ahí están TODAS las personas activas
- Si encuentras múltiples coincidencias (ej: 2 personas con nombre "Juan"), muéstralas TODAS en tabla y pide al usuario que especifique
- Si NO encuentras a la persona después de buscar con variantes, di: "No encontré a [nombre] en el directorio. Verifica que esté escrito correctamente"
- NUNCA inventes teléfonos, correos, extensiones, domicilios o nombres de gerentes
- Si un dato no está registrado (ej: extensión vacía o null), di claramente: "No tiene extensión registrada"
- Para búsquedas de oficinas, incluye: nombre, teléfono, domicilio, email, redes sociales, gerente
- Para búsquedas de personas, incluye: nombre completo, puesto, oficina, teléfono laboral, extensión, email laboral
- Incluye botones para copiar teléfonos y emails fácilmente

EJEMPLO DE BÚSQUEDA:
Usuario busca: "Ale Abarca"
1. Busca en directorio_empleados donde:
   - nombre contenga "Ale" (case-insensitive)
   - Y apellidos contenga "Abarca" (case-insensitive)
2. Si encuentras "Alejandra Abarca García", esa es la persona correcta
3. Muestra: nombre completo, rol, puesto, oficina, teléfono, extensión, email

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
14. CHAT INTERNO: En chat_conversaciones encontrarás las conversaciones activas del usuario con sus últimos 5 mensajes de cada chat
    - Puedes decirle cuándo fue el último mensaje con alguien
    - Puedes mostrarle el contenido de los últimos mensajes
    - Si el usuario pregunta por mensajes con alguien específico, busca en los chats por el nombre de la persona
15. DOCUMENTOS ADJUNTOS: Si el usuario adjunta archivos (PDFs, imágenes, etc.), encontrarás su contenido en la sección DOCUMENTOS ADJUNTOS del prompt
16. Si el usuario pregunta sobre archivos adjuntos, analiza el contenido proporcionado y responde en base a él
17. Para PDFs y documentos complejos, analiza la información disponible y proporciona insights útiles

RUTAS DISPONIBLES EN LA PLATAFORMA:
- /dashboard - Panel principal
- /perfil - Perfil del usuario
- /chat - Chat interno con compañeros
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
Home, Users, DollarSign, TrendingUp, CheckSquare, FileText, Briefcase, Calendar, GraduationCap, Calculator, BookOpen, Bell, Settings, MessageSquare, Send`;

      const { data: fullUserProfile } = await supabaseAdmin
        .from('usuarios')
        .select('*')
        .eq('id', userContext.id)
        .single();

      let userPrompt = '';

      if (routingDecision?.selectedMode === 'chatgpt') {
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

EJEMPLOS DE RESPUESTA ESPERADA:

Para comisiones:
{
  "type": "text",
  "text": "Este mes has generado $45,230 en comisiones netas, con 12 registros. Tu última comisión fue de GNP por $3,450 del cliente Juan Pérez. También tienes 3 tareas vencidas que requieren atención.",
  "actions": [
    {"type": "navigate", "label": "Ver mis comisiones", "destination": "/mis-comisiones", "icon": "DollarSign"},
    {"type": "navigate", "label": "Ver tareas pendientes", "destination": "/mi-crm/tareas", "icon": "CheckSquare"}
  ]
}

Para chat:
{
  "type": "text",
  "text": "Lo último que hablaste con Pablo fue el 5 de noviembre a las 22:47 hrs. Enviaste el archivo 'Logo-City-Suites2.png'. Pablo aún no ha respondido a ese mensaje.",
  "actions": [
    {"type": "navigate", "label": "Ir al chat", "destination": "/chat", "icon": "MessageSquare"}
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