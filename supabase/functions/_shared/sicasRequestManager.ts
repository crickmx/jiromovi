/**
 * SICAS Request Manager - Centralized wrapper for all SICAS API calls
 *
 * Responsibilities:
 * - Rate limiting (min delay between requests)
 * - Circuit breaker (pause on repeated failures)
 * - Process locks (prevent concurrent operations)
 * - Response caching (avoid redundant calls)
 * - Controlled retries with backoff
 * - Timeouts per operation type
 * - Audit logging of every call
 * - Credential redaction in logs
 *
 * ALL Edge Functions that call SICAS must use this manager.
 */

import { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { SicasSoapReportClient, SicasReportOptions, SicasReportResponse, FilterCondition } from './sicasSoapReportClient.ts';

export type { FilterCondition };

export interface RateConfig {
  maxRetriesRead: number;
  maxRetriesWrite: number;
  maxConcurrentRequests: number;
  minDelayBetweenRequestsMs: number;
  reportPageDelayMs: number;
  verifyCacheMinutes: number;
  searchCacheMinutes: number;
  catalogCacheHours: number;
  reportCacheMinutes: number;
  timeoutSimpleMs: number;
  timeoutReportMs: number;
  timeoutMassiveMs: number;
  batchSize: number;
  batchDelayMs: number;
  maxPagesPerExecution: number;
  maxJobDurationMinutes: number;
  lockExpiryMinutes: number;
  userCooldownMinutes: number;
}

export type ProcessType = 'sync' | 'register' | 'verify' | 'search' | 'catalog' | 'report' | 'create_client' | 'hwcapture';
export type OperationType = 'read' | 'write';

export interface RequestOptions {
  processType: ProcessType;
  operationType: OperationType;
  module: string;
  keyCode?: string;
  keyProcess?: string;
  tproc?: string;
  deliveryId?: string;
  userId?: string;
  lockKey?: string;
  lockType?: string;
  skipCache?: boolean;
  skipLock?: boolean;
  cacheMinutes?: number;
  timeoutMs?: number;
}

export interface ManagedReportOptions extends SicasReportOptions {
  requestOptions: RequestOptions;
}

interface CircuitBreakerState {
  is_open: boolean;
  reason?: string;
  closes_at?: string;
}

const BACKOFF_DELAYS = [5000, 15000, 30000]; // 5s, 15s, 30s

export class SicasRequestManager {
  private supabase: SupabaseClient;
  private soapClient: SicasSoapReportClient | null = null;
  private config: RateConfig | null = null;
  private lastRequestAt = 0;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Load rate config from database (cached in memory per instance)
   */
  async getConfig(): Promise<RateConfig> {
    if (this.config) return this.config;

    const { data: rows } = await this.supabase
      .from('sicas_rate_config')
      .select('config_key, config_value');

    const configMap: Record<string, string> = {};
    if (rows) {
      for (const row of rows) {
        configMap[row.config_key] = row.config_value;
      }
    }

    this.config = {
      maxRetriesRead: parseInt(configMap['MAX_RETRIES_READ'] || '2'),
      maxRetriesWrite: parseInt(configMap['MAX_RETRIES_WRITE'] || '0'),
      maxConcurrentRequests: parseInt(configMap['MAX_CONCURRENT_REQUESTS'] || '3'),
      minDelayBetweenRequestsMs: parseInt(configMap['MIN_DELAY_BETWEEN_REQUESTS_MS'] || '500'),
      reportPageDelayMs: parseInt(configMap['REPORT_PAGE_DELAY_MS'] || '1500'),
      verifyCacheMinutes: parseInt(configMap['VERIFY_CACHE_MINUTES'] || '10'),
      searchCacheMinutes: parseInt(configMap['SEARCH_CACHE_MINUTES'] || '10'),
      catalogCacheHours: parseInt(configMap['CATALOG_CACHE_HOURS'] || '24'),
      reportCacheMinutes: parseInt(configMap['REPORT_CACHE_MINUTES'] || '15'),
      timeoutSimpleMs: parseInt(configMap['TIMEOUT_SIMPLE_MS'] || '20000'),
      timeoutReportMs: parseInt(configMap['TIMEOUT_REPORT_MS'] || '45000'),
      timeoutMassiveMs: parseInt(configMap['TIMEOUT_MASSIVE_MS'] || '90000'),
      batchSize: parseInt(configMap['BATCH_SIZE'] || '50'),
      batchDelayMs: parseInt(configMap['BATCH_DELAY_MS'] || '2000'),
      maxPagesPerExecution: parseInt(configMap['MAX_PAGES_PER_EXECUTION'] || '20'),
      maxJobDurationMinutes: parseInt(configMap['MAX_JOB_DURATION_MINUTES'] || '5'),
      lockExpiryMinutes: parseInt(configMap['LOCK_EXPIRY_MINUTES'] || '10'),
      userCooldownMinutes: parseInt(configMap['USER_COOLDOWN_MINUTES'] || '2'),
    };

    return this.config;
  }

  /**
   * Initialize the SOAP client from sicas_config
   */
  async getSoapClient(): Promise<SicasSoapReportClient> {
    if (this.soapClient) return this.soapClient;

    const { data: config } = await this.supabase
      .from('sicas_config')
      .select('soap_endpoint, soap_username, soap_password')
      .limit(1)
      .maybeSingle();

    if (!config) {
      throw new Error('No se encontro configuracion SICAS. Configure las credenciales SOAP en sicas_config.');
    }

    this.soapClient = new SicasSoapReportClient({
      endpoint: config.soap_endpoint || 'https://www.sicasonline.com.mx/SICASOnline/WS_SICASOnline.asmx',
      username: config.soap_username,
      password: config.soap_password,
    });

    return this.soapClient;
  }

  /**
   * Check circuit breaker state
   */
  async checkCircuitBreaker(): Promise<CircuitBreakerState> {
    const { data } = await this.supabase.rpc('check_sicas_circuit_breaker');
    if (data) return data as CircuitBreakerState;
    return { is_open: false };
  }

  /**
   * Enforce minimum delay between requests
   */
  private async enforceRateLimit(): Promise<void> {
    const config = await this.getConfig();
    const now = Date.now();
    const elapsed = now - this.lastRequestAt;
    const minDelay = config.minDelayBetweenRequestsMs;

    if (elapsed < minDelay) {
      const waitMs = minDelay - elapsed;
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }

    this.lastRequestAt = Date.now();
  }

  /**
   * Check cache for a response
   */
  async getCachedResponse(cacheKey: string): Promise<any | null> {
    const { data } = await this.supabase
      .from('sicas_request_cache')
      .select('response_data')
      .eq('cache_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    return data?.response_data || null;
  }

  /**
   * Store response in cache
   */
  async setCachedResponse(cacheKey: string, module: string, operation: string, responseData: any, cacheMinutes: number): Promise<void> {
    const expiresAt = new Date(Date.now() + cacheMinutes * 60 * 1000).toISOString();

    await this.supabase
      .from('sicas_request_cache')
      .upsert({
        cache_key: cacheKey,
        module,
        operation,
        response_data: responseData,
        expires_at: expiresAt,
      }, { onConflict: 'cache_key' });
  }

  /**
   * Acquire a process lock
   */
  async acquireLock(lockType: string, lockKey: string, processType: string, userId?: string): Promise<{ acquired: boolean; lockId?: string; reason?: string }> {
    const config = await this.getConfig();

    const { data } = await this.supabase.rpc('acquire_sicas_lock', {
      p_lock_type: lockType,
      p_lock_key: lockKey,
      p_process_type: processType,
      p_user_id: userId || null,
      p_duration_minutes: config.lockExpiryMinutes,
    });

    if (data?.acquired) {
      return { acquired: true, lockId: data.lock_id };
    }

    return { acquired: false, reason: data?.reason || 'lock_active' };
  }

  /**
   * Release a process lock
   */
  async releaseLock(lockId: string): Promise<void> {
    await this.supabase.rpc('release_sicas_lock', { p_lock_id: lockId });
  }

  /**
   * Log an API call
   */
  async logCall(opts: {
    processType: string;
    module: string;
    method?: string;
    endpoint?: string;
    soapAction?: string;
    keyProcess?: string;
    keyCode?: string;
    tproc?: string;
    conditionsHash?: string;
    requestPreview?: string;
    responseStatus?: number;
    responseSuccess: boolean;
    responseMessage?: string;
    responseTimeMs?: number;
    retryCount?: number;
    wasCached?: boolean;
    wasRateLimited?: boolean;
    wasBlocked?: boolean;
    errorCode?: string;
    errorMessage?: string;
    userId?: string;
    deliveryId?: string;
  }): Promise<void> {
    try {
      await this.supabase
        .from('sicas_api_call_logs')
        .insert({
          process_type: opts.processType,
          module: opts.module,
          method: opts.method || 'SOAP',
          endpoint: opts.endpoint,
          soap_action: opts.soapAction,
          key_process: opts.keyProcess,
          key_code: opts.keyCode,
          tproc: opts.tproc,
          conditions_hash: opts.conditionsHash,
          request_preview_redacted: opts.requestPreview?.substring(0, 500),
          response_status: opts.responseStatus,
          response_success: opts.responseSuccess,
          response_message: opts.responseMessage?.substring(0, 500),
          response_time_ms: opts.responseTimeMs,
          retry_count: opts.retryCount || 0,
          was_cached: opts.wasCached || false,
          was_rate_limited: opts.wasRateLimited || false,
          was_blocked: opts.wasBlocked || false,
          error_code: opts.errorCode,
          error_message: opts.errorMessage?.substring(0, 1000),
          user_id: opts.userId || null,
          delivery_id: opts.deliveryId || null,
        });
    } catch (e) {
      console.error('[SicasRequestManager] Error logging call:', e);
    }
  }

  /**
   * Build a cache key from request parameters
   */
  buildCacheKey(module: string, operation: string, keyCode: string, filters?: FilterCondition[], page?: number): string {
    const filterStr = filters ? JSON.stringify(filters.map(f => `${f.fieldDb}:${f.values.join(',')}`)) : '';
    return `sicas:${module}:${operation}:${keyCode}:p${page || 1}:${filterStr}`;
  }

  /**
   * Get timeout for a specific operation type
   */
  async getTimeout(processType: ProcessType): Promise<number> {
    const config = await this.getConfig();
    switch (processType) {
      case 'sync':
      case 'hwcapture':
        return config.timeoutMassiveMs;
      case 'report':
        return config.timeoutReportMs;
      default:
        return config.timeoutSimpleMs;
    }
  }

  /**
   * Get max retries for an operation type
   */
  async getMaxRetries(operationType: OperationType): Promise<number> {
    const config = await this.getConfig();
    return operationType === 'read' ? config.maxRetriesRead : config.maxRetriesWrite;
  }

  /**
   * Get cache duration for a module/operation
   */
  async getCacheDuration(processType: ProcessType): Promise<number> {
    const config = await this.getConfig();
    switch (processType) {
      case 'verify':
        return config.verifyCacheMinutes;
      case 'search':
        return config.searchCacheMinutes;
      case 'catalog':
        return config.catalogCacheHours * 60;
      case 'report':
        return config.reportCacheMinutes;
      default:
        return 0;
    }
  }

  /**
   * Execute a SICAS SOAP report with full protection:
   * circuit breaker, rate limit, cache, retries, timeout, logging
   */
  async executeReport(reportOptions: SicasReportOptions, requestOptions: RequestOptions): Promise<SicasReportResponse> {
    const startTime = Date.now();
    const config = await this.getConfig();

    // 1. Check circuit breaker
    const cbState = await this.checkCircuitBreaker();
    if (cbState.is_open) {
      await this.logCall({
        processType: requestOptions.processType,
        module: requestOptions.module,
        keyCode: reportOptions.keyCode,
        responseSuccess: false,
        wasBlocked: true,
        errorMessage: `Circuit breaker activo: ${cbState.reason}`,
        userId: requestOptions.userId,
        deliveryId: requestOptions.deliveryId,
      });

      return {
        success: false,
        responseNbr: '0',
        message: `SICAS esta respondiendo con errores o lentitud. MOVI pauso temporalmente los procesos automaticos para evitar saturacion. Se reanudara automaticamente.`,
        records: [],
      };
    }

    // 2. Check cache (for read operations)
    if (requestOptions.operationType === 'read' && !requestOptions.skipCache) {
      const cacheMinutes = requestOptions.cacheMinutes || await this.getCacheDuration(requestOptions.processType);
      if (cacheMinutes > 0) {
        const cacheKey = this.buildCacheKey(
          requestOptions.module,
          requestOptions.processType,
          reportOptions.keyCode,
          reportOptions.filters,
          reportOptions.page
        );
        const cached = await this.getCachedResponse(cacheKey);
        if (cached) {
          await this.logCall({
            processType: requestOptions.processType,
            module: requestOptions.module,
            keyCode: reportOptions.keyCode,
            responseSuccess: true,
            wasCached: true,
            responseTimeMs: Date.now() - startTime,
            userId: requestOptions.userId,
          });
          return cached as SicasReportResponse;
        }
      }
    }

    // 3. Acquire lock if needed
    let lockId: string | undefined;
    if (!requestOptions.skipLock && requestOptions.lockKey) {
      const lockResult = await this.acquireLock(
        requestOptions.lockType || requestOptions.processType,
        requestOptions.lockKey,
        requestOptions.processType,
        requestOptions.userId
      );
      if (!lockResult.acquired) {
        await this.logCall({
          processType: requestOptions.processType,
          module: requestOptions.module,
          keyCode: reportOptions.keyCode,
          responseSuccess: false,
          wasBlocked: true,
          errorMessage: `Proceso bloqueado: ${lockResult.reason}`,
          userId: requestOptions.userId,
          deliveryId: requestOptions.deliveryId,
        });
        return {
          success: false,
          responseNbr: '0',
          message: 'Ya hay un proceso SICAS en curso. Espere a que termine antes de intentar nuevamente.',
          records: [],
        };
      }
      lockId = lockResult.lockId;
    }

    // 4. Execute with retries and backoff
    const maxRetries = await this.getMaxRetries(requestOptions.operationType);
    const timeoutMs = requestOptions.timeoutMs || await this.getTimeout(requestOptions.processType);
    let lastError: Error | null = null;
    let attempt = 0;

    try {
      const soapClient = await this.getSoapClient();

      while (attempt <= maxRetries) {
        try {
          // Rate limit
          await this.enforceRateLimit();

          // Execute with timeout
          const result = await this.executeWithTimeout(
            () => soapClient.executeReport(reportOptions),
            timeoutMs
          );

          // Success - log and cache
          const responseTimeMs = Date.now() - startTime;

          await this.logCall({
            processType: requestOptions.processType,
            module: requestOptions.module,
            method: 'SOAP',
            endpoint: 'ProcesarWS',
            soapAction: 'http://tempuri.org/ProcesarWS',
            keyProcess: 'REPORT',
            keyCode: reportOptions.keyCode,
            responseSuccess: result.success,
            responseMessage: result.message,
            responseTimeMs,
            retryCount: attempt,
            userId: requestOptions.userId,
            deliveryId: requestOptions.deliveryId,
          });

          if (result.success) {
            // Record success in circuit breaker
            await this.supabase.rpc('record_sicas_success');

            // Cache the response
            if (requestOptions.operationType === 'read' && !requestOptions.skipCache) {
              const cacheMinutes = requestOptions.cacheMinutes || await this.getCacheDuration(requestOptions.processType);
              if (cacheMinutes > 0) {
                const cacheKey = this.buildCacheKey(
                  requestOptions.module,
                  requestOptions.processType,
                  reportOptions.keyCode,
                  reportOptions.filters,
                  reportOptions.page
                );
                await this.setCachedResponse(cacheKey, requestOptions.module, requestOptions.processType, result, cacheMinutes);
              }
            }
          }

          return result;
        } catch (error) {
          lastError = error as Error;
          attempt++;

          const isTimeout = lastError.message.includes('timeout') || lastError.message.includes('Timeout');

          // Record error in circuit breaker
          await this.supabase.rpc('record_sicas_error', { p_is_timeout: isTimeout });

          // Log the failed attempt
          await this.logCall({
            processType: requestOptions.processType,
            module: requestOptions.module,
            keyCode: reportOptions.keyCode,
            responseSuccess: false,
            responseTimeMs: Date.now() - startTime,
            retryCount: attempt,
            errorMessage: lastError.message,
            errorCode: isTimeout ? 'TIMEOUT' : 'ERROR',
            userId: requestOptions.userId,
            deliveryId: requestOptions.deliveryId,
          });

          // If we have retries left, wait with backoff
          if (attempt <= maxRetries) {
            const backoffMs = BACKOFF_DELAYS[Math.min(attempt - 1, BACKOFF_DELAYS.length - 1)];
            console.log(`[SicasRequestManager] Retry ${attempt}/${maxRetries} in ${backoffMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
          }
        }
      }

      // All retries exhausted
      return {
        success: false,
        responseNbr: '0',
        message: lastError?.message || 'Error desconocido despues de reintentos',
        records: [],
      };
    } finally {
      // Release lock
      if (lockId) {
        await this.releaseLock(lockId);
      }
    }
  }

  /**
   * Execute a function with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error(`Timeout: la solicitud excedio ${timeoutMs}ms`));
          });
        }),
      ]);
      return result;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Execute paginated report with page delays and limits
   */
  async executePaginatedReport(
    reportOptions: Omit<SicasReportOptions, 'page'>,
    requestOptions: RequestOptions,
    onPage?: (records: any[], page: number) => Promise<void>
  ): Promise<{ totalRecords: number; totalPages: number; abortReason?: string }> {
    const config = await this.getConfig();
    const startTime = Date.now();
    const maxDurationMs = config.maxJobDurationMinutes * 60 * 1000;
    let totalRecords = 0;
    let currentPage = 1;

    while (currentPage <= config.maxPagesPerExecution) {
      // Check job duration limit
      if (Date.now() - startTime > maxDurationMs) {
        return { totalRecords, totalPages: currentPage - 1, abortReason: 'max_duration_exceeded' };
      }

      // Check circuit breaker before each page
      const cbState = await this.checkCircuitBreaker();
      if (cbState.is_open) {
        return { totalRecords, totalPages: currentPage - 1, abortReason: 'circuit_breaker_open' };
      }

      const result = await this.executeReport(
        { ...reportOptions, page: currentPage, itemsPerPage: reportOptions.itemsPerPage || config.batchSize },
        { ...requestOptions, skipCache: true }
      );

      if (!result.success) {
        return { totalRecords, totalPages: currentPage - 1, abortReason: result.message };
      }

      const records = result.records || [];
      totalRecords += records.length;

      if (onPage) {
        await onPage(records, currentPage);
      }

      // End of data
      if (records.length < (reportOptions.itemsPerPage || config.batchSize)) {
        return { totalRecords, totalPages: currentPage };
      }

      // Page delay
      if (config.reportPageDelayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, config.reportPageDelayMs));
      }

      currentPage++;
    }

    return { totalRecords, totalPages: currentPage - 1, abortReason: 'max_pages_reached' };
  }

  /**
   * Check if user is in cooldown period (too many manual retries)
   */
  async isUserInCooldown(userId: string, operation: string): Promise<{ inCooldown: boolean; remainingSeconds?: number }> {
    const config = await this.getConfig();
    const cooldownMinutes = config.userCooldownMinutes;
    const since = new Date(Date.now() - cooldownMinutes * 60 * 1000).toISOString();

    const { count } = await this.supabase
      .from('sicas_api_call_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('process_type', operation)
      .eq('was_cached', false)
      .gte('created_at', since);

    if ((count || 0) >= 3) {
      const { data: lastCall } = await this.supabase
        .from('sicas_api_call_logs')
        .select('created_at')
        .eq('user_id', userId)
        .eq('process_type', operation)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastCall) {
        const lastCallTime = new Date(lastCall.created_at).getTime();
        const cooldownEnds = lastCallTime + cooldownMinutes * 60 * 1000;
        const remaining = Math.ceil((cooldownEnds - Date.now()) / 1000);
        if (remaining > 0) {
          return { inCooldown: true, remainingSeconds: remaining };
        }
      }
    }

    return { inCooldown: false };
  }
}

/**
 * Create a SicasRequestManager instance
 */
export function createSicasRequestManager(supabase: SupabaseClient): SicasRequestManager {
  return new SicasRequestManager(supabase);
}
