import { useState, useEffect, useCallback } from 'react';
import { X, CheckCircle2, Loader2, AlertTriangle, Shield, ArrowRight, Zap, Search, ChevronDown, RefreshCw, Save, Info } from 'lucide-react';
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
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

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

  async function handleSyncCatalogs() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No hay sesion activa');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sicas-sync-hwcapture-catalogs`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }
      );

      const result = await response.json();
      if (result.success) {
        const s = result.summary;
        setSyncMessage({
          type: 'success',
          text: `Sincronizados ${s.total_records} registros (${s.success} catalogos OK, ${s.errors} errores)`,
        });
        await loadCatalogsForMissing();
      } else {
        setSyncMessage({ type: 'error', text: result.error || 'Error desconocido' });
      }
    } catch (err: any) {
      setSyncMessage({ type: 'error', text: err.message });
    } finally {
      setSyncing(false);
    }
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

      // Save as HWCAPTURE defaults if checkbox is checked
      if (saveAsDefault) {
        await saveSelectedAsDefaults();
      }

      onReResolve();
    } catch (err: any) {
      console.error('Error saving overrides:', err);
    } finally {
      setSavingOverrides(false);
    }
  }

  async function saveSelectedAsDefaults() {
    const FIELD_TO_DEFAULT: Record<string, string> = {
      IDTipoDocto: 'IDTipoDocto',
      IDCia: 'IDCia',
      IDRamo: 'IDRamo',
      IDSubRamo: 'IDSubRamo',
      IDMon: 'IDMon',
      IDFPago: 'IDFPago',
      IDEjecutivo: 'IDEjecutivo',
      IDGrupo: 'IDGrupo',
      Estatus: 'Estatus',
    };

    for (const [fieldKey, { value, label }] of Object.entries(userOverrides)) {
      const fieldName = FIELD_TO_DEFAULT[fieldKey];
      if (!fieldName || !value || fieldKey === 'IDCli') continue;

      await supabase
        .from('sicas_hwcapture_defaults')
        .update({
          default_value: value,
          default_label: label || value,
        })
        .eq('field_name', fieldName);
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

        {/* Sync bar + Diagnostics toggle */}
        {hasMissing && (
          <div className="px-5 pt-3 flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncCatalogs}
              disabled={syncing}
              className="h-7 text-[11px] gap-1.5"
            >
              {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Sincronizar catalogos SICAS
            </Button>
            <button
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className="h-7 px-2.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-neutral-700 dark:hover:text-neutral-300 border rounded-md transition-colors"
            >
              <Info className="h-3 w-3" />
              {showDiagnostics ? 'Ocultar diagnostico' : 'Ver diagnostico'}
            </button>
            {syncMessage && (
              <span className={`text-[11px] ${syncMessage.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {syncMessage.text}
              </span>
            )}
          </div>
        )}

        {/* Diagnostics panel */}
        {showDiagnostics && hasWarnings && (
          <div className="px-5 pt-3">
            <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 border dark:border-neutral-700 rounded-xl">
              <p className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5">Diagnostico de resolucion</p>
              <ul className="space-y-1">
                {resolutionData.warnings.map((warning, i) => (
                  <li key={i} className="text-[11px] text-neutral-600 dark:text-neutral-400 flex items-start gap-1.5">
                    <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                    {warning}
                  </li>
                ))}
              </ul>
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
                    if (fieldKey === 'IDCli') {
                      return (
                        <ClientSearchField
                          key={fieldKey}
                          selectedValue={userOverrides[fieldKey]?.value || ''}
                          selectedLabel={userOverrides[fieldKey]?.label || ''}
                          onSelect={(value, label) => {
                            setUserOverrides(prev => ({ ...prev, [fieldKey]: { value, label } }));
                          }}
                        />
                      );
                    }

                    const catalogTypeId = FIELD_CATALOG_MAP[fieldKey];
                    const options = catalogTypeId ? catalogs[catalogTypeId] || [] : [];

                    return (
                      <MissingFieldSelector
                        key={fieldKey}
                        fieldKey={fieldKey}
                        fieldLabel={getFieldDisplayName(fieldKey)}
                        options={options}
                        selectedValue={userOverrides[fieldKey]?.value || ''}
                        selectedLabel={userOverrides[fieldKey]?.label || ''}
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
          {/* Save as default checkbox */}
          {hasMissing && Object.keys(userOverrides).length > 0 && (
            <label className="flex items-center gap-2 mb-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={saveAsDefault}
                onChange={(e) => setSaveAsDefault(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-neutral-300 dark:border-neutral-600 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-[11px] text-neutral-600 dark:text-neutral-400">
                Guardar selecciones como default HWCAPTURE (se usaran automaticamente en futuras polizas)
              </span>
            </label>
          )}

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
                      <Save className="h-4 w-4 mr-2" />
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

// ---- Client Search Field (live search via edge function) ----

interface ClientSearchFieldProps {
  selectedValue: string;
  selectedLabel: string;
  onSelect: (value: string, label: string) => void;
}

function ClientSearchField({ selectedValue, selectedLabel, onSelect }: ClientSearchFieldProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Array<{ id_sicas: string; nombre: string; rfc?: string }>>([]);
  const [showResults, setShowResults] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualValue, setManualValue] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearch = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    setSearching(true);
    setSearchError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sin sesion');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sicas-search-client`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: query.trim(), limit: 15 }),
        }
      );

      const data = await response.json();
      if (data.success) {
        setResults(data.results || []);
        setShowResults(true);
      } else {
        setSearchError(data.error || 'Error buscando');
      }
    } catch (err: any) {
      setSearchError(err.message);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.trim().length >= 2) {
        handleSearch(searchTerm);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm, handleSearch]);

  if (showManual) {
    return (
      <div className={`border rounded-xl p-3 transition-colors ${selectedValue ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/10' : 'border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/10'}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
            Cliente SICAS
            {!selectedValue && <Badge variant="destructive" className="text-[9px] px-1 py-0">Requerido</Badge>}
          </span>
          {selectedValue && (
            <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
              {selectedLabel} ({selectedValue})
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Ingresar ID SICAS del cliente"
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
              onSelect(manualValue.trim(), `ID: ${manualValue.trim()}`);
              setManualValue('');
            }}
          >
            Usar
          </Button>
        </div>
        <button
          onClick={() => setShowManual(false)}
          className="mt-1.5 text-[10px] text-muted-foreground hover:text-neutral-700 dark:hover:text-neutral-300 underline underline-offset-2"
        >
          Volver a buscar cliente
        </button>
      </div>
    );
  }

  return (
    <div className={`border rounded-xl p-3 transition-colors ${selectedValue ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/10' : 'border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/10'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
          Cliente SICAS
          {!selectedValue && <Badge variant="destructive" className="text-[9px] px-1 py-0">Requerido</Badge>}
        </span>
        {selectedValue && (
          <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
            {selectedLabel} ({selectedValue})
          </Badge>
        )}
      </div>

      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o RFC del cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
          {searching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>

        {showResults && results.length > 0 && (
          <div className="absolute z-20 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 shadow-xl">
            {results.map((client) => (
              <button
                key={client.id_sicas}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors border-b dark:border-neutral-800 last:border-b-0 ${selectedValue === client.id_sicas ? 'bg-emerald-50 dark:bg-emerald-950/30 font-medium' : ''}`}
                onClick={() => {
                  onSelect(client.id_sicas, client.nombre);
                  setShowResults(false);
                  setSearchTerm('');
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate">{client.nombre}</span>
                  <span className="text-[10px] text-muted-foreground ml-2 shrink-0 font-mono">{client.id_sicas}</span>
                </div>
                {client.rfc && (
                  <span className="text-[10px] text-muted-foreground">RFC: {client.rfc}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {showResults && results.length === 0 && searchTerm.trim().length >= 2 && !searching && (
          <div className="absolute z-20 top-full left-0 right-0 mt-1 p-3 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 shadow-xl">
            <p className="text-xs text-muted-foreground text-center">Sin resultados para "{searchTerm}"</p>
          </div>
        )}

        {searchError && (
          <p className="mt-1 text-[10px] text-red-500">{searchError}</p>
        )}

        <button
          onClick={() => setShowManual(true)}
          className="mt-1.5 text-[10px] text-muted-foreground hover:text-neutral-700 dark:hover:text-neutral-300 underline underline-offset-2"
        >
          Capturar ID manualmente
        </button>
      </div>
    </div>
  );
}

// ---- Missing Field Selector (catalog-based) ----

interface MissingFieldSelectorProps {
  fieldKey: string;
  fieldLabel: string;
  options: CatalogOption[];
  selectedValue: string;
  selectedLabel: string;
  onSelect: (value: string, label: string) => void;
}

function MissingFieldSelector({ fieldKey, fieldLabel, options, selectedValue, selectedLabel, onSelect }: MissingFieldSelectorProps) {
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
