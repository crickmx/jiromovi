import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { DollarSign, Download, FileText, Calendar, Loader2, ChevronDown, ChevronRight, TrendingUp, Shield, LifeBuoy } from 'lucide-react';
import type { CommissionBatch, CommissionDetail } from '../lib/commissionTypes';
import { calculateBatchSummary, formatCurrency, formatDate } from '../lib/commissionUtils';
import { generateOrdenDePagoPDF, downloadPDF } from '../lib/pdfUtils';
import { NuevoTramiteModal } from '../components/tramites/NuevoTramiteModal';
import GraficaColumnas from '../components/comisiones/GraficaColumnas';
import GraficaCircular from '../components/comisiones/GraficaCircular';
import { normalizarRegimenFiscal } from '../lib/commissionFiscalCalculations';

export default function MisComisiones() {
  const { usuario } = useAuth();
  const [batches, setBatches] = useState<CommissionBatch[]>([]);
  const [batchDetails, setBatchDetails] = useState<Map<string, CommissionDetail[]>>(new Map());
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [expandedPolicies, setExpandedPolicies] = useState<Set<string>>(new Set());
  const [showAllPolicies, setShowAllPolicies] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPDF, setGeneratingPDF] = useState<string | null>(null);
  const [showTramiteModal, setShowTramiteModal] = useState(false);
  const [selectedBatchForCorrection, setSelectedBatchForCorrection] = useState<CommissionBatch | null>(null);
  const [estatusList, setEstatusList] = useState<any[]>([]);
  const [desgloseFiscal, setDesgloseFiscal] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    loadCommissions();
    loadEstatus();
  }, [usuario]);

  const loadEstatus = async () => {
    const { data } = await supabase
      .from('ticket_estatus')
      .select('*')
      .eq('activo', true)
      .order('orden');

    if (data) setEstatusList(data);
  };

  const loadCommissions = async () => {
    if (!usuario) return;

    setLoading(true);

    const { data: authUser } = await supabase.auth.getUser();
    if (!authUser.user) return;

    const { data: agent } = await supabase
      .from('commission_agents')
      .select('id')
      .eq('usuario_id', authUser.user.id)
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

      const fiscalMap = new Map<string, any>();

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

          // Calcular desglose fiscal según el régimen actual del usuario
          const agentData = details[0].agent;
          const regimenFiscalName = agentData?.usuario?.regimen_fiscal?.name || agentData?.fiscal_regime?.name || 'HONORARIOS';
          const regimenFiscal = normalizarRegimenFiscal(regimenFiscalName);

          if (regimenFiscal === 'ASIMILADOS') {
            // Para ASIMILADOS, usar función de base de datos
            const { data: fiscal, error: fiscalError } = await supabase.rpc('calcular_desglose_fiscal_asimilados', {
              p_batch_id: batch.id,
              p_agent_id: agent.id
            });

            if (!fiscalError && fiscal) {
              fiscalMap.set(batch.id, fiscal);
            }
          } else {
            // ============================================================================
            // Para HONORARIOS y RESICO: Leer valores persistidos del batch
            // ============================================================================

            // Primero, leer valores persistidos del batch
            const { data: batchData } = await supabase
              .from('commission_batches')
              .select('commission_vida, commission_sinvida, iva, ret_isr, ret_iva, total_neto, retencion_contable, costo_dispersion, commission_total')
              .eq('id', batch.id)
              .maybeSingle();

            const totalComisionNeta = details.reduce((sum, d) =>
              sum + (d.is_manual_adjusted ? (d.adjusted_commission_neta || 0) : d.commission_neta), 0
            );

            let desglose: any;

            // Si hay datos persistidos, usarlos (NO recalcular)
            if (batchData && batchData.iva !== null && batchData.ret_isr !== null && batchData.ret_iva !== null && batchData.total_neto !== null) {
              desglose = {
                vida: batchData.commission_vida || 0,
                sinVida: batchData.commission_sinvida || 0,
                retContable: batchData.retencion_contable || 0,
                costoDispersion: batchData.costo_dispersion || 0,
                iva: batchData.iva || 0,
                retIsr: batchData.ret_isr || 0,
                retIva: batchData.ret_iva || 0,
                isrVida: 0,
                isrDanios: 0,
                isrTotal: 0,
                totalAPagar: batchData.total_neto || 0,
              };
              console.log(`[MisComisiones] Usando valores persistidos del batch ${batch.id}`);
            } else {
              // RECALCULAR AUTOMÁTICAMENTE si no hay datos persistidos
              console.warn(`[MisComisiones] Batch ${batch.id} no tiene datos fiscales. Recalculando...`);

              const { error: recalcError } = await supabase.rpc('calculate_batch_fiscal_aggregates', {
                p_batch_id: batch.id
              });

              if (recalcError) {
                console.error(`[MisComisiones] Error al recalcular:`, recalcError);
                // Usar valores por defecto si falla el recálculo
                desglose = {
                  vida: 0,
                  sinVida: totalComisionNeta,
                  retContable: 0,
                  costoDispersion: 0,
                  iva: 0,
                  retIsr: 0,
                  retIva: 0,
                  isrVida: 0,
                  isrDanios: 0,
                  isrTotal: 0,
                  totalAPagar: totalComisionNeta,
                };
              } else {
                // Recargar datos después de recálculo
                const { data: recalculatedData } = await supabase
                  .from('commission_batches')
                  .select('commission_vida, commission_sinvida, iva, ret_isr, ret_iva, total_neto, retencion_contable, costo_dispersion')
                  .eq('id', batch.id)
                  .maybeSingle();

                if (recalculatedData) {
                  desglose = {
                    vida: recalculatedData.commission_vida || 0,
                    sinVida: recalculatedData.commission_sinvida || 0,
                    retContable: recalculatedData.retencion_contable || 0,
                    costoDispersion: recalculatedData.costo_dispersion || 0,
                    iva: recalculatedData.iva || 0,
                    retIsr: recalculatedData.ret_isr || 0,
                    retIva: recalculatedData.ret_iva || 0,
                    isrVida: 0,
                    isrDanios: 0,
                    isrTotal: 0,
                    totalAPagar: recalculatedData.total_neto || 0,
                  };
                  console.log(`[MisComisiones] Valores recalculados para batch ${batch.id}`);
                } else {
                  // Si aún no hay datos, usar valores por defecto
                  desglose = {
                    vida: 0,
                    sinVida: totalComisionNeta,
                    retContable: 0,
                    costoDispersion: 0,
                    iva: 0,
                    retIsr: 0,
                    retIva: 0,
                    isrVida: 0,
                    isrDanios: 0,
                    isrTotal: 0,
                    totalAPagar: totalComisionNeta,
                  };
                }
              }
            }

            // Convertir al formato esperado por la UI
            fiscalMap.set(batch.id, {
              regimen: regimenFiscalName,
              total_comision: totalComisionNeta.toString(),
              vida: desglose.vida.toString(),
              sin_vida: desglose.sinVida.toString(),
              ret_contable: desglose.retContable.toString(),
              dispersion: desglose.costoDispersion.toString(),
              iva: desglose.iva.toString(),
              ret_isr: desglose.retIsr.toString(),
              ret_iva: desglose.retIva.toString(),
              isr_total: desglose.isrTotal.toString(),
              total_pagar: desglose.totalAPagar.toString()
            });
          }
        }
      }

      setBatchDetails(detailsMap);
      setDesgloseFiscal(fiscalMap);
    }

    setLoading(false);
  };

  const handleSolicitarCorreccion = (e: React.MouseEvent, batch: CommissionBatch) => {
    e.stopPropagation();
    setSelectedBatchForCorrection(batch);
    setShowTramiteModal(true);
  };

  const handleTramiteSuccess = () => {
    setShowTramiteModal(false);
    setSelectedBatchForCorrection(null);
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
      // Validar que el batch tenga valores fiscales antes de generar PDF
      const { data: batchCheck } = await supabase
        .from('commission_batches')
        .select('calculated_at, iva, ret_isr, ret_iva, total_neto')
        .eq('id', batch.id)
        .single();

      if (!batchCheck?.calculated_at || batchCheck.iva === null || batchCheck.ret_isr === null) {
        // Intentar recalcular antes de generar PDF
        console.log('[MisComisiones] PDF: Valores fiscales faltantes, recalculando...');
        const { data: recalcResult, error: recalcError } = await supabase.rpc('calculate_batch_fiscal_aggregates', {
          p_batch_id: batch.id
        });

        if (recalcError) {
          alert('Error al recalcular valores fiscales:\n\n' + recalcError.message + '\n\nContacta al administrador.');
          setGeneratingPDF(null);
          return;
        }

        // Verificar resultado del recálculo
        if (recalcResult?.skipped) {
          alert('No se puede generar el PDF automáticamente.\n\n' +
                'Motivo: ' + recalcResult.reason + '\n\n' +
                'Por favor, contacta al administrador para recalcular este lote manualmente.');
          setGeneratingPDF(null);
          return;
        }

        if (!recalcResult?.success) {
          alert('Error al recalcular valores fiscales.\n\n' +
                (recalcResult?.error || 'Error desconocido') + '\n\n' +
                'Contacta al administrador.');
          setGeneratingPDF(null);
          return;
        }

        console.log('[MisComisiones] PDF: Recálculo exitoso:', recalcResult);

        // Recargar el batch actualizado de BD
        const { data: updatedBatch, error: reloadError } = await supabase
          .from('commission_batches')
          .select('*')
          .eq('id', batch.id)
          .single();

        if (reloadError || !updatedBatch) {
          alert('Error al recargar datos del lote.\n\nIntenta de nuevo.');
          setGeneratingPDF(null);
          return;
        }

        // Usar el batch actualizado para generar PDF
        const pdfBlob = await generateOrdenDePagoPDF(details, updatedBatch);
        const fileName = `Orden_de_Pago_${updatedBatch.name.replace(/\s+/g, '_')}_${usuario?.nombre_completo?.replace(/\s+/g, '_')}.pdf`;
        downloadPDF(pdfBlob, fileName);

        // Recargar toda la vista para actualizar UI
        await loadCommissions();

        return; // Salir aquí para evitar generar PDF dos veces
      }

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
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-primary-600 mb-1 sm:mb-2">
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
                className="bg-white rounded-xl sm:rounded-2xl shadow-soft border border-neutral-200 overflow-hidden hover:shadow-medium transition-shadow"
              >
                <div className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <div
                      onClick={() => setSelectedBatch(selectedBatch === batch.id ? null : batch.id)}
                      className="flex-1 cursor-pointer"
                    >
                      <div className="flex items-start space-x-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base sm:text-lg font-bold text-neutral-900 break-words mb-1">
                            {batch.name}
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-neutral-500">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{formatDate(batch.period_start || batch.date_from)} - {formatDate(batch.period_end || batch.date_to)}</span>
                          </div>
                        </div>
                      </div>

                      {summary && (
                        <div className="grid grid-cols-3 gap-2 sm:gap-3">
                          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-2.5">
                            <div className="text-[10px] sm:text-xs text-primary-700 font-medium mb-0.5">Pólizas</div>
                            <div className="text-sm sm:text-base font-bold text-primary-900">{details.length}</div>
                          </div>
                          <div className="bg-gradient-to-br from-neutral-50 to-neutral-100 rounded-lg p-2.5">
                            <div className="text-[10px] sm:text-xs text-neutral-600 font-medium mb-0.5">Prima Neta</div>
                            <div className="text-xs sm:text-sm font-bold text-neutral-900 break-words">
                              {formatCurrency(details.reduce((sum, d) => sum + d.prima_neta, 0))}
                            </div>
                          </div>
                          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-2.5">
                            <div className="text-[10px] sm:text-xs text-green-700 font-medium mb-0.5">Comisiones</div>
                            <div className="text-xs sm:text-sm font-bold text-green-700 break-words">
                              {formatCurrency(summary.total_neta)}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-row sm:flex-col gap-2 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadPDF(batch.id);
                        }}
                        disabled={generatingPDF === batch.id}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm whitespace-nowrap"
                      >
                        {generatingPDF === batch.id ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                            <span className="hidden sm:inline">Generando...</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span>PDF</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={(e) => handleSolicitarCorreccion(e, batch)}
                        title="Solicitar corrección"
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-100 hover:border-orange-300 transition-all font-medium text-xs sm:text-sm whitespace-nowrap group"
                      >
                        <LifeBuoy className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:scale-110 transition-transform" />
                        <span>Corrección</span>
                      </button>
                    </div>
                  </div>
                </div>

                {selectedBatch === batch.id && summary && (
                  <div className="border-t border-neutral-200 p-4 sm:p-6 bg-neutral-50">
                    {/* 1. GRÁFICAS */}
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

                    {/* 2. DESGLOSE POR RAMO */}
                    <div className="flex items-center gap-2 mb-3 sm:mb-4">
                      <TrendingUp className="w-5 h-5 text-primary-600" />
                      <h4 className="text-base sm:text-lg font-bold text-neutral-900">
                        Desglose por Ramo
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 sm:mb-6">
                      {Object.entries(summary.by_ramo).map(([ramo, data]) => {
                        const primaNeta = details.filter(d => d.ramo === ramo).reduce((sum, d) => sum + d.prima_neta, 0);
                        const porcentaje = summary.total_neta > 0 ? (data.neta / summary.total_neta) * 100 : 0;

                        return (
                          <div key={ramo} className="bg-gradient-to-br from-white to-neutral-50 rounded-lg border border-neutral-200 p-3 hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1 min-w-0">
                                <h5 className="text-sm font-bold text-neutral-900 truncate">{ramo}</h5>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800 mt-1">
                                  {data.count} {data.count === 1 ? 'póliza' : 'pólizas'}
                                </span>
                              </div>
                              <div className="flex-shrink-0 text-right ml-2">
                                <div className="text-lg font-bold text-green-700">{formatCurrency(data.neta)}</div>
                                <div className="text-xs text-neutral-500">{porcentaje.toFixed(1)}%</div>
                              </div>
                            </div>

                            <div className="w-full bg-neutral-200 rounded-full h-1.5 mb-2">
                              <div
                                className="bg-gradient-to-r from-green-500 to-green-600 h-1.5 rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(porcentaje, 100)}%` }}
                              ></div>
                            </div>

                            <div className="flex items-center justify-between text-xs text-neutral-600 mb-2">
                              <span>Prima Neta</span>
                              <span className="font-semibold text-neutral-900">{formatCurrency(primaNeta)}</span>
                            </div>

                            <div className="pt-2 border-t border-neutral-200">
                              <div className="flex items-center gap-1 mb-1.5">
                                <Shield className="w-3 h-3 text-neutral-500" />
                                <span className="text-xs font-medium text-neutral-600">Aseguradoras:</span>
                              </div>
                              <div className="space-y-0.5">
                                {Object.entries(summary.by_aseguradora)
                                  .filter(([aseg]) => details.some(d => d.ramo === ramo && d.aseguradora === aseg))
                                  .slice(0, 3)
                                  .map(([aseg, asegData]) => (
                                    <div key={aseg} className="flex items-center justify-between text-xs gap-2">
                                      <span className="text-neutral-700 truncate flex-1">{aseg}</span>
                                      <span className="font-semibold text-green-700 flex-shrink-0">{formatCurrency(asegData.neta)}</span>
                                    </div>
                                  ))}
                                {Object.entries(summary.by_aseguradora)
                                  .filter(([aseg]) => details.some(d => d.ramo === ramo && d.aseguradora === aseg))
                                  .length > 3 && (
                                    <div className="text-xs text-neutral-500 italic">
                                      +{Object.entries(summary.by_aseguradora)
                                        .filter(([aseg]) => details.some(d => d.ramo === ramo && d.aseguradora === aseg))
                                        .length - 3} más
                                    </div>
                                  )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* 3. DETALLE DE PÓLIZAS */}
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
                                    <span className="truncate">{detail.nombre_asegurado || 'Cliente no especificado'}</span>
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

                    {/* 4. DESGLOSE FISCAL (COMPACTO) */}
                    {desgloseFiscal.has(batch.id) && (() => {
                      const fiscal = desgloseFiscal.get(batch.id);
                      const regimen = fiscal.regimen || 'HONORARIOS';
                      const isAsimilados = regimen.toUpperCase().includes('ASIMILAD');
                      const isResico = regimen.toUpperCase().includes('RESICO');
                      const isHonorarios = !isAsimilados && !isResico;

                      return (
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 sm:p-4 mt-6 border border-primary-200">
                          <h4 className="text-sm sm:text-base font-bold text-primary-900 mb-2 flex items-center gap-2">
                            <DollarSign className="w-4 h-4" />
                            Desglose Fiscal ({regimen.toUpperCase()})
                          </h4>

                          <div className="bg-white rounded-lg p-2 sm:p-3 space-y-1.5">
                            {/* Comisión Base Total */}
                            {(isHonorarios || isResico) && (
                              <div className="flex items-center justify-between text-xs sm:text-sm border-b border-neutral-100 pb-1.5">
                                <span className="text-neutral-600">Comisión Base Total</span>
                                <span className="font-bold text-green-700">{formatCurrency(parseFloat(fiscal.total_comision))}</span>
                              </div>
                            )}

                            {/* Vida */}
                            {(isHonorarios || isResico) && parseFloat(fiscal.vida) > 0 && (
                              <div className="flex items-center justify-between text-xs sm:text-sm">
                                <span className="text-neutral-600">Vida</span>
                                <span className="font-semibold text-neutral-700">{formatCurrency(parseFloat(fiscal.vida))}</span>
                              </div>
                            )}

                            {/* Sin Vida */}
                            {(isHonorarios || isResico) && (
                              <div className="flex items-center justify-between text-xs sm:text-sm">
                                <span className="text-neutral-600">Sin Vida</span>
                                <span className="font-semibold text-neutral-700">{formatCurrency(parseFloat(fiscal.sin_vida))}</span>
                              </div>
                            )}

                            {/* Ret. Contable (ASIMILADOS) */}
                            {isAsimilados && parseFloat(fiscal.ret_contable) > 0 && (
                              <div className="flex items-center justify-between text-xs sm:text-sm">
                                <span className="text-neutral-600">Ret. Contable</span>
                                <span className="font-semibold text-red-600">- {formatCurrency(parseFloat(fiscal.ret_contable))}</span>
                              </div>
                            )}

                            {/* Costo Dispersión (ASIMILADOS) */}
                            {isAsimilados && parseFloat(fiscal.dispersion) > 0 && (
                              <div className="flex items-center justify-between text-xs sm:text-sm">
                                <span className="text-neutral-600">Costo Dispersión</span>
                                <span className="font-semibold text-red-600">- {formatCurrency(parseFloat(fiscal.dispersion))}</span>
                              </div>
                            )}

                            {/* IVA */}
                            <div className="flex items-center justify-between text-xs sm:text-sm">
                              <span className="text-neutral-600">
                                {(isHonorarios || isResico) ? 'IVA (16% Sin Vida)' : 'IVA'}
                              </span>
                              <span className="font-semibold text-green-600">
                                {parseFloat(fiscal.iva) > 0 ? `+ ${formatCurrency(parseFloat(fiscal.iva))}` : formatCurrency(0)}
                              </span>
                            </div>

                            {/* Ret. ISR */}
                            {(isHonorarios || isResico) && parseFloat(fiscal.ret_isr) > 0 && (
                              <div className="flex items-center justify-between text-xs sm:text-sm">
                                <span className="text-neutral-600">
                                  {isResico ? 'Ret. ISR (1.25%)' : 'Ret. ISR (10%)'}
                                </span>
                                <span className="font-semibold text-red-600">- {formatCurrency(parseFloat(fiscal.ret_isr))}</span>
                              </div>
                            )}

                            {/* Ret. IVA */}
                            {(isHonorarios || isResico) && parseFloat(fiscal.ret_iva) > 0 && (
                              <div className="flex items-center justify-between text-xs sm:text-sm">
                                <span className="text-neutral-600">Ret. IVA (10.667%)</span>
                                <span className="font-semibold text-red-600">- {formatCurrency(parseFloat(fiscal.ret_iva))}</span>
                              </div>
                            )}

                            {/* ISR Total (ASIMILADOS) */}
                            {isAsimilados && parseFloat(fiscal.isr_total) > 0 && (
                              <div className="flex items-center justify-between text-xs sm:text-sm">
                                <span className="text-neutral-600">ISR Total</span>
                                <span className="font-semibold text-red-600">- {formatCurrency(parseFloat(fiscal.isr_total))}</span>
                              </div>
                            )}

                            {/* Total a Pagar */}
                            <div className="flex items-center justify-between text-xs sm:text-sm bg-gradient-to-r from-green-100 to-green-200 -mx-2 sm:-mx-3 px-2 sm:px-3 py-2 mt-2 rounded-lg border border-green-300">
                              <span className="text-green-800 font-bold">Total a Pagar</span>
                              <span className="text-base sm:text-lg font-bold text-green-900">
                                {formatCurrency(parseFloat(fiscal.total_pagar))}
                              </span>
                            </div>
                          </div>

                          <p className="text-[10px] sm:text-xs text-primary-700 mt-2 italic">
                            * Cálculo según régimen {regimen.toUpperCase()}
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showTramiteModal && selectedBatchForCorrection && (
        <NuevoTramiteModal
          isOpen={showTramiteModal}
          onClose={() => {
            setShowTramiteModal(false);
            setSelectedBatchForCorrection(null);
          }}
          onSuccess={handleTramiteSuccess}
          estatusList={estatusList}
          preloadedData={{
            tipoTramite: 'correccion_comisiones',
            comisionesLoteId: selectedBatchForCorrection.id,
            comisionesLoteLabel: selectedBatchForCorrection.name
          }}
        />
      )}
    </div>
  );
}
