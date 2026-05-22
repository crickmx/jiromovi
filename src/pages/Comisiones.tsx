import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { DollarSign, Plus, Calendar, FileSpreadsheet, CheckCircle, Clock, AlertCircle, Percent } from 'lucide-react';
import type { CommissionBatch } from '../lib/commissionTypes';
import { formatDate } from '../lib/commissionUtils';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';

export default function Comisiones() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [batches, setBatches] = useState<CommissionBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'draft' | 'closed'>('all');

  const isAdmin = usuario?.rol === 'Administrador';

  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('commission_batches')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading batches:', error);
    } else {
      setBatches(data || []);
    }

    setLoading(false);
  };

  const filteredBatches = batches.filter(batch => {
    if (filter === 'all') return true;
    return batch.status === filter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return (
          <span className="flex items-center space-x-1 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-semibold">
            <Clock className="w-4 h-4" />
            <span>Borrador</span>
          </span>
        );
      case 'confirmed':
        return (
          <span className="flex items-center space-x-1 px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-semibold">
            <AlertCircle className="w-4 h-4" />
            <span>Confirmado</span>
          </span>
        );
      case 'closed':
        return (
          <span className="flex items-center space-x-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
            <CheckCircle className="w-4 h-4" />
            <span>Cerrado</span>
          </span>
        );
      default:
        return null;
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-20">
        <EmptyState
          icon={AlertCircle}
          title="Acceso Denegado"
          description="Solo los administradores pueden acceder a esta seccion."
          action={{ label: 'Volver al Dashboard', onClick: () => navigate('/dashboard') }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Comisiones"
        description="Gestiona lotes de comisiones y pagos a agentes"
        icon={DollarSign}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/comisiones/regimen-fiscal')}>
              <Percent className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Regimen Fiscal</span>
            </Button>
            <Button size="sm" onClick={() => navigate('/comisiones/upload-nuevo')}>
              <Plus className="w-4 h-4 mr-1.5" />
              Cargar
            </Button>
          </div>
        }
      >
        {/* Filter Tabs */}
        <div className="flex gap-1 border-b border-neutral-200 dark:border-white/8">
          {([['all', 'Todos'], ['draft', 'Borradores'], ['closed', 'Cerrados']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
                filter === key
                  ? 'text-accent border-accent'
                  : 'text-neutral-500 dark:text-white/50 border-transparent hover:text-neutral-700 dark:hover:text-white/70'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </PageHeader>

      {loading ? (
        <LoadingState text="Cargando comisiones..." />
      ) : filteredBatches.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title="No hay lotes de comisiones"
          description="Crea tu primer lote subiendo un archivo Excel"
          action={{ label: 'Cargar Archivo', onClick: () => navigate('/comisiones/upload-nuevo') }}
        />
      ) : (
        <div className="grid gap-3">
          {filteredBatches.map(batch => (
            <div
              key={batch.id}
              onClick={() => navigate(`/comisiones/lote/${batch.id}`)}
              className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 p-4 sm:p-5 hover:border-neutral-300 dark:hover:border-white/15 hover:shadow-sm transition-all duration-200 cursor-pointer group"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-2">
                    <FileSpreadsheet className="w-4 h-4 text-accent flex-shrink-0" />
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                      {batch.name}
                    </h3>
                  </div>
                  {getStatusBadge(batch.status)}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 text-xs text-neutral-500 dark:text-white/40">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(batch.period_start || batch.date_from)} - {formatDate(batch.period_end || batch.date_to)}
                    </span>
                    {batch.source_file && (
                      <span className="truncate max-w-[200px]">{batch.source_file}</span>
                    )}
                  </div>
                </div>

                <div className="text-xs text-neutral-400 dark:text-white/30 flex-shrink-0">
                  {formatDate(batch.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
