import { useEffect, useState } from 'react';
import { Card } from './ui/card';
import { supabase } from '../lib/supabase';
import { Brain, Zap, TrendingUp, CheckCircle2 } from 'lucide-react';

interface AnalyticsData {
  total_queries: number;
  chatgpt_queries: number;
  movi_queries: number;
  avg_confidence: number;
  recent_decisions: Array<{
    selected_mode: string;
    confidence_score: number;
    created_at: string;
    intent: string;
  }>;
}

export function AssistantAnalytics() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    try {
      setIsLoading(true);

      const { data: logs, error } = await supabase
        .from('assistant_routing_logs')
        .select('selected_mode, confidence_score, created_at, router_reasoning')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      if (logs && logs.length > 0) {
        const chatgptCount = logs.filter((l) => l.selected_mode === 'chatgpt').length;
        const moviCount = logs.filter((l) => l.selected_mode === 'movi').length;
        const avgConfidence =
          logs.reduce((sum, l) => sum + (l.confidence_score || 0), 0) / logs.length;

        setAnalytics({
          total_queries: logs.length,
          chatgpt_queries: chatgptCount,
          movi_queries: moviCount,
          avg_confidence: Math.round(avgConfidence),
          recent_decisions: logs.slice(0, 10).map((l) => ({
            selected_mode: l.selected_mode,
            confidence_score: l.confidence_score || 0,
            created_at: l.created_at,
            intent: l.router_reasoning?.layer2_intent || 'GENERAL',
          })),
        });
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </Card>
    );
  }

  if (!analytics) {
    return (
      <Card className="p-6">
        <p className="text-sm text-gray-500">No hay datos de analytics disponibles</p>
      </Card>
    );
  }

  const chatgptPercentage = Math.round(
    (analytics.chatgpt_queries / analytics.total_queries) * 100
  );
  const moviPercentage = Math.round(
    (analytics.movi_queries / analytics.total_queries) * 100
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Analytics del Asistente Inteligente</h3>
        <p className="text-sm text-gray-600">
          Métricas del sistema de routing dual-mode (últimas 100 consultas)
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Brain className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Consultas</p>
              <p className="text-2xl font-bold">{analytics.total_queries}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Zap className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">ChatGPT</p>
              <p className="text-2xl font-bold">{chatgptPercentage}%</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">MOVI</p>
              <p className="text-2xl font-bold">{moviPercentage}%</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Confianza Promedio</p>
              <p className="text-2xl font-bold">{analytics.avg_confidence}%</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h4 className="font-semibold mb-4">Decisiones Recientes</h4>
        <div className="space-y-2">
          {analytics.recent_decisions.map((decision, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    decision.selected_mode === 'chatgpt'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-primary-100 text-primary-700'
                  }`}
                >
                  {decision.selected_mode === 'chatgpt' ? '🤖 ChatGPT' : '📊 MOVI'}
                </span>
                <span className="text-sm text-gray-600">{decision.intent}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-500">
                  {decision.confidence_score}% confianza
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(decision.created_at).toLocaleDateString('es-MX', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6 bg-primary-50 border-primary-200">
        <h4 className="font-semibold mb-2 text-primary-900">Cómo funciona el sistema</h4>
        <div className="space-y-2 text-sm text-primary-800">
          <p>
            <strong>1 Chat, 2 Cerebros:</strong> El asistente analiza cada pregunta y decide
            automáticamente cuál es el mejor modo para responder.
          </p>
          <p>
            <strong>🤖 ChatGPT:</strong> Para conocimiento general, explicaciones, consejos y
            preguntas sobre seguros.
          </p>
          <p>
            <strong>📊 MOVI:</strong> Para consultar datos específicos del sistema (comisiones,
            producción, CRM, etc.)
          </p>
          <p>
            <strong>Confianza:</strong> Indica qué tan seguro está el router de su decisión. Mayor
            confianza = mejor selección de modo.
          </p>
        </div>
      </Card>
    </div>
  );
}
