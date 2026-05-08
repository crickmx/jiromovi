import { useState, useEffect } from 'react';
import { X, CheckCircle2, Loader2, AlertTriangle, Shield, ArrowRight, Search, ChevronDown, RefreshCw, Info, UserPlus, Zap, User } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { supabase } from '../../lib/supabase';

interface DeliveryRecord {
  id: string;
  policy_number: string | null;
  manual_policy_number: string | null;
  insured_name: string | null;
  insured_rfc: string | null;
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
  logs?: Record<string, any>;
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
  catalog_match_general: 'Match catalogo (General)',
  matched_to_vendor_name: 'Coincide con vendedor',
  single_catalog_item: 'Unico item en catalogo',
  inferred_from_vehicle_data: 'Inferido (datos vehiculo)',
  vendor: 'Datos del vendedor',
  matched_by_rfc: 'Match por RFC',
  matched_by_name: 'Match por nombre',
  matched_by_name_partial: 'Match parcial por nombre',
  auto_created: 'Creado automaticamente',
  auto_create_pending: 'Se creara automaticamente',
  previously_resolved: 'Resuelto previamente',
  policy_delivery: 'Datos de la entrega',
  user_override: 'Seleccion manual',
  fallback_vendor_id: 'Ejecutivo = Vendedor',
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
  if (source === 'auto_created' || source === 'auto_create_pending' || source === 'fallback_vendor_id') {
    return 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 border-teal-200 dark:border-teal-800';
  }
  if (source.startsWith('catalog_match') || source === 'single_catalog_item' || source.startsWith('matched_by') || source === 'inferred_from_vehicle_data' || source === 'matched_to_vendor_name') {
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
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);
  const [clientCreateStatus, setClientCreateStatus] = useState<string | null>(null);

  const policyNumber =
    resolutionData.policy_number ||
    record.manual_policy_number ||
    record.policy_number ||
    'Sin numero';

  const resolvedEntries = Object.entries(resolutionData.resolved);
  const hasWarnings = resolutionData.warnings.length > 0;

  // Filter out IDEjecutivo and IDCli from missing - these are auto-resolved
  const AUTO_RESOLVED_FIELDS = ['IDEjecutivo', 'IDCli'];
  const allMissingFieldKeys = [...new Set(resolutionData.missing.map(extractFieldKey))];
  const missingFieldKeys = allMissingFieldKeys.filter(k => !AUTO_RESOLVED_FIELDS.includes(k));
  const hasMissing = missingFieldKeys.length > 0;
  const allMissingFilled = hasMissing && missingFieldKeys.every(key => userOverrides[key]?.value);

  // Auto-resolution info for ejecutivo and client
  const ejecutivoResolved = resolutionData.resolved.IDEjecutivo;
  const clienteResolved = resolutionData.resolved.IDCli;
  const clientAutoCreatePending = clienteResolved?.source === 'auto_create_pending';
  const ejecutivoAutoAssigned = ejecutivoResolved?.source === 'fallback_vendor_id';

  // Show auto-resolution section when either field is auto-assigned
  const hasAutoResolution = ejecutivoAutoAssigned || clientAutoCreatePending;

  useEffect(() => {
    if (hasMissing && missingFieldKeys.length > 0) {
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
      const { data: result, error: invokeError } = await supabase.functions.invoke('sicas-sync-hwcapture-catalogs', {
        body: {},
      });

      if (invokeError) throw new Error(invokeError.message || 'Error al sincronizar catalogos');

      if (result.success) {
        const s = result.summary;
        setSyncMessage({
          type: 'success',
          text: `Sincronizados ${s.total_records} registros (${s.success} catalogos OK)`,
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

  async function handleAutoResolveAndRegister() {
    setCreatingClient(true);
    setClientCreateStatus('Resolviendo datos y registrando en SICAS...');
    try {
      // First save any manual overrides for truly missing fields
      if (Object.keys(userOverrides).length > 0) {
        const OVERRIDE_COLUMNS: Record<string, string> = {
          IDTipoDocto: 'sicas_override_tipo_docto',
          IDCia: 'sicas_override_cia',
          IDRamo: 'sicas_override_ramo',
          IDSubRamo: 'sicas_override_subramo',
          IDMon: 'sicas_override_moneda',
          IDFPago: 'sicas_override_fpago',
          IDGrupo: 'sicas_override_grupo',
          Estatus: 'sicas_override_estatus',
        };
        const updateData: Record<string, string> = {};
        for (const [fieldKey, { value }] of Object.entries(userOverrides)) {
          const col = OVERRIDE_COLUMNS[fieldKey];
          if (col && value) updateData[col] = value;
        }
        if (Object.keys(updateData).length > 0) {
          await supabase.from('policy_deliveries').update(updateData).eq('id', record.id);
        }
      }

      // Save defaults if checked
      if (saveAsDefault) {
        await saveSelectedAsDefaults();
      }

      setClientCreateStatus('Ejecutando registro automatico...');

      // Call the auto action - this handles ejecutivo fallback + client creation + registration
      const { data: result, error: invokeError } = await supabase.functions.invoke('sicas-register-policy-delivery', {
        body: { delivery_id: record.id, policy_delivery_id: record.id, action: 'auto' },
      });

      if (invokeError) throw new Error(invokeError.message || 'Error al comunicarse con SICAS');

      if (result.success) {
        setClientCreateStatus(`Registrado exitosamente${result.document_id ? ` (Doc: ${result.document_id})` : ''}`);
        setTimeout(() => onConfirm(), 1200);
      } else if (result.status === 'manual_review_required') {
        setClientCreateStatus(`Algunos campos requieren atencion: ${result.missing?.join(', ') || 'desconocido'}`);
        setTimeout(() => onReResolve(), 1500);
      } else {
        setClientCreateStatus(`Error: ${result.error || result.message || 'No se pudo registrar'}`);
      }
    } catch (err: any) {
      setClientCreateStatus(`Error: ${err.message}`);
    } finally {
      setCreatingClient(false);
    }
  }

  async function handleSaveOverridesAndRegister() {
    if (!allMissingFilled && hasMissing) return;
    // Use the auto-resolve flow directly
    await handleAutoResolveAndRegister();
  }

  async function saveSelectedAsDefaults() {
    for (const [fieldKey, { value, label }] of Object.entries(userOverrides)) {
      if (!value || fieldKey === 'IDCli') continue;
      await supabase
        .from('sicas_hwcapture_defaults')
        .update({ default_value: value, default_label: label || value })
        .eq('field_name', fieldKey);
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
                {record.insured_name && <span className="ml-2">- {record.insured_name}</span>}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isRegistering || creatingClient}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Toolbar */}
        {(hasMissing || hasWarnings) && (
          <div className="px-5 pt-3 flex items-center gap-2 flex-wrap">
            {hasMissing && (
              <Button variant="outline" size="sm" onClick={handleSyncCatalogs} disabled={syncing} className="h-7 text-[11px] gap-1.5">
                {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Sincronizar catalogos
              </Button>
            )}
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

        {/* Client create status */}
        {clientCreateStatus && (
          <div className="px-5 pt-2">
            <div className={`p-2.5 rounded-lg text-[11px] ${
              clientCreateStatus.startsWith('Error')
                ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                : clientCreateStatus.startsWith('Cliente creado') || clientCreateStatus.startsWith('Cliente encontrado')
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
            }`}>
              {creatingClient && <Loader2 className="h-3 w-3 animate-spin inline mr-1.5" />}
              {clientCreateStatus}
            </div>
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
          {/* Auto-resolution info */}
          {hasAutoResolution && (
            <div className="bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-teal-800 dark:text-teal-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5" />
                Resolucion automatica
              </h3>
              <div className="flex flex-wrap gap-2">
                {ejecutivoAutoAssigned && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white dark:bg-neutral-800 rounded-lg border border-teal-200 dark:border-teal-700">
                    <User className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                    <span className="text-[11px] text-neutral-700 dark:text-neutral-300">
                      <span className="font-medium">Ejecutivo</span> = {ejecutivoResolved?.label || 'Vendedor'}
                    </span>
                    <Badge className="text-[9px] px-1.5 py-0 bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300 border-teal-200 dark:border-teal-800">
                      Auto
                    </Badge>
                  </div>
                )}
                {clientAutoCreatePending && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white dark:bg-neutral-800 rounded-lg border border-teal-200 dark:border-teal-700">
                    <UserPlus className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                    <span className="text-[11px] text-neutral-700 dark:text-neutral-300">
                      <span className="font-medium">Cliente</span> = {clienteResolved?.label || 'Se creara'}
                    </span>
                    <Badge className="text-[9px] px-1.5 py-0 bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300 border-teal-200 dark:border-teal-800">
                      Auto
                    </Badge>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-teal-700/70 dark:text-teal-400/70 mt-2">
                MOVI resolvera estos campos automaticamente al registrar en SICAS.
              </p>
            </div>
          )}

          {/* Resolved fields */}
          {resolvedEntries.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Datos resueltos ({resolvedEntries.length})
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
                      {field.source === 'auto_create_pending' ? (
                        <span className="italic text-teal-700 dark:text-teal-400">{field.label || 'Se creara automaticamente'}</span>
                      ) : (
                        <>
                          {field.label || field.value}
                          {field.label && field.value && field.label !== field.value && field.value !== '__auto_create__' && (
                            <span className="ml-1 text-[10px] text-muted-foreground">({field.value})</span>
                          )}
                        </>
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

          {/* Missing fields (only non-auto-resolved ones) */}
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

                    return (
                      <MissingFieldSelector
                        key={fieldKey}
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
                  ? 'Campos completados. Listo para registrar.'
                  : `${missingFieldKeys.length} campo(s) pendientes de seleccionar.`
                : `${resolvedEntries.length} campos resueltos. Listo para registrar.`}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onClose} disabled={isRegistering || creatingClient}>
                Cancelar
              </Button>

              {hasMissing ? (
                <Button
                  onClick={handleSaveOverridesAndRegister}
                  disabled={!allMissingFilled || creatingClient}
                >
                  {creatingClient ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Registrando...</>
                  ) : (
                    <><Zap className="h-4 w-4 mr-2" />Resolver y registrar en SICAS<ArrowRight className="h-3.5 w-3.5 ml-1.5" /></>
                  )}
                </Button>
              ) : (
                <Button onClick={handleAutoResolveAndRegister} disabled={isRegistering || creatingClient}>
                  {isRegistering || creatingClient ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Registrando...</>
                  ) : (
                    <><Zap className="h-4 w-4 mr-2" />Resolver y registrar en SICAS<ArrowRight className="h-3.5 w-3.5 ml-1.5" /></>
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
                placeholder={`Buscar (${options.length} items)...`}
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); if (!isOpen) setIsOpen(true); }}
                onFocus={() => setIsOpen(true)}
                className="h-8 pl-8 text-xs"
              />
            </div>
            <button onClick={() => setIsOpen(!isOpen)} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition-colors">
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
                    onClick={() => { onSelect(opt.id_sicas, opt.nombre); setIsOpen(false); setSearchTerm(''); }}
                  >
                    <span className="truncate">{opt.nombre}</span>
                    <span className="text-[10px] text-muted-foreground ml-2 shrink-0 font-mono">{opt.id_sicas}</span>
                  </button>
                ))
              )}
            </div>
          )}

          <button onClick={() => setShowManual(true)} className="mt-1.5 text-[10px] text-muted-foreground hover:text-neutral-700 dark:hover:text-neutral-300 underline underline-offset-2">
            Capturar ID manualmente
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Input placeholder={`ID SICAS para ${fieldLabel}`} value={manualValue} onChange={(e) => setManualValue(e.target.value)} className="h-8 text-xs flex-1" />
            <Button size="sm" variant="outline" className="h-8 text-xs px-2" disabled={!manualValue.trim()} onClick={() => { onSelect(manualValue.trim(), `Manual: ${manualValue.trim()}`); setManualValue(''); }}>
              Usar
            </Button>
          </div>
          {options.length > 0 && (
            <button onClick={() => setShowManual(false)} className="text-[10px] text-muted-foreground hover:text-neutral-700 dark:hover:text-neutral-300 underline underline-offset-2">
              Volver a buscar en catalogo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
