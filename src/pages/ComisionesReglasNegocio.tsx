import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Plus, Edit2, AlertCircle, Settings, Trash2 } from 'lucide-react';
import type { CommissionBusinessRule, CommissionOffice } from '../lib/commissionTypes';

export default function ComisionesReglasNegocio() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [rules, setRules] = useState<CommissionBusinessRule[]>([]);
  const [offices, setOffices] = useState<CommissionOffice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<CommissionBusinessRule | null>(null);

  const isAdmin = usuario?.rol === 'Administrador';

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  const loadData = async () => {
    setLoading(true);

    const [rulesResult, officesResult] = await Promise.all([
      supabase
        .from('commission_business_rules')
        .select('*')
        .order('prioridad', { ascending: false }),
      supabase
        .from('commission_offices')
        .select('*')
        .order('name')
    ]);

    if (rulesResult.data) setRules(rulesResult.data);
    if (officesResult.data) setOffices(officesResult.data);

    setLoading(false);
  };

  const handleDelete = async (ruleId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta regla?')) return;

    const { error } = await supabase
      .from('commission_business_rules')
      .delete()
      .eq('id', ruleId);

    if (error) {
      alert('Error al eliminar la regla');
      console.error(error);
    } else {
      loadData();
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
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/comisiones')}
              className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-neutral-700" />
            </button>
            <div>
              <h1 className="text-3xl font-display font-bold text-neutral-900 mb-1">
                Reglas de Negocio
              </h1>
              <p className="text-neutral-600">
                Configura cómo se calculan las comisiones por ramo y aseguradora
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setEditingRule(null);
              setShowModal(true);
            }}
            className="flex items-center space-x-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white px-5 py-3 rounded-xl hover:shadow-medium transition-all duration-200 hover:scale-105 font-semibold"
          >
            <Plus className="w-5 h-5" />
            <span>Nueva Regla</span>
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : rules.length === 0 ? (
          <div className="bg-neutral-50 rounded-2xl p-12 text-center">
            <Settings className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-neutral-700 mb-2">
              No hay reglas configuradas
            </h3>
            <p className="text-neutral-500 mb-6">
              Crea tu primera regla para empezar a calcular comisiones
            </p>
            <button
              onClick={() => {
                setEditingRule(null);
                setShowModal(true);
              }}
              className="inline-flex items-center space-x-2 px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-semibold"
            >
              <Plus className="w-5 h-5" />
              <span>Crear Regla</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="text-left py-3 px-4 font-semibold text-neutral-700">Ramo</th>
                  <th className="text-left py-3 px-4 font-semibold text-neutral-700">Aseguradora</th>
                  <th className="text-left py-3 px-4 font-semibold text-neutral-700">Oficina</th>
                  <th className="text-left py-3 px-4 font-semibold text-neutral-700">Campo Base</th>
                  <th className="text-left py-3 px-4 font-semibold text-neutral-700">Tipo</th>
                  <th className="text-left py-3 px-4 font-semibold text-neutral-700">Valor</th>
                  <th className="text-center py-3 px-4 font-semibold text-neutral-700">Prioridad</th>
                  <th className="text-left py-3 px-4 font-semibold text-neutral-700">Vigencia</th>
                  <th className="text-center py-3 px-4 font-semibold text-neutral-700">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rules.map(rule => {
                  const office = offices.find(o => o.id === rule.office_id);
                  const isActive = !rule.valid_to || new Date(rule.valid_to) >= new Date();

                  return (
                    <tr key={rule.id} className={`border-b border-neutral-100 hover:bg-neutral-50 ${!isActive ? 'opacity-50' : ''}`}>
                      <td className="py-3 px-4 font-medium text-neutral-900">{rule.ramo}</td>
                      <td className="py-3 px-4 text-neutral-700">{rule.aseguradora}</td>
                      <td className="py-3 px-4 text-neutral-700">{office?.name || 'Todas'}</td>
                      <td className="py-3 px-4 text-neutral-700">{rule.campo_base}</td>
                      <td className="py-3 px-4 text-neutral-700">
                        {rule.tipo_calculo === '%_sobre_base' && '% sobre base'}
                        {rule.tipo_calculo === 'monto_fijo' && 'Monto fijo'}
                        {rule.tipo_calculo === '%_con_min_max' && '% con min/max'}
                      </td>
                      <td className="py-3 px-4 text-neutral-700">
                        {rule.tipo_calculo === '%_sobre_base' && `${rule.porcentaje}%`}
                        {rule.tipo_calculo === 'monto_fijo' && `$${rule.monto_fijo}`}
                        {rule.tipo_calculo === '%_con_min_max' && `${rule.porcentaje}% (${rule.minimo}-${rule.maximo})`}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-semibold">
                          {rule.prioridad}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-neutral-700 text-sm">
                        {new Date(rule.valid_from).toLocaleDateString('es-MX')}
                        {rule.valid_to && ` - ${new Date(rule.valid_to).toLocaleDateString('es-MX')}`}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => {
                              setEditingRule(rule);
                              setShowModal(true);
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(rule.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <ReglaModal
          rule={editingRule}
          offices={offices}
          onClose={() => {
            setShowModal(false);
            setEditingRule(null);
          }}
          onSuccess={() => {
            loadData();
            setShowModal(false);
            setEditingRule(null);
          }}
        />
      )}
    </div>
  );
}

interface ReglaModalProps {
  rule: CommissionBusinessRule | null;
  offices: CommissionOffice[];
  onClose: () => void;
  onSuccess: () => void;
}

function ReglaModal({ rule, offices, onClose, onSuccess }: ReglaModalProps) {
  const [formData, setFormData] = useState({
    ramo: rule?.ramo || '',
    aseguradora: rule?.aseguradora || '',
    office_id: rule?.office_id || '',
    campo_base: rule?.campo_base || 'PrimaNeta',
    tipo_calculo: rule?.tipo_calculo || '%_sobre_base',
    porcentaje: rule?.porcentaje?.toString() || '',
    monto_fijo: rule?.monto_fijo?.toString() || '',
    minimo: rule?.minimo?.toString() || '',
    maximo: rule?.maximo?.toString() || '',
    prioridad: rule?.prioridad?.toString() || '0',
    valid_from: rule?.valid_from || new Date().toISOString().split('T')[0],
    valid_to: rule?.valid_to || ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.ramo || !formData.aseguradora) {
      setError('Ramo y Aseguradora son obligatorios');
      return;
    }

    if (formData.tipo_calculo === '%_sobre_base' && !formData.porcentaje) {
      setError('El porcentaje es obligatorio para este tipo de cálculo');
      return;
    }

    if (formData.tipo_calculo === 'monto_fijo' && !formData.monto_fijo) {
      setError('El monto fijo es obligatorio para este tipo de cálculo');
      return;
    }

    if (formData.tipo_calculo === '%_con_min_max' && (!formData.porcentaje || !formData.minimo || !formData.maximo)) {
      setError('Porcentaje, mínimo y máximo son obligatorios para este tipo de cálculo');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const dataToSave: any = {
        ramo: formData.ramo,
        aseguradora: formData.aseguradora,
        office_id: formData.office_id || null,
        campo_base: formData.campo_base,
        tipo_calculo: formData.tipo_calculo,
        porcentaje: formData.porcentaje ? parseFloat(formData.porcentaje) : null,
        monto_fijo: formData.monto_fijo ? parseFloat(formData.monto_fijo) : null,
        minimo: formData.minimo ? parseFloat(formData.minimo) : null,
        maximo: formData.maximo ? parseFloat(formData.maximo) : null,
        prioridad: parseInt(formData.prioridad),
        valid_from: formData.valid_from,
        valid_to: formData.valid_to || null
      };

      if (rule) {
        const { error: updateError } = await supabase
          .from('commission_business_rules')
          .update(dataToSave)
          .eq('id', rule.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('commission_business_rules')
          .insert(dataToSave);

        if (insertError) throw insertError;
      }

      onSuccess();

    } catch (err: any) {
      console.error('Error saving rule:', err);
      setError(err.message || 'Error al guardar la regla');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4">
          <h2 className="text-2xl font-bold text-neutral-900">
            {rule ? 'Editar Regla' : 'Nueva Regla'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                Ramo <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={formData.ramo}
                onChange={(e) => setFormData({ ...formData, ramo: e.target.value })}
                className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Ej: Autos"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                Aseguradora <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={formData.aseguradora}
                onChange={(e) => setFormData({ ...formData, aseguradora: e.target.value })}
                className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Ej: GNP"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                Oficina
              </label>
              <select
                value={formData.office_id}
                onChange={(e) => setFormData({ ...formData, office_id: e.target.value })}
                className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Todas las oficinas</option>
                {offices.map(office => (
                  <option key={office.id} value={office.id}>{office.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                Campo Base
              </label>
              <input
                type="text"
                value={formData.campo_base}
                onChange={(e) => setFormData({ ...formData, campo_base: e.target.value })}
                className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="PrimaNeta"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-2">
              Tipo de Cálculo
            </label>
            <select
              value={formData.tipo_calculo}
              onChange={(e) => setFormData({ ...formData, tipo_calculo: e.target.value as any })}
              className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="%_sobre_base">Porcentaje sobre base</option>
              <option value="monto_fijo">Monto fijo</option>
              <option value="%_con_min_max">Porcentaje con mínimo y máximo</option>
            </select>
          </div>

          {formData.tipo_calculo === '%_sobre_base' && (
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                Porcentaje <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.porcentaje}
                onChange={(e) => setFormData({ ...formData, porcentaje: e.target.value })}
                className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Ej: 10"
              />
            </div>
          )}

          {formData.tipo_calculo === 'monto_fijo' && (
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                Monto Fijo <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.monto_fijo}
                onChange={(e) => setFormData({ ...formData, monto_fijo: e.target.value })}
                className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Ej: 500"
              />
            </div>
          )}

          {formData.tipo_calculo === '%_con_min_max' && (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  Porcentaje <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.porcentaje}
                  onChange={(e) => setFormData({ ...formData, porcentaje: e.target.value })}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="10"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  Mínimo <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.minimo}
                  onChange={(e) => setFormData({ ...formData, minimo: e.target.value })}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="100"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  Máximo <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.maximo}
                  onChange={(e) => setFormData({ ...formData, maximo: e.target.value })}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="5000"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                Prioridad
              </label>
              <input
                type="number"
                value={formData.prioridad}
                onChange={(e) => setFormData({ ...formData, prioridad: e.target.value })}
                className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                Válido Desde
              </label>
              <input
                type="date"
                value={formData.valid_from}
                onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                Válido Hasta
              </label>
              <input
                type="date"
                value={formData.valid_to}
                onChange={(e) => setFormData({ ...formData, valid_to: e.target.value })}
                className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          <div className="flex items-center space-x-3 pt-4 border-t border-neutral-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-neutral-300 text-neutral-700 rounded-xl hover:bg-neutral-50 transition-colors font-semibold"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:shadow-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
            >
              {loading ? 'Guardando...' : rule ? 'Guardar Cambios' : 'Crear Regla'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
