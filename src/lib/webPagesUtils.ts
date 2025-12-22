import { supabase } from './supabase';
import type {
  WebPageInsurer,
  WebPageCategory,
  UserWebPage,
  UserWebPageConfig,
  PublicWebPageData
} from './webPagesTypes';

export async function getActiveInsurers(): Promise<WebPageInsurer[]> {
  const { data, error } = await supabase
    .from('web_page_insurers')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getAllInsurers(): Promise<WebPageInsurer[]> {
  const { data, error } = await supabase
    .from('web_page_insurers')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createInsurer(
  insurer: Omit<WebPageInsurer, 'id' | 'created_at' | 'updated_at'>
): Promise<WebPageInsurer> {
  const { data, error } = await supabase
    .from('web_page_insurers')
    .insert(insurer)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateInsurer(
  id: string,
  updates: Partial<Omit<WebPageInsurer, 'id' | 'created_at' | 'updated_at'>>
): Promise<WebPageInsurer> {
  const { data, error } = await supabase
    .from('web_page_insurers')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteInsurer(id: string): Promise<void> {
  const { error } = await supabase
    .from('web_page_insurers')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getActiveCategories(): Promise<WebPageCategory[]> {
  const { data, error } = await supabase
    .from('web_page_categories')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getAllCategories(): Promise<WebPageCategory[]> {
  const { data, error } = await supabase
    .from('web_page_categories')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createCategory(
  category: Omit<WebPageCategory, 'id' | 'created_at' | 'updated_at'>
): Promise<WebPageCategory> {
  const { data, error } = await supabase
    .from('web_page_categories')
    .insert(category)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCategory(
  id: string,
  updates: Partial<Omit<WebPageCategory, 'id' | 'created_at' | 'updated_at'>>
): Promise<WebPageCategory> {
  const { data, error } = await supabase
    .from('web_page_categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase
    .from('web_page_categories')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getUserWebPageConfig(userId: string): Promise<UserWebPageConfig | null> {
  const { data: webPage, error: webPageError } = await supabase
    .from('user_web_pages')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (webPageError) throw webPageError;
  if (!webPage) return null;

  const { data: insurers, error: insurersError } = await supabase
    .from('user_web_page_insurers')
    .select('insurer_id')
    .eq('user_web_page_id', webPage.id);

  if (insurersError) throw insurersError;

  const { data: categories, error: categoriesError } = await supabase
    .from('user_web_page_categories')
    .select('category_id')
    .eq('user_web_page_id', webPage.id);

  if (categoriesError) throw categoriesError;

  return {
    id: webPage.id,
    primary_color: webPage.primary_color,
    secondary_color: webPage.secondary_color,
    custom_text: webPage.custom_text || [],
    is_published: webPage.is_published,
    selected_insurer_ids: insurers?.map(i => i.insurer_id) || [],
    selected_category_ids: categories?.map(c => c.category_id) || []
  };
}

export async function saveUserWebPageConfig(
  userId: string,
  config: Omit<UserWebPageConfig, 'id'>
): Promise<void> {
  const { data: existingPage } = await supabase
    .from('user_web_pages')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  let webPageId: string;

  if (existingPage) {
    const { data: updated, error: updateError } = await supabase
      .from('user_web_pages')
      .update({
        primary_color: config.primary_color,
        secondary_color: config.secondary_color,
        custom_text: config.custom_text,
        is_published: config.is_published
      })
      .eq('id', existingPage.id)
      .select()
      .single();

    if (updateError) throw updateError;
    webPageId = updated.id;
  } else {
    const { data: created, error: createError } = await supabase
      .from('user_web_pages')
      .insert({
        user_id: userId,
        primary_color: config.primary_color,
        secondary_color: config.secondary_color,
        custom_text: config.custom_text,
        is_published: config.is_published
      })
      .select()
      .single();

    if (createError) throw createError;
    webPageId = created.id;
  }

  await supabase
    .from('user_web_page_insurers')
    .delete()
    .eq('user_web_page_id', webPageId);

  if (config.selected_insurer_ids.length > 0) {
    const insurersToInsert = config.selected_insurer_ids.map(insurerId => ({
      user_web_page_id: webPageId,
      insurer_id: insurerId
    }));

    const { error: insurersError } = await supabase
      .from('user_web_page_insurers')
      .insert(insurersToInsert);

    if (insurersError) throw insurersError;
  }

  await supabase
    .from('user_web_page_categories')
    .delete()
    .eq('user_web_page_id', webPageId);

  if (config.selected_category_ids.length > 0) {
    const categoriesToInsert = config.selected_category_ids.map(categoryId => ({
      user_web_page_id: webPageId,
      category_id: categoryId
    }));

    const { error: categoriesError } = await supabase
      .from('user_web_page_categories')
      .insert(categoriesToInsert);

    if (categoriesError) throw categoriesError;
  }
}

export async function getPublicWebPageBySlug(slug: string): Promise<PublicWebPageData | null> {
  const { data, error } = await supabase.rpc('get_public_web_page_by_slug', {
    p_slug: slug
  });

  if (error) {
    console.error('Error fetching public web page:', error);
    return null;
  }

  return data;
}

export function validateSlug(slug: string): { valid: boolean; error?: string } {
  if (!slug) {
    return { valid: false, error: 'El slug es requerido' };
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { valid: false, error: 'Solo se permiten minúsculas, números y guiones' };
  }

  if (slug.length < 3) {
    return { valid: false, error: 'El slug debe tener al menos 3 caracteres' };
  }

  if (slug.length > 50) {
    return { valid: false, error: 'El slug no puede tener más de 50 caracteres' };
  }

  if (slug.startsWith('-') || slug.endsWith('-')) {
    return { valid: false, error: 'El slug no puede comenzar ni terminar con guión' };
  }

  if (slug.includes('--')) {
    return { valid: false, error: 'El slug no puede contener guiones consecutivos' };
  }

  return { valid: true };
}

export function validateHexColor(color: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(color);
}

export async function checkSlugAvailability(
  slug: string,
  excludeUserId?: string
): Promise<boolean> {
  let query = supabase
    .from('usuarios')
    .select('id')
    .eq('web_slug', slug);

  if (excludeUserId) {
    query = query.neq('id', excludeUserId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) throw error;

  return !data;
}
