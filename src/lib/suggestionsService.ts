import { supabase } from './supabase';
import type { AssistantSuggestion } from './assistantTypes';
import { matchRoutePattern } from './assistantUtils';

export async function getSuggestionsForRoute(
  pathname: string,
  userRole?: string
): Promise<AssistantSuggestion[]> {
  const { data, error } = await supabase
    .from('assistant_suggestions')
    .select('*')
    .eq('activo', true)
    .order('orden', { ascending: true });

  if (error) {
    console.error('Error getting suggestions:', error);
    return [];
  }

  if (!data) return [];

  const matchingByRoute = data.filter((suggestion) => {
    if (suggestion.rol_requerido && userRole !== suggestion.rol_requerido) {
      return false;
    }

    return matchRoutePattern(pathname, suggestion.ruta_pattern);
  });

  if (matchingByRoute.length > 0) {
    return matchingByRoute.slice(0, 5);
  }

  const fallback = data.filter((suggestion) => suggestion.ruta_pattern === '*');
  return fallback.slice(0, 5);
}

export async function getAllSuggestions(): Promise<AssistantSuggestion[]> {
  const { data, error } = await supabase
    .from('assistant_suggestions')
    .select('*')
    .eq('activo', true)
    .order('ruta_pattern', { ascending: true })
    .order('orden', { ascending: true });

  if (error) {
    console.error('Error getting all suggestions:', error);
    return [];
  }

  return data || [];
}

export async function createSuggestion(
  intentCodigo: string | null,
  rutaPattern: string,
  rolRequerido: string | null,
  orden: number,
  textoPregunta: string
): Promise<AssistantSuggestion | null> {
  const { data, error } = await supabase
    .from('assistant_suggestions')
    .insert({
      intent_codigo: intentCodigo,
      ruta_pattern: rutaPattern,
      rol_requerido: rolRequerido,
      orden,
      texto_pregunta: textoPregunta,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating suggestion:', error);
    return null;
  }

  return data;
}

export async function updateSuggestion(
  id: string,
  updates: Partial<AssistantSuggestion>
): Promise<boolean> {
  const { error } = await supabase
    .from('assistant_suggestions')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.error('Error updating suggestion:', error);
    return false;
  }

  return true;
}

export async function deleteSuggestion(id: string): Promise<boolean> {
  const { error } = await supabase.from('assistant_suggestions').delete().eq('id', id);

  if (error) {
    console.error('Error deleting suggestion:', error);
    return false;
  }

  return true;
}
