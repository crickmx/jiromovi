import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { DollarSign, Plus, Calendar, FileSpreadsheet, CheckCircle, Clock, AlertCircle, Upload } from 'lucide-react';
import type { CommissionBatch } from '../lib/commissionTypes';
import { formatCurrency, formatDate } from '../lib/commissionUtils';

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
          <span className="flex items-center space-x-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
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
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-soft p-12 text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">
            Acceso Denegado
          </h2>
          <p className="text-neutral-600 mb-6">
            Solo los administradores pueden acceder a esta sección.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-semibold"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-soft border border-neutral-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-primary-600 mb-1 sm:mb-2">
              Comisiones
            </h1>
            <p className="text-sm sm:text-base text-neutral-600">
              Gestiona lotes de comisiones y pagos a agentes
            </p>
          </div>
          <button
            onClick={() => navigate('/comisiones/upload-nuevo')}
            className="flex items-center justify-center space-x-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white px-4 sm:px-5 py-3 rounded-xl hover:shadow-medium transition-all duration-200 hover:scale-105 font-semibold min-h-[44px] w-full sm:w-auto"
          >
            <Plus className="w-5 h-5" />
            <span>Cargar Archivo</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4 sm:mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 sm:flex-none px-4 py-2.5 rounded-lg font-semibold transition-colors min-h-[44px] text-sm sm:text-base ${
              filter === 'all'
                ? 'bg-primary-600 text-white'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilter('draft')}
            className={`flex-1 sm:flex-none px-4 py-2.5 rounded-lg font-semibold transition-colors min-h-[44px] text-sm sm:text-base ${
              filter === 'draft'
                ? 'bg-primary-600 text-white'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            Borradores
          </button>
          <button
            onClick={() => setFilter('closed')}
            className={`flex-1 sm:flex-none px-4 py-2.5 rounded-lg font-semibold transition-colors min-h-[44px] text-sm sm:text-base ${
              filter === 'closed'
                ? 'bg-primary-600 text-white'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            Cerrados
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredBatches.length === 0 ? (
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-soft border border-neutral-200 p-8 sm:p-12 text-center">
          <DollarSign className="w-12 h-12 sm:w-16 sm:h-16 text-neutral-300 mx-auto mb-3 sm:mb-4" />
          <h3 className="text-lg sm:text-xl font-semibold text-neutral-700 mb-2">
            No hay lotes de comisiones
          </h3>
          <p className="text-sm sm:text-base text-neutral-500 mb-4 sm:mb-6">
            Crea tu primer lote subiendo un archivo Excel
          </p>
          <button
            onClick={() => navigate('/comisiones/upload-nuevo')}
            className="inline-flex items-center justify-center space-x-2 bg-primary-600 text-white px-5 sm:px-6 py-3 rounded-xl hover:bg-primary-700 transition-colors font-semibold min-h-[44px] w-full sm:w-auto"
          >
            <Plus className="w-5 h-5" />
            <span>Cargar Archivo</span>
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-4">
          {filteredBatches.map(batch => (
            <div
              key={batch.id}
              className="bg-white rounded-xl sm:rounded-2xl shadow-soft border border-neutral-200 p-4 sm:p-6 hover:shadow-medium transition-all duration-200"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => navigate(`/comisiones/lote/${batch.id}`)}
                >
                  <div className="flex items-start space-x-2 sm:space-x-3 mb-3">
                    <FileSpreadsheet className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg sm:text-xl font-bold text-neutral-900 mb-2 break-words">
                        {batch.name}
                      </h3>
                      {getStatusBadge(batch.status)}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-neutral-600">
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-4 h-4 flex-shrink-0" />
                      <span className="font-medium">Periodo:</span>
                      <span className="truncate">{formatDate(batch.period_start || batch.date_from)} - {formatDate(batch.period_end || batch.date_to)}</span>
                    </span>
                    {batch.source_file && (
                      <span className="flex items-center space-x-1 min-w-0">
                        <FileSpreadsheet className="w-4 h-4 flex-shrink-0" />
                        <span className="font-medium">Archivo:</span>
                        <span className="truncate">{batch.source_file}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-100">
                  <div className="text-left sm:text-right text-xs sm:text-sm text-neutral-500">
                    <div className="font-medium">
                      Creado: {formatDate(batch.created_at)}
                    </div>
                    <div className="text-xs mt-1">
                      {new Date(batch.created_at).toLocaleTimeString('es-MX', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
