import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { DollarSign, Plus, Calendar, FileSpreadsheet, CheckCircle, Clock, AlertCircle } from 'lucide-react';
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
    <div className="space-y-6">
      <div className="bg-white rounded-3xl shadow-soft border border-neutral-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-display font-bold text-neutral-900 mb-2">
              Comisiones
            </h1>
            <p className="text-neutral-600">
              Gestiona lotes de comisiones y pagos a agentes
            </p>
          </div>
          <button
            onClick={() => navigate('/comisiones/upload')}
            className="flex items-center space-x-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white px-5 py-3 rounded-xl hover:shadow-medium transition-all duration-200 hover:scale-105 font-semibold"
          >
            <Plus className="w-5 h-5" />
            <span>Nuevo Lote</span>
          </button>
        </div>

        <div className="flex space-x-2 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              filter === 'all'
                ? 'bg-primary-600 text-white'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilter('draft')}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              filter === 'draft'
                ? 'bg-primary-600 text-white'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            Borradores
          </button>
          <button
            onClick={() => setFilter('closed')}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
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
        <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-12 text-center">
          <DollarSign className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-neutral-700 mb-2">
            No hay lotes de comisiones
          </h3>
          <p className="text-neutral-500 mb-6">
            Crea tu primer lote subiendo un archivo Excel
          </p>
          <button
            onClick={() => navigate('/comisiones/upload')}
            className="inline-flex items-center space-x-2 bg-primary-600 text-white px-6 py-3 rounded-xl hover:bg-primary-700 transition-colors font-semibold"
          >
            <Plus className="w-5 h-5" />
            <span>Subir Excel</span>
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredBatches.map(batch => (
            <div
              key={batch.id}
              onClick={() => navigate(`/comisiones/lote/${batch.id}`)}
              className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-6 hover:shadow-medium transition-all duration-200 cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <FileSpreadsheet className="w-6 h-6 text-primary-600" />
                    <h3 className="text-xl font-bold text-neutral-900">
                      {batch.name}
                    </h3>
                    {getStatusBadge(batch.status)}
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm text-neutral-600 mb-4">
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-4 h-4" />
                      <span className="font-medium">Periodo:</span>
                      <span>{formatDate(batch.date_from)} - {formatDate(batch.date_to)}</span>
                    </span>
                    {batch.source_file && (
                      <span className="flex items-center space-x-1">
                        <FileSpreadsheet className="w-4 h-4" />
                        <span className="font-medium">Archivo:</span>
                        <span>{batch.source_file}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right text-sm text-neutral-500">
                  <div>
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
          ))}
        </div>
      )}
    </div>
  );
}
