import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Info } from 'lucide-react';

interface FiscalRegime {
  id: string;
  name: string;
  iva_trasladado: number;
  iva_retenido: number;
  isr: number;
}

interface PaymentFieldsProps {
  regimenFiscalId: string;
  banco: string;
  clabe: string;
  onChange: (field: 'regimen_fiscal_id' | 'banco' | 'clabe', value: string) => void;
  editable?: boolean;
}

export function PaymentFields({
  regimenFiscalId,
  banco,
  clabe,
  onChange,
  editable = true
}: PaymentFieldsProps) {
  const [regimenesFiscales, setRegimenesFiscales] = useState<FiscalRegime[]>([]);

  useEffect(() => {
    loadRegimenesFiscales();
  }, []);

  const loadRegimenesFiscales = async () => {
    try {
      const { data, error } = await supabase
        .from('commission_fiscal_regimes')
        .select('*')
        .order('name');

      if (error) throw error;
      setRegimenesFiscales(data || []);
    } catch (error) {
      console.error('Error loading fiscal regimes:', error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Información de Pago</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Régimen Fiscal
            </label>
            <select
              value={regimenFiscalId}
              onChange={(e) => onChange('regimen_fiscal_id', e.target.value)}
              disabled={!editable}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
            >
              <option value="">Seleccionar régimen</option>
              {regimenesFiscales.map((regimen) => (
                <option key={regimen.id} value={regimen.id}>
                  {regimen.name}
                </option>
              ))}
            </select>
            {regimenFiscalId && (
              <p className="text-xs text-slate-500 mt-1">
                {(() => {
                  const regimen = regimenesFiscales.find(r => r.id === regimenFiscalId);
                  if (!regimen) return '';
                  return `ISR: ${(regimen.isr * 100).toFixed(2)}% | IVA Ret: ${(regimen.iva_retenido * 100).toFixed(2)}%`;
                })()}
              </p>
            )}
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

        <div className="mt-4 flex items-start gap-2 sm:gap-3 bg-primary-50 border border-primary-200 rounded-lg p-3 sm:p-4">
          <Info className="w-4 h-4 sm:w-5 sm:h-5 text-primary-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm text-primary-900 leading-relaxed break-words">
              <span className="font-medium">Recuerda:</span> La actualización de tus datos de Información de pago tarda de 24 a 72 horas en verse reflejada y aplicada para futuros movimientos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
