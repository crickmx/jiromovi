import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Download, Edit, Trash2, Search } from 'lucide-react';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/ui/page-header';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { supabase } from '../lib/supabase';
import { generateQuotePDF } from '../lib/gmmPdfGenerator';
import type { QuoteInput, QuoteCalculationResult } from '../lib/gmmTypes';

interface GMMQuotation {
  id: string;
  folio: string;
  usuario_id: string;
  estado: string;
  producto: string;
  cliente_nombre: string | null;
  asegurado_principal: string;
  quote_data: QuoteInput;
  coverage_selections: Record<string, boolean>;
  prima_neta_total: number;
  total_a_pagar: number;
  forma_pago: string;
  pdf_url: string | null;
  editada_desde_cotizacion_id: string | null;
  created_at: string;
  updated_at: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function MisCotizaciones() {
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState<GMMQuotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadQuotations();
  }, []);

  async function loadQuotations() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('gmm_quotations')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      let filtered = data || [];

      if (searchTerm) {
        filtered = filtered.filter(
          q =>
            q.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
            q.asegurado_principal.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (q.cliente_nombre && q.cliente_nombre.toLowerCase().includes(searchTerm.toLowerCase()))
        );
      }

      setQuotations(filtered);
    } catch (error) {
      console.error('Error loading quotations:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadPDF(quotation: GMMQuotation) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: usuario } = await supabase
        .from('usuarios')
        .select('nombre_completo, celular_laboral')
        .eq('id', user.id)
        .maybeSingle();

      const asesorInfo = {
        nombre: usuario?.nombre_completo || 'Asesor JIRO',
        celular: usuario?.celular_laboral || '',
      };

      const quoteForPdf = {
        quote_number: quotation.folio,
        created_at: quotation.created_at,
        estado: quotation.quote_data.estado,
        nivel_hospitalario: quotation.quote_data.nivel_hospitalario,
        tabulador: quotation.quote_data.tabulador,
        suma_asegurada: quotation.quote_data.suma_asegurada,
        deducible: quotation.quote_data.deducible,
        coaseguro: quotation.quote_data.coaseguro,
        tope_coaseguro: (quotation.quote_data as any).tope_coaseguro_seleccionado || 0,
        forma_pago: quotation.forma_pago,
        cob_medicamentos_fuera: quotation.coverage_selections.medicamentos_fuera || false,
        cob_eliminacion_deducible_accidente: quotation.coverage_selections.eliminacion_deducible_accidente || false,
        cob_multiregion: quotation.coverage_selections.multiregion || false,
        cob_vip: quotation.coverage_selections.vip || false,
        cob_emergencia_medica_extranjero: quotation.coverage_selections.emergencia_medica_extranjero || false,
        cob_reconocimiento_antiguedad: quotation.coverage_selections.reconocimiento_antiguedad || false,
        cob_complicaciones_no_amparadas: quotation.coverage_selections.complicaciones_no_amparadas || false,
        cob_padecimientos_preexistentes: quotation.coverage_selections.padecimientos_preexistentes || false,
        cob_enfermedades_graves_extranjero: quotation.coverage_selections.enfermedades_graves_extranjero || false,
        cob_cobertura_internacional: quotation.coverage_selections.cobertura_internacional || false,
        cob_ampliacion_servicios: quotation.coverage_selections.ampliacion_servicios || false,
        cob_ayuda_diaria: quotation.coverage_selections.ayuda_diaria || false,
        cob_indemnizacion_eg: quotation.coverage_selections.indemnizacion_eg || false,
        cob_maternidad: quotation.coverage_selections.maternidad || false,
        prima_neta_total: quotation.prima_neta_total,
        subtotal: quotation.prima_neta_total,
        iva: quotation.total_a_pagar - quotation.prima_neta_total,
        total: quotation.total_a_pagar,
      };

      const insuredsData = quotation.quote_data.insureds.map((ins, idx) => ({
        orden: idx + 1,
        nombre: ins.nombre,
        sexo: ins.sexo,
        edad: ins.edad,
        prima_base: 0,
        prima_adicionales: 0,
        prima_total: 0,
      }));

      const pdfBlob = await generateQuotePDF(quoteForPdf as any, insuredsData, asesorInfo);

      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cotizacion_${quotation.folio}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      alert(`Error al generar PDF: ${error.message}`);
    }
  }

  async function handleEdit(quotation: GMMQuotation) {
    navigate('/gmm-cotizador', { state: { editQuotation: quotation } });
  }

  async function handleDelete(quotation: GMMQuotation) {
    if (!confirm(`¿Está seguro de eliminar la cotización ${quotation.folio}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('gmm_quotations')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', quotation.id);

      if (error) throw error;

      alert('Cotización eliminada exitosamente');
      loadQuotations();
    } catch (error: any) {
      console.error('Error deleting quotation:', error);
      alert(`Error: ${error.message}`);
    }
  }

  return (
    <Layout>
      <PageHeader
        title="Mis Cotizaciones GMM BX+"
        description="Gestiona todas tus cotizaciones de GMM BX+"
        icon={FileText}
      />

      <Card className="p-6 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar por folio, cliente o asegurado..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyUp={() => loadQuotations()}
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </Card>

      {loading ? (
        <Card className="p-12 text-center">
          <p className="text-gray-500">Cargando cotizaciones...</p>
        </Card>
      ) : quotations.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-2">No hay cotizaciones guardadas</p>
          <Button onClick={() => navigate('/gmm-cotizador')}>
            Crear Primera Cotización
          </Button>
        </Card>
      ) : (
        <>
          <div className="hidden md:block">
            <Card className="overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Folio
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cliente / Asegurado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {quotations.map((q) => (
                    <tr key={q.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                        {q.folio}
                        {q.editada_desde_cotizacion_id && (
                          <span className="ml-2 text-xs text-gray-400">(Editada)</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="font-medium">{q.asegurado_principal}</div>
                        {q.cliente_nombre && (
                          <div className="text-gray-500 text-xs">{q.cliente_nombre}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(q.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        {formatCurrency(q.total_a_pagar)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadPDF(q)}
                            title="Descargar PDF"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(q)}
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(q)}
                            title="Eliminar"
                            className="text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>

          <div className="md:hidden space-y-4">
            {quotations.map((q) => (
              <Card key={q.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold text-blue-600">{q.folio}</div>
                    <div className="text-sm text-gray-500">{formatDate(q.created_at)}</div>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">Asegurado:</span>{' '}
                    <span className="text-gray-900">{q.asegurado_principal}</span>
                  </div>
                  {q.cliente_nombre && (
                    <div className="text-sm">
                      <span className="font-medium text-gray-700">Cliente:</span>{' '}
                      <span className="text-gray-900">{q.cliente_nombre}</span>
                    </div>
                  )}
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">Total:</span>{' '}
                    <span className="text-gray-900 font-semibold">
                      {formatCurrency(q.total_a_pagar)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleDownloadPDF(q)} className="flex-1">
                    <Download className="w-4 h-4 mr-2" />
                    PDF
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleEdit(q)} className="flex-1">
                    <Edit className="w-4 h-4 mr-2" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(q)}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </Layout>
  );
}
