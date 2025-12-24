/**
 * Intelligent Router Service - Decides between ChatGPT and MOVI modes
 *
 * This service implements a 3-layer scoring system:
 * 1. Keyword matching (fast, simple)
 * 2. Intent classification (contextual analysis)
 * 3. Confidence threshold (prevents uncertain routing)
 */

export interface RoutingDecision {
  selectedMode: 'chatgpt' | 'movi';
  chatgptScore: number;
  moviScore: number;
  confidence: number;
  reasoning: {
    layer1_keywords: string[];
    layer2_intent: string;
    layer3_factors: string[];
  };
  requiresWebSearch: boolean;
}

interface KeywordRule {
  keywords: string[];
  mode: 'chatgpt' | 'movi';
  weight: number;
  category: string;
}

const KEYWORD_RULES: KeywordRule[] = [
  // MOVI System Keywords (High Priority)
  {
    keywords: ['comisiones', 'comisión', 'pago', 'pagos', 'cuenta', 'saldo'],
    mode: 'movi',
    weight: 40,
    category: 'comisiones'
  },
  {
    keywords: ['producción', 'primas', 'póliza', 'pólizas', 'vendedor', 'vendedores'],
    mode: 'movi',
    weight: 40,
    category: 'produccion'
  },
  {
    keywords: ['crm', 'contacto', 'contactos', 'cliente', 'clientes', 'tarea', 'tareas'],
    mode: 'movi',
    weight: 40,
    category: 'crm'
  },
  {
    keywords: ['cotización', 'cotizaciones', 'gmm', 'seguro', 'prima'],
    mode: 'movi',
    weight: 35,
    category: 'cotizaciones'
  },
  {
    keywords: ['perfil', 'información', 'datos personales', 'configuración'],
    mode: 'movi',
    weight: 35,
    category: 'perfil'
  },
  {
    keywords: ['comunicado', 'comunicados', 'notificación', 'notificaciones'],
    mode: 'movi',
    weight: 35,
    category: 'comunicados'
  },
  {
    keywords: ['directorio', 'oficina', 'oficinas', 'equipo', 'compañeros'],
    mode: 'movi',
    weight: 30,
    category: 'directorio'
  },
  {
    keywords: ['trámite', 'trámites', 'ticket', 'tickets', 'solicitud'],
    mode: 'movi',
    weight: 35,
    category: 'tramites'
  },
  {
    keywords: ['reunión', 'reuniones', 'calendario', 'eventos', 'agenda'],
    mode: 'movi',
    weight: 30,
    category: 'calendario'
  },

  // ChatGPT Keywords (General Knowledge)
  {
    keywords: ['qué es', 'cómo funciona', 'explica', 'explicar', 'definición'],
    mode: 'chatgpt',
    weight: 30,
    category: 'explicaciones'
  },
  {
    keywords: ['consejo', 'consejos', 'recomendación', 'sugerencia', 'estrategia'],
    mode: 'chatgpt',
    weight: 35,
    category: 'consejos'
  },
  {
    keywords: ['comparar', 'diferencia', 'versus', 'vs', 'mejor opción'],
    mode: 'chatgpt',
    weight: 30,
    category: 'comparaciones'
  },
  {
    keywords: ['tendencia', 'tendencias', 'mercado', 'industria', 'actualidad'],
    mode: 'chatgpt',
    weight: 35,
    category: 'tendencias'
  },
  {
    keywords: ['historia', 'origen', 'evolución', 'desarrollo'],
    mode: 'chatgpt',
    weight: 25,
    category: 'historia'
  }
];

const INTENT_PATTERNS = {
  DATA_QUERY: /^(cuánto|cuánta|cuántos|cuántas|mostrar|ver|consultar|listar|dame|obtener)/i,
  ACTION_REQUEST: /^(crear|agregar|añadir|eliminar|borrar|actualizar|modificar|cambiar)/i,
  NAVIGATION: /^(ir a|navegar a|abrir|mostrar página|llevar a|cómo llego)/i,
  EXPLANATION: /^(qué|cómo|por qué|para qué|cuál|explica|define)/i,
  COMPARISON: /^(comparar|diferencia|mejor|versus|vs|cuál es mejor)/i,
  RECOMMENDATION: /^(recomienda|sugiere|aconseja|qué debería)/i,
};

export class IntelligentRouter {
  /**
   * Main routing function - analyzes user query and decides mode
   */
  static async route(userMessage: string, conversationHistory?: any[]): Promise<RoutingDecision> {
    const normalizedMessage = userMessage.toLowerCase().trim();

    // Layer 1: Keyword Matching
    const keywordResults = this.analyzeKeywords(normalizedMessage);

    // Layer 2: Intent Classification
    const intentAnalysis = this.classifyIntent(normalizedMessage, conversationHistory);

    // Layer 3: Score Calculation and Confidence
    const decision = this.calculateFinalScores(
      keywordResults,
      intentAnalysis,
      normalizedMessage
    );

    return decision;
  }

  /**
   * Layer 1: Fast keyword matching with weighted scoring
   */
  private static analyzeKeywords(message: string): {
    chatgptScore: number;
    moviScore: number;
    matchedKeywords: string[];
  } {
    let chatgptScore = 0;
    let moviScore = 0;
    const matchedKeywords: string[] = [];

    for (const rule of KEYWORD_RULES) {
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

  /**
   * Layer 2: Intent classification based on patterns
   */
  private static classifyIntent(
    message: string,
    conversationHistory?: any[]
  ): {
    intent: string;
    moviBoost: number;
    chatgptBoost: number;
  } {
    let intent = 'GENERAL';
    let moviBoost = 0;
    let chatgptBoost = 0;

    // Check intent patterns
    if (INTENT_PATTERNS.DATA_QUERY.test(message)) {
      intent = 'DATA_QUERY';
      moviBoost = 25;
    } else if (INTENT_PATTERNS.ACTION_REQUEST.test(message)) {
      intent = 'ACTION_REQUEST';
      moviBoost = 30;
    } else if (INTENT_PATTERNS.NAVIGATION.test(message)) {
      intent = 'NAVIGATION';
      moviBoost = 35;
    } else if (INTENT_PATTERNS.EXPLANATION.test(message)) {
      intent = 'EXPLANATION';
      chatgptBoost = 30;
    } else if (INTENT_PATTERNS.COMPARISON.test(message)) {
      intent = 'COMPARISON';
      chatgptBoost = 25;
    } else if (INTENT_PATTERNS.RECOMMENDATION.test(message)) {
      intent = 'RECOMMENDATION';
      chatgptBoost = 25;
    }

    // Context boost: if previous messages were about system data, prefer MOVI
    if (conversationHistory && conversationHistory.length > 0) {
      const recentMoviUsage = conversationHistory
        .slice(-3)
        .filter(msg => msg.modo_usado === 'movi').length;

      if (recentMoviUsage >= 2) {
        moviBoost += 15;
      }
    }

    return { intent, moviBoost, chatgptBoost };
  }

  /**
   * Layer 3: Final score calculation and confidence threshold
   */
  private static calculateFinalScores(
    keywordResults: any,
    intentAnalysis: any,
    message: string
  ): RoutingDecision {
    // Base scores from keywords
    let chatgptScore = keywordResults.chatgptScore + intentAnalysis.chatgptBoost;
    let moviScore = keywordResults.moviScore + intentAnalysis.moviBoost;

    // Special rules
    const requiresWebSearch = this.requiresWebSearch(message);
    if (requiresWebSearch) {
      chatgptScore += 20;
    }

    // Question about system navigation
    if (message.includes('cómo') && (message.includes('usar') || message.includes('funciona'))) {
      if (keywordResults.matchedKeywords.length > 0) {
        moviScore += 20;
      } else {
        chatgptScore += 15;
      }
    }

    // Normalize scores to 0-100
    const total = chatgptScore + moviScore;
    if (total > 0) {
      chatgptScore = (chatgptScore / total) * 100;
      moviScore = (moviScore / total) * 100;
    } else {
      // Default to ChatGPT for general queries
      chatgptScore = 60;
      moviScore = 40;
    }

    // Calculate confidence (difference between scores)
    const confidence = Math.abs(chatgptScore - moviScore);

    // Select mode (with 55% threshold for clear winner)
    const selectedMode = chatgptScore > moviScore ? 'chatgpt' : 'movi';

    // Build reasoning
    const factors: string[] = [];
    if (keywordResults.matchedKeywords.length > 0) {
      factors.push(`Matched ${keywordResults.matchedKeywords.length} keywords`);
    }
    factors.push(`Intent: ${intentAnalysis.intent}`);
    if (requiresWebSearch) {
      factors.push('Requires web search');
    }
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
      },
      requiresWebSearch
    };
  }

  /**
   * Determines if query requires web search
   */
  private static requiresWebSearch(message: string): boolean {
    const webSearchIndicators = [
      'último', 'última', 'reciente', 'actual', 'hoy',
      'noticia', 'noticias', 'nuevo', 'nueva',
      '2024', '2025', 'actualizado', 'tendencia'
    ];

    return webSearchIndicators.some(indicator => message.includes(indicator));
  }

  /**
   * Format routing decision for logging
   */
  static formatDecisionLog(decision: RoutingDecision): string {
    return `
Mode: ${decision.selectedMode.toUpperCase()}
Scores: ChatGPT ${decision.chatgptScore}% | MOVI ${decision.moviScore}%
Confidence: ${decision.confidence}%
Intent: ${decision.reasoning.layer2_intent}
Keywords: ${decision.reasoning.layer1_keywords.join(', ') || 'none'}
    `.trim();
  }
}
