import { X, CheckCircle2, Loader2, AlertTriangle, Shield, ArrowRight } from 'lucide-react';
import { Button } from '../ui/button';

interface DeliveryRecord {
  id: string;
  policy_number: string | null;
  manual_policy_number: string | null;
  insured_name: string | null;
  vendor_sicas_name: string | null;
  sicas_office_name: string | null;
  total_premium: string | null;
  start_date: string | null;
  end_date: string | null;
}

interface ResolvedField {
  value: string;
  label?: string;
  source: string;
}

interface ResolutionData {
  resolved: Record<string, ResolvedField>;
  missing: string[];
  warnings: string[];
  policy_number: string | null;
}

interface Props {
  record: DeliveryRecord;
  resolutionData: ResolutionData;
  onConfirm: () => void;
  onClose: () => void;
  isRegistering: boolean;
}

const SOURCE_LABELS: Record<string, string> = {
  override: 'Override manual',
  default: 'Default configurado',
  catalog_match_poliza: 'Match catalogo (Poliza)',
  catalog_match_qualitas: 'Match catalogo (Qualitas)',
  catalog_match_extracted: 'Match catalogo (datos extraidos)',
  catalog_match_autos: 'Match catalogo (Autos)',
  catalog_match_pesos: 'Match catalogo (Pesos)',
  catalog_match_contado: 'Match catalogo (Contado)',
  catalog_match_vigente: 'Match catalogo (Vigente)',
  single_catalog_item: 'Unico item en catalogo',
  inferred_from_vehicle_data: 'Inferido (datos vehiculo)',
  vendor: 'Datos del vendedor SICAS',
  matched_by_rfc: 'Match por RFC',
  matched_by_name: 'Match por nombre',
  matched_by_name_partial: 'Match parcial por nombre',
  policy_delivery: 'Datos de la entrega',
};

function getSourceLabel(source: string): string {
  return SOURCE_LABELS[source] || source;
}

function getSourceColorClasses(source: string): string {
  if (source === 'override' || source === 'vendor') {
    return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
  }
  if (source.startsWith('catalog_match') || source === 'single_catalog_item') {
    return 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800';
  }
  if (source === 'default') {
    return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800';
  }
  return 'bg-neutral-50 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700';
}

const FIELD_DISPLAY_NAMES: Record<string, string> = {
  IDTipoDocto: 'Tipo de Documento',
  IDCia: 'Aseguradora',
  IDRamo: 'Ramo',
  IDSubRamo: 'SubRamo',
  IDMon: 'Moneda',
  IDFPago: 'Forma de Pago',
  IDEjecutivo: 'Ejecutivo',
  IDGrupo: 'Grupo',
  IDCli: 'Cliente',
  Estatus: 'Estatus',
  IDVend: 'Vendedor',
  IDOficina: 'Oficina',
  FechaInicio: 'Fecha Inicio',
  FechaFin: 'Fecha Fin',
  PrimaTotal: 'Prima Total',
  NumeroPoliza: 'Numero Poliza',
};

function getFieldDisplayName(fieldKey: string): string {
  return FIELD_DISPLAY_NAMES[fieldKey] || fieldKey;
}

export default function SicasPreRegistrationModal({
  record,
  resolutionData,
  onConfirm,
  onClose,
  isRegistering,
}: Props) {
  const policyNumber =
    resolutionData.policy_number ||
    record.manual_policy_number ||
    record.policy_number ||
    'Sin numero';

  const resolvedEntries = Object.entries(resolutionData.resolved);
  const hasWarnings = resolutionData.warnings.length > 0;
  const hasMissing = resolutionData.missing.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl">
              <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
                Confirmar registro SICAS
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Poliza: <span className="font-medium text-neutral-700 dark:text-neutral-300">{policyNumber}</span>
                {record.insured_name && (
                  <span className="ml-2">- {record.insured_name}</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isRegistering}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Warnings */}
        {hasWarnings && (
          <div className="px-5 pt-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-200">Advertencias</p>
                  <ul className="mt-1 space-y-0.5">
                    {resolutionData.warnings.map((warning, i) => (
                      <li key={i} className="text-[11px] text-amber-700 dark:text-amber-300">
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Missing fields alert */}
        {hasMissing && (
          <div className="px-5 pt-4">
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-red-800 dark:text-red-200">Campos sin resolver</p>
                  <p className="text-[11px] text-red-700 dark:text-red-300 mt-1">
                    {resolutionData.missing.join(', ')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Resolved fields table */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="border dark:border-neutral-800 rounded-xl overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_1.2fr_1fr] bg-neutral-50 dark:bg-neutral-800/50 px-4 py-2.5 border-b dark:border-neutral-800">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500 dark:text-neutral-400">
                Campo
              </span>
              <span className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500 dark:text-neutral-400">
                Valor resuelto
              </span>
              <span className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500 dark:text-neutral-400">
                Fuente
              </span>
            </div>

            {/* Table rows */}
            {resolvedEntries.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                No hay campos resueltos
              </div>
            ) : (
              resolvedEntries.map(([fieldKey, field], idx) => (
                <div
                  key={fieldKey}
                  className={`grid grid-cols-[1fr_1.2fr_1fr] px-4 py-2.5 items-center ${
                    idx < resolvedEntries.length - 1
                      ? 'border-b dark:border-neutral-800'
                      : ''
                  } hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors`}
                >
                  <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    {getFieldDisplayName(fieldKey)}
                  </span>
                  <span className="text-xs text-neutral-900 dark:text-white truncate" title={field.label || field.value}>
                    {field.label || field.value}
                    {field.label && field.value && field.label !== field.value && (
                      <span className="ml-1.5 text-[10px] text-muted-foreground">
                        ({field.value})
                      </span>
                    )}
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-medium w-fit ${getSourceColorClasses(field.source)}`}
                  >
                    {getSourceLabel(field.source)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t dark:border-neutral-800 p-5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground max-w-[50%]">
              {resolvedEntries.length} campos resueltos automaticamente.
              Confirme para proceder con el registro.
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onClose} disabled={isRegistering}>
                Cancelar
              </Button>
              <Button
                onClick={onConfirm}
                disabled={isRegistering || hasMissing}
              >
                {isRegistering ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Confirmar y registrar en SICAS
                    <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
