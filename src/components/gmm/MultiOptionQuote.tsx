import { useState } from 'react';
import { Plus, Trash2, Copy, Calculator } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import type {
  QuoteInputMultiOption,
  QuoteOption,
  QuoteInputInsured,
  TariffTables,
  QuoteCalculationMultiResult
} from '../../lib/gmmTypes';

interface MultiOptionQuoteProps {
  tariffTables: TariffTables;
  insureds: QuoteInputInsured[];
  onInsuredsChange: (insureds: QuoteInputInsured[]) => void;
  onCalculate: (input: QuoteInputMultiOption) => void;
  result: QuoteCalculationMultiResult | null;
  calculating: boolean;
}

export function MultiOptionQuote({
  tariffTables,
  insureds,
  onInsuredsChange,
  onCalculate,
  result,
  calculating
}: MultiOptionQuoteProps) {
  const [options, setOptions] = useState<QuoteOption[]>([
    createDefaultOption(tariffTables),
    createDefaultOption(tariffTables),
  ]);

  function createDefaultOption(tables: TariffTables): QuoteOption {
    return {
      plan: {
        zona: 'ZONA 1',
        estado: tables.factor_estado[0]?.col_0 || '',
        nivel_hospitalario: tables.factor_nivel_hospitalario[0]?.col_0 || '',
        tabulador: tables.factor_tabulador[0]?.col_0 || '',
        suma_asegurada: tables.factor_suma_asegurada[0]?.col_0 || '',
        deducible: tables.factor_deducible[0]?.col_0 || '',
        coaseguro: tables.factor_coaseguro[0]?.col_0 || '',
        formas_pago: [tables.forma_pago[0]?.col_0 || 'ANUAL'],
        montos: {},
      },
      coberturas: {
        medicamentos_fuera: true,
        eliminacion_deducible_accidente: true,
        multiregion: true,
        vip: true,
        emergencia_medica_extranjero: true,
      }
    };
  }

  function addOption() {
    if (options.length >= 5) {
      alert('Máximo 5 opciones permitidas');
      return;
    }
    setOptions([...options, createDefaultOption(tariffTables)]);
  }

  function removeOption(index: number) {
    if (options.length <= 2) {
      alert('Mínimo 2 opciones requeridas para comparación');
      return;
    }
    setOptions(options.filter((_, i) => i !== index));
  }

  function duplicateOption(index: number) {
    if (options.length >= 5) {
      alert('Máximo 5 opciones permitidas');
      return;
    }
    const newOption = JSON.parse(JSON.stringify(options[index]));
    setOptions([...options, newOption]);
  }

  function updateOption(index: number, field: string, value: any) {
    const newOptions = [...options];
    if (field.startsWith('coberturas.')) {
      const coverageKey = field.split('.')[1];
      newOptions[index].coberturas[coverageKey] = value;
    } else {
      newOptions[index].plan[field] = value;
    }
    setOptions(newOptions);
  }

  function handleCalculate() {
    if (insureds.length === 0 || !insureds[0].nombre) {
      alert('Agregue al menos un asegurado');
      return;
    }

    const multiInput: QuoteInputMultiOption = {
      insureds,
      options
    };

    onCalculate(multiInput);
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">
          Cotización Comparativa
        </h3>
        <p className="text-sm text-blue-700">
          Configure múltiples opciones con diferentes parámetros para comparar resultados lado a lado.
        </p>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Asegurados</h3>
        {insureds.map((insured, idx) => (
          <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
            <div>
              <label className="block text-sm font-medium mb-1">Nombre</label>
              <input
                type="text"
                value={insured.nombre}
                onChange={(e) => {
                  const newInsureds = [...insureds];
                  newInsureds[idx].nombre = e.target.value;
                  onInsuredsChange(newInsureds);
                }}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Nombre completo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Edad</label>
              <input
                type="number"
                value={insured.edad}
                onChange={(e) => {
                  const newInsureds = [...insureds];
                  newInsureds[idx].edad = parseInt(e.target.value);
                  onInsuredsChange(newInsureds);
                }}
                className="w-full px-3 py-2 border rounded-lg"
                min="0"
                max="99"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Sexo</label>
              <select
                value={insured.sexo}
                onChange={(e) => {
                  const newInsureds = [...insureds];
                  newInsureds[idx].sexo = e.target.value as 'Hombre' | 'Mujer';
                  onInsuredsChange(newInsureds);
                }}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="Hombre">Hombre</option>
                <option value="Mujer">Mujer</option>
              </select>
            </div>
          </div>
        ))}
        <div className="flex gap-2 mt-4">
          <Button
            onClick={() => onInsuredsChange([...insureds, { nombre: '', sexo: 'Hombre', edad: 30 }])}
            variant="outline"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-1" />
            Agregar Asegurado
          </Button>
          {insureds.length > 1 && (
            <Button
              onClick={() => onInsuredsChange(insureds.slice(0, -1))}
              variant="outline"
              size="sm"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Eliminar Último
            </Button>
          )}
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Opciones a Comparar</h3>
        <Button onClick={addOption} variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Agregar Opción
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {options.map((option, idx) => (
          <Card key={idx} className="p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <Badge className="text-sm">Opción {String.fromCharCode(65 + idx)}</Badge>
              <div className="flex gap-1">
                <Button
                  onClick={() => duplicateOption(idx)}
                  variant="ghost"
                  size="sm"
                  title="Duplicar opción"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => removeOption(idx)}
                  variant="ghost"
                  size="sm"
                  disabled={options.length <= 2}
                  title="Eliminar opción"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Estado</label>
                <select
                  value={option.plan.estado}
                  onChange={(e) => updateOption(idx, 'estado', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  {tariffTables.factor_estado.map((row) => (
                    <option key={row.col_0} value={row.col_0}>{row.col_0}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Nivel Hospitalario</label>
                <select
                  value={option.plan.nivel_hospitalario}
                  onChange={(e) => updateOption(idx, 'nivel_hospitalario', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  {tariffTables.factor_nivel_hospitalario.map((row) => (
                    <option key={row.col_0} value={row.col_0}>{row.col_0}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Tabulador</label>
                <select
                  value={option.plan.tabulador}
                  onChange={(e) => updateOption(idx, 'tabulador', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  {tariffTables.factor_tabulador.map((row) => (
                    <option key={row.col_0} value={row.col_0}>{row.col_0}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Suma Asegurada</label>
                <select
                  value={option.plan.suma_asegurada}
                  onChange={(e) => updateOption(idx, 'suma_asegurada', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  {tariffTables.factor_suma_asegurada.map((row) => (
                    <option key={row.col_0} value={row.col_0}>{row.col_0}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Deducible</label>
                <select
                  value={option.plan.deducible}
                  onChange={(e) => updateOption(idx, 'deducible', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  {tariffTables.factor_deducible.map((row) => (
                    <option key={row.col_0} value={row.col_0}>{row.col_0}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Coaseguro</label>
                <select
                  value={option.plan.coaseguro}
                  onChange={(e) => updateOption(idx, 'coaseguro', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  {tariffTables.factor_coaseguro.map((row) => (
                    <option key={row.col_0} value={row.col_0}>
                      {(parseFloat(row.col_0) * 100).toFixed(0)}%
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Forma de Pago</label>
                <select
                  value={option.plan.formas_pago[0]}
                  onChange={(e) => updateOption(idx, 'formas_pago', [e.target.value])}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  {tariffTables.forma_pago.map((row) => (
                    <option key={row.col_0} value={row.col_0}>{row.col_0}</option>
                  ))}
                </select>
              </div>

              <div className="pt-2 border-t">
                <h4 className="text-sm font-semibold mb-3">Coberturas Adicionales</h4>
                <div className="space-y-2">
                  {[
                    { key: 'medicamentos_fuera', label: 'Medicamentos Fuera' },
                    { key: 'eliminacion_deducible_accidente', label: 'Sin Deducible en Accidente' },
                    { key: 'multiregion', label: 'Multirregión' },
                    { key: 'vip', label: 'VIP' },
                    { key: 'emergencia_medica_extranjero', label: 'Emergencia en Extranjero' }
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={option.coberturas[key]}
                        onChange={(e) => updateOption(idx, `coberturas.${key}`, e.target.checked)}
                        className="rounded"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {result?.options[idx] && (
                <div className="pt-4 border-t bg-gray-50 -mx-6 -mb-6 px-6 py-4 rounded-b-lg">
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">Total a Pagar</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {new Intl.NumberFormat('es-MX', {
                        style: 'currency',
                        currency: 'MXN',
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                      }).format(result.options[idx].totales.total_pagar)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Prima Neta: {new Intl.NumberFormat('es-MX', {
                        style: 'currency',
                        currency: 'MXN',
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                      }).format(result.options[idx].prima_neta_total)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      <div className="flex justify-center">
        <Button
          onClick={handleCalculate}
          disabled={calculating}
          size="lg"
          className="px-8"
        >
          <Calculator className="h-5 w-5 mr-2" />
          {calculating ? 'Calculando...' : 'Calcular Todas las Opciones'}
        </Button>
      </div>
    </div>
  );
}
