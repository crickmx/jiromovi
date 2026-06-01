import { supabase } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

/**
 * Returns the public URL for a Supabase Storage asset.
 * Handles all cases:
 *  - already an absolute URL  → returned as-is
 *  - storage path              → resolved via getPublicUrl
 *  - null/empty                → returns fallback
 */
export function getStorageUrl(
  path: string | null | undefined,
  bucket: string,
  fallback = ''
): string {
  if (!path) return fallback;

  // Already absolute (http/https or data URI)
  if (/^(https?:\/\/|data:)/.test(path)) {
    // Ensure cache-busting doesn't apply to data URIs
    return path;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl || fallback;
}

/**
 * Returns a cache-busted public URL for a Supabase Storage asset.
 * Useful when the file may have been updated in-place.
 */
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

/**
 * Creates a short-lived signed URL for a private Supabase Storage file.
 * Returns null if the path is empty or an error occurs.
 */
export async function getSignedUrl(
  path: string | null | undefined,
  bucket: string,
  expiresInSeconds = 3600
): Promise<string | null> {
  if (!path) return null;

  // If it's already an absolute URL, return it directly
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

/**
 * Resolves an image URL that could be:
 *  - an absolute URL (Supabase storage, CDN, etc.)
 *  - a relative path stored in DB
 *  - null/empty (returns fallback)
 *
 * This is the universal helper to use in <img src> attributes.
 */
export function resolveImageUrl(
  url: string | null | undefined,
  bucket?: string,
  fallback = ''
): string {
  if (!url) return fallback;
  if (/^(https?:\/\/|data:|blob:)/.test(url)) return url;
  if (url.startsWith('/')) return url; // public folder
  if (bucket) return getStorageUrl(url, bucket, fallback);
  // Last resort: construct manually
  return `${SUPABASE_URL}/storage/v1/object/public/${url}`;
}

/**
 * Handles image load errors by hiding the broken image and showing a sibling fallback element.
 * Pass the event from onError.
 */
export function handleImgError(
  e: React.SyntheticEvent<HTMLImageElement>,
  logPath?: string
) {
  const target = e.currentTarget;
  if (logPath) {
    console.warn('[storageUtils] Image failed to load:', logPath);
  }
  target.style.display = 'none';
  const fallback = target.nextElementSibling as HTMLElement | null;
  if (fallback) fallback.style.display = 'flex';
}
