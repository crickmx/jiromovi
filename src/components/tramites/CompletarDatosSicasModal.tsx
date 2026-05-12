import { useState, useEffect } from 'react';
import { X, Loader2, Search, CheckCircle2, AlertTriangle, Zap, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';

interface DeliveryRecord {
  id: string;
  policy_number: string | null;
  manual_policy_number: string | null;
  insured_name: string | null;
  total_premium: string | null;
  start_date: string | null;
  end_date: string | null;
  vendor_sicas_name: string | null;
  vendor_sicas_id: string | null;
  sicas_manual_review_reason: string | null;
  sicas_override_tipo_docto: string | null;
  sicas_override_cia: string | null;
  sicas_override_ramo: string | null;
  sicas_override_subramo: string | null;
  sicas_override_moneda: string | null;
  sicas_override_fpago: string | null;
  sicas_override_ejecutivo: string | null;
  sicas_override_grupo: string | null;
  sicas_override_cliente: string | null;
  sicas_override_estatus: string | null;
  [key: string]: any;
}

interface CatalogOption {
  id_sicas: string;
  nombre: string;
}

interface FieldDef {
  fieldName: string;
  overrideColumn: string;
  label: string;
  catalogTypeId: number | null;
}

const OVERRIDE_FIELDS: FieldDef[] = [
  { fieldName: 'IDTipoDocto', overrideColumn: 'sicas_override_tipo_docto', label: 'Tipo de Documento', catalogTypeId: 24 },
  { fieldName: 'IDCia', overrideColumn: 'sicas_override_cia', label: 'Aseguradora', catalogTypeId: 12 },
  { fieldName: 'IDRamo', overrideColumn: 'sicas_override_ramo', label: 'Ramo', catalogTypeId: 9 },
  { fieldName: 'IDSubRamo', overrideColumn: 'sicas_override_subramo', label: 'SubRamo', catalogTypeId: 10 },
  { fieldName: 'IDMon', overrideColumn: 'sicas_override_moneda', label: 'Moneda', catalogTypeId: 6 },
  { fieldName: 'IDFPago', overrideColumn: 'sicas_override_fpago', label: 'Forma de Pago', catalogTypeId: 8 },
  { fieldName: 'IDEjecutivo', overrideColumn: 'sicas_override_ejecutivo', label: 'Ejecutivo', catalogTypeId: 16 },
  { fieldName: 'IDGrupo', overrideColumn: 'sicas_override_grupo', label: 'Grupo', catalogTypeId: 62 },
  { fieldName: 'IDCli', overrideColumn: 'sicas_override_cliente', label: 'Cliente (RFC/Nombre)', catalogTypeId: null },
  { fieldName: 'Estatus', overrideColumn: 'sicas_override_estatus', label: 'Estatus', catalogTypeId: 40 },
];

interface Props {
  record: DeliveryRecord;
  onClose: () => void;
  onSaved: () => void;
  onSavedAndRegister?: () => void;
}

function findFieldValue(record: any, ...fieldNames: string[]): { value: string | null; source: string } {
  for (const name of fieldNames) {
    const val = record[name];
    if (val && String(val).trim() && String(val).trim() !== 'null' && String(val).trim() !== 'undefined') {
      return { value: String(val).trim(), source: `delivery.${name}` };
    }
  }
  const ext = record.extracted_data as Record<string, any> | null;
  if (ext) {
    for (const name of fieldNames) {
      const val = ext[name];
      if (val && String(val).trim() && String(val).trim() !== 'null' && String(val).trim() !== 'undefined') {
        return { value: String(val).trim(), source: `extracted_data.${name}` };
      }
    }
  }
  return { value: null, source: 'no encontrado' };
}

function normalizePremium(val: string): string {
  return val.replace(/[$,\s]/g, '').trim();
}

export default function CompletarDatosSicasModal({ record, onClose, onSaved, onSavedAndRegister }: Props) {
  const [catalogs, setCatalogs] = useState<Record<number, CatalogOption[]>>({});
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingAndRegistering, setSavingAndRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [policyNumber, setPolicyNumber] = useState('');
  const [insuredName, setInsuredName] = useState('');
  const [premium, setPremium] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [clientId, setClientId] = useState('');

  const [sources, setSources] = useState<Record<string, string>>({});

  useEffect(() => {
    loadCatalogs();
    prefillCoreFields();
    const initial: Record<string, string> = {};
    for (const field of OVERRIDE_FIELDS) {
      const val = (record as any)[field.overrideColumn];
      if (val) initial[field.overrideColumn] = val;
    }
    setOverrides(initial);
  }, []);

  function prefillCoreFields() {
    const rec = record as any;
    const newSources: Record<string, string> = {};

    const poliza = findFieldValue(rec, 'policy_number', 'manual_policy_number', 'poliza', 'numero_poliza', 'document_number', 'Documento');
    if (poliza.value) { setPolicyNumber(poliza.value); newSources.policy_number = poliza.source; }

    const asegurado = findFieldValue(rec, 'insured_name', 'asegurado', 'contratante', 'client_name', 'nombre_asegurado');
    if (asegurado.value) { setInsuredName(asegurado.value); newSources.insured_name = asegurado.source; }

    const prima = findFieldValue(rec, 'total_premium', 'premium', 'prima', 'prima_neta', 'net_premium', 'PrimaNeta');
    if (prima.value) { setPremium(prima.value); newSources.premium = prima.source; }

    const inicio = findFieldValue(rec, 'start_date', 'fecha_inicio', 'vigencia_inicio', 'FDesde');
    if (inicio.value) { setStartDate(inicio.value); newSources.start_date = inicio.source; }

    const fin = findFieldValue(rec, 'end_date', 'fecha_fin', 'vigencia_fin', 'FHasta');
    if (fin.value) { setEndDate(fin.value); newSources.end_date = fin.source; }

    const cli = findFieldValue(rec, 'sicas_client_id', 'IDCli', 'sicas_override_cliente');
    if (cli.value && cli.value !== '0' && cli.value !== '__auto_create__') {
      setClientId(cli.value);
      newSources.sicas_client_id = cli.source;
    }

    setSources(newSources);
  }

  async function loadCatalogs() {
    setLoadingCatalogs(true);
    const catalogTypeIds = [...new Set(OVERRIDE_FIELDS.map(f => f.catalogTypeId).filter(Boolean))] as number[];
    const results: Record<number, CatalogOption[]> = {};
    for (const ctId of catalogTypeIds) {
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

  function getCoreFieldsMissing(): string[] {
    const missing: string[] = [];
    if (!policyNumber.trim()) missing.push('Poliza');
    if (!insuredName.trim()) missing.push('Asegurado');
    if (!premium.trim()) missing.push('Prima');
    if (!startDate.trim()) missing.push('Fecha inicio');
    if (!endDate.trim()) missing.push('Fecha fin');
    return missing;
  }

  async function handleSave(andRegister = false) {
    if (andRegister) setSavingAndRegistering(true);
    else setSaving(true);
    setError(null);

    try {
      const updateData: Record<string, any> = {};

      if (policyNumber.trim()) updateData.policy_number = policyNumber.trim();
      if (insuredName.trim()) updateData.insured_name = insuredName.trim();
      if (premium.trim()) updateData.total_premium = normalizePremium(premium);
      if (startDate.trim()) updateData.start_date = startDate.trim();
      if (endDate.trim()) updateData.end_date = endDate.trim();
      if (clientId.trim()) {
        updateData.sicas_client_id = clientId.trim();
        updateData.sicas_override_cliente = clientId.trim();
      }

      for (const field of OVERRIDE_FIELDS) {
        const val = overrides[field.overrideColumn];
        if (val && val.trim()) {
          updateData[field.overrideColumn] = val.trim();
        }
      }

      if (Object.keys(updateData).length === 0) {
        setError('Debe completar al menos un campo');
        setSaving(false);
        setSavingAndRegistering(false);
        return;
      }

      const coreMissing = getCoreFieldsMissing();
      if (coreMissing.length === 0) {
        updateData.sicas_registration_status = 'ready_to_register';
        updateData.sicas_error_message = null;
      }

      updateData.sicas_request_debug = {
        ...(record as any).sicas_request_debug,
        data_resolution: {
          resolved_at: new Date().toISOString(),
          sources,
          core_fields_complete: coreMissing.length === 0,
          missing_after_resolve: coreMissing,
        },
      };

      const { error: updateError } = await supabase
        .from('policy_deliveries')
        .update(updateData)
        .eq('id', record.id);

      if (updateError) throw updateError;

      if (andRegister && coreMissing.length === 0 && onSavedAndRegister) {
        onSavedAndRegister();
      } else {
        onSaved();
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error guardando datos');
    } finally {
      setSaving(false);
      setSavingAndRegistering(false);
    }
  }

  const coreMissing = getCoreFieldsMissing();
  const canRegister = coreMissing.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b dark:border-neutral-800">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
              Resolver datos SICAS
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
              Completa los datos necesarios para registrar la poliza en SICAS.
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* === CORE FIELDS SECTION === */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-neutral-800 dark:text-white">Datos obligatorios de la poliza</h3>
              {coreMissing.length > 0 && (
                <Badge variant="destructive" className="text-[10px]">Faltan {coreMissing.length}</Badge>
              )}
            </div>

            {/* Policy Number */}
            <CoreField
              label="Poliza / Documento"
              value={policyNumber}
              onChange={setPolicyNumber}
              source={sources.policy_number}
              required
              placeholder="Ej: 5520206922"
            />

            {/* Insured Name */}
            <CoreField
              label="Asegurado / Contratante"
              value={insuredName}
              onChange={setInsuredName}
              source={sources.insured_name}
              required
              placeholder="Nombre completo del asegurado"
            />

            {/* Premium */}
            <CoreField
              label="Prima total"
              value={premium}
              onChange={setPremium}
              source={sources.premium}
              required
              placeholder="Ej: 15231.80"
              type="text"
              inputMode="decimal"
            />

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <CoreField
                label="Fecha inicio"
                value={startDate}
                onChange={setStartDate}
                source={sources.start_date}
                required
                type="date"
              />
              <CoreField
                label="Fecha fin"
                value={endDate}
                onChange={setEndDate}
                source={sources.end_date}
                required
                type="date"
              />
            </div>

            {/* Client ID */}
            <CoreField
              label="Cliente SICAS (IDCli)"
              value={clientId}
              onChange={setClientId}
              source={sources.sicas_client_id}
              placeholder="ID numerico del cliente en SICAS"
              inputMode="numeric"
              hint={!clientId ? 'Si no tiene IDCli, el registro HWCAPTURE fallara. Capture el ID o use el flujo de resolucion de cliente.' : undefined}
            />

            {/* Vendor ID - readonly info */}
            {record.vendor_sicas_id && (
              <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg px-3 py-2">
                <span className="font-medium">IDVend:</span>
                <span className="font-mono">{record.vendor_sicas_id}</span>
                <span className="text-neutral-400">({record.vendor_sicas_name})</span>
              </div>
            )}
          </div>

          {/* === SICAS CATALOG OVERRIDES === */}
          <details className="group">
            <summary className="cursor-pointer text-sm font-semibold text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-colors">
              Campos adicionales SICAS (catalogos)
            </summary>
            <div className="mt-3 space-y-3 pl-1">
              {loadingCatalogs ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
                  <span className="ml-2 text-sm text-neutral-400">Cargando catalogos...</span>
                </div>
              ) : (
                OVERRIDE_FIELDS.map((field) => {
                  const options = field.catalogTypeId ? catalogs[field.catalogTypeId] || [] : [];
                  const currentValue = overrides[field.overrideColumn] || '';
                  const currentLabel = options.find(o => o.id_sicas === currentValue)?.nombre;

                  return (
                    <FieldSelector
                      key={field.overrideColumn}
                      field={field}
                      options={options}
                      currentValue={currentValue}
                      currentLabel={currentLabel}
                      searchTerm={searchTerms[field.overrideColumn] || ''}
                      isOpen={openDropdown === field.overrideColumn}
                      onToggle={() => setOpenDropdown(openDropdown === field.overrideColumn ? null : field.overrideColumn)}
                      onSearchChange={(val) => setSearchTerms(prev => ({ ...prev, [field.overrideColumn]: val }))}
                      onSelect={(id) => {
                        setOverrides(prev => ({ ...prev, [field.overrideColumn]: id }));
                        setOpenDropdown(null);
                      }}
                      onManualInput={(val) => setOverrides(prev => ({ ...prev, [field.overrideColumn]: val }))}
                    />
                  );
                })
              )}
            </div>
          </details>
        </div>

        {/* Footer */}
        <div className="border-t dark:border-neutral-800 p-5 space-y-3">
          {error && (
            <div className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {coreMissing.length > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Faltan: {coreMissing.join(', ')}. Complete estos datos para habilitar el registro.
            </p>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving || savingAndRegistering}>
              Cancelar
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSave(false)}
              disabled={saving || savingAndRegistering}
            >
              {saving ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Guardando...</>
              ) : (
                <><Save className="h-4 w-4 mr-2" />Guardar datos</>
              )}
            </Button>
            {onSavedAndRegister && (
              <Button
                onClick={() => handleSave(true)}
                disabled={saving || savingAndRegistering || !canRegister}
                title={!canRegister ? `Faltan datos: ${coreMissing.join(', ')}` : 'Guardar y ejecutar HWCAPTURE'}
              >
                {savingAndRegistering ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Registrando...</>
                ) : (
                  <><Zap className="h-4 w-4 mr-2" />Guardar y registrar</>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Core Field Component ----

function CoreField({ label, value, onChange, source, required, placeholder, type, inputMode, hint }: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  source?: string;
  required?: boolean;
  placeholder?: string;
  type?: string;
  inputMode?: 'text' | 'numeric' | 'decimal';
  hint?: string;
}) {
  const isEmpty = !value.trim();
  return (
    <div className={`border rounded-lg p-3 transition-colors ${isEmpty && required ? 'border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-950/10' : 'border-neutral-200 dark:border-neutral-700'}`}>
      <div className="flex items-center justify-between mb-1.5">
        <Label className="text-xs font-medium flex items-center gap-1.5">
          {label}
          {required && <span className="text-red-500">*</span>}
          {isEmpty && required && <Badge variant="destructive" className="text-[9px] px-1 py-0">Faltante</Badge>}
        </Label>
        {source && (
          <span className="text-[9px] text-neutral-400 font-mono">{source}</span>
        )}
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type || 'text'}
        inputMode={inputMode}
        className="h-8 text-sm"
      />
      {hint && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">{hint}</p>
      )}
    </div>
  );
}

// ---- Catalog Field Selector ----

interface FieldSelectorProps {
  field: FieldDef;
  options: CatalogOption[];
  currentValue: string;
  currentLabel: string | undefined;
  searchTerm: string;
  isOpen: boolean;
  onToggle: () => void;
  onSearchChange: (val: string) => void;
  onSelect: (id: string) => void;
  onManualInput: (val: string) => void;
}

function FieldSelector({ field, options, currentValue, currentLabel, searchTerm, isOpen, onToggle, onSearchChange, onSelect, onManualInput }: FieldSelectorProps) {
  const filtered = options.filter(o => {
    if (!searchTerm) return true;
    const t = searchTerm.toLowerCase();
    return o.nombre.toLowerCase().includes(t) || o.id_sicas.toLowerCase().includes(t);
  }).slice(0, 25);

  return (
    <div className="border rounded-lg p-3 dark:border-neutral-700">
      <div className="flex items-center justify-between mb-2">
        <Label className="text-xs font-medium">{field.label}</Label>
        {currentValue && (
          <Badge variant="secondary" className="text-[10px]">
            {currentLabel || currentValue}
          </Badge>
        )}
      </div>

      {options.length > 0 ? (
        <div className="relative">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-neutral-400" />
              <Input
                placeholder={`Buscar ${field.label.toLowerCase()}...`}
                value={searchTerm}
                onChange={(e) => {
                  onSearchChange(e.target.value);
                  if (!isOpen) onToggle();
                }}
                onFocus={() => { if (!isOpen) onToggle(); }}
                className="h-8 pl-8 text-sm"
              />
            </div>
            <span className="text-[9px] text-neutral-400 whitespace-nowrap">{options.length}</span>
          </div>

          {isOpen && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto border rounded-md bg-white dark:bg-neutral-800 shadow-lg">
              {filtered.length === 0 ? (
                <p className="p-2 text-xs text-neutral-400 text-center">Sin resultados</p>
              ) : (
                filtered.map((opt) => (
                  <button
                    key={opt.id_sicas}
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors border-b last:border-b-0 dark:border-neutral-700 flex items-center justify-between ${currentValue === opt.id_sicas ? 'bg-neutral-50 dark:bg-neutral-700/50 font-medium' : ''}`}
                    onClick={() => onSelect(opt.id_sicas)}
                  >
                    <span className="truncate">{opt.nombre}</span>
                    <span className="text-[10px] text-neutral-400 ml-2 shrink-0">{opt.id_sicas}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      ) : (
        <Input
          placeholder="Ingresar ID SICAS manualmente"
          value={currentValue}
          onChange={(e) => onManualInput(e.target.value)}
          className="h-8 text-sm"
        />
      )}
    </div>
  );
}
