import { X, Calendar, Building, FileText, DollarSign } from 'lucide-react';

interface DocumentoDetalle {
  fecha: string;
  periodo_mes: string;
  desp_nombre_raw: string;
  gerencia_nombre_raw: string;
  region_raw: string | null;
  aseguradora_nombre: string;
  ramo_nombre: string;
  subramo_nombre: string | null;
  importe_pesos: number;
  prima_convenio: number;
  prima_ponderada: number;
  bono: number;
  convenio_flag: boolean;
}

interface DetalleDocumentoModalProps {
  documento: DocumentoDetalle | null;
  onClose: () => void;
}

export default function DetalleDocumentoModal({
  documento,
  onClose,
}: DetalleDocumentoModalProps) {
  if (!documento) return null;

  const formatCurrency = (value: number) =>
    `$${value.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-neutral-900">Detalle de Documento</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-neutral-600" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                <p className="text-sm font-medium text-blue-900">Fecha</p>
              </div>
              <p className="text-lg font-bold text-blue-900">{formatDate(documento.fecha)}</p>
              <p className="text-xs text-blue-700 mt-1">Periodo: {documento.periodo_mes}</p>
            </div>

            <div className="bg-green-50 rounded-xl p-4 border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                <p className="text-sm font-medium text-green-900">Importe Principal</p>
              </div>
              <p className="text-lg font-bold text-green-900">
                {formatCurrency(documento.importe_pesos > 0 ? documento.importe_pesos : documento.prima_convenio)}
              </p>
              {documento.convenio_flag && (
                <p className="text-xs text-green-700 mt-1">Convenio</p>
              )}
            </div>
          </div>

          <div className="border border-neutral-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Building className="w-5 h-5 text-neutral-600" />
              <h3 className="font-semibold text-neutral-900">Información del Cliente</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-neutral-500 mb-1">Oficina</p>
                <p className="text-sm font-medium text-neutral-900">{documento.desp_nombre_raw}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 mb-1">Gerencia</p>
                <p className="text-sm font-medium text-neutral-900">{documento.gerencia_nombre_raw}</p>
              </div>
              {documento.region_raw && (
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Región</p>
                  <p className="text-sm font-medium text-neutral-900">{documento.region_raw}</p>
                </div>
              )}
            </div>
          </div>

          <div className="border border-neutral-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-5 h-5 text-neutral-600" />
              <h3 className="font-semibold text-neutral-900">Detalles del Seguro</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-neutral-500 mb-1">Aseguradora</p>
                <p className="text-sm font-medium text-neutral-900">{documento.aseguradora_nombre}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 mb-1">Ramo</p>
                <p className="text-sm font-medium text-neutral-900">{documento.ramo_nombre}</p>
              </div>
              {documento.subramo_nombre && (
                <div className="md:col-span-2">
                  <p className="text-xs text-neutral-500 mb-1">Subramo</p>
                  <p className="text-sm font-medium text-neutral-900">{documento.subramo_nombre}</p>
                </div>
              )}
            </div>
          </div>

          <div className="border border-neutral-200 rounded-xl p-4">
            <h3 className="font-semibold text-neutral-900 mb-3">Desglose Financiero</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center py-2 border-b border-neutral-100">
                <span className="text-sm text-neutral-600">Importe en Pesos</span>
                <span className="text-sm font-semibold text-neutral-900">
                  {formatCurrency(documento.importe_pesos)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-neutral-100">
                <span className="text-sm text-neutral-600">Prima Convenio</span>
                <span className="text-sm font-semibold text-neutral-900">
                  {formatCurrency(documento.prima_convenio)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-neutral-100">
                <span className="text-sm text-neutral-600">Prima Ponderada</span>
                <span className="text-sm font-semibold text-neutral-900">
                  {formatCurrency(documento.prima_ponderada)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-neutral-600">Bono</span>
                <span className="text-sm font-semibold text-orange-700">
                  {formatCurrency(documento.bono)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-neutral-200">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-neutral-600 text-white rounded-lg hover:bg-neutral-700 transition-colors font-medium"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
