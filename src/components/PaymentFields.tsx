import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, X } from 'lucide-react';
import type { Database } from '../lib/database.types';

type EsquemaPago = Database['public']['Tables']['esquemas_pago']['Row'];

interface PaymentFieldsProps {
  esquemaPagoId: string;
  banco: string;
  clabe: string;
  onChange: (field: 'esquema_pago_id' | 'banco' | 'clabe', value: string) => void;
  editable?: boolean;
}

export function PaymentFields({
  esquemaPagoId,
  banco,
  clabe,
  onChange,
  editable = true
}: PaymentFieldsProps) {
  const [esquemasPago, setEsquemasPago] = useState<EsquemaPago[]>([]);
  const [showNewSchemeModal, setShowNewSchemeModal] = useState(false);
  const [newSchemeName, setNewSchemeName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadEsquemasPago();
  }, []);

  const loadEsquemasPago = async () => {
    try {
      const { data, error } = await supabase
        .from('esquemas_pago')
        .select('*')
        .eq('activo', true)
        .order('nombre');

      if (error) throw error;
      setEsquemasPago(data || []);
    } catch (error) {
      console.error('Error loading payment schemes:', error);
    }
  };

  const handleAddNewScheme = async () => {
    if (!newSchemeName.trim()) {
      alert('Por favor ingresa un nombre para el esquema de pago');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('esquemas_pago')
        .insert({ nombre: newSchemeName.trim() })
        .select()
        .single();

      if (error) throw error;

      await loadEsquemasPago();

      onChange('esquema_pago_id', data.id);
      setNewSchemeName('');
      setShowNewSchemeModal(false);
    } catch (error: any) {
      console.error('Error adding payment scheme:', error);
      alert('Error al agregar el esquema de pago: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Información de Pago</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Esquema de Pago
            </label>
            <div className="flex gap-2">
              <select
                value={esquemaPagoId}
                onChange={(e) => onChange('esquema_pago_id', e.target.value)}
                disabled={!editable}
                className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
              >
                <option value="">Seleccionar esquema</option>
                {esquemasPago.map((esquema) => (
                  <option key={esquema.id} value={esquema.id}>
                    {esquema.nombre}
                  </option>
                ))}
              </select>
              {editable && (
                <button
                  type="button"
                  onClick={() => setShowNewSchemeModal(true)}
                  className="px-3 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center"
                  title="Agregar nuevo esquema"
                >
                  <Plus className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Banco
            </label>
            <input
              type="text"
              value={banco}
              onChange={(e) => onChange('banco', e.target.value)}
              disabled={!editable}
              placeholder="Nombre del banco"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              CLABE
            </label>
            <input
              type="text"
              value={clabe}
              onChange={(e) => onChange('clabe', e.target.value)}
              disabled={!editable}
              placeholder="Número CLABE"
              maxLength={18}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      {showNewSchemeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-slate-900">
                Agregar Esquema de Pago
              </h3>
              <button
                onClick={() => {
                  setShowNewSchemeModal(false);
                  setNewSchemeName('');
                }}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nombre del Esquema *
                </label>
                <input
                  type="text"
                  value={newSchemeName}
                  onChange={(e) => setNewSchemeName(e.target.value)}
                  placeholder="Ej: Honorarios, Comisiones, etc."
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddNewScheme();
                    }
                  }}
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowNewSchemeModal(false);
                    setNewSchemeName('');
                  }}
                  className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddNewScheme}
                  disabled={loading || !newSchemeName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Agregando...' : 'Agregar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
