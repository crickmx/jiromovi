/**
 * Web Search Service using Tavily API
 *
 * Enriches ChatGPT responses with current information from the web
 * Provides citations and sources for transparency
 */

export interface WebSearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  publishedDate?: string;
}

export interface WebSearchResponse {
  query: string;
  results: WebSearchResult[];
  answer?: string;
  searchTime: number;
}

export class WebSearchService {
  private static readonly MAX_RESULTS = 5;
  private static readonly TIMEOUT_MS = 5000;

  /**
   * Performs web search using Tavily API
   */
  static async search(query: string): Promise<WebSearchResponse> {
    const startTime = Date.now();

    try {
      // Note: Tavily API would be called from edge function due to API key security
      // This is a placeholder that will be integrated in the edge function
      const response = await fetch('/api/web-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          max_results: this.MAX_RESULTS,
          include_answer: true,
          include_raw_content: false
        }),
        signal: AbortSignal.timeout(this.TIMEOUT_MS)
      });

      if (!response.ok) {
        throw new Error(`Web search failed: ${response.statusText}`);
      }

      const data = await response.json();
      const searchTime = Date.now() - startTime;

      return {
        query,
        results: data.results || [],
        answer: data.answer,
        searchTime
      };
    } catch (error) {
      console.error('Web search error:', error);
      return {
        query,
        results: [],
        searchTime: Date.now() - startTime
      };
    }
  }

  /**
   * Formats web search results for ChatGPT context
   */
  static formatForContext(searchResponse: WebSearchResponse): string {
    if (!searchResponse.results || searchResponse.results.length === 0) {
      return '';
    }

    let context = '\n\n--- Información actualizada de la web ---\n\n';

    if (searchResponse.answer) {
      context += `Resumen: ${searchResponse.answer}\n\n`;
    }

    context += 'Fuentes:\n';
    searchResponse.results.slice(0, 3).forEach((result, index) => {
      context += `${index + 1}. ${result.title}\n`;
      context += `   ${result.content.substring(0, 200)}...\n`;
      context += `   Fuente: ${result.url}\n\n`;
    });

    return context;
  }

  /**
   * Formats citations for display in UI
   */
  static formatCitations(results: WebSearchResult[]): Array<{
    title: string;
    url: string;
    snippet: string;
  }> {
    return results.slice(0, 3).map(result => ({
      title: result.title,
      url: result.url,
      snippet: result.content.substring(0, 150) + '...'
    }));
  }

  /**
   * Determines if a query should trigger web search
   */
  static shouldSearch(query: string): boolean {
    const searchTriggers = [
      /último|última|reciente|actual/i,
      /noticia|noticias/i,
      /\b202[3-5]\b/,
      /hoy|ayer|esta semana/i,
      /nuevo|nueva|actualizado/i,
      /tendencia|trending/i,
      /precio|costo|valor/i
    ];

    return searchTriggers.some(pattern => pattern.test(query));
  }
}
