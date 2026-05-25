import { useEffect, useState } from 'react';
import { FileText, Search, Calendar, Building2 } from 'lucide-react';
import { useSeguwallet } from '../lib/SeguwalletContext';
import { getSeguwalletSicasClients } from '../lib/seguwalletAuth';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface Policy {
  id: string;
  poliza: string;
  aseguradora_nombre: string;
  ramo: string;
  cliente: string;
  vigencia_desde: string;
  vigencia_hasta: string;
  is_vigente: boolean;
  is_cancelada: boolean;
  prima_total: number | null;
  status_texto: string;
}

export function SeguwalletPolizas() {
  const { customer } = useSeguwallet();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [filtered, setFiltered] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [aseguradoraFilter, setAseguradoraFilter] = useState('all');
  const [aseguradoras, setAseguradoras] = useState<string[]>([]);

  useEffect(() => {
    if (!customer) return;
    loadPolicies();
  }, [customer]);

  useEffect(() => {
    applyFilters();
  }, [search, statusFilter, aseguradoraFilter, policies]);

  const loadPolicies = async () => {
    if (!customer) return;
    try {
      const clients = await getSeguwalletSicasClients(customer.id);
      if (clients.length === 0) {
        setPolicies([]);
        setLoading(false);
        return;
      }

      const clientIds = clients.map((c: any) => c.sicas_client_id);

      const { data } = await supabase
        .from('sicas_documents')
        .select('id, poliza, aseguradora_nombre, ramo, cliente, vigencia_desde, vigencia_hasta, is_vigente, is_cancelada, prima_total, status_texto')
        .in('desp_id', clientIds)
        .eq('is_poliza', true)
        .order('vigencia_hasta', { ascending: false })
        .limit(200);

      const pols = (data || []) as Policy[];
      setPolicies(pols);

      const uniqueAseg = [...new Set(pols.map(p => p.aseguradora_nombre).filter(Boolean))];
      setAseguradoras(uniqueAseg);
    } catch (err) {
      console.error('Error loading policies:', err);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let result = [...policies];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.poliza?.toLowerCase().includes(q) ||
        p.cliente?.toLowerCase().includes(q) ||
        p.aseguradora_nombre?.toLowerCase().includes(q) ||
        p.ramo?.toLowerCase().includes(q)
      );
    }

    if (statusFilter === 'vigente') {
      result = result.filter(p => p.is_vigente);
    } else if (statusFilter === 'vencida') {
      result = result.filter(p => !p.is_vigente && !p.is_cancelada);
    } else if (statusFilter === 'cancelada') {
      result = result.filter(p => p.is_cancelada);
    }

    if (aseguradoraFilter !== 'all') {
      result = result.filter(p => p.aseguradora_nombre === aseguradoraFilter);
    }

    setFiltered(result);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getStatusInfo = (policy: Policy) => {
    if (policy.is_cancelada) return { label: 'Cancelada', class: 'bg-neutral-100 text-neutral-600 border-neutral-200' };
    if (policy.is_vigente) return { label: 'Vigente', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    return { label: 'Vencida', class: 'bg-red-50 text-red-700 border-red-200' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-[3px] border-blue-200 border-t-[#1C37E0] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Mis Polizas</h1>
        <p className="text-sm text-neutral-500 mt-1">Consulta tus coberturas y vigencias</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-neutral-200/50 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por poliza, cliente, aseguradora..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">Todos los estatus</option>
            <option value="vigente">Vigente</option>
            <option value="vencida">Vencida</option>
            <option value="cancelada">Cancelada</option>
          </select>
          {aseguradoras.length > 1 && (
            <select
              value={aseguradoraFilter}
              onChange={(e) => setAseguradoraFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="all">Todas las aseguradoras</option>
              {aseguradoras.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Policies list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200/50 shadow-sm p-12 text-center">
          <FileText className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-neutral-500">
            {policies.length === 0 ? 'No tienes polizas asignadas' : 'No se encontraron resultados'}
          </p>
          <p className="text-xs text-neutral-400 mt-1">
            {policies.length === 0 ? 'Contacta a tu agente para mas informacion' : 'Intenta con otros filtros'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((policy) => {
            const status = getStatusInfo(policy);
            return (
              <div
                key={policy.id}
                className="bg-white rounded-2xl border border-neutral-200/50 shadow-sm p-5 hover:shadow-md hover:border-blue-100 transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <p className="font-bold text-neutral-900 text-sm">{policy.poliza || 'Sin numero'}</p>
                      <span className={cn("px-2 py-0.5 rounded-lg text-[10px] font-bold border", status.class)}>
                        {status.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
                      {policy.aseguradora_nombre && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {policy.aseguradora_nombre}
                        </span>
                      )}
                      {policy.ramo && (
                        <span className="text-neutral-400">{policy.ramo}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(policy.vigencia_desde)} — {formatDate(policy.vigencia_hasta)}
                      </span>
                    </div>
                    {policy.cliente && (
                      <p className="text-xs text-neutral-400 mt-1.5">{policy.cliente}</p>
                    )}
                  </div>
                  {policy.prima_total ? (
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-neutral-900">
                        ${policy.prima_total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-[10px] text-neutral-400">Prima total</p>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
