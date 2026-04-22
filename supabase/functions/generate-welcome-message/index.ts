import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface SmartAnalysisRequest {
  sicasData: SicasContext | null;
  userContext: UserContext;
  periodo: string;
  forceRegenerate?: boolean;
}

interface UserContext {
  nombre: string;
  rol: string;
  oficina?: string;
  tareas_pendientes?: number;
  tareas_vencidas?: number;
  cotizaciones_activas?: number;
  comunicados_sin_leer?: number;
  tramites_pendientes_atencion?: number;
  nivel_actual?: number;
  dias_racha?: number;
  posicion_ranking?: number;
}

interface SicasContext {
  usuario: {
    nombre: string;
    rol: string;
    oficina: string;
    id_sicas: string;
  };
  kpis: {
    polizas_vigentes: number;
    fianzas_vigentes: number;
    prima_vigente: number;
    polizas_emitidas: number;
    fianzas_emitidas: number;
    prima_neta_emitida: number;
    prima_total_emitida: number;
    mes_prima_neta: number;
    mes_prima_total: number;
    mes_emisiones: number;
    clientes_total: number;
    clientes_mes: number;
    renovaciones_7dias: number;
    renovaciones_15dias: number;
    renovaciones_30dias: number;
    prima_renovar: number;
    cancelaciones: number;
    ticket_promedio: number;
    variacion_mes_anterior: number;
    variacion_interanual: number;
  };
  top_clientes: Array<{ name: string; count: number; prima: number }>;
  top_aseguradoras: Array<{ name: string; count: number; prima: number }>;
  top_ramos: Array<{ name: string; count: number; prima: number }>;
  top_subramos: Array<{ name: string; count: number; prima: number }>;
  observaciones: {
    periodo_analizado: string;
    total_documentos: number;
    tiene_fianzas: boolean;
    tiene_renovaciones_urgentes: boolean;
  };
}

interface AnalysisResponse {
  title: string;
  summary: string;
  insights: Array<{ icon: string; label: string; value: string; detail?: string }>;
  alerts: Array<{ level: 'info' | 'warning' | 'critical'; message: string }>;
  opportunities: Array<{ description: string; impact: string }>;
  recommendations: Array<{ action: string; reason: string }>;
  tone: 'positive' | 'neutral' | 'attention';
  priority: 'low' | 'medium' | 'high';
}

function buildChatGPTPrompt(sicasData: SicasContext, periodo: string): string {
  return `Eres un consultor experto en produccion, cartera, renovaciones, ventas y desarrollo comercial para agentes y promotorias de seguros en Mexico. Recibes datos reales del sistema SICAS y debes generar un analisis inteligente, accionable y personalizado.

REGLAS:
1. Responde EXCLUSIVAMENTE en formato JSON valido (sin markdown, sin backticks, sin texto fuera del JSON)
2. Usa solo los datos proporcionados, NUNCA inventes numeros o porcentajes
3. Prioriza: alertas urgentes > oportunidades comerciales > tendencias > motivacion
4. Maximo 4 insights, 3 alertas, 3 oportunidades, 3 recomendaciones
5. Sigue la estructura JSON exacta especificada abajo
6. Todos los textos en espanol
7. Se breve y directo, cada texto max 80 caracteres
8. Para iconos usa nombres de Lucide React (TrendingUp, AlertTriangle, Target, Shield, Clock, DollarSign, Users, FileText, RefreshCw, Award, BarChart3, Zap)

ESTRUCTURA JSON REQUERIDA:
{
  "title": "string corto (max 60 chars)",
  "summary": "string resumen ejecutivo (max 200 chars)",
  "insights": [{"icon": "LucideIconName", "label": "etiqueta", "value": "valor formateado", "detail": "contexto opcional"}],
  "alerts": [{"level": "info|warning|critical", "message": "texto de alerta"}],
  "opportunities": [{"description": "oportunidad", "impact": "impacto esperado"}],
  "recommendations": [{"action": "accion concreta", "reason": "razon"}],
  "tone": "positive|neutral|attention",
  "priority": "low|medium|high"
}

LOGICA DE PRIORIDADES:
- Si hay renovaciones en 7 dias: priority=high, tone=attention
- Si variacion mes anterior < -10%: priority=high, tone=attention
- Si cancelaciones > 5% del total: incluir alerta
- Si prima mes actual > mes anterior: tone=positive
- Si no hay renovaciones urgentes y produccion estable: priority=low, tone=positive

DATOS DEL PERIODO ${periodo}:
${JSON.stringify(sicasData, null, 2)}`;
}

function generateFallbackAnalysis(sicasData: SicasContext | null, userContext: UserContext, periodo: string): AnalysisResponse {
  if (!sicasData) {
    return {
      title: `Bienvenido, ${userContext.nombre.split(' ')[0]}`,
      summary: 'Tu cuenta aun no esta vinculada a SICAS. Contacta a tu administrador para activar el analisis de produccion.',
      insights: [],
      alerts: [{
        level: 'info',
        message: 'Sin vinculacion a SICAS. Solicita el mapeo de tu cuenta para ver tu produccion.'
      }],
      opportunities: [],
      recommendations: [{
        action: 'Solicitar vinculacion SICAS',
        reason: 'Para ver analisis de tu cartera y produccion en tiempo real'
      }],
      tone: 'neutral',
      priority: 'low'
    };
  }

  const k = sicasData.kpis;
  const nombre = userContext.nombre.split(' ')[0];

  const insights: AnalysisResponse['insights'] = [];
  const alerts: AnalysisResponse['alerts'] = [];
  const opportunities: AnalysisResponse['opportunities'] = [];
  const recommendations: AnalysisResponse['recommendations'] = [];

  let tone: AnalysisResponse['tone'] = 'neutral';
  let priority: AnalysisResponse['priority'] = 'low';

  if (k.polizas_vigentes > 0) {
    insights.push({ icon: 'Shield', label: 'Polizas vigentes', value: String(k.polizas_vigentes), detail: `Prima vigente: $${formatNumber(k.prima_vigente)}` });
  }
  if (k.mes_emisiones > 0) {
    insights.push({ icon: 'TrendingUp', label: 'Emisiones del mes', value: String(k.mes_emisiones), detail: `Prima: $${formatNumber(k.mes_prima_total)}` });
  }
  if (k.renovaciones_30dias > 0) {
    insights.push({ icon: 'RefreshCw', label: 'Renovaciones 30 dias', value: String(k.renovaciones_30dias), detail: `Prima: $${formatNumber(k.prima_renovar)}` });
  }
  if (k.clientes_total > 0) {
    insights.push({ icon: 'Users', label: 'Clientes en cartera', value: String(k.clientes_total) });
  }

  if (k.renovaciones_7dias > 0) {
    alerts.push({ level: 'critical', message: `${k.renovaciones_7dias} poliza${k.renovaciones_7dias > 1 ? 's' : ''} por renovar en 7 dias ($${formatNumber(k.prima_renovar)})` });
    priority = 'high';
    tone = 'attention';
  } else if (k.renovaciones_15dias > 0) {
    alerts.push({ level: 'warning', message: `${k.renovaciones_15dias} poliza${k.renovaciones_15dias > 1 ? 's' : ''} por renovar en 15 dias` });
    priority = 'medium';
  }

  if (k.cancelaciones > 0 && k.polizas_emitidas > 0) {
    const cancRate = (k.cancelaciones / k.polizas_emitidas) * 100;
    if (cancRate > 5) {
      alerts.push({ level: 'warning', message: `Tasa de cancelacion: ${cancRate.toFixed(1)}% (${k.cancelaciones} polizas)` });
    }
  }

  if (k.variacion_mes_anterior < -10) {
    alerts.push({ level: 'warning', message: `Produccion ${k.variacion_mes_anterior.toFixed(1)}% vs mes anterior` });
    priority = 'high';
    tone = 'attention';
  } else if (k.variacion_mes_anterior > 10) {
    tone = 'positive';
  }

  if (sicasData.top_clientes.length > 0) {
    const top = sicasData.top_clientes[0];
    opportunities.push({ description: `Fortalecer relacion con ${top.name}`, impact: `${top.count} polizas, $${formatNumber(top.prima)} en prima` });
  }

  if (k.renovaciones_30dias > 0) {
    recommendations.push({ action: 'Gestionar renovaciones proximas', reason: `${k.renovaciones_30dias} polizas por vencer representan $${formatNumber(k.prima_renovar)}` });
  }
  if (k.mes_emisiones === 0 && k.polizas_emitidas > 0) {
    recommendations.push({ action: 'Impulsar nuevas emisiones este mes', reason: 'No hay emisiones nuevas registradas en el periodo actual' });
  }

  let title = `Analisis de produccion - ${periodo}`;
  let summary = '';

  if (k.mes_prima_total > 0) {
    summary = `${nombre}, este mes llevas $${formatNumber(k.mes_prima_total)} en prima emitida con ${k.mes_emisiones} emisiones.`;
    if (k.renovaciones_7dias > 0) {
      summary += ` Atencion: ${k.renovaciones_7dias} renovaciones urgentes.`;
    }
  } else if (k.polizas_vigentes > 0) {
    summary = `${nombre}, tienes ${k.polizas_vigentes} polizas vigentes con $${formatNumber(k.prima_vigente)} en prima.`;
  } else {
    summary = `${nombre}, aun no hay movimientos registrados para este periodo.`;
  }

  return { title, summary, insights: insights.slice(0, 4), alerts: alerts.slice(0, 3), opportunities: opportunities.slice(0, 3), recommendations: recommendations.slice(0, 3), tone, priority };
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toFixed(0);
}

function validateAnalysis(data: any): AnalysisResponse {
  return {
    title: typeof data.title === 'string' ? data.title.slice(0, 100) : 'Analisis de produccion',
    summary: typeof data.summary === 'string' ? data.summary.slice(0, 300) : '',
    insights: Array.isArray(data.insights)
      ? data.insights.slice(0, 4).map((i: any) => ({
          icon: typeof i.icon === 'string' ? i.icon : 'BarChart3',
          label: typeof i.label === 'string' ? i.label : '',
          value: typeof i.value === 'string' ? i.value : String(i.value ?? ''),
          detail: typeof i.detail === 'string' ? i.detail : undefined,
        }))
      : [],
    alerts: Array.isArray(data.alerts)
      ? data.alerts.slice(0, 3).map((a: any) => ({
          level: ['info', 'warning', 'critical'].includes(a.level) ? a.level : 'info',
          message: typeof a.message === 'string' ? a.message : '',
        }))
      : [],
    opportunities: Array.isArray(data.opportunities)
      ? data.opportunities.slice(0, 3).map((o: any) => ({
          description: typeof o.description === 'string' ? o.description : '',
          impact: typeof o.impact === 'string' ? o.impact : '',
        }))
      : [],
    recommendations: Array.isArray(data.recommendations)
      ? data.recommendations.slice(0, 3).map((r: any) => ({
          action: typeof r.action === 'string' ? r.action : '',
          reason: typeof r.reason === 'string' ? r.reason : '',
        }))
      : [],
    tone: ['positive', 'neutral', 'attention'].includes(data.tone) ? data.tone : 'neutral',
    priority: ['low', 'medium', 'high'].includes(data.priority) ? data.priority : 'low',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    const body = await req.json() as SmartAnalysisRequest;
    const { sicasData, userContext, periodo, forceRegenerate } = body;

    // If no SICAS data or no OpenAI key, use fallback
    if (!sicasData || !openaiApiKey) {
      const analysis = generateFallbackAnalysis(sicasData, userContext, periodo);
      return new Response(
        JSON.stringify({ success: true, analysis, source: sicasData ? 'fallback' : 'no_sicas' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call ChatGPT for structured analysis
    const prompt = buildChatGPTPrompt(sicasData, periodo);

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: `Genera el analisis JSON para el periodo ${periodo}. Solo responde con el JSON, nada mas.` },
        ],
        temperature: 0.4,
        max_tokens: 800,
        response_format: { type: 'json_object' },
      }),
    });

    if (!openaiResponse.ok) {
      console.error('OpenAI error:', openaiResponse.status, await openaiResponse.text());
      const analysis = generateFallbackAnalysis(sicasData, userContext, periodo);
      return new Response(
        JSON.stringify({ success: true, analysis, source: 'fallback' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openaiData = await openaiResponse.json();
    const rawContent = openaiData.choices?.[0]?.message?.content;

    if (!rawContent) {
      const analysis = generateFallbackAnalysis(sicasData, userContext, periodo);
      return new Response(
        JSON.stringify({ success: true, analysis, source: 'fallback' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      console.error('Failed to parse ChatGPT JSON:', rawContent.substring(0, 200));
      const analysis = generateFallbackAnalysis(sicasData, userContext, periodo);
      return new Response(
        JSON.stringify({ success: true, analysis, source: 'fallback' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const analysis = validateAnalysis(parsed);

    return new Response(
      JSON.stringify({ success: true, analysis, source: 'chatgpt' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
