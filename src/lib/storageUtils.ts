import { supabase } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export function getStorageUrl(
  path: string | null | undefined,
  bucket: string,
  fallback = ''
): string {
  if (!path) return fallback;

  if (/^(https?:\/\/|data:)/.test(path)) {
    return path;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl || fallback;
}

export function getStorageUrlFresh(
  path: string | null | undefined,
  bucket: string,
  fallback = ''
): string {
  const url = getStorageUrl(path, bucket, fallback);
  if (!url || url === fallback) return fallback;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}t=${Date.now()}`;
}

export async function getSignedUrl(
  path: string | null | undefined,
  bucket: string,
  expiresInSeconds = 3600
): Promise<string | null> {
  if (!path) return null;

  if (/^https?:\/\//.test(path)) return path;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error) {
    console.warn(`[storageUtils] Could not sign URL for ${bucket}/${path}:`, error.message);
    return null;
  }

  return data.signedUrl || null;
}

export function resolveImageUrl(
  url: string | null | undefined,
  bucket?: string,
  fallback = ''
): string {
  if (!url) return fallback;
  if (/^(https?:\/\/|data:|blob:)/.test(url)) return url;
  if (url.startsWith('/')) return url;
  if (bucket) return getStorageUrl(url, bucket, fallback);
  return `${SUPABASE_URL}/storage/v1/object/public/${url}`;
}

/**
 * Returns a cache-busted version of a URL for retry on image load failure.
 */
export function bustUrl(url: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}_r=${Date.now()}`;
}

/**
 * Handles image load errors by hiding the broken image and showing a sibling fallback element.
 * Attempts a one-time cache-busted retry before showing the fallback.
 */
export function handleImgError(
  e: React.SyntheticEvent<HTMLImageElement>,
  logPath?: string
) {
  const target = e.currentTarget;
  const alreadyRetried = target.dataset.retried === '1';

  if (!alreadyRetried && target.src) {
    target.dataset.retried = '1';
    target.src = bustUrl(target.src);
    return;
  }

  if (logPath) {
    console.warn('[storageUtils] Image failed to load:', logPath);
  }
  target.style.display = 'none';
  const fallback = target.nextElementSibling as HTMLElement | null;
  if (fallback) fallback.style.display = 'flex';
}
