import { useState } from 'react';
import { X, DollarSign, AlertCircle } from 'lucide-react';
import type { CommissionDetail } from '../../lib/commissionTypes';
import { formatCurrency } from '../../lib/commissionUtils';
import { supabase } from '../../lib/supabase';

interface AjustarComisionModalProps {
  detail: CommissionDetail;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AjustarComisionModal({ detail, onClose, onSuccess }: AjustarComisionModalProps) {
  const currentNeta = detail.is_manual_adjusted
    ? detail.adjusted_commission_neta || 0
    : detail.commission_neta;

  const [newNeta, setNewNeta] = useState<string>(currentNeta.toString());
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const netaValue = parseFloat(newNeta);

    if (isNaN(netaValue) || netaValue < 0) {
      setError('Por favor ingresa una comisión neta válida');
      return;
    }

    if (!reason.trim()) {
      setError('Por favor proporciona un motivo para el ajuste');
      return;
    }

    if (netaValue === currentNeta) {
      setError('La comisión neta es la misma que la actual');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const { error: updateError } = await supabase
        .from('commission_details')
        .update({
          is_manual_adjusted: true,
          adjusted_commission_neta: netaValue,
          adjust_reason: reason,
          adjusted_by_user_id: user.id,
          adjusted_at: new Date().toISOString()
        })
        .eq('id', detail.id);

      if (updateError) throw updateError;

      onSuccess();
      onClose();

    } catch (err: any) {
      console.error('Error adjusting commission:', err);
      setError(err.message || 'Error al ajustar la comisión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-neutral-900">
            Ajustar Comisión
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-neutral-600" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="bg-neutral-50 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-neutral-900 mb-3">
              Información de la Póliza
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-neutral-600">Póliza:</span>
                <span className="ml-2 font-medium text-neutral-900">{detail.poliza}</span>
              </div>
              <div>
                <span className="text-neutral-600">Agente:</span>
                <span className="ml-2 font-medium text-neutral-900">{detail.agent?.name}</span>
              </div>
              <div>
                <span className="text-neutral-600">Ramo:</span>
                <span className="ml-2 font-medium text-neutral-900">{detail.ramo}</span>
              </div>
              <div>
                <span className="text-neutral-600">Aseguradora:</span>
                <span className="ml-2 font-medium text-neutral-900">{detail.aseguradora}</span>
              </div>
              <div>
                <span className="text-neutral-600">Oficina:</span>
                <span className="ml-2 font-medium text-neutral-900">
                  {detail.agent?.office?.name || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-neutral-600">Prima Neta:</span>
                <span className="ml-2 font-medium text-neutral-900">
                  {formatCurrency(detail.prima_base)}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-blue-900 mb-3">
              Comisión Actual
            </h3>
            <div className="flex justify-between items-center">
              <div className="text-blue-700">Comisión:</div>
              <div className="font-bold text-green-700 text-2xl">
                {formatCurrency(currentNeta)}
              </div>
            </div>
          </div>

          {detail.is_manual_adjusted && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <div className="font-semibold text-yellow-900 mb-2">
                Esta comisión ya fue ajustada manualmente
              </div>
              <p className="text-sm text-yellow-800 mb-2">
                <strong>Motivo anterior:</strong> {detail.adjust_reason}
              </p>
              {detail.adjusted_at && (
                <p className="text-xs text-yellow-700">
                  Ajustado el {new Date(detail.adjusted_at).toLocaleString('es-MX')}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-2">
              Nueva Comisión
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
              <input
                type="number"
                step="0.01"
                value={newNeta}
                onChange={(e) => setNewNeta(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-lg font-semibold"
                placeholder="0.00"
              />
            </div>
            <p className="text-xs text-neutral-600 mt-1">
              Ingresa el nuevo monto de comisión para esta póliza
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-2">
              Motivo del Ajuste <span className="text-red-600">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Explica por qué se está ajustando esta comisión..."
            />
          </div>

          <div className="flex items-center space-x-3 pt-4 border-t border-neutral-200">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-neutral-300 text-neutral-700 rounded-xl hover:bg-neutral-50 transition-colors font-semibold"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:shadow-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
            >
              {loading ? 'Guardando...' : 'Guardar Ajuste'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
