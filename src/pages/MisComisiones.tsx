import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { DollarSign, Download, FileText, Calendar, Loader2 } from 'lucide-react';
import type { CommissionBatch, CommissionDetail } from '../lib/commissionTypes';
import { calculateBatchSummary, formatCurrency, formatDate } from '../lib/commissionUtils';
import { generateOrdenDePagoPDF, downloadPDF } from '../lib/pdfUtils';
import GraficaColumnas from '../components/comisiones/GraficaColumnas';
import GraficaCircular from '../components/comisiones/GraficaCircular';

export default function MisComisiones() {
  const { usuario } = useAuth();
  const [batches, setBatches] = useState<CommissionBatch[]>([]);
  const [batchDetails, setBatchDetails] = useState<Map<string, CommissionDetail[]>>(new Map());
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPDF, setGeneratingPDF] = useState<string | null>(null);

  useEffect(() => {
    loadCommissions();
  }, [usuario]);

  const loadCommissions = async () => {
    if (!usuario) return;

    setLoading(true);

    const { data: authUser } = await supabase.auth.getUser();
    if (!authUser.user) return;

    const { data: agent } = await supabase
      .from('commission_agents')
      .select('id')
      .eq('email', authUser.user.email)
      .maybeSingle();

    if (!agent) {
      setLoading(false);
      return;
    }

    const { data: batchesData } = await supabase
      .from('commission_batches')
      .select('*')
      .eq('status', 'closed')
      .order('date_from', { ascending: false });

    if (batchesData) {
      setBatches(batchesData);

      const detailsMap = new Map<string, CommissionDetail[]>();

      for (const batch of batchesData) {
        const { data: details } = await supabase
          .from('commission_details')
          .select(`
            *,
            agent:agent_id(
              *,
              office:office_id(*),
              fiscal_regime:fiscal_regime_id(*),
              usuario:usuario_id(
                id,
                regimen_fiscal_id,
                regimen_fiscal:regimen_fiscal_id(*)
              )
            )
          `)
          .eq('batch_id', batch.id)
          .eq('agent_id', agent.id);

        if (details && details.length > 0) {
          detailsMap.set(batch.id, details);
        }
      }

      setBatchDetails(detailsMap);
    }

    setLoading(false);
  };

  const getBatchSummary = (batchId: string) => {
    const details = batchDetails.get(batchId);
    if (!details || details.length === 0) return null;
    return calculateBatchSummary(details);
  };

  const handleDownloadPDF = async (batchId: string) => {
    const batch = batches.find(b => b.id === batchId);
    const details = batchDetails.get(batchId);

    if (!batch || !details || details.length === 0) {
      alert('No hay datos para generar el PDF');
      return;
    }

    setGeneratingPDF(batchId);

    try {
      const pdfBlob = await generateOrdenDePagoPDF(details, batch);
      const fileName = `Orden_de_Pago_${batch.name.replace(/\s+/g, '_')}_${usuario?.nombre_completo?.replace(/\s+/g, '_')}.pdf`;
      downloadPDF(pdfBlob, fileName);
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      alert('Error al generar el PDF: ' + error.message);
    } finally {
      setGeneratingPDF(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const myBatches = batches.filter(batch => batchDetails.has(batch.id));

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl shadow-soft border border-neutral-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-display font-bold text-neutral-900 mb-2">
              Mis Comisiones
            </h1>
            <p className="text-neutral-600">
              Consulta tus comisiones pagadas y genera tus recibos
            </p>
          </div>
          <DollarSign className="w-12 h-12 text-primary-600" />
        </div>
      </div>

      {myBatches.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-12 text-center">
          <DollarSign className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-neutral-700 mb-2">
            No hay comisiones disponibles
          </h3>
          <p className="text-neutral-500">
            Tus comisiones aparecerán aquí una vez que sean procesadas y cerradas
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {myBatches.map(batch => {
            const summary = getBatchSummary(batch.id);
            const details = batchDetails.get(batch.id) || [];

            return (
              <div
                key={batch.id}
                className="bg-white rounded-2xl shadow-soft border border-neutral-200 overflow-hidden"
              >
                <div
                  onClick={() => setSelectedBatch(selectedBatch === batch.id ? null : batch.id)}
                  className="p-6 cursor-pointer hover:bg-neutral-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <FileText className="w-6 h-6 text-primary-600" />
                        <h3 className="text-xl font-bold text-neutral-900">
                          {batch.name}
                        </h3>
                      </div>

                      <div className="flex flex-wrap gap-4 text-sm text-neutral-600 mb-4">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4" />
                          <span className="font-medium">Periodo:</span>
                          <span>{formatDate(batch.date_from)} - {formatDate(batch.date_to)}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <FileText className="w-4 h-4" />
                          <span className="font-medium">Pólizas:</span>
                          <span>{details.length}</span>
                        </span>
                      </div>

                      {summary && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-neutral-50 rounded-lg p-3">
                            <div className="text-xs text-neutral-600 font-medium mb-1">Prima Neta</div>
                            <div className="text-lg font-bold text-neutral-900">
                              {formatCurrency(details.reduce((sum, d) => sum + d.prima_neta, 0))}
                            </div>
                          </div>
                          <div className="bg-green-50 rounded-lg p-3">
                            <div className="text-xs text-green-700 font-medium mb-1">Comisiones</div>
                            <div className="text-lg font-bold text-green-700">
                              {formatCurrency(summary.total_neta)}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadPDF(batch.id);
                      }}
                      disabled={generatingPDF === batch.id}
                      className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-semibold ml-4 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {generatingPDF === batch.id ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Generando...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-5 h-5" />
                          <span>PDF</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {selectedBatch === batch.id && summary && (
                  <div className="border-t border-neutral-200 p-6 bg-neutral-50">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                      <GraficaColumnas
                        title="Comisiones por Ramo"
                        data={Object.entries(summary.by_ramo).map(([ramo, data]) => ({
                          label: ramo,
                          value: data.neta
                        }))}
                        valueFormatter={(v) => formatCurrency(v)}
                      />

                      <GraficaCircular
                        title="Distribución por Aseguradora"
                        data={Object.entries(summary.by_aseguradora).map(([aseg, data]) => ({
                          label: aseg,
                          value: data.neta
                        }))}
                        valueFormatter={(v) => formatCurrency(v)}
                      />
                    </div>

                    <h4 className="text-lg font-bold text-neutral-900 mb-4">
                      Desglose por Ramo
                    </h4>

                    <div className="space-y-4 mb-6">
                      {Object.entries(summary.by_ramo).map(([ramo, data]) => (
                        <div key={ramo} className="bg-white rounded-lg p-4">
                          <div className="font-semibold text-neutral-900 mb-3">
                            {ramo} ({data.count} pólizas)
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="text-neutral-600 mb-1">Prima Neta</div>
                              <div className="font-bold text-neutral-900">
                                {formatCurrency(details.filter(d => d.ramo === ramo).reduce((sum, d) => sum + d.prima_neta, 0))}
                              </div>
                            </div>
                            <div>
                              <div className="text-neutral-600 mb-1">Comisiones</div>
                              <div className="font-bold text-green-700">{formatCurrency(data.neta)}</div>
                            </div>
                          </div>

                          <div className="mt-4 border-t border-neutral-100 pt-4">
                            <div className="text-sm font-medium text-neutral-700 mb-2">
                              Aseguradoras:
                            </div>
                            {Object.entries(summary.by_aseguradora)
                              .filter(([aseg]) => {
                                return details.some(d => d.ramo === ramo && d.aseguradora === aseg);
                              })
                              .map(([aseg, asegData]) => (
                                <div key={aseg} className="flex justify-between text-sm py-1">
                                  <span className="text-neutral-700">{aseg}</span>
                                  <span className="font-semibold text-green-700">{formatCurrency(asegData.neta)}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <h4 className="text-lg font-bold text-neutral-900 mb-4">
                      Detalle de Pólizas ({details.length})
                    </h4>

                    <div className="hidden md:block bg-white rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-neutral-100">
                          <tr>
                            <th className="text-left py-3 px-3 font-semibold text-neutral-700">Póliza</th>
                            <th className="text-left py-3 px-3 font-semibold text-neutral-700">Asegurado</th>
                            <th className="text-left py-3 px-3 font-semibold text-neutral-700">Ramo / Aseg.</th>
                            <th className="text-right py-3 px-3 font-semibold text-neutral-700">Prima Neta</th>
                            <th className="text-right py-3 px-3 font-semibold text-neutral-700">% / Comisión</th>
                          </tr>
                        </thead>
                        <tbody>
                          {details.map(detail => {
                            const commission = detail.is_manual_adjusted
                              ? detail.adjusted_commission_neta
                              : detail.commission_neta;

                            return (
                              <tr key={detail.id} className="border-b border-neutral-100">
                                <td className="py-3 px-3">
                                  <div className="font-medium text-neutral-900">{detail.poliza}</div>
                                  {detail.concepto && (
                                    <div className="text-xs text-neutral-500 mt-1">{detail.concepto}</div>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-neutral-700">{detail.nombre_asegurado || '-'}</td>
                                <td className="py-3 px-3">
                                  <div className="text-neutral-900 font-medium">{detail.ramo}</div>
                                  <div className="text-xs text-neutral-600">{detail.aseguradora}</div>
                                </td>
                                <td className="py-3 px-3 text-right">
                                  <div className="text-neutral-900 font-medium">{formatCurrency(detail.prima_neta)}</div>
                                  <div className="text-xs text-neutral-600">Base: {formatCurrency(detail.importe_base)}</div>
                                </td>
                                <td className="py-3 px-3 text-right">
                                  <div className="font-bold text-green-700">{formatCurrency(commission || 0)}</div>
                                  <div className="text-xs text-neutral-600">{detail.porcentaje_comision.toFixed(2)}%</div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="md:hidden space-y-3">
                      {details.map(detail => {
                        const commission = detail.is_manual_adjusted
                          ? detail.adjusted_commission_neta
                          : detail.commission_neta;

                        return (
                          <div key={detail.id} className="bg-white rounded-xl p-4 border border-neutral-200">
                            <div className="mb-3">
                              <div className="font-bold text-neutral-900 mb-1">{detail.poliza}</div>
                              <div className="text-sm text-neutral-700">{detail.nombre_asegurado || '-'}</div>
                              {detail.concepto && (
                                <div className="text-xs text-neutral-500 mt-1">{detail.concepto}</div>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-3 pb-3 border-b border-neutral-200">
                              <div>
                                <div className="text-xs text-neutral-600 mb-1">Ramo</div>
                                <div className="text-sm font-medium text-neutral-900">{detail.ramo}</div>
                              </div>
                              <div>
                                <div className="text-xs text-neutral-600 mb-1">Aseguradora</div>
                                <div className="text-sm font-medium text-neutral-900">{detail.aseguradora}</div>
                              </div>
                              <div>
                                <div className="text-xs text-neutral-600 mb-1">Prima Neta</div>
                                <div className="text-sm font-medium text-neutral-900">{formatCurrency(detail.prima_neta)}</div>
                              </div>
                              <div>
                                <div className="text-xs text-neutral-600 mb-1">Base Comisión</div>
                                <div className="text-sm font-medium text-neutral-900">{formatCurrency(detail.importe_base)}</div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-xs text-neutral-600 mb-1">Comisión ({detail.porcentaje_comision.toFixed(2)}%)</div>
                                <div className="text-xl font-bold text-green-700">{formatCurrency(commission || 0)}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
