import { supabase } from './supabase';

export type BulletType =
  | 'production'
  | 'renewals'
  | 'emissions'
  | 'portfolio'
  | 'tickets'
  | 'commissions'
  | 'leads'
  | 'tasks'
  | 'contact_center'
  | 'whatsapp'
  | 'email'
  | 'marketing'
  | 'courses'
  | 'documents'
  | 'cross_sell'
  | 'alerts'
  | 'general';

export type BulletPriority = 'high' | 'medium' | 'low';

export interface AnalysisBullet {
  type: BulletType;
  priority: BulletPriority;
  text: string;
}

export interface AnalysisAction {
  label: string;
  type: 'navigate';
  target: string;
  priority: BulletPriority;
}

export interface SmartAnalysis {
  message: string;
  tone: 'positive' | 'neutral' | 'attention';
}

export interface StructuredAnalysis {
  title: string;
  source: 'SICAS + MOVI' | 'Solo MOVI' | 'Datos parciales';
  summary_bullets: AnalysisBullet[];
  actions: AnalysisAction[];
  tone: 'positive' | 'neutral' | 'attention';
}

export interface SmartAnalysisResult {
  analysis: SmartAnalysis;
  structured: StructuredAnalysis | null;
  source: 'chatgpt' | 'fallback' | 'cache';
  periodo: string;
  modules?: string[];
  cachedAt?: string;
  updatedMinutesAgo?: number;
}

const CACHE_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

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
    if (!cached) return null;

    const minutesAgo = Math.round((Date.now() - new Date(data.updated_at).getTime()) / 60000);

    // Support both old format (message/tone) and new structured format
    if (cached.summary_bullets) {
      return {
        analysis: {
          message: cached.summary_bullets.map((b: any) => b.text).join('\n'),
          tone: cached.tone || 'neutral',
        },
        structured: {
          title: cached.title || 'Tu resumen inteligente',
          source: cached.source || 'Solo MOVI',
          summary_bullets: cached.summary_bullets || [],
          actions: cached.actions || [],
          tone: cached.tone || 'neutral',
        },
        source: 'cache',
        periodo: data.periodo,
        modules: data.modules_included || [],
        cachedAt: data.updated_at,
        updatedMinutesAgo: minutesAgo,
      };
    }

    // Legacy format
    if (!cached.message) return null;
    return {
      analysis: { message: cached.message, tone: cached.tone || 'neutral' },
      structured: null,
      source: 'cache',
      periodo: data.periodo,
      modules: data.modules_included || [],
      cachedAt: data.updated_at,
      updatedMinutesAgo: minutesAgo,
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
    if (!data.success) throw new Error('Invalid response');

    // Handle new structured format
    if (data.structured) {
      return {
        analysis: {
          message: data.structured.summary_bullets?.map((b: any) => b.text).join('\n') || '',
          tone: data.structured.tone || 'neutral',
        },
        structured: data.structured,
        source: data.source || 'chatgpt',
        periodo: data.periodo || periodo,
        modules: data.modules || [],
        updatedMinutesAgo: 0,
      };
    }

    // Legacy format
    if (data.analysis) {
      return {
        analysis: data.analysis,
        structured: null,
        source: data.source || 'chatgpt',
        periodo: data.periodo || periodo,
        modules: data.modules || [],
      };
    }

    throw new Error('No analysis in response');
  } catch (error) {
    console.error('Edge function call failed:', error);
    return {
      analysis: {
        message: 'En este momento no fue posible generar tu analisis personalizado. Intenta actualizar en unos minutos.',
        tone: 'neutral',
      },
      structured: null,
      source: 'fallback',
      periodo,
      modules: [],
    };
  }
}
