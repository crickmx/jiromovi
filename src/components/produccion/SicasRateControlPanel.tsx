import { useState, useEffect } from 'react';
import { Loader2, RefreshCw, ShieldAlert, Lock, Activity, Settings2, Unlock, RotateCcw } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  loadRateConfig,
  updateRateConfig,
  getRecentLogs,
  getActiveLocks,
  checkCircuitBreaker,
  adminReleaseStuckLocks,
  adminResetCircuitBreaker,
  type SicasRateConfig,
  type SicasApiCallLog,
  type ProcessLock,
  type CircuitBreakerState,
} from '../../lib/sicasRateControl';

export default function SicasRateControlPanel() {
  const [loading, setLoading] = useState(true);
  const [configs, setConfigs] = useState<SicasRateConfig[]>([]);
  const [logs, setLogs] = useState<SicasApiCallLog[]>([]);
  const [locks, setLocks] = useState<ProcessLock[]>([]);
  const [cbState, setCbState] = useState<CircuitBreakerState>({ is_open: false });
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [cfgs, recentLogs, activeLocks, circuitBreaker] = await Promise.all([
        loadRateConfig(),
        getRecentLogs(30),
        getActiveLocks(),
        checkCircuitBreaker(),
      ]);
      setConfigs(cfgs);
      setLogs(recentLogs);
      setLocks(activeLocks);
      setCbState(circuitBreaker);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveConfig(key: string) {
    setSaving(true);
    const ok = await updateRateConfig(key, editValue);
    if (ok) {
      setConfigs(prev => prev.map(c => c.config_key === key ? { ...c, config_value: editValue } : c));
      setEditingKey(null);
      setActionMessage({ type: 'success', text: `Configuracion "${key}" actualizada.` });
    } else {
      setActionMessage({ type: 'error', text: `Error al actualizar "${key}".` });
    }
    setSaving(false);
    setTimeout(() => setActionMessage(null), 3000);
  }

  async function handleReleaseLocks() {
    const count = await adminReleaseStuckLocks();
    setActionMessage({ type: 'success', text: `${count} lock(s) liberados.` });
    await loadAll();
    setTimeout(() => setActionMessage(null), 3000);
  }

  async function handleResetCircuitBreaker() {
    const ok = await adminResetCircuitBreaker();
    if (ok) {
      setActionMessage({ type: 'success', text: 'Circuit breaker reseteado. SICAS habilitado.' });
    } else {
      setActionMessage({ type: 'error', text: 'Error al resetear circuit breaker.' });
    }
    await loadAll();
    setTimeout(() => setActionMessage(null), 3000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const CONFIG_LABELS: Record<string, string> = {
    max_retries: 'Reintentos maximos',
    backoff_delay_1: 'Backoff 1er reintento (ms)',
    backoff_delay_2: 'Backoff 2do reintento (ms)',
    backoff_delay_3: 'Backoff 3er reintento (ms)',
    rate_limit_between_calls_ms: 'Pausa entre llamadas (ms)',
    rate_limit_between_pages_ms: 'Pausa entre paginas (ms)',
    timeout_simple_ms: 'Timeout simple (ms)',
    timeout_report_ms: 'Timeout reportes (ms)',
    timeout_massive_ms: 'Timeout masivo (ms)',
    circuit_breaker_error_threshold: 'Errores para abrir CB',
    circuit_breaker_timeout_threshold: 'Timeouts para abrir CB',
    circuit_breaker_window_minutes: 'Ventana CB (min)',
    circuit_breaker_pause_minutes: 'Pausa CB (min)',
    max_concurrent_calls: 'Llamadas concurrentes max',
    max_concurrent_massive: 'Syncs masivos concurrentes max',
    lock_expiry_minutes: 'Expiracion locks (min)',
    cache_ttl_verify_minutes: 'Cache verificacion (min)',
    cache_ttl_search_minutes: 'Cache busqueda (min)',
    cache_ttl_catalog_hours: 'Cache catalogos (h)',
    cache_ttl_report_minutes: 'Cache reportes (min)',
    user_cooldown_minutes: 'Cooldown usuario (min)',
    batch_size: 'Tamano de lote',
    batch_pause_ms: 'Pausa entre lotes (ms)',
    max_job_duration_minutes: 'Duracion max por job (min)',
  };

  return (
    <div className="space-y-6">
      {actionMessage && (
        <div className={`p-3 rounded-lg border text-sm ${
          actionMessage.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
        }`}>
          {actionMessage.text}
        </div>
      )}

      {/* Circuit Breaker Status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" />
              Circuit Breaker
            </CardTitle>
            <div className="flex items-center gap-2">
              {cbState.is_open ? (
                <Badge variant="destructive">ABIERTO - SICAS pausado</Badge>
              ) : (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">CERRADO - Normal</Badge>
              )}
              {cbState.is_open && (
                <Button size="sm" variant="outline" onClick={handleResetCircuitBreaker}>
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Resetear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        {cbState.is_open && (
          <CardContent className="pt-0">
            <div className="text-sm text-muted-foreground space-y-1">
              {cbState.reason && <p>Razon: {cbState.reason}</p>}
              {cbState.closes_at && <p>Se cierra automaticamente: {new Date(cbState.closes_at).toLocaleString('es-MX')}</p>}
              {cbState.error_count_5min !== undefined && <p>Errores (5 min): {cbState.error_count_5min}</p>}
              {cbState.timeout_count_5min !== undefined && <p>Timeouts (5 min): {cbState.timeout_count_5min}</p>}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Active Locks */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Locks Activos ({locks.length})
            </CardTitle>
            {locks.length > 0 && (
              <Button size="sm" variant="outline" onClick={handleReleaseLocks}>
                <Unlock className="w-3 h-3 mr-1" />
                Liberar todos
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {locks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay locks activos.</p>
          ) : (
            <div className="space-y-2">
              {locks.map(lock => (
                <div key={lock.id} className="flex items-center justify-between p-2 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800">
                  <div className="text-sm">
                    <span className="font-medium">{lock.lock_type}</span>
                    <span className="text-muted-foreground ml-2">{lock.lock_key}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Expira: {new Date(lock.expires_at).toLocaleTimeString('es-MX')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings2 className="w-4 h-4" />
              Configuracion de Limites
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={loadAll}>
              <RefreshCw className="w-3 h-3 mr-1" />
              Recargar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {configs.map(cfg => (
              <div key={cfg.config_key} className="flex items-center gap-2 p-2 rounded border border-border/50">
                <div className="flex-1 min-w-0">
                  <Label className="text-xs font-medium truncate block">
                    {CONFIG_LABELS[cfg.config_key] || cfg.config_key}
                  </Label>
                  {cfg.description && (
                    <p className="text-[10px] text-muted-foreground truncate">{cfg.description}</p>
                  )}
                </div>
                {editingKey === cfg.config_key ? (
                  <div className="flex items-center gap-1">
                    <Input
                      className="w-20 h-7 text-xs"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                    />
                    <Button size="sm" className="h-7 px-2 text-xs" disabled={saving} onClick={() => handleSaveConfig(cfg.config_key)}>
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'OK'}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditingKey(null)}>
                      X
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditingKey(cfg.config_key); setEditValue(cfg.config_value); }}
                    className="text-sm font-mono bg-muted/50 px-2 py-0.5 rounded hover:bg-muted transition-colors cursor-pointer"
                  >
                    {cfg.config_value}
                  </button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Logs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Ultimas llamadas SICAS ({logs.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay registros recientes.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-1">
              {logs.map(log => (
                <div key={log.id} className={`flex items-center justify-between p-2 rounded text-xs ${
                  log.response_success
                    ? 'bg-green-50/50 dark:bg-green-900/10'
                    : 'bg-red-50/50 dark:bg-red-900/10'
                }`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${log.response_success ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="font-medium truncate">{log.module}/{log.method}</span>
                    {log.was_cached && <Badge variant="secondary" className="text-[9px] px-1">cache</Badge>}
                    {log.was_rate_limited && <Badge variant="destructive" className="text-[9px] px-1">limited</Badge>}
                    {log.was_blocked && <Badge variant="destructive" className="text-[9px] px-1">blocked</Badge>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-muted-foreground">{log.response_time_ms}ms</span>
                    <span className="text-muted-foreground">
                      {new Date(log.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
