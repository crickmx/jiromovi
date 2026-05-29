import { useState, useEffect, useCallback } from 'react';
import { X, Search, Database, CheckCircle, Loader2, AlertCircle, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { UnifiedContacto } from '../../lib/contactosTypes';
import { getAgentSicasClients, searchSicasClientsAdmin } from '../../seguwallet/lib/seguwalletAuth';
import type { SicasClientResult } from '../../seguwallet/lib/seguwalletAuth';

interface AssignedClient {
  id: string;
  sicas_client_id: string;
  sicas_client_name: string;
  sicas_client_rfc: string;
}

interface AsignarSicasModalProps {
  contacto: UnifiedContacto;
  onClose: () => void;
  onSave: () => void;
}

export default function AsignarSicasModal({ contacto, onClose, onSave }: AsignarSicasModalProps) {
  const { usuario } = useAuth();
  const isAdmin = ['Administrador', 'Gerente'].includes(usuario?.rol || '');

  const [search, setSearch] = useState('');
  const [available, setAvailable] = useState<SicasClientResult[]>([]);
  const [assigned, setAssigned] = useState<AssignedClient[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [loadingAssigned, setLoadingAssigned] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'asignados' | 'buscar'>('asignados');

  const customerId = contacto.seguwallet_customer_id!;
  const agentId = contacto.seguwallet_agent_id || usuario?.id || '';

  const loadAssigned = useCallback(async () => {
    setLoadingAssigned(true);
    try {
      const { data, error } = await supabase
        .from('seguwallet_customer_sicas_clients')
        .select('id, sicas_client_id, sicas_client_name, sicas_client_rfc')
        .eq('seguwallet_customer_id', customerId)
        .order('sicas_client_name');
      if (error) throw error;
      setAssigned(data || []);
    } catch (err: any) {
      setError(err.message || 'Error al cargar clientes asignados.');
    } finally {
      setLoadingAssigned(false);
    }
  }, [customerId]);

  const loadAvailable = useCallback(async (q: string) => {
    setLoadingAvailable(true);
    try {
      const results = isAdmin
        ? await searchSicasClientsAdmin(q, 50)
        : await getAgentSicasClients(agentId, q, 50);
      setAvailable(results);
    } catch {
      setAvailable([]);
    } finally {
      setLoadingAvailable(false);
    }
  }, [isAdmin, agentId]);

  useEffect(() => {
    loadAssigned();
  }, [loadAssigned]);

  useEffect(() => {
    if (tab === 'buscar') {
      loadAvailable(search);
    }
  }, [tab, search, loadAvailable]);

  const isAssigned = (clientId: string) => assigned.some(a => a.sicas_client_id === clientId);

  const handleToggle = async (client: SicasClientResult) => {
    setToggling(client.sicas_client_id);
    setError('');
    try {
      if (isAssigned(client.sicas_client_id)) {
        const { error } = await supabase
          .from('seguwallet_customer_sicas_clients')
          .delete()
          .eq('seguwallet_customer_id', customerId)
          .eq('sicas_client_id', client.sicas_client_id);
        if (error) throw error;
        setAssigned(prev => prev.filter(a => a.sicas_client_id !== client.sicas_client_id));
      } else {
        const { data, error } = await supabase
          .from('seguwallet_customer_sicas_clients')
          .insert({
            seguwallet_customer_id: customerId,
            sicas_client_id: client.sicas_client_id,
            sicas_client_name: client.client_name,
            sicas_client_rfc: client.rfc || '',
            created_by: usuario?.id,
          })
          .select('id, sicas_client_id, sicas_client_name, sicas_client_rfc')
          .single();
        if (error) throw error;
        if (data) setAssigned(prev => [...prev, data]);
      }
    } catch (err: any) {
      setError(err.message || 'Error al actualizar asignacion.');
    } finally {
      setToggling(null);
    }
  };

  const handleRemoveAssigned = async (a: AssignedClient) => {
    setToggling(a.sicas_client_id);
    setError('');
    try {
      const { error } = await supabase
        .from('seguwallet_customer_sicas_clients')
        .delete()
        .eq('id', a.id);
      if (error) throw error;
      setAssigned(prev => prev.filter(x => x.id !== a.id));
    } catch (err: any) {
      setError(err.message || 'Error al quitar cliente.');
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-50 dark:bg-cyan-900/20 flex items-center justify-center">
              <Database className="h-4.5 w-4.5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <h2 className="font-semibold text-neutral-900 dark:text-white text-sm">Clientes SICAS</h2>
              <p className="text-xs text-neutral-500 dark:text-white/50 truncate max-w-[220px]">{contacto.nombre_completo}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-100 dark:border-neutral-800 px-5">
          {(['asignados', 'buscar'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition -mb-px ${
                tab === t
                  ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                  : 'border-transparent text-neutral-500 dark:text-white/50 hover:text-neutral-700 dark:hover:text-white/70'
              }`}
            >
              {t === 'asignados'
                ? `Asignados${assigned.length > 0 ? ` (${assigned.length})` : ''}`
                : 'Buscar y agregar'}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'asignados' && (
            loadingAssigned ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-neutral-300 dark:text-neutral-600" />
              </div>
            ) : assigned.length === 0 ? (
              <div className="text-center py-10">
                <Database className="h-9 w-9 text-neutral-200 dark:text-neutral-700 mx-auto mb-3" />
                <p className="text-sm font-medium text-neutral-600 dark:text-white/60">Sin clientes asignados</p>
                <p className="text-xs text-neutral-400 dark:text-white/40 mt-1">
                  Usa la pestana "Buscar y agregar" para asignar clientes SICAS a este usuario.
                </p>
                <button
                  onClick={() => setTab('buscar')}
                  className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-cyan-600 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-900/30 transition"
                >
                  <Search className="h-4 w-4" />
                  Buscar clientes
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {assigned.map(a => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-700 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center flex-shrink-0">
                        <Users className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{a.sicas_client_name}</p>
                        {a.sicas_client_rfc && (
                          <p className="text-xs text-neutral-400 dark:text-white/40">{a.sicas_client_rfc}</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveAssigned(a)}
                      disabled={toggling === a.sicas_client_id}
                      className="flex-shrink-0 ml-3 p-1.5 rounded-lg text-neutral-300 dark:text-neutral-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition opacity-0 group-hover:opacity-100 disabled:opacity-50"
                      title="Quitar"
                    >
                      {toggling === a.sicas_client_id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <X className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'buscar' && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar por nombre o RFC..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                  autoFocus
                />
              </div>

              {loadingAvailable ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-neutral-300 dark:text-neutral-600" />
                </div>
              ) : available.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-neutral-400 dark:text-white/40">
                    {search ? 'Sin resultados para esa busqueda.' : 'Escribe para buscar clientes.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {available.map(client => {
                    const assigned_ = isAssigned(client.sicas_client_id);
                    const busy = toggling === client.sicas_client_id;
                    return (
                      <button
                        key={client.sicas_client_id}
                        onClick={() => handleToggle(client)}
                        disabled={busy}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition ${
                          assigned_
                            ? 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800'
                            : 'bg-white dark:bg-neutral-800/50 border-neutral-100 dark:border-neutral-700 hover:border-cyan-200 dark:hover:border-cyan-800 hover:bg-cyan-50/30 dark:hover:bg-cyan-900/10'
                        } disabled:opacity-60`}
                      >
                        <div className="min-w-0">
                          <p className={`text-sm font-medium truncate ${assigned_ ? 'text-cyan-700 dark:text-cyan-400' : 'text-neutral-900 dark:text-white'}`}>
                            {client.client_name}
                          </p>
                          {client.rfc && (
                            <p className="text-xs text-neutral-400 dark:text-white/40">{client.rfc}</p>
                          )}
                          {client.poliza_count !== undefined && (
                            <p className="text-xs text-neutral-400 dark:text-white/40">{client.poliza_count} poliza{client.poliza_count !== 1 ? 's' : ''}</p>
                          )}
                        </div>
                        <div className="flex-shrink-0 ml-3">
                          {busy
                            ? <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
                            : assigned_
                              ? <CheckCircle className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                              : <div className="w-4 h-4 rounded-full border-2 border-neutral-200 dark:border-neutral-600" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-neutral-100 dark:border-neutral-800 flex justify-end gap-3">
          <button
            onClick={() => { onSave(); }}
            className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold transition shadow-sm"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
