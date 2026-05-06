import { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Eye,
  Car,
  FileUp,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import { PageHeader } from '../components/ui/page-header';
import type { ExtractedPolizaData } from '../lib/lectorQualitasTypes';

export default function LectorQualitas() {
  const [results, setResults] = useState<ExtractedPolizaData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedData, setSelectedData] = useState<ExtractedPolizaData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileCount, setFileCount] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (files: FileList) => {
    setIsProcessing(true);
    setError(null);
    setFileCount(files.length);

    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append('files', file);
      });

      const apiUrl = `${supabaseUrl}/functions/v1/lector-qualitas-proxy`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Error del servidor: ${response.status} - ${errBody}`);
      }

      const json = await response.json();

      if (json.success && Array.isArray(json.data)) {
        setResults(json.data);
      } else {
        throw new Error(json.error || 'Respuesta inesperada del servidor');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length) {
      handleUpload(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      handleUpload(e.target.files);
    }
  };

  const handleExportExcel = () => {
    if (!results.length) return;

    const headers = [
      'Archivo', 'Tipo de Poliza', 'Numero de Poliza', 'Nombre o Razon Social',
      'Direccion', 'C.P.', 'Municipio/Alcaldia', 'Colonia', 'RFC Asegurado',
      'Descripcion o Version', 'Nacional o Importado', 'Placas',
      'Serie', 'Motor', 'Forma de Pago', 'Moneda', 'Prima Neta',
      'Tasa Financiamiento', 'Gastos de Expedicion', 'Subtotal', 'I.V.A.',
      'Prima Total', 'Inicio Vigencia', 'Fin Vigencia', 'Tipo Vehiculo',
    ];

    const rows = results.map((r) => [
      r.archivo, r.tipoPoliza, r.numeroPoliza, r.nombreCliente,
      r.direccion, r.cp, r.municipio, r.colonia, r.rfcAsegurado,
      r.descripcionVehiculo, r.nacionalImportado, r.placas,
      r.serie, r.motor, r.formaPago, r.moneda, r.primaNeta,
      r.tasaFinanciamiento, r.gastosExpedicion, r.subtotal, r.iva,
      r.primaTotal, r.inicioVigencia, r.finVigencia, r.tipoVehiculo,
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = headers.map((h, i) => {
      const max = Math.max(h.length, ...rows.map((r) => String(r[i] || '').length));
      return { wch: Math.min(max + 2, 40) };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Polizas');

    const rechazadas = results.filter((r) => r.mensaje);
    if (rechazadas.length) {
      const wsR = XLSX.utils.aoa_to_sheet([
        ['Archivo', 'Mensaje'],
        ...rechazadas.map((r) => [r.archivo, r.mensaje]),
      ]);
      XLSX.utils.book_append_sheet(wb, wsR, 'Rechazadas');
    }

    XLSX.writeFile(wb, `polizas_qualitas_${Date.now()}.xlsx`);
  };

  const successCount = results.filter((r) => !r.mensaje).length;
  const errorCount = results.filter((r) => r.mensaje).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lector de Polizas Qualitas"
        description="Carga archivos PDF de polizas Qualitas y extrae todos los datos automaticamente"
        icon={Car}
        actions={
          results.length > 0 ? (
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
            >
              <Download className="w-4 h-4" />
              Exportar Excel
            </button>
          ) : undefined
        }
      />

      {/* Upload Area */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200
          ${dragActive
            ? 'border-accent bg-accent/5 scale-[1.01]'
            : 'border-neutral-200 dark:border-white/10 hover:border-accent/50 hover:bg-neutral-50 dark:hover:bg-white/3'
          }
          ${isProcessing ? 'pointer-events-none opacity-60' : 'cursor-pointer'}
        `}
        onClick={() => !isProcessing && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf"
          onChange={handleFileChange}
          className="hidden"
        />

        {isProcessing ? (
          <div className="flex flex-col items-center gap-3">
            <div className="p-4 bg-accent/10 rounded-2xl">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
            <div>
              <p className="text-base font-semibold text-neutral-800 dark:text-white">
                Procesando {fileCount} archivo{fileCount !== 1 ? 's' : ''}...
              </p>
              <p className="text-sm text-neutral-500 dark:text-white/50 mt-1">
                Extrayendo datos de las polizas
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="p-4 bg-neutral-100 dark:bg-white/8 rounded-2xl group-hover:bg-accent/10 transition-colors">
              <FileUp className="w-8 h-8 text-neutral-400 dark:text-white/40" />
            </div>
            <div>
              <p className="text-base font-semibold text-neutral-800 dark:text-white">
                Arrastra archivos PDF aqui
              </p>
              <p className="text-sm text-neutral-500 dark:text-white/50 mt-1">
                o haz clic para seleccionar. Multiples archivos PDF permitidos.
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
            >
              <Upload className="w-4 h-4" />
              Seleccionar Archivos
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-800 dark:text-red-300">Error al procesar</p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-0.5 break-words">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Results Summary */}
      {results.length > 0 && (
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-100 dark:bg-white/8 rounded-lg">
            <FileText className="w-4 h-4 text-neutral-500" />
            <span className="text-sm font-medium text-neutral-700 dark:text-white/80">
              {results.length} archivo{results.length !== 1 ? 's' : ''} procesado{results.length !== 1 ? 's' : ''}
            </span>
          </div>
          {successCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                {successCount} exitoso{successCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}
          {errorCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm font-medium text-red-700 dark:text-red-400">
                {errorCount} rechazado{errorCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Results Table */}
      {results.length > 0 && (
        <div className="bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-50 dark:bg-white/5 border-b border-neutral-200 dark:border-white/10">
                  {['Archivo', 'N. Poliza', 'Cliente', 'RFC', 'Prima Total', 'Vigencia', 'Placas', 'Estado', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-white/50 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
                {results.map((result, index) => (
                  <tr key={index} className="hover:bg-neutral-50 dark:hover:bg-white/3 transition-colors">
                    <td className="px-4 py-3 font-medium text-neutral-800 dark:text-white max-w-[180px] truncate">
                      {result.archivo}
                    </td>
                    <td className="px-4 py-3 text-neutral-600 dark:text-white/70">
                      {result.numeroPoliza || '-'}
                    </td>
                    <td className="px-4 py-3 text-neutral-600 dark:text-white/70 max-w-[200px] truncate">
                      {result.nombreCliente || '-'}
                    </td>
                    <td className="px-4 py-3 text-neutral-600 dark:text-white/70 font-mono text-xs">
                      {result.rfcAsegurado || '-'}
                    </td>
                    <td className="px-4 py-3 font-semibold text-neutral-800 dark:text-white">
                      {result.primaTotal || '-'}
                    </td>
                    <td className="px-4 py-3 text-neutral-600 dark:text-white/70 text-xs">
                      {result.inicioVigencia && result.finVigencia
                        ? `${result.inicioVigencia} - ${result.finVigencia}`
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-neutral-600 dark:text-white/70 font-mono text-xs">
                      {result.placas || '-'}
                    </td>
                    <td className="px-4 py-3">
                      {result.mensaje ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-xs font-medium">
                          <AlertCircle className="w-3 h-3" />
                          Error
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          OK
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedData(result)}
                        className="inline-flex items-center gap-1 text-accent hover:text-accent/80 text-sm font-medium transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedData && (
        <PolizaDetailModal
          data={selectedData}
          onClose={() => setSelectedData(null)}
        />
      )}
    </div>
  );
}

function PolizaDetailModal({ data, onClose }: { data: ExtractedPolizaData; onClose: () => void }) {
  const fields: [string, string | undefined][] = [
    ['Archivo', data.archivo],
    ['Tipo de Poliza', data.tipoPoliza],
    ['Numero de Poliza', data.numeroPoliza],
    ['Nombre o Razon Social', data.nombreCliente],
    ['Direccion', data.direccion],
    ['C.P.', data.cp],
    ['Municipio/Alcaldia', data.municipio],
    ['Colonia', data.colonia],
    ['RFC Asegurado', data.rfcAsegurado],
    ['Descripcion o Version', data.descripcionVehiculo],
    ['Nacional o Importado', data.nacionalImportado],
    ['Placas', data.placas],
    ['Serie', data.serie],
    ['Motor', data.motor],
    ['Forma de Pago', data.formaPago],
    ['Moneda', data.moneda],
    ['Prima Neta', data.primaNeta],
    ['Tasa Financiamiento', data.tasaFinanciamiento],
    ['Gastos de Expedicion', data.gastosExpedicion],
    ['Subtotal', data.subtotal],
    ['I.V.A.', data.iva],
    ['Prima Total', data.primaTotal],
    ['Inicio Vigencia', data.inicioVigencia],
    ['Fin Vigencia', data.finVigencia],
    ['Tipo Vehiculo', data.tipoVehiculo],
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent/10 rounded-xl">
              <Car className="w-5 h-5 text-accent" />
            </div>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
              Detalles de la Poliza
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
          {data.mensaje && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl">
              <p className="text-sm text-red-700 dark:text-red-400 font-medium">{data.mensaje}</p>
            </div>
          )}

          <dl className="divide-y divide-neutral-100 dark:divide-white/5">
            {fields.map(([label, value], i) => (
              <div key={i} className="flex items-start py-2.5 gap-4">
                <dt className="w-40 flex-shrink-0 text-xs font-semibold text-neutral-500 dark:text-white/50 uppercase tracking-wider pt-0.5">
                  {label}
                </dt>
                <dd className="flex-1 text-sm text-neutral-800 dark:text-white font-medium break-words">
                  {value || <span className="text-neutral-400 dark:text-white/30 italic font-normal">No encontrado</span>}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-200 dark:border-white/10">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-neutral-100 dark:bg-white/10 hover:bg-neutral-200 dark:hover:bg-white/15 text-neutral-700 dark:text-white rounded-xl text-sm font-medium transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
