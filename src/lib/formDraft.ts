/**
 * sessionStorage-backed form draft with TTL.
 * Survives browser tab suspension and navigation back.
 * Use for form fields the user would lose on tab switch.
 */

const DRAFT_TTL = 30 * 60 * 1000; // 30 minutes

export function saveDraft(key: string, data: Record<string, unknown>): void {
  try {
    sessionStorage.setItem(key, JSON.stringify({ ...data, _ts: Date.now() }));
  } catch {
    // sessionStorage full or unavailable — silently ignore
  }
}

export function loadDraft<T extends Record<string, unknown>>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as T & { _ts?: number };
    const ts = (parsed as Record<string, unknown>)._ts as number | undefined;
    if (!ts || Date.now() - ts > DRAFT_TTL) {
      sessionStorage.removeItem(key);
      return null;
    }
    const { _ts: _ignored, ...rest } = parsed as Record<string, unknown>;
    void _ignored;
    return rest as T;
  } catch {
    return null;
  }
}

export function hasDraft(key: string): boolean {
  return loadDraft(key) !== null;
}

export function clearDraft(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}
