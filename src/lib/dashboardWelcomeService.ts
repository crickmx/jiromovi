import { supabase } from './supabase';

export interface SmartAnalysis {
  message: string;
  tone: 'positive' | 'neutral' | 'attention';
}

export interface SmartAnalysisResult {
  analysis: SmartAnalysis;
  source: 'chatgpt' | 'fallback' | 'cache';
  periodo: string;
  modules?: string[];
  cachedAt?: string;
}

const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours

export async function getSmartAnalysis(
  userId: string,
  forceRegenerate: boolean = false
): Promise<SmartAnalysisResult> {
  const now = new Date();
  const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  if (!forceRegenerate) {
    const cached = await getCachedAnalysis(userId, periodo);
    if (cached) return cached;
  }

  return await callEdgeFunction(periodo, forceRegenerate);
}

async function getCachedAnalysis(userId: string, periodo: string): Promise<SmartAnalysisResult | null> {
  try {
    const { data } = await supabase
      .from('dashboard_smart_analysis')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!data) return null;
    if (data.periodo !== periodo) return null;

    if (data.expires_at) {
      if (Date.now() > new Date(data.expires_at).getTime()) return null;
    } else {
      const cacheAge = Date.now() - new Date(data.updated_at).getTime();
      if (cacheAge > CACHE_MAX_AGE_MS) return null;
    }

    const cached = data.analysis_json as any;
    if (!cached?.message) return null;

    return {
      analysis: { message: cached.message, tone: cached.tone || 'neutral' },
      source: 'cache',
      periodo: data.periodo,
      modules: data.modules_included || [],
      cachedAt: data.updated_at,
    };
  } catch {
    return null;
  }
}

async function callEdgeFunction(
  periodo: string,
  forceRegenerate: boolean
): Promise<SmartAnalysisResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No session');

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const response = await fetch(`${supabaseUrl}/functions/v1/generate-welcome-message`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ forceRegenerate }),
    });

    if (!response.ok) throw new Error(`Edge function error: ${response.status}`);

    const data = await response.json();
    if (!data.success || !data.analysis) throw new Error('Invalid response');

    return {
      analysis: data.analysis,
      source: data.source || 'chatgpt',
      periodo: data.periodo || periodo,
      modules: data.modules || [],
    };
  } catch (error) {
    console.error('Edge function call failed:', error);
    const nombre = 'Usuario';
    return {
      analysis: {
        message: `${nombre}, en este momento no fue posible generar tu analisis personalizado. Intenta actualizar en unos minutos.`,
        tone: 'neutral',
      },
      source: 'fallback',
      periodo,
      modules: [],
    };
  }
}
