import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, FileSpreadsheet, DollarSign, Users, AlertCircle, XCircle, CheckCircle, Wrench, Download, Loader2 } from 'lucide-react';
import type { CommissionBatch, CommissionDetail, CommissionError } from '../lib/commissionTypes';
import { calculateBatchSummary, calculateAgentSummaries, formatCurrency, formatDate } from '../lib/commissionUtils';
import { generateOrdenDePagoPDF, downloadPDF } from '../lib/pdfUtils';
import GraficaColumnas from '../components/comisiones/GraficaColumnas';
import GraficaCircular from '../components/comisiones/GraficaCircular';
import { calcularDesgloseFiscal, normalizarRegimenFiscal, type RegimenFiscal, type RamoResumen } from '../lib/commissionFiscalCalculations';

export default function ComisionesLote() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [batch, setBatch] = useState<CommissionBatch | null>(null);
  const [details, setDetails] = useState<CommissionDetail[]>([]);
  const [errors, setErrors] = useState<CommissionError[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'resumen' | 'agentes' | 'polizas' | 'errores'>('resumen');
  const [generatingPDF, setGeneratingPDF] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);

  const isAdmin = usuario?.rol === 'Administrador';

  useEffect(() => {
    if (id) {
      loadBatch();
    }
  }, [id]);

  const loadBatch = async () => {
    if (!id) return;

    setLoading(true);

    console.log('[ComisionesLote] Cargando batch:', id);

    // DIAGNÓSTICO: Primero verificar si existen registros sin JOINs
    const simpleCountResult = await supabase
      .from('commission_details')
      .select('id', { count: 'exact', head: true })
      .eq('batch_id', id);

    console.log('[ComisionesLote] DIAGNÓSTICO - Conteo simple (sin JOINs):', simpleCountResult);

    // DIAGNÓSTICO: Intentar query simple con solo agent_id
    const simpleDetailsResult = await supabase
      .from('commission_details')
      .select('id, poliza, agent_id')
      .eq('batch_id', id)
      .limit(5);

    console.log('[ComisionesLote] DIAGNÓSTICO - Query simple (sin JOINs profundos):', simpleDetailsResult);

    const [batchResult, detailsResult, errorsResult] = await Promise.all([
      supabase.from('commission_batches').select('*').eq('id', id).single(),
      supabase.from('commission_details').select(`
        *,
        agent:agent_id(
          *,
          office:office_id(*),
          fiscal_regime:fiscal_regime_id(*),
          usuario:usuario_id(
            *,
            regimen_fiscal:regimen_fiscal_id(*)
          )
        )
      `).eq('batch_id', id),
      supabase.from('commission_errors').select('*').eq('batch_id', id).eq('resolved', false)
    ]);

    console.log('[ComisionesLote] Batch result:', batchResult);
    console.log('[ComisionesLote] Details result:', detailsResult);
    console.log('[ComisionesLote] Details count:', detailsResult.data?.length || 0);
    console.log('[ComisionesLote] Errors result:', errorsResult);

    if (batchResult.error) {
      console.error('[ComisionesLote] Error loading batch:', batchResult.error);
      navigate('/comisiones');
      return;
    }

    if (detailsResult.error) {
      console.error('[ComisionesLote] Error loading details:', detailsResult.error);
    }

    // EMERGENCIA: Si no hay datos con JOINs pero sí con query simple, intentar sin JOINs
    if ((!detailsResult.data || detailsResult.data.length === 0) && simpleCountResult.count && simpleCountResult.count > 0) {
      console.warn('[ComisionesLote] EMERGENCIA: Datos existen pero JOINs fallaron. Cargando sin JOINs...');

      const fallbackResult = await supabase
        .from('commission_details')
        .select('*, agent:agent_id(id, name, email)')
        .eq('batch_id', id);

      console.log('[ComisionesLote] EMERGENCIA - Resultado sin JOINs profundos:', fallbackResult);

      if (fallbackResult.data && fallbackResult.data.length > 0) {
        console.log('[ComisionesLote] EMERGENCIA - Usando datos sin JOINs profundos');
        setBatch(batchResult.data);
        setDetails(fallbackResult.data);
        setErrors(errorsResult.data || []);
        setLoading(false);
        return;
      }
    }

    setBatch(batchResult.data);
    setDetails(detailsResult.data || []);
    setErrors(errorsResult.data || []);
    setLoading(false);

    console.log('[ComisionesLote] Estado actualizado:', {
      batch: batchResult.data,
      detailsCount: detailsResult.data?.length || 0,
      errorsCount: errorsResult.data?.length || 0
    });
  };

  const handleCloseBatch = async () => {
    if (!batch || !confirm('¿Estás seguro de cerrar este lote? Ya no podrás modificarlo.')) return;

    try {
      // 1. Query commission_details con información del régimen fiscal del agente
      const { data: detailsWithRegime, error: detailsError } = await supabase
        .from('commission_details')
        .select(`
          *,
          agent:agent_id(
            id,
            name,
            email,
            usuario_id,
            usuario:usuario_id(
              regimen_fiscal_id,
              regimen_fiscal:regimen_fiscal_id(name)
            )
          )
        `)
        .eq('batch_id', batch.id);

      if (detailsError) {
        console.error('Error loading details:', detailsError);
        alert('Error al cargar los detalles del lote');
        return;
      }

      if (!detailsWithRegime || detailsWithRegime.length === 0) {
        alert('No hay detalles en este lote');
        return;
      }

      // 2. Determinar el régimen fiscal (asumiendo que todos los agentes tienen el mismo régimen)
      const firstAgent = detailsWithRegime[0].agent;
      const regimeNameRaw = firstAgent?.usuario?.regimen_fiscal?.name;
      const regimenFiscal = normalizarRegimenFiscal(regimeNameRaw);

      console.log('[ComisionesLote] Régimen fiscal detectado:', regimenFiscal);

      // 3. GUARD CLAUSE: ASIMILADOS no se toca (ya manejado por DB)
      let fiscalUpdate: any = {
        status: 'closed'
      };

      if (regimenFiscal === 'ASIMILADOS') {
        console.log('[ComisionesLote] ASIMILADOS detectado - NO se calculan campos fiscales en frontend');
        // Solo cerramos el lote, sin calcular campos fiscales
      }
      // 4. Para HONORARIOS o RESICO: Llamar a función SQL para calcular y persistir
      else if (regimenFiscal === 'HONORARIOS' || regimenFiscal === 'RESICO') {
        console.log(`[ComisionesLote] Llamando a función SQL para calcular valores fiscales de ${regimenFiscal}...`);

        // Llamar a la función SQL que calcula y persiste los valores fiscales
        const { data: fiscalResult, error: fiscalError } = await supabase.rpc(
          'calculate_batch_fiscal_aggregates',
          { p_batch_id: batch.id }
        );

        if (fiscalError) {
          console.error('[ComisionesLote] Error al calcular valores fiscales:', fiscalError);
          alert(`Error al calcular valores fiscales: ${fiscalError.message}`);
          return;
        }

        if (!fiscalResult || !fiscalResult.success) {
          console.error('[ComisionesLote] La función SQL no retornó éxito:', fiscalResult);
          alert('Error: No se pudieron calcular los valores fiscales');
          return;
        }

        console.log('[ComisionesLote] Valores fiscales calculados por SQL:', fiscalResult);

        // Los valores ya están persistidos por la función SQL
        // Solo necesitamos cerrar el lote
        fiscalUpdate = {
          status: 'closed'
        };
      } else {
        console.warn('[ComisionesLote] Régimen desconocido:', regimenFiscal);
      }

      // 5. Actualizar el lote con status='closed' y valores fiscales (si aplica)
      const { error: updateError } = await supabase
        .from('commission_batches')
        .update(fiscalUpdate)
        .eq('id', batch.id);

      if (updateError) {
        console.error('Error updating batch:', updateError);
        alert('Error al cerrar el lote');
        return;
      }

      console.log('[ComisionesLote] Lote actualizado con valores fiscales:', fiscalUpdate);

      // 6. Enviar notificaciones
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-commission-batch-notifications`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({ batchId: batch.id })
          }
        );

        const result = await response.json();
        console.log('Respuesta de notificaciones:', result);

        if (response.ok && result.success) {
          alert(
            `✅ Lote cerrado exitosamente!\n\n` +
            `📧 Notificaciones enviadas a ${result.agents_notified} agentes.\n\n` +
            `Detalles:\n${result.results.map((r: any) =>
              `- ${r.agent_name}: ` +
              `${r.notifications_sent.in_app ? '✓ App' : '✗ App'}, ` +
              `${r.notifications_sent.email ? '✓ Email' : '✗ Email'}, ` +
              `${r.notifications_sent.whatsapp ? '✓ WhatsApp' : '✗ WhatsApp'}`
            ).join('\n')}`
          );
        } else {
          console.error('Error en respuesta:', result);
          alert(
            `⚠️ Lote cerrado, pero hubo un problema al enviar notificaciones:\n\n` +
            `${result.error || 'Error desconocido'}\n\n` +
            `Revisa la consola para más detalles.`
          );
        }
      } catch (notifError: any) {
        console.error('Error al enviar notificaciones:', notifError);
        alert(
          `⚠️ Lote cerrado, pero no se pudieron enviar las notificaciones:\n\n` +
          `${notifError.message}\n\n` +
          `Verifica:\n` +
          `1. Que la plantilla esté activa en Notificaciones Transaccionales\n` +
          `2. Que los agentes tengan email y teléfono registrados\n` +
          `3. Que la configuración SMTP y WhatsApp sea correcta`
        );
      }

      loadBatch();
    } catch (error: any) {
      console.error('Error in handleCloseBatch:', error);
      alert(`Error al cerrar el lote: ${error.message}`);
    }
  };

  const handleRecalculateBatch = async () => {
    if (!batch) return;

    setRecalculating(true);

    try {
      console.log('[ComisionesLote] Recalculando lote:', batch.id);

      // Llamar a la función SQL que calcula y persiste los valores fiscales
      const { data: fiscalResult, error: fiscalError } = await supabase.rpc(
        'calculate_batch_fiscal_aggregates',
        { p_batch_id: batch.id }
      );

      if (fiscalError) {
        console.error('[ComisionesLote] Error al recalcular valores fiscales:', fiscalError);
        alert(`Error al recalcular: ${fiscalError.message}`);
        return;
      }

      if (!fiscalResult || !fiscalResult.success) {
        if (fiscalResult?.skipped) {
          alert(`Lote omitido: ${fiscalResult.reason}\n\nRégimen: ${fiscalResult.regimen_fiscal}`);
        } else {
          console.error('[ComisionesLote] La función SQL no retornó éxito:', fiscalResult);
          alert('Error: No se pudieron recalcular los valores fiscales');
        }
        return;
      }

      console.log('[ComisionesLote] Valores fiscales recalculados:', fiscalResult);

      // Construir mensaje con detalles
      let message = `✓ Lote recalculado exitosamente\n\n`;
      message += `Régimen: ${fiscalResult.regimen_fiscal}\n`;
      if (fiscalResult.manual_adjustments_count > 0) {
        message += `Ajustes manuales: ${fiscalResult.manual_adjustments_count} de ${fiscalResult.normal_commissions_count + fiscalResult.manual_adjustments_count}\n\n`;
      } else {
        message += '\n';
      }
      message += `Comisión Total: ${formatCurrency(fiscalResult.commission_total)}\n`;
      message += `Vida: ${formatCurrency(fiscalResult.commission_vida)}\n`;
      message += `Sin Vida: ${formatCurrency(fiscalResult.commission_sinvida)}\n\n`;
      message += `IVA: ${formatCurrency(fiscalResult.iva)}\n`;
      message += `Ret. ISR: ${formatCurrency(fiscalResult.ret_isr)}\n`;
      message += `Ret. IVA: ${formatCurrency(fiscalResult.ret_iva)}\n\n`;
      message += `Total Neto: ${formatCurrency(fiscalResult.total_neto)}`;

      alert(message);

      // Recargar el lote para ver los valores actualizados
      await loadBatch();
    } catch (error: any) {
      console.error('Error in handleRecalculateBatch:', error);
      alert(`Error al recalcular el lote: ${error.message}`);
    } finally {
      setRecalculating(false);
    }
  };

  const handleDeleteBatch = async () => {
    if (!batch || !confirm('¿Estás seguro de eliminar este lote? Esta acción no se puede deshacer.')) return;

    const { error } = await supabase
      .from('commission_batches')
      .delete()
      .eq('id', batch.id);

    if (error) {
      alert('Error al eliminar el lote');
      console.error(error);
    } else {
      navigate('/comisiones');
    }
  };

  const handleDownloadOrdenDePago = async (agentId: string) => {
    if (!batch) return;

    const agentDetails = details.filter(d => d.agent_id === agentId);

    if (agentDetails.length === 0) {
      alert('No hay datos para este agente');
      return;
    }

    setGeneratingPDF(agentId);

    try {
      const pdfBlob = await generateOrdenDePagoPDF(agentDetails, batch);
      const agentName = agentDetails[0].agent?.name || 'Agente';
      const fileName = `Orden_de_Pago_${batch.name.replace(/\s+/g, '_')}_${agentName.replace(/\s+/g, '_')}.pdf`;
      downloadPDF(pdfBlob, fileName);
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      alert('Error al generar el PDF: ' + error.message);
    } finally {
      setGeneratingPDF(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-soft p-8 sm:p-12 text-center max-w-md w-full">
          <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 mb-2">
            Acceso Denegado
          </h2>
          <p className="text-sm sm:text-base text-neutral-600 mb-6">
            Solo los administradores pueden acceder a esta sección.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-semibold min-h-[44px]"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-8 sm:p-12 text-center mx-4">
        <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg sm:text-xl font-semibold text-neutral-700 mb-2">
          Lote no encontrado
        </h3>
        <button
          onClick={() => navigate('/comisiones')}
          className="mt-4 px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-semibold min-h-[44px]"
        >
          Volver a Comisiones
        </button>
      </div>
    );
  }

  const summary = calculateBatchSummary(details);
  const agentSummaries = calculateAgentSummaries(details);

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-soft border border-neutral-200 p-4 sm:p-6">
        <div className="flex flex-col gap-4 mb-4 sm:mb-6">
          <div className="flex items-start gap-3">
            <button
              onClick={() => navigate('/comisiones')}
              className="p-2 hover:bg-neutral-100 rounded-lg transition-colors flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6 text-neutral-700" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-display font-bold text-primary-600 mb-1 break-words">
                {batch.name}
              </h1>
              <p className="text-sm sm:text-base text-neutral-600">
                Periodo: {formatDate(batch.period_start || batch.date_from)} - {formatDate(batch.period_end || batch.date_to)}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              onClick={handleRecalculateBatch}
              disabled={recalculating}
              className="flex items-center justify-center space-x-2 px-4 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-semibold min-h-[44px] w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {recalculating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Recalculando...</span>
                </>
              ) : (
                <>
                  <Wrench className="w-5 h-5" />
                  <span>Recalcular Lote</span>
                </>
              )}
            </button>

            {batch.status !== 'closed' ? (
              <>
                <button
                  onClick={handleCloseBatch}
                  className="flex items-center justify-center space-x-2 px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-semibold min-h-[44px] w-full sm:w-auto"
                >
                  <CheckCircle className="w-5 h-5" />
                  <span>Cerrar Lote</span>
                </button>
                <button
                  onClick={handleDeleteBatch}
                  className="flex items-center justify-center space-x-2 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-semibold min-h-[44px] w-full sm:w-auto"
                >
                  <XCircle className="w-5 h-5" />
                  <span>Eliminar</span>
                </button>
              </>
            ) : (
              <button
                onClick={handleDeleteBatch}
                className="flex items-center justify-center space-x-2 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-semibold min-h-[44px] w-full sm:w-auto"
              >
                <XCircle className="w-5 h-5" />
                <span>Eliminar Lote</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex overflow-x-auto space-x-2 border-b border-neutral-200 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
          <button
            onClick={() => setActiveTab('resumen')}
            className={`px-4 sm:px-6 py-3 font-semibold transition-all whitespace-nowrap flex-shrink-0 text-sm sm:text-base ${
              activeTab === 'resumen'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Resumen
          </button>
          <button
            onClick={() => setActiveTab('agentes')}
            className={`px-4 sm:px-6 py-3 font-semibold transition-all whitespace-nowrap flex-shrink-0 text-sm sm:text-base ${
              activeTab === 'agentes'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Por Agente
          </button>
          <button
            onClick={() => setActiveTab('polizas')}
            className={`px-4 sm:px-6 py-3 font-semibold transition-all whitespace-nowrap flex-shrink-0 text-sm sm:text-base ${
              activeTab === 'polizas'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Por Póliza
          </button>
          {errors.length > 0 && (
            <button
              onClick={() => setActiveTab('errores')}
              className={`px-4 sm:px-6 py-3 font-semibold transition-all whitespace-nowrap flex-shrink-0 text-sm sm:text-base ${
                activeTab === 'errores'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Errores ({errors.length})
            </button>
          )}
        </div>
      </div>

      {activeTab === 'resumen' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-soft border border-neutral-200 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm sm:text-base text-neutral-600 font-medium">Comisión Total</span>
                <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-green-700">
                {formatCurrency(summary.total_neta)}
              </div>
            </div>

            <div className="bg-white rounded-xl sm:rounded-2xl shadow-soft border border-neutral-200 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm sm:text-base text-neutral-600 font-medium">Total Pólizas</span>
                <FileSpreadsheet className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-neutral-900">
                {summary.total_polizas}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-soft border border-neutral-200 p-4 sm:p-6">
              <h3 className="text-lg sm:text-xl font-bold text-neutral-900 mb-3 sm:mb-4">
                Comisiones por Ramo
              </h3>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200">
                      <th className="text-left py-3 px-4 font-semibold text-neutral-700">Ramo</th>
                      <th className="text-right py-3 px-4 font-semibold text-neutral-700">Pólizas</th>
                      <th className="text-right py-3 px-4 font-semibold text-neutral-700">Comisión</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(summary.by_ramo).map(([ramo, data]) => (
                      <tr key={ramo} className="border-b border-neutral-100 hover:bg-neutral-50">
                        <td className="py-3 px-4 font-medium text-neutral-900">{ramo}</td>
                        <td className="py-3 px-4 text-right text-neutral-700">{data.count}</td>
                        <td className="py-3 px-4 text-right font-bold text-green-700">{formatCurrency(data.neta)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl sm:rounded-2xl shadow-soft border border-neutral-200 p-4 sm:p-6">
              <h3 className="text-lg sm:text-xl font-bold text-neutral-900 mb-3 sm:mb-4">
                Comisiones por Aseguradora
              </h3>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200">
                      <th className="text-left py-3 px-4 font-semibold text-neutral-700">Aseguradora</th>
                      <th className="text-right py-3 px-4 font-semibold text-neutral-700">Pólizas</th>
                      <th className="text-right py-3 px-4 font-semibold text-neutral-700">Comisión</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(summary.by_aseguradora).map(([aseg, data]) => (
                      <tr key={aseg} className="border-b border-neutral-100 hover:bg-neutral-50">
                        <td className="py-3 px-4 font-medium text-neutral-900">{aseg}</td>
                        <td className="py-3 px-4 text-right text-neutral-700">{data.count}</td>
                        <td className="py-3 px-4 text-right font-bold text-green-700">{formatCurrency(data.neta)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'agentes' && (
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-soft border border-neutral-200 p-4 sm:p-6">
          <h3 className="text-lg sm:text-xl font-bold text-neutral-900 mb-3 sm:mb-4">
            Comisiones por Agente
          </h3>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="text-left py-3 px-4 font-semibold text-neutral-700">Agente</th>
                  <th className="text-left py-3 px-4 font-semibold text-neutral-700">Oficina</th>
                  <th className="text-right py-3 px-4 font-semibold text-neutral-700">Pólizas</th>
                  <th className="text-right py-3 px-4 font-semibold text-neutral-700">Comisión</th>
                  <th className="text-center py-3 px-4 font-semibold text-neutral-700">PDF</th>
                </tr>
              </thead>
              <tbody>
                {agentSummaries.map(agent => (
                  <tr key={agent.agent_id} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="py-3 px-4 font-medium text-neutral-900">{agent.agent_name}</td>
                    <td className="py-3 px-4 text-neutral-700">{agent.office_name || '-'}</td>
                    <td className="py-3 px-4 text-right text-neutral-700">{agent.total_polizas}</td>
                    <td className="py-3 px-4 text-right font-bold text-green-700">{formatCurrency(agent.total_commission)}</td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleDownloadOrdenDePago(agent.agent_id)}
                        disabled={generatingPDF === agent.agent_id}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Descargar Orden de Pago"
                      >
                        {generatingPDF === agent.agent_id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        <span className="hidden lg:inline">Orden de Pago</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'polizas' && (
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-soft border border-neutral-200 p-4 sm:p-6">
          <h3 className="text-lg sm:text-xl font-bold text-neutral-900 mb-3 sm:mb-4">
            Detalle por Póliza ({details.length})
          </h3>

          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="text-left py-3 px-3 font-semibold text-neutral-700">Póliza</th>
                  <th className="text-left py-3 px-3 font-semibold text-neutral-700">Asegurado</th>
                  <th className="text-left py-3 px-3 font-semibold text-neutral-700">Agente</th>
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
                    <tr key={detail.id} className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-medium text-neutral-900">{detail.poliza}</div>
                        {detail.is_manual_adjusted && (
                          <span className="inline-block mt-1 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                            Ajustado
                          </span>
                        )}
                        {detail.concepto && (
                          <div className="text-xs text-neutral-500 mt-1">{detail.concepto}</div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-neutral-700">{detail.nombre_asegurado || '-'}</td>
                      <td className="py-3 px-3 text-neutral-700">{detail.agent?.name}</td>
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

          <div className="lg:hidden space-y-3">
            {details.map(detail => {
              const commission = detail.is_manual_adjusted
                ? detail.adjusted_commission_neta
                : detail.commission_neta;

              return (
                <div key={detail.id} className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  <div className="mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-neutral-900 mb-1 break-words">{detail.poliza}</div>
                      {detail.is_manual_adjusted && (
                        <span className="inline-block text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full mb-2">
                          Ajustado
                        </span>
                      )}
                      <div className="text-sm text-neutral-700 break-words">{detail.nombre_asegurado || '-'}</div>
                      {detail.concepto && (
                        <div className="text-xs text-neutral-500 mt-1 break-words">{detail.concepto}</div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3 pb-3 border-b border-neutral-200">
                    <div>
                      <div className="text-xs text-neutral-600 mb-1">Agente</div>
                      <div className="text-sm font-medium text-neutral-900 break-words">{detail.agent?.name}</div>
                    </div>
                    <div>
                      <div className="text-xs text-neutral-600 mb-1">Ramo</div>
                      <div className="text-sm font-medium text-neutral-900 break-words">{detail.ramo}</div>
                    </div>
                    <div>
                      <div className="text-xs text-neutral-600 mb-1">Aseguradora</div>
                      <div className="text-sm font-medium text-neutral-900 break-words">{detail.aseguradora}</div>
                    </div>
                    <div>
                      <div className="text-xs text-neutral-600 mb-1">Prima Neta</div>
                      <div className="text-sm font-medium text-neutral-900">{formatCurrency(detail.prima_neta)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-neutral-600 mb-1">Base Comisión</div>
                      <div className="text-sm font-medium text-neutral-900">{formatCurrency(detail.importe_base)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-neutral-600 mb-1">Porcentaje</div>
                      <div className="text-sm font-medium text-neutral-900">{detail.porcentaje_comision.toFixed(2)}%</div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-neutral-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-neutral-700">Comisión Total</span>
                      <span className="text-lg font-bold text-green-700">{formatCurrency(commission || 0)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {details.length === 0 && (
            <div className="text-center py-12">
              <FileSpreadsheet className="w-12 h-12 sm:w-16 sm:h-16 text-neutral-300 mx-auto mb-4" />
              <p className="text-sm sm:text-base text-neutral-500">No hay pólizas registradas en este lote</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'errores' && (
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-soft border border-neutral-200 p-4 sm:p-6">
          <h3 className="text-lg sm:text-xl font-bold text-neutral-900 mb-3 sm:mb-4">
            Errores de Procesamiento
          </h3>
          <div className="space-y-3 sm:space-y-4">
            {errors.map(error => (
              <div key={error.id} className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-red-900 mb-1">
                      {error.error_type === 'agent_not_found' && 'Agente no encontrado'}
                      {error.error_type === 'rule_not_found' && 'Regla no encontrada'}
                      {error.error_type === 'invalid_data' && 'Datos inválidos'}
                      {error.error_type === 'other' && 'Error desconocido'}
                    </div>
                    <p className="text-red-800 text-sm mb-2 break-words">{error.detalle}</p>
                    {error.email_agente && (
                      <p className="text-red-700 text-xs break-all">Email: {error.email_agente}</p>
                    )}
                    {error.poliza && (
                      <p className="text-red-700 text-xs break-words">Póliza: {error.poliza}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
