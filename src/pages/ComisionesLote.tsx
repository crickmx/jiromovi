import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, FileSpreadsheet, DollarSign, Users, AlertCircle, Edit2, XCircle, CheckCircle, Wrench, Download, Loader2 } from 'lucide-react';
import type { CommissionBatch, CommissionDetail, CommissionError } from '../lib/commissionTypes';
import { calculateBatchSummary, calculateAgentSummaries, formatCurrency, formatDate } from '../lib/commissionUtils';
import AjustarComisionModal from '../components/comisiones/AjustarComisionModal';
import { generateCommissionPDF, downloadPDF } from '../lib/pdfUtils';

export default function ComisionesLote() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [batch, setBatch] = useState<CommissionBatch | null>(null);
  const [details, setDetails] = useState<CommissionDetail[]>([]);
  const [errors, setErrors] = useState<CommissionError[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'resumen' | 'agentes' | 'polizas' | 'errores'>('resumen');
  const [adjustingDetail, setAdjustingDetail] = useState<CommissionDetail | null>(null);
  const [generatingPDF, setGeneratingPDF] = useState<string | null>(null);

  const isAdmin = usuario?.rol === 'Administrador';

  useEffect(() => {
    if (id) {
      loadBatch();
    }
  }, [id]);

  const loadBatch = async () => {
    if (!id) return;

    setLoading(true);

    const [batchResult, detailsResult, errorsResult] = await Promise.all([
      supabase.from('commission_batches').select('*').eq('id', id).single(),
      supabase.from('commission_details').select(`
        *,
        agent:agent_id(
          *,
          office:office_id(*),
          fiscal_regime:fiscal_regime_id(*)
        )
      `).eq('batch_id', id),
      supabase.from('commission_errors').select('*').eq('batch_id', id).eq('resolved', false)
    ]);

    if (batchResult.error) {
      console.error('Error loading batch:', batchResult.error);
      navigate('/comisiones');
      return;
    }

    setBatch(batchResult.data);
    setDetails(detailsResult.data || []);
    setErrors(errorsResult.data || []);
    setLoading(false);
  };

  const handleCloseBatch = async () => {
    if (!batch || !confirm('¿Estás seguro de cerrar este lote? Ya no podrás modificarlo.')) return;

    const { error } = await supabase
      .from('commission_batches')
      .update({ status: 'closed' })
      .eq('id', batch.id);

    if (error) {
      alert('Error al cerrar el lote');
      console.error(error);
    } else {
      alert('Lote cerrado exitosamente');
      loadBatch();
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

  const handleDownloadAgentPDF = async (agentId: string) => {
    if (!batch) return;

    const agentDetails = details.filter(d => d.agent_id === agentId);

    if (agentDetails.length === 0) {
      alert('No hay datos para este agente');
      return;
    }

    setGeneratingPDF(agentId);

    try {
      const pdfBlob = await generateCommissionPDF(agentDetails, batch);
      const agentName = agentDetails[0].agent?.name || 'Agente';
      const fileName = `Comisiones_${batch.name.replace(/\s+/g, '_')}_${agentName.replace(/\s+/g, '_')}.pdf`;
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

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-12 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-neutral-700 mb-2">
          Lote no encontrado
        </h3>
        <button
          onClick={() => navigate('/comisiones')}
          className="mt-4 px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-semibold"
        >
          Volver a Comisiones
        </button>
      </div>
    );
  }

  const summary = calculateBatchSummary(details);
  const agentSummaries = calculateAgentSummaries(details);

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
                {batch.name}
              </h1>
              <p className="text-neutral-600">
                Periodo: {formatDate(batch.date_from)} - {formatDate(batch.date_to)}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {batch.status !== 'closed' ? (
              <>
                <button
                  onClick={handleCloseBatch}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-semibold"
                >
                  <CheckCircle className="w-5 h-5" />
                  <span>Cerrar Lote</span>
                </button>
                <button
                  onClick={handleDeleteBatch}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-semibold"
                >
                  <XCircle className="w-5 h-5" />
                  <span>Eliminar</span>
                </button>
              </>
            ) : (
              <button
                onClick={handleDeleteBatch}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-semibold"
              >
                <XCircle className="w-5 h-5" />
                <span>Eliminar Lote</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex space-x-2 border-b border-neutral-200">
          <button
            onClick={() => setActiveTab('resumen')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'resumen'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Resumen
          </button>
          <button
            onClick={() => setActiveTab('agentes')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'agentes'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Por Agente
          </button>
          <button
            onClick={() => setActiveTab('polizas')}
            className={`px-6 py-3 font-semibold transition-all ${
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
              className={`px-6 py-3 font-semibold transition-all ${
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
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-neutral-600 font-medium">Comisión Total</span>
                <DollarSign className="w-6 h-6 text-primary-600" />
              </div>
              <div className="text-3xl font-bold text-green-700">
                {formatCurrency(summary.total_commission)}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-neutral-600 font-medium">Total Pólizas</span>
                <FileSpreadsheet className="w-6 h-6 text-blue-600" />
              </div>
              <div className="text-3xl font-bold text-neutral-900">
                {summary.total_polizas}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-6">
              <h3 className="text-xl font-bold text-neutral-900 mb-4">
                Comisiones por Ramo
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
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
                        <td className="py-3 px-4 text-right font-bold text-green-700">{formatCurrency(data.commission)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-6">
              <h3 className="text-xl font-bold text-neutral-900 mb-4">
                Comisiones por Aseguradora
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
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
                        <td className="py-3 px-4 text-right font-bold text-green-700">{formatCurrency(data.commission)}</td>
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
        <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-6">
          <h3 className="text-xl font-bold text-neutral-900 mb-4">
            Comisiones por Agente
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
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
                        onClick={() => handleDownloadAgentPDF(agent.agent_id)}
                        disabled={generatingPDF === agent.agent_id}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Descargar PDF"
                      >
                        {generatingPDF === agent.agent_id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
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
        <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-6">
          <h3 className="text-xl font-bold text-neutral-900 mb-4">
            Detalle por Póliza
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="text-left py-3 px-4 font-semibold text-neutral-700">Póliza</th>
                  <th className="text-left py-3 px-4 font-semibold text-neutral-700">Asegurado</th>
                  <th className="text-left py-3 px-4 font-semibold text-neutral-700">Agente</th>
                  <th className="text-left py-3 px-4 font-semibold text-neutral-700">Ramo</th>
                  <th className="text-left py-3 px-4 font-semibold text-neutral-700">Aseguradora</th>
                  <th className="text-right py-3 px-4 font-semibold text-neutral-700">Prima</th>
                  <th className="text-right py-3 px-4 font-semibold text-neutral-700">Comisión</th>
                  <th className="text-center py-3 px-4 font-semibold text-neutral-700">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {details.map(detail => {
                  const commission = detail.is_manual_adjusted
                    ? detail.adjusted_commission_neta
                    : detail.commission_neta;

                  return (
                    <tr key={detail.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                      <td className="py-3 px-4 font-medium text-neutral-900">
                        {detail.poliza}
                        {detail.is_manual_adjusted && (
                          <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                            Ajustado
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-neutral-700">{detail.nombre_asegurado || '-'}</td>
                      <td className="py-3 px-4 text-neutral-700">{detail.agent?.name}</td>
                      <td className="py-3 px-4 text-neutral-700">{detail.ramo}</td>
                      <td className="py-3 px-4 text-neutral-700">{detail.aseguradora}</td>
                      <td className="py-3 px-4 text-right text-neutral-900">{formatCurrency(detail.prima_base)}</td>
                      <td className="py-3 px-4 text-right font-bold text-green-700">{formatCurrency(commission || 0)}</td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setAdjustingDetail(detail)}
                          className="inline-flex items-center space-x-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                          title="Ajustar comisión"
                        >
                          <Wrench className="w-4 h-4" />
                          <span>Ajustar</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'errores' && (
        <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-6">
          <h3 className="text-xl font-bold text-neutral-900 mb-4">
            Errores de Procesamiento
          </h3>
          <div className="space-y-4">
            {errors.map(error => (
              <div key={error.id} className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-semibold text-red-900 mb-1">
                      {error.error_type === 'agent_not_found' && 'Agente no encontrado'}
                      {error.error_type === 'rule_not_found' && 'Regla no encontrada'}
                      {error.error_type === 'invalid_data' && 'Datos inválidos'}
                      {error.error_type === 'other' && 'Error desconocido'}
                    </div>
                    <p className="text-red-800 text-sm mb-2">{error.detalle}</p>
                    {error.email_agente && (
                      <p className="text-red-700 text-xs">Email: {error.email_agente}</p>
                    )}
                    {error.poliza && (
                      <p className="text-red-700 text-xs">Póliza: {error.poliza}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {adjustingDetail && (
        <AjustarComisionModal
          detail={adjustingDetail}
          onClose={() => setAdjustingDetail(null)}
          onSuccess={() => {
            loadBatch();
            setAdjustingDetail(null);
          }}
        />
      )}
    </div>
  );
}
