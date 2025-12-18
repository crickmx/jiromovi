import { X, Calendar, Building2, Shield, Tag, DollarSign, Package, FileText } from 'lucide-react';

interface DocumentoDetalle {
  fecha: string;
  periodo_mes: string;
  desp_nombre_raw: string;
  nombre_cliente?: string | null;
  gerencia_nombre_raw: string;
  region_raw: string | null;
  aseguradora_nombre: string;
  ramo_nombre: string;
  subramo_nombre: string | null;
  concepto?: string | null;
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
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  const InfoItem = ({ icon: Icon, label, value, className = "" }: {
    icon: any;
    label: string;
    value: string | number;
    className?: string;
  }) => (
    <div className={`flex items-start gap-2 ${className}`}>
      <div className="mt-0.5">
        <Icon className="w-4 h-4 text-neutral-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-neutral-500 leading-tight">{label}</p>
        <p className="text-sm font-medium text-neutral-900 truncate">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-3.5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Detalle de Documento</h2>
            <p className="text-xs text-blue-100 mt-0.5">{formatDate(documento.fecha)} • {documento.periodo_mes}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-700 font-medium mb-0.5">Importe Total</p>
                <p className="text-2xl font-bold text-green-900">
                  {formatCurrency(documento.importe_pesos > 0 ? documento.importe_pesos : documento.prima_convenio)}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                {documento.convenio_flag && (
                  <span className="px-2.5 py-1 bg-blue-600 text-white text-xs font-medium rounded-full">
                    Convenio
                  </span>
                )}
                <DollarSign className="w-10 h-10 text-green-600 opacity-20" />
              </div>
            </div>
          </div>

          <div className="bg-neutral-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-neutral-200">
              <Building2 className="w-4 h-4 text-blue-600" />
              <h3 className="font-semibold text-neutral-900 text-sm">Cliente</h3>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-neutral-900 leading-snug">
                {documento.nombre_cliente || documento.desp_nombre_raw}
              </p>
              {documento.nombre_cliente && documento.desp_nombre_raw && (
                <div className="pt-2 border-t border-neutral-200">
                  <p className="text-xs text-neutral-500">Despacho/Oficina</p>
                  <p className="text-sm text-neutral-700">{documento.desp_nombre_raw}</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-neutral-50 rounded-lg p-3">
              <InfoItem
                icon={Shield}
                label="Aseguradora"
                value={documento.aseguradora_nombre}
              />
            </div>
            <div className="bg-neutral-50 rounded-lg p-3">
              <InfoItem
                icon={Package}
                label="Ramo"
                value={documento.ramo_nombre}
              />
            </div>
          </div>

          {documento.subramo_nombre && (
            <div className="bg-neutral-50 rounded-lg p-3">
              <InfoItem
                icon={Tag}
                label="Subramo"
                value={documento.subramo_nombre}
              />
            </div>
          )}

          <div className="bg-neutral-50 rounded-lg p-3">
            <InfoItem
              icon={FileText}
              label="Concepto"
              value={documento.concepto || '-'}
            />
          </div>
        </div>

        <div className="border-t border-neutral-200 px-5 py-3 bg-neutral-50 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-700 text-white text-sm rounded-lg hover:bg-neutral-800 transition-colors font-medium"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
