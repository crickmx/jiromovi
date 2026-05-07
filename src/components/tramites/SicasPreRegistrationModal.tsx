import { useState, useEffect } from 'react';
import { X, CheckCircle2, Loader2, AlertTriangle, Shield, ArrowRight, Zap, Search, ChevronDown } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { supabase } from '../../lib/supabase';

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

interface CatalogOption {
  id_sicas: string;
  nombre: string;
}

interface Props {
  record: DeliveryRecord;
  resolutionData: ResolutionData;
  onConfirm: () => void;
  onClose: () => void;
  onReResolve: () => void;
  isRegistering: boolean;
}

const SOURCE_LABELS: Record<string, string> = {
  override: 'Override manual',
  default: 'Default configurado',
  catalog_match_poliza: 'Match catalogo (Poliza)',
  catalog_match_qualitas: 'Match catalogo (Qualitas)',
  catalog_match_extracted: 'Match datos extraidos',
  catalog_match_autos: 'Match catalogo (Autos)',
  catalog_match_pesos: 'Match catalogo (Pesos)',
  catalog_match_contado: 'Match catalogo (Contado)',
  catalog_match_vigente: 'Match catalogo (Vigente)',
  single_catalog_item: 'Unico item en catalogo',
  inferred_from_vehicle_data: 'Inferido (datos vehiculo)',
  vendor: 'Datos del vendedor',
  matched_by_rfc: 'Match por RFC',
  matched_by_name: 'Match por nombre',
  matched_by_name_partial: 'Match parcial por nombre',
  policy_delivery: 'Datos de la entrega',
  user_override: 'Seleccion manual',
};

const FIELD_DISPLAY_NAMES: Record<string, string> = {
  IDTipoDocto: 'Tipo de Documento',
  IDCia: 'Aseguradora',
  IDRamo: 'Ramo',
  IDSubRamo: 'SubRamo',
  IDMon: 'Moneda',
  IDFPago: 'Forma de Pago',
  IDEjecutivo: 'Ejecutivo',
  IDGrupo: 'Grupo',
  IDCli: 'Cliente SICAS',
  Estatus: 'Estatus',
  IDVend: 'Vendedor',
  IDOficina: 'Oficina',
  FechaInicio: 'Fecha Inicio',
  FechaFin: 'Fecha Fin',
  PrimaTotal: 'Prima Total',
  NumeroPoliza: 'Numero Poliza',
};

const FIELD_CATALOG_MAP: Record<string, number> = {
  IDTipoDocto: 24,
  IDCia: 12,
  IDRamo: 9,
  IDSubRamo: 10,
  IDMon: 6,
  IDFPago: 8,
  IDEjecutivo: 16,
  IDGrupo: 62,
  Estatus: 40,
};

function getSourceLabel(source: string): string {
  return SOURCE_LABELS[source] || source;
}

function getSourceColorClasses(source: string): string {
  if (source === 'override' || source === 'vendor' || source === 'user_override') {
    return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
  }
  if (source.startsWith('catalog_match') || source === 'single_catalog_item' || source.startsWith('matched_by') || source === 'inferred_from_vehicle_data') {
    return 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800';
  }
  if (source === 'default') {
    return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800';
  }
  return 'bg-neutral-50 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700';
}

function getFieldDisplayName(fieldKey: string): string {
  return FIELD_DISPLAY_NAMES[fieldKey] || fieldKey;
}

function extractFieldKey(missingLabel: string): string {
  const match = missingLabel.match(/\((\w+)\)/);
  if (match) return match[1];
  if (/tipo.?doc/i.test(missingLabel)) return 'IDTipoDocto';
  if (/aseguradora|compa[nñ]ia/i.test(missingLabel)) return 'IDCia';
  if (/\bramo\b/i.test(missingLabel) && !/subramo/i.test(missingLabel)) return 'IDRamo';
  if (/subramo/i.test(missingLabel)) return 'IDSubRamo';
  if (/moneda/i.test(missingLabel)) return 'IDMon';
  if (/forma.?pago/i.test(missingLabel)) return 'IDFPago';
  if (/ejecutivo/i.test(missingLabel)) return 'IDEjecutivo';
  if (/grupo/i.test(missingLabel)) return 'IDGrupo';
  if (/cliente/i.test(missingLabel)) return 'IDCli';
  if (/estatus/i.test(missingLabel)) return 'Estatus';
  if (/agente|vendedor/i.test(missingLabel)) return 'IDVend';
  return missingLabel;
}

export default function SicasPreRegistrationModal({
  record,
  resolutionData,
  onConfirm,
  onClose,
  onReResolve,
  isRegistering,
}: Props) {
  const [catalogs, setCatalogs] = useState<Record<number, CatalogOption[]>>({});
  const [loadingCatalogs, setLoadingCatalogs] = useState(false);
  const [userOverrides, setUserOverrides] = useState<Record<string, { value: string; label: string }>>({});
  const [savingOverrides, setSavingOverrides] = useState(false);

  const policyNumber =
    resolutionData.policy_number ||
    record.manual_policy_number ||
    record.policy_number ||
    'Sin numero';

  const resolvedEntries = Object.entries(resolutionData.resolved);
  const hasWarnings = resolutionData.warnings.length > 0;
  const missingFieldKeys = resolutionData.missing.map(extractFieldKey);
  const hasMissing = missingFieldKeys.length > 0;
  const allMissingFilled = hasMissing && missingFieldKeys.every(key => userOverrides[key]?.value);

  useEffect(() => {
    if (hasMissing) {
      loadCatalogsForMissing();
    }
  }, [resolutionData.missing]);

  async function loadCatalogsForMissing() {
    setLoadingCatalogs(true);
    const typeIds = new Set<number>();
    for (const key of missingFieldKeys) {
      const catId = FIELD_CATALOG_MAP[key];
      if (catId) typeIds.add(catId);
    }

    const results: Record<number, CatalogOption[]> = {};
    for (const ctId of typeIds) {
      const { data } = await supabase
        .from('sicas_catalogos')
        .select('id_sicas, nombre')
        .eq('catalog_type_id', ctId)
        .order('nombre');
      results[ctId] = data || [];
    }
    setCatalogs(results);
    setLoadingCatalogs(false);
  }

  async function handleSaveOverridesAndRegister() {
    if (!allMissingFilled && hasMissing) return;

    setSavingOverrides(true);
    try {
      const OVERRIDE_COLUMNS: Record<string, string> = {
        IDTipoDocto: 'sicas_override_tipo_docto',
        IDCia: 'sicas_override_cia',
        IDRamo: 'sicas_override_ramo',
        IDSubRamo: 'sicas_override_subramo',
        IDMon: 'sicas_override_moneda',
        IDFPago: 'sicas_override_fpago',
        IDEjecutivo: 'sicas_override_ejecutivo',
        IDGrupo: 'sicas_override_grupo',
        IDCli: 'sicas_override_cliente',
        Estatus: 'sicas_override_estatus',
      };

      const updateData: Record<string, string | null> = {};
      for (const [fieldKey, { value }] of Object.entries(userOverrides)) {
        const col = OVERRIDE_COLUMNS[fieldKey];
        if (col && value) {
          updateData[col] = value;
        }
      }

      if (Object.keys(updateData).length > 0) {
        updateData['sicas_registration_status'] = 'ready_to_register';
        updateData['sicas_error_message'] = null;

        const { error } = await supabase
          .from('policy_deliveries')
          .update(updateData)
          .eq('id', record.id);

        if (error) throw error;
      }

      onReResolve();
    } catch (err: any) {
      console.error('Error saving overrides:', err);
    } finally {
      setSavingOverrides(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${hasMissing && !allMissingFilled ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-emerald-50 dark:bg-emerald-950/30'}`}>
              <Shield className={`h-5 w-5 ${hasMissing && !allMissingFilled ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
                {hasMissing && !allMissingFilled ? 'Resolver datos SICAS' : 'Confirmar registro SICAS'}
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
            disabled={isRegistering || savingOverrides}
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Resolved fields section */}
          {resolvedEntries.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Datos resueltos automaticamente ({resolvedEntries.length})
              </h3>
              <div className="border dark:border-neutral-800 rounded-xl overflow-hidden">
                <div className="grid grid-cols-[1fr_1.2fr_1fr] bg-neutral-50 dark:bg-neutral-800/50 px-4 py-2 border-b dark:border-neutral-800">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500 dark:text-neutral-400">Campo</span>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500 dark:text-neutral-400">Valor</span>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500 dark:text-neutral-400">Fuente</span>
                </div>
                {resolvedEntries.map(([fieldKey, field], idx) => (
                  <div
                    key={fieldKey}
                    className={`grid grid-cols-[1fr_1.2fr_1fr] px-4 py-2 items-center ${
                      idx < resolvedEntries.length - 1 ? 'border-b dark:border-neutral-800' : ''
                    } hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors`}
                  >
                    <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      {getFieldDisplayName(fieldKey)}
                    </span>
                    <span className="text-xs text-neutral-900 dark:text-white truncate" title={field.label || field.value}>
                      {field.label || field.value}
                      {field.label && field.value && field.label !== field.value && (
                        <span className="ml-1 text-[10px] text-muted-foreground">({field.value})</span>
                      )}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-medium w-fit ${getSourceColorClasses(field.source)}`}>
                      {getSourceLabel(field.source)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Missing fields section with catalog selectors */}
          {hasMissing && (
            <div>
              <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                Campos que requieren seleccion ({missingFieldKeys.length})
              </h3>

              {loadingCatalogs ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-xs text-muted-foreground">Cargando catalogos...</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {missingFieldKeys.map((fieldKey) => {
                    const catalogTypeId = FIELD_CATALOG_MAP[fieldKey];
                    const options = catalogTypeId ? catalogs[catalogTypeId] || [] : [];
                    const userVal = userOverrides[fieldKey];

                    return (
                      <MissingFieldSelector
                        key={fieldKey}
                        fieldLabel={getFieldDisplayName(fieldKey)}
                        options={options}
                        selectedValue={userVal?.value || ''}
                        selectedLabel={userVal?.label || ''}
                        onSelect={(value, label) => {
                          setUserOverrides(prev => ({ ...prev, [fieldKey]: { value, label } }));
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t dark:border-neutral-800 p-5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground max-w-[50%]">
              {hasMissing
                ? allMissingFilled
                  ? 'Todos los campos completados. Guarde y reintente la resolucion.'
                  : `${missingFieldKeys.length} campo(s) pendientes de seleccion.`
                : `${resolvedEntries.length} campos resueltos. Confirme para registrar.`}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onClose} disabled={isRegistering || savingOverrides}>
                Cancelar
              </Button>

              {hasMissing ? (
                <Button
                  onClick={handleSaveOverridesAndRegister}
                  disabled={!allMissingFilled || savingOverrides}
                >
                  {savingOverrides ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Guardar y re-resolver
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={onConfirm}
                  disabled={isRegistering}
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
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Missing Field Selector ----

interface MissingFieldSelectorProps {
  fieldLabel: string;
  options: CatalogOption[];
  selectedValue: string;
  selectedLabel: string;
  onSelect: (value: string, label: string) => void;
}

function MissingFieldSelector({ fieldLabel, options, selectedValue, selectedLabel, onSelect }: MissingFieldSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [manualValue, setManualValue] = useState('');

  const filtered = options.filter(o => {
    if (!searchTerm) return true;
    const t = searchTerm.toLowerCase();
    return o.nombre.toLowerCase().includes(t) || o.id_sicas.toLowerCase().includes(t);
  }).slice(0, 30);

  return (
    <div className={`border rounded-xl p-3 transition-colors ${selectedValue ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/10' : 'border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/10'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
          {fieldLabel}
          {!selectedValue && <Badge variant="destructive" className="text-[9px] px-1 py-0">Requerido</Badge>}
        </span>
        {selectedValue && (
          <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
            {selectedLabel} ({selectedValue})
          </Badge>
        )}
      </div>

      {options.length > 0 && !showManual ? (
        <div className="relative">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder={`Buscar en catalogo (${options.length} items)...`}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (!isOpen) setIsOpen(true);
                }}
                onFocus={() => setIsOpen(true)}
                className="h-8 pl-8 text-xs"
              />
            </div>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition-colors"
            >
              <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {isOpen && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 max-h-44 overflow-y-auto border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 shadow-xl">
              {filtered.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground text-center">Sin resultados</p>
              ) : (
                filtered.map((opt) => (
                  <button
                    key={opt.id_sicas}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors border-b dark:border-neutral-800 last:border-b-0 flex items-center justify-between ${selectedValue === opt.id_sicas ? 'bg-emerald-50 dark:bg-emerald-950/30 font-medium' : ''}`}
                    onClick={() => {
                      onSelect(opt.id_sicas, opt.nombre);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                  >
                    <span className="truncate">{opt.nombre}</span>
                    <span className="text-[10px] text-muted-foreground ml-2 shrink-0 font-mono">{opt.id_sicas}</span>
                  </button>
                ))
              )}
            </div>
          )}

          <button
            onClick={() => setShowManual(true)}
            className="mt-1.5 text-[10px] text-muted-foreground hover:text-neutral-700 dark:hover:text-neutral-300 underline underline-offset-2"
          >
            Capturar ID manualmente
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Input
              placeholder={`Ingresar ID SICAS para ${fieldLabel}`}
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              className="h-8 text-xs flex-1"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs px-2"
              disabled={!manualValue.trim()}
              onClick={() => {
                onSelect(manualValue.trim(), `Manual: ${manualValue.trim()}`);
                setManualValue('');
              }}
            >
              Usar
            </Button>
          </div>
          {options.length > 0 && (
            <button
              onClick={() => setShowManual(false)}
              className="text-[10px] text-muted-foreground hover:text-neutral-700 dark:hover:text-neutral-300 underline underline-offset-2"
            >
              Volver a buscar en catalogo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
