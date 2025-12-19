import { useState, useEffect } from 'react';
import { Calculator, Save, FileText, Plus, Trash2 } from 'lucide-react';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/ui/page-header';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { supabase } from '../lib/supabase';
import { calculateQuote, loadTariffTables } from '../lib/gmmCalculationEngine';
import type { QuoteInput, QuoteInputInsured, QuoteCalculationResult, TariffTables } from '../lib/gmmTypes';

export default function GMMCotizador() {
  const [tariffPackageId, setTariffPackageId] = useState<string>('');
  const [tariffTables, setTariffTables] = useState<TariffTables | null>(null);
  const [loading, setLoading] = useState(true);

  const [input, setInput] = useState<QuoteInput>({
    zona: '',
    estado: '',
    nivel_hospitalario: '',
    tabulador: '',
    suma_asegurada: '',
    deducible: '',
    coaseguro: '',
    forma_pago: '',
    insureds: [{ nombre: '', sexo: 'Hombre', edad: 30 }],
    coberturas: {},
    montos: {},
  });

  const [result, setResult] = useState<QuoteCalculationResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadActiveTariff();
  }, []);

  async function loadActiveTariff() {
    try {
      const { data: pkg, error: pkgError } = await supabase
        .from('tariff_packages')
        .select('id')
        .eq('status', 'active')
        .maybeSingle();

      if (pkgError) throw pkgError;
      if (!pkg) {
        alert('No hay tarifas activas. Contacta al administrador.');
        setLoading(false);
        return;
      }

      setTariffPackageId(pkg.id);

      const { data: tables, error: tablesError } = await supabase
        .from('tariff_tables')
        .select('*')
        .eq('tariff_package_id', pkg.id);

      if (tablesError) throw tablesError;

      const loaded = loadTariffTables(tables || []);
      setTariffTables(loaded);

      if (loaded.factor_estado.length > 0) {
        setInput(prev => ({ ...prev, estado: loaded.factor_estado[0].col_0 }));
      }
      if (loaded.factor_nivel_hospitalario.length > 0) {
        setInput(prev => ({ ...prev, nivel_hospitalario: loaded.factor_nivel_hospitalario[0].col_0 }));
      }
      if (loaded.factor_tabulador.length > 0) {
        setInput(prev => ({ ...prev, tabulador: loaded.factor_tabulador[0].col_0 }));
      }
      if (loaded.factor_suma_asegurada.length > 0) {
        setInput(prev => ({ ...prev, suma_asegurada: loaded.factor_suma_asegurada[0].col_0 }));
      }
      if (loaded.factor_deducible.length > 0) {
        setInput(prev => ({ ...prev, deducible: loaded.factor_deducible[0].col_0 }));
      }
      if (loaded.factor_coaseguro.length > 0) {
        setInput(prev => ({ ...prev, coaseguro: loaded.factor_coaseguro[0].col_0 }));
      }
      if (loaded.forma_pago.length > 0) {
        setInput(prev => ({ ...prev, forma_pago: loaded.forma_pago[0].col_0 }));
      }
    } catch (error) {
      console.error('Error loading tariff:', error);
      alert('Error al cargar tarifas');
    } finally {
      setLoading(false);
    }
  }

  function handleAddInsured() {
    if (input.insureds.length >= 8) {
      alert('Máximo 8 asegurados');
      return;
    }
    setInput(prev => ({
      ...prev,
      insureds: [...prev.insureds, { nombre: '', sexo: 'Hombre', edad: 30 }],
    }));
  }

  function handleRemoveInsured(index: number) {
    if (input.insureds.length === 1) {
      alert('Debe haber al menos un asegurado');
      return;
    }
    setInput(prev => ({
      ...prev,
      insureds: prev.insureds.filter((_, i) => i !== index),
    }));
  }

  function handleInsuredChange(index: number, field: keyof QuoteInputInsured, value: any) {
    setInput(prev => ({
      ...prev,
      insureds: prev.insureds.map((ins, i) =>
        i === index ? { ...ins, [field]: value } : ins
      ),
    }));
  }

  function handleCalculate() {
    if (!tariffTables) {
      alert('Tarifas no cargadas');
      return;
    }

    const valid = input.insureds.every(ins => ins.nombre.trim() && (ins.edad || ins.fecha_nacimiento));
    if (!valid) {
      alert('Complete todos los campos de asegurados');
      return;
    }

    setCalculating(true);
    try {
      const calculated = calculateQuote(input, tariffTables);
      setResult(calculated);
    } catch (error: any) {
      console.error('Error calculating:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setCalculating(false);
    }
  }

  async function handleSave() {
    if (!result) {
      alert('Calcule la cotización primero');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const { data: quote, error: quoteError } = await supabase
        .from('gmm_quotes')
        .insert({
          tariff_package_id: tariffPackageId,
          zona: input.zona || 'N/A',
          estado: input.estado,
          nivel_hospitalario: input.nivel_hospitalario,
          tabulador: input.tabulador,
          suma_asegurada: input.suma_asegurada,
          deducible: input.deducible,
          coaseguro: input.coaseguro,
          tope_coaseguro: result.tope_coaseguro,
          forma_pago: input.forma_pago,
          num_recibos: result.num_recibos,

          cob_reconocimiento_antiguedad: input.coberturas.reconocimiento_antiguedad || false,
          cob_medicamentos_fuera: input.coberturas.medicamentos_fuera || false,
          cob_complicaciones_no_amparadas: input.coberturas.complicaciones_no_amparadas || false,
          cob_padecimientos_preexistentes: input.coberturas.padecimientos_preexistentes || false,
          cob_eliminacion_deducible_accidente: input.coberturas.eliminacion_deducible_accidente || false,
          cob_multiregion: input.coberturas.multiregion || false,
          cob_vip: input.coberturas.vip || false,
          cob_emergencia_medica_extranjero: input.coberturas.emergencia_medica_extranjero || false,
          cob_enfermedades_graves_extranjero: input.coberturas.enfermedades_graves_extranjero || false,
          cob_cobertura_internacional: input.coberturas.cobertura_internacional || false,
          cob_ampliacion_servicios: input.coberturas.ampliacion_servicios || false,
          cob_ayuda_diaria: input.coberturas.ayuda_diaria || false,
          cob_indemnizacion_eg: input.coberturas.indemnizacion_eg || false,
          cob_maternidad: input.coberturas.maternidad || false,
          cob_xtensuz: input.coberturas.xtensuz || false,

          monto_maternidad: input.montos?.maternidad || null,
          monto_xtensuz: input.montos?.xtensuz || null,

          prima_neta_total: result.prima_neta_total,
          recargo: result.recargo,
          gastos_expedicion: result.gastos_expedicion,
          subtotal: result.subtotal,
          iva: result.iva,
          total: result.total,
          primer_recibo: result.primer_recibo,
          recibos_subsecuentes: result.recibos_subsecuentes,

          input_json: input,
          result_json: result,

          created_by: user.id,
        })
        .select()
        .single();

      if (quoteError) throw quoteError;

      const insuredsData = result.insureds.map((ins, idx) => ({
        quote_id: quote.id,
        orden: idx + 1,
        nombre: ins.nombre,
        sexo: ins.sexo,
        edad: ins.edad,
        fecha_nacimiento: input.insureds[idx].fecha_nacimiento || null,
        prima_base: ins.prima_base,
        prima_adicionales: ins.prima_adicionales,
        prima_xtensuz: ins.prima_xtensuz,
        prima_total: ins.prima_total,
        adicionales_json: ins.adicionales_detalle,
      }));

      const { error: insuredsError } = await supabase
        .from('gmm_quote_insureds')
        .insert(insuredsData);

      if (insuredsError) throw insuredsError;

      alert(`Cotización guardada: ${quote.quote_number}`);
    } catch (error: any) {
      console.error('Error saving:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">Cargando tarifas...</div>
        </div>
      </Layout>
    );
  }

  if (!tariffTables) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">No hay tarifas activas</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader
        title="Cotizador GMM BX+"
        subtitle="Cotiza pólizas de seguro de gastos médicos mayores"
      />

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Parámetros del Plan</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <select
                    value={input.estado}
                    onChange={(e) => setInput({ ...input, estado: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    {tariffTables.factor_estado.map((row) => (
                      <option key={row.col_0} value={row.col_0}>{row.col_0}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nivel Hospitalario</label>
                  <select
                    value={input.nivel_hospitalario}
                    onChange={(e) => setInput({ ...input, nivel_hospitalario: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    {tariffTables.factor_nivel_hospitalario.map((row) => (
                      <option key={row.col_0} value={row.col_0}>{row.col_0}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tabulador</label>
                  <select
                    value={input.tabulador}
                    onChange={(e) => setInput({ ...input, tabulador: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    {tariffTables.factor_tabulador.map((row) => (
                      <option key={row.col_0} value={row.col_0}>{row.col_0}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Suma Asegurada</label>
                  <select
                    value={input.suma_asegurada}
                    onChange={(e) => setInput({ ...input, suma_asegurada: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    {tariffTables.factor_suma_asegurada.map((row) => (
                      <option key={row.col_0} value={row.col_0}>{row.col_0}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deducible</label>
                  <select
                    value={input.deducible}
                    onChange={(e) => setInput({ ...input, deducible: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    {tariffTables.factor_deducible.map((row) => (
                      <option key={row.col_0} value={row.col_0}>{row.col_0}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Coaseguro</label>
                  <select
                    value={input.coaseguro}
                    onChange={(e) => setInput({ ...input, coaseguro: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    {tariffTables.factor_coaseguro.map((row) => (
                      <option key={row.col_0} value={row.col_0}>{row.col_0}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Forma de Pago</label>
                  <select
                    value={input.forma_pago}
                    onChange={(e) => setInput({ ...input, forma_pago: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    {tariffTables.forma_pago.map((row) => (
                      <option key={row.col_0} value={row.col_0}>{row.col_0}</option>
                    ))}
                  </select>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Asegurados</h3>
                <Button onClick={handleAddInsured} size="sm" variant="outline">
                  <Plus className="w-4 h-4 mr-1" />
                  Agregar
                </Button>
              </div>

              <div className="space-y-4">
                {input.insureds.map((insured, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-sm text-gray-700">Asegurado {idx + 1}</span>
                      {input.insureds.length > 1 && (
                        <button
                          onClick={() => handleRemoveInsured(idx)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <input
                          type="text"
                          placeholder="Nombre completo"
                          value={insured.nombre}
                          onChange={(e) => handleInsuredChange(idx, 'nombre', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      </div>
                      <select
                        value={insured.sexo}
                        onChange={(e) => handleInsuredChange(idx, 'sexo', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      >
                        <option value="Hombre">Hombre</option>
                        <option value="Mujer">Mujer</option>
                      </select>
                      <div>
                        <input
                          type="number"
                          placeholder="Edad"
                          value={insured.edad || ''}
                          onChange={(e) => handleInsuredChange(idx, 'edad', parseInt(e.target.value) || undefined)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="date"
                          value={insured.fecha_nacimiento || ''}
                          onChange={(e) => handleInsuredChange(idx, 'fecha_nacimiento', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Coberturas Opcionales</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'reconocimiento_antiguedad', label: 'Reconocimiento de Antigüedad' },
                  { key: 'medicamentos_fuera', label: 'Medicamentos Fuera de Hospital' },
                  { key: 'complicaciones_no_amparadas', label: 'Complicaciones No Amparadas' },
                  { key: 'padecimientos_preexistentes', label: 'Padecimientos Preexistentes' },
                  { key: 'eliminacion_deducible_accidente', label: 'Eliminación Deducible por Accidente' },
                  { key: 'multiregion', label: 'Multiregión' },
                  { key: 'vip', label: 'VIP' },
                  { key: 'emergencia_medica_extranjero', label: 'Emergencia Médica Extranjero' },
                  { key: 'enfermedades_graves_extranjero', label: 'Enfermedades Graves Extranjero' },
                  { key: 'cobertura_internacional', label: 'Cobertura Internacional' },
                  { key: 'ampliacion_servicios', label: 'Ampliación de Servicios' },
                  { key: 'ayuda_diaria', label: 'Ayuda Diaria' },
                  { key: 'indemnizacion_eg', label: 'Indemnización EG' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={input.coberturas[key as keyof typeof input.coberturas] || false}
                      onChange={(e) =>
                        setInput({
                          ...input,
                          coberturas: { ...input.coberturas, [key]: e.target.checked },
                        })
                      }
                      className="rounded"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </Card>

            <div className="flex gap-3">
              <Button onClick={handleCalculate} disabled={calculating} className="flex-1">
                <Calculator className="w-4 h-4 mr-2" />
                {calculating ? 'Calculando...' : 'Calcular'}
              </Button>
              {result && (
                <Button onClick={handleSave} disabled={saving} variant="outline" className="flex-1">
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Guardando...' : 'Guardar'}
                </Button>
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            {result && (
              <Card className="p-6 sticky top-6">
                <h3 className="text-lg font-semibold mb-4">Resumen</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Prima Neta</span>
                    <span className="font-medium">${result.prima_neta_total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Recargo</span>
                    <span className="font-medium">${result.recargo.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Gastos Expedición</span>
                    <span className="font-medium">${result.gastos_expedicion.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium">${result.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">IVA</span>
                    <span className="font-medium">${result.iva.toFixed(2)}</span>
                  </div>
                  <div className="border-t pt-3 flex justify-between">
                    <span className="font-semibold">TOTAL</span>
                    <span className="font-bold text-lg text-blue-600">${result.total.toFixed(2)}</span>
                  </div>

                  <div className="border-t pt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Primer Recibo</span>
                      <span className="font-medium">${result.primer_recibo.toFixed(2)}</span>
                    </div>
                    {result.num_recibos > 1 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Recibos Subsecuentes ({result.num_recibos - 1})</span>
                        <span className="font-medium">${result.recibos_subsecuentes.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-3 text-xs text-gray-500">
                    <div className="flex justify-between">
                      <span>Tope Coaseguro</span>
                      <span>${result.tope_coaseguro.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
