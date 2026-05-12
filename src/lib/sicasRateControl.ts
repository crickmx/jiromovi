/**
 * SICAS Rate Control - Frontend utilities
 *
 * Provides:
 * - Circuit breaker state checking
 * - Process lock awareness
 * - Double-click prevention
 * - User-friendly error messages
 * - Admin config management
 */

import { supabase } from './supabase';

export interface CircuitBreakerState {
  is_open: boolean;
  reason?: string;
  closes_at?: string;
  error_count_5min?: number;
  timeout_count_5min?: number;
}

export interface ProcessLock {
  id: string;
  lock_type: string;
  lock_key: string;
  is_active: boolean;
  started_at: string;
  expires_at: string;
  process_type: string;
}

export interface SicasRateConfig {
  config_key: string;
  config_value: string;
  description: string;
}

export interface SicasApiCallLog {
  id: string;
  process_type: string;
  module: string;
  method: string;
  key_code: string;
  response_success: boolean;
  response_time_ms: number;
  retry_count: number;
  was_cached: boolean;
  was_rate_limited: boolean;
  was_blocked: boolean;
  error_message: string | null;
  created_at: string;
}

// In-memory lock to prevent double-clicks on the same operation
const activeOperations = new Map<string, number>();

const SICAS_USER_MESSAGES: Record<string, string> = {
  circuit_breaker_open: 'SICAS esta respondiendo con errores o lentitud. MOVI pauso temporalmente los procesos automaticos para evitar saturacion.',
  lock_active: 'Ya hay un proceso SICAS en curso. Espere a que termine antes de intentar nuevamente.',
  cooldown: 'Ya se realizo una consulta reciente. Puedes intentar de nuevo en unos minutos.',
  rate_limited: 'Estamos esperando unos minutos antes de volver a consultar SICAS para evitar saturar el servicio.',
  timeout: 'SICAS tardo demasiado en responder. El proceso se detuvo de forma segura.',
};

/**
 * Get user-friendly message for a SICAS error
 */
export function getSicasUserMessage(errorKey: string): string {
  return SICAS_USER_MESSAGES[errorKey] || 'Ocurrio un error al comunicarse con SICAS.';
}

/**
 * Check if the circuit breaker is currently open
 */
export async function checkCircuitBreaker(): Promise<CircuitBreakerState> {
  const { data, error } = await supabase
    .from('sicas_circuit_breaker')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return { is_open: false };
  }

  // Auto-close if past close time
  if (data.is_open && data.closes_at && new Date(data.closes_at) <= new Date()) {
    return { is_open: false };
  }

  return {
    is_open: data.is_open,
    reason: data.reason,
    closes_at: data.closes_at,
    error_count_5min: data.error_count_5min,
    timeout_count_5min: data.timeout_count_5min,
  };
}

/**
 * Check if there's an active lock for a given operation
 */
export async function checkActiveLock(lockType: string, lockKey: string): Promise<ProcessLock | null> {
  const { data } = await supabase
    .from('sicas_process_locks')
    .select('*')
    .eq('lock_type', lockType)
    .eq('lock_key', lockKey)
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  return data || null;
}

/**
 * Prevent double-click on SICAS operations.
 * Returns true if operation can proceed, false if blocked.
 */
export function acquireClientLock(operationKey: string, cooldownMs = 3000): boolean {
  const now = Date.now();
  const lastAttempt = activeOperations.get(operationKey);

  if (lastAttempt && now - lastAttempt < cooldownMs) {
    return false;
  }

  activeOperations.set(operationKey, now);
  return true;
}

/**
 * Release client-side lock after operation completes
 */
export function releaseClientLock(operationKey: string): void {
  activeOperations.delete(operationKey);
}

/**
 * Full pre-flight check before any SICAS operation.
 * Returns null if OK to proceed, or an error message if blocked.
 */
export async function preflight(operationKey: string, lockType?: string, lockKey?: string): Promise<string | null> {
  // 1. Double-click prevention
  if (!acquireClientLock(operationKey)) {
    return 'Proceso en curso. Espere unos segundos.';
  }

  // 2. Circuit breaker
  const cb = await checkCircuitBreaker();
  if (cb.is_open) {
    releaseClientLock(operationKey);
    return getSicasUserMessage('circuit_breaker_open');
  }

  // 3. Process lock (server-side)
  if (lockType && lockKey) {
    const lock = await checkActiveLock(lockType, lockKey);
    if (lock) {
      releaseClientLock(operationKey);
      return getSicasUserMessage('lock_active');
    }
  }

  return null;
}

// ─── Admin functions ────────────────────────────────────────────────────────

/**
 * Load all SICAS rate config values
 */
export async function loadRateConfig(): Promise<SicasRateConfig[]> {
  const { data } = await supabase
    .from('sicas_rate_config')
    .select('config_key, config_value, description')
    .order('config_key');

  return data || [];
}

/**
 * Update a rate config value (admin only)
 */
export async function updateRateConfig(key: string, value: string): Promise<boolean> {
  const { error } = await supabase
    .from('sicas_rate_config')
    .update({ config_value: value, updated_at: new Date().toISOString() })
    .eq('config_key', key);

  return !error;
}

/**
 * Get recent API call logs (admin only)
 */
export async function getRecentLogs(limit = 50): Promise<SicasApiCallLog[]> {
  const { data } = await supabase
    .from('sicas_api_call_logs')
    .select('id, process_type, module, method, key_code, response_success, response_time_ms, retry_count, was_cached, was_rate_limited, was_blocked, error_message, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  return data || [];
}

/**
 * Get active process locks (admin only)
 */
export async function getActiveLocks(): Promise<ProcessLock[]> {
  const { data } = await supabase
    .from('sicas_process_locks')
    .select('*')
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString())
    .order('started_at', { ascending: false });

  return data || [];
}

/**
 * Admin: force release all stuck locks
 */
export async function adminReleaseStuckLocks(): Promise<number> {
  const { data } = await supabase.rpc('admin_release_stuck_sicas_locks');
  return data || 0;
}

/**
 * Admin: manually reset circuit breaker
 */
export async function adminResetCircuitBreaker(): Promise<boolean> {
  const { error } = await supabase.rpc('admin_reset_circuit_breaker');
  return !error;
}
