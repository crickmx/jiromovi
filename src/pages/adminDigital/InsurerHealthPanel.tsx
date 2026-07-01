import { useState, useEffect } from 'react';
import { Activity, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, Circle as XCircle, WifiOff, KeyRound, Clock, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface InsurerStatus {
  insurer_name: string;
  credential_status: string;
  endpoint_reachable: boolean;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_error: string | null;
  consecutive_failures: number;
  latency_ms: number;
  error_category: string;
  updated_at: string;
}

function getStatusColor(status: InsurerStatus): string {
  if (status.error_category === 'OK' && status.credential_status === 'valid') return 'emerald';
  if (status.error_category === 'DNS_UNREACHABLE') return 'gray';
  if (status.error_category === 'CREDENTIAL_ERROR') return 'amber';
  if (status.error_category === 'MISSING_AMIS') return 'orange';
  return 'red';
}

function getStatusIcon(status: InsurerStatus) {
  if (status.error_category === 'OK' && status.credential_status === 'valid') return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
  if (status.error_category === 'DNS_UNREACHABLE') return <WifiOff className="w-4 h-4 text-gray-400" />;
  if (status.error_category === 'CREDENTIAL_ERROR') return <KeyRound className="w-4 h-4 text-amber-500" />;
  if (status.error_category === 'MISSING_AMIS') return <AlertTriangle className="w-4 h-4 text-orange-500" />;
  return <XCircle className="w-4 h-4 text-red-500" />;
}

function getStatusLabel(status: InsurerStatus): string {
  if (status.error_category === 'OK' && status.credential_status === 'valid') return 'ONLINE';
  if (status.error_category === 'DNS_UNREACHABLE') return 'DNS';
  if (status.error_category === 'CREDENTIAL_ERROR') return 'CREDENCIALES';
  if (status.error_category === 'MISSING_AMIS') return 'SIN AMIS';
  if (status.error_category === 'TIMEOUT') return 'TIMEOUT';
  if (status.error_category === 'SOAP_FAULT') return 'WS ERROR';
  if (status.credential_status === 'unknown') return 'SIN VERIFICAR';
  return 'OFFLINE';
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Nunca';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Hace instantes';
  if (mins < 60) return `Hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  return `Hace ${Math.floor(hours / 24)}d`;
}

export function InsurerHealthPanel() {
  const [statuses, setStatuses] = useState<InsurerStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [hoveredInsurer, setHoveredInsurer] = useState<string | null>(null);

  const fetchStatuses = async () => {
    const { data } = await supabase
      .from('multi_autos_insurer_status')
      .select('*')
      .order('insurer_name');
    if (data) setStatuses(data as InsurerStatus[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchStatuses();
  }, []);

  if (loading) return null;

  const onlineCount = statuses.filter((s) => s.error_category === 'OK' && s.credential_status === 'valid').length;
  const totalCount = statuses.length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Estado de Integraciones</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {onlineCount}/{totalCount} aseguradoras conectadas
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {statuses.map((s) => (
            <div
              key={s.insurer_name}
              className={`w-2.5 h-2.5 rounded-full ${
                s.error_category === 'OK' && s.credential_status === 'valid'
                  ? 'bg-emerald-500'
                  : s.error_category === 'DNS_UNREACHABLE'
                  ? 'bg-gray-300 dark:bg-gray-600'
                  : s.error_category === 'CREDENTIAL_ERROR'
                  ? 'bg-amber-400'
                  : 'bg-red-400'
              }`}
            />
          ))}
          <RefreshCw
            className="w-4 h-4 text-gray-400 ml-2 cursor-pointer hover:text-blue-500 transition-colors"
            onClick={(e) => { e.stopPropagation(); fetchStatuses(); }}
          />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {statuses.map((s) => {
              const color = getStatusColor(s);
              return (
                <div
                  key={s.insurer_name}
                  className="relative group"
                  onMouseEnter={() => setHoveredInsurer(s.insurer_name)}
                  onMouseLeave={() => setHoveredInsurer(null)}
                >
                  <div className={`rounded-xl border p-3 transition-all ${
                    color === 'emerald' ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10' :
                    color === 'amber' ? 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10' :
                    color === 'orange' ? 'border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/10' :
                    color === 'gray' ? 'border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20' :
                    'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-900 dark:text-white truncate">{s.insurer_name}</span>
                      {getStatusIcon(s)}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        color === 'emerald' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' :
                        color === 'amber' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' :
                        color === 'orange' ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300' :
                        color === 'gray' ? 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400' :
                        'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                      }`}>
                        {getStatusLabel(s)}
                      </span>
                      {s.latency_ms > 0 && (
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-0.5">
                          <Clock className="w-3 h-3" />{s.latency_ms}ms
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1.5 truncate">
                      {s.last_success_at ? `OK: ${formatTimeAgo(s.last_success_at)}` : formatTimeAgo(s.updated_at)}
                    </p>
                  </div>

                  {hoveredInsurer === s.insurer_name && s.last_error && (
                    <div className="absolute z-50 bottom-full left-0 mb-2 w-72 p-3 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-xl shadow-xl pointer-events-none">
                      <p className="font-semibold mb-1">{s.insurer_name} - Ultimo error:</p>
                      <p className="text-gray-300 dark:text-gray-200 break-all leading-relaxed">{s.last_error}</p>
                      {s.last_failure_at && (
                        <p className="text-gray-400 mt-1.5 text-[10px]">{formatTimeAgo(s.last_failure_at)}</p>
                      )}
                      <div className="absolute bottom-0 left-6 translate-y-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
