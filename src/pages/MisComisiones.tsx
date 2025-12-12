import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { DollarSign, Download, FileText, Calendar, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
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
  const [expandedPolicies, setExpandedPolicies] = useState<Set<string>>(new Set());
  const [showAllPolicies, setShowAllPolicies] = useState<string | null>(null);
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
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-soft border border-neutral-200 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-neutral-900 mb-1 sm:mb-2">
              Mis Comisiones
            </h1>
            <p className="text-sm sm:text-base text-neutral-600">
              Consulta tus comisiones pagadas y genera tus recibos
            </p>
          </div>
          <DollarSign className="w-10 h-10 sm:w-12 sm:h-12 text-primary-600 flex-shrink-0" />
        </div>
      </div>

      {myBatches.length === 0 ? (
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-soft border border-neutral-200 p-8 sm:p-12 text-center">
          <DollarSign className="w-12 h-12 sm:w-16 sm:h-16 text-neutral-300 mx-auto mb-3 sm:mb-4" />
          <h3 className="text-lg sm:text-xl font-semibold text-neutral-700 mb-2">
            No hay comisiones disponibles
          </h3>
          <p className="text-sm sm:text-base text-neutral-500">
            Tus comisiones aparecerán aquí una vez que sean procesadas y cerradas
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-4">
          {myBatches.map(batch => {
            const summary = getBatchSummary(batch.id);
            const details = batchDetails.get(batch.id) || [];

            return (
              <div
                key={batch.id}
                className="bg-white rounded-xl sm:rounded-2xl shadow-soft border border-neutral-200 overflow-hidden"
              >
                <div
                  onClick={() => setSelectedBatch(selectedBatch === batch.id ? null : batch.id)}
                  className="p-4 sm:p-6 cursor-pointer hover:bg-neutral-50 transition-colors active:bg-neutral-100"
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex-1">
                      <div className="flex items-start space-x-2 sm:space-x-3 mb-3">
                        <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600 flex-shrink-0 mt-0.5" />
                        <h3 className="text-lg sm:text-xl font-bold text-neutral-900 break-words flex-1">
                          {batch.name}
                        </h3>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-neutral-600 mb-4">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4 flex-shrink-0" />
                          <span className="font-medium">Periodo:</span>
                          <span>{formatDate(batch.date_from)} - {formatDate(batch.date_to)}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <FileText className="w-4 h-4 flex-shrink-0" />
                          <span className="font-medium">Pólizas:</span>
                          <span>{details.length}</span>
                        </span>
                      </div>

                      {summary && (
                        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4">
                          <div className="bg-neutral-50 rounded-lg p-3">
                            <div className="text-xs text-neutral-600 font-medium mb-1">Prima Neta</div>
                            <div className="text-base sm:text-lg font-bold text-neutral-900 break-words">
                              {formatCurrency(details.reduce((sum, d) => sum + d.prima_neta, 0))}
                            </div>
                          </div>
                          <div className="bg-green-50 rounded-lg p-3">
                            <div className="text-xs text-green-700 font-medium mb-1">Comisiones</div>
                            <div className="text-base sm:text-lg font-bold text-green-700 break-words">
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
                      className="flex items-center justify-center space-x-2 px-4 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] w-full active:scale-[0.98]"
                    >
                      {generatingPDF === batch.id ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Generando PDF...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-5 h-5" />
                          <span>Descargar Orden de Pago (PDF)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {selectedBatch === batch.id && summary && (
                  <div className="border-t border-neutral-200 p-4 sm:p-6 bg-neutral-50">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
                      <GraficaColumnas
                        title="Comisiones por Ramo"
                        data={Object.entries(summary.by_ramo).map(([ramo, data]) => ({
                          label: ramo,
                          value: data.neta
                        }))}
                        valueFormatter={(v) => formatCurrency(v)}
                        height={220}
                      />

                      <GraficaCircular
                        title="Distribución por Aseguradora"
                        data={Object.entries(summary.by_aseguradora).map(([aseg, data]) => ({
                          label: aseg,
                          value: data.neta
                        }))}
                        valueFormatter={(v) => formatCurrency(v)}
                        size={200}
                      />
                    </div>

                    <h4 className="text-base sm:text-lg font-bold text-neutral-900 mb-3 sm:mb-4">
                      Desglose por Ramo
                    </h4>

                    <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
                      {Object.entries(summary.by_ramo).map(([ramo, data]) => (
                        <div key={ramo} className="bg-white rounded-lg p-3 sm:p-4">
                          <div className="text-sm sm:text-base font-semibold text-neutral-900 mb-2 sm:mb-3">
                            {ramo} ({data.count} pólizas)
                          </div>
                          <div className="grid grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                            <div>
                              <div className="text-neutral-600 mb-1">Prima Neta</div>
                              <div className="font-bold text-neutral-900 break-words">
                                {formatCurrency(details.filter(d => d.ramo === ramo).reduce((sum, d) => sum + d.prima_neta, 0))}
                              </div>
                            </div>
                            <div>
                              <div className="text-neutral-600 mb-1">Comisiones</div>
                              <div className="font-bold text-green-700 break-words">{formatCurrency(data.neta)}</div>
                            </div>
                          </div>

                          <div className="mt-3 sm:mt-4 border-t border-neutral-100 pt-3 sm:pt-4">
                            <div className="text-xs sm:text-sm font-medium text-neutral-700 mb-2">
                              Aseguradoras:
                            </div>
                            {Object.entries(summary.by_aseguradora)
                              .filter(([aseg]) => {
                                return details.some(d => d.ramo === ramo && d.aseguradora === aseg);
                              })
                              .map(([aseg, asegData]) => (
                                <div key={aseg} className="flex justify-between text-xs sm:text-sm py-1 gap-2">
                                  <span className="text-neutral-700 truncate">{aseg}</span>
                                  <span className="font-semibold text-green-700 flex-shrink-0">{formatCurrency(asegData.neta)}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-3 sm:mb-4">
                      <h4 className="text-base sm:text-lg font-bold text-neutral-900">
                        Detalle de Pólizas ({details.length})
                      </h4>
                      {details.length > 5 && (
                        <button
                          onClick={() => setShowAllPolicies(showAllPolicies === batch.id ? null : batch.id)}
                          className="text-xs sm:text-sm text-primary-600 hover:text-primary-700 font-semibold flex items-center space-x-1 self-start sm:self-auto min-h-[44px] sm:min-h-0"
                        >
                          {showAllPolicies === batch.id ? (
                            <>
                              <span>Mostrar menos</span>
                              <ChevronDown className="w-4 h-4" />
                            </>
                          ) : (
                            <>
                              <span>Mostrar todas</span>
                              <ChevronRight className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {(showAllPolicies === batch.id ? details : details.slice(0, 5)).map(detail => {
                        const commission = detail.is_manual_adjusted
                          ? detail.adjusted_commission_neta
                          : detail.commission_neta;
                        const isExpanded = expandedPolicies.has(detail.id);

                        return (
                          <div key={detail.id} className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
                            <div
                              onClick={() => {
                                const newExpanded = new Set(expandedPolicies);
                                if (isExpanded) {
                                  newExpanded.delete(detail.id);
                                } else {
                                  newExpanded.add(detail.id);
                                }
                                setExpandedPolicies(newExpanded);
                              }}
                              className="p-3 cursor-pointer hover:bg-neutral-50 transition-colors active:bg-neutral-100 min-h-[44px] flex items-center"
                            >
                              <div className="flex items-start justify-between w-full gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start space-x-2 mb-1">
                                    {isExpanded ? (
                                      <ChevronDown className="w-4 h-4 text-neutral-400 flex-shrink-0 mt-0.5" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4 text-neutral-400 flex-shrink-0 mt-0.5" />
                                    )}
                                    <div className="text-sm sm:text-base font-semibold text-neutral-900 break-words">{detail.poliza}</div>
                                  </div>
                                  <div className="ml-6 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-y-0.5 sm:gap-x-3 sm:gap-y-1 text-xs text-neutral-600">
                                    <span className="truncate">{detail.nombre_asegurado || 'Sin asegurado'}</span>
                                    <span className="hidden sm:inline text-neutral-400">•</span>
                                    <span className="truncate">{detail.ramo}</span>
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <div className="font-bold text-green-700 text-sm sm:text-base whitespace-nowrap">
                                    {formatCurrency(commission || 0)}
                                  </div>
                                  <div className="text-xs text-neutral-500">
                                    {detail.porcentaje_comision.toFixed(2)}%
                                  </div>
                                </div>
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="border-t border-neutral-200 p-3 bg-neutral-50">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs sm:text-sm">
                                  <div>
                                    <div className="text-xs text-neutral-600 mb-1">Aseguradora</div>
                                    <div className="font-medium text-neutral-900 break-words">{detail.aseguradora}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-neutral-600 mb-1">Prima Neta</div>
                                    <div className="font-medium text-neutral-900">{formatCurrency(detail.prima_neta)}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-neutral-600 mb-1">Base Comisión</div>
                                    <div className="font-medium text-neutral-900">{formatCurrency(detail.importe_base)}</div>
                                  </div>
                                  {detail.concepto && (
                                    <div className="col-span-1 sm:col-span-3">
                                      <div className="text-xs text-neutral-600 mb-1">Concepto</div>
                                      <div className="text-xs sm:text-sm text-neutral-700 break-words">{detail.concepto}</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
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
