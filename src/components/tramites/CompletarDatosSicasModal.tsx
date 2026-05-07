import { useState, useEffect } from 'react';
import { X, Loader2, Search, CheckCircle2, AlertTriangle } from 'lucide-react';
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
  vendor_sicas_name: string | null;
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
}

export default function CompletarDatosSicasModal({ record, onClose, onSaved }: Props) {
  const [catalogs, setCatalogs] = useState<Record<number, CatalogOption[]>>({});
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCatalogs();
    // Initialize overrides from existing record values
    const initial: Record<string, string> = {};
    for (const field of OVERRIDE_FIELDS) {
      const val = (record as any)[field.overrideColumn];
      if (val) initial[field.overrideColumn] = val;
    }
    setOverrides(initial);
  }, []);

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

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      // Build update object with only non-empty overrides
      const updateData: Record<string, string | null> = {};
      for (const field of OVERRIDE_FIELDS) {
        const val = overrides[field.overrideColumn];
        if (val && val.trim()) {
          updateData[field.overrideColumn] = val.trim();
        }
      }

      if (Object.keys(updateData).length === 0) {
        setError('Debe completar al menos un campo');
        setSaving(false);
        return;
      }

      // Reset status back to ready_to_register so user can retry
      updateData['sicas_registration_status'] = 'ready_to_register';
      updateData['sicas_error_message'] = null;

      const { error: updateError } = await supabase
        .from('policy_deliveries')
        .update(updateData)
        .eq('id', record.id);

      if (updateError) throw updateError;

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error guardando datos');
    } finally {
      setSaving(false);
    }
  }

  // Parse which fields are missing from the review reason
  const missingFields = parseMissingFields(record.sicas_manual_review_reason);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b dark:border-neutral-800">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
              Completar datos SICAS
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Poliza: {record.manual_policy_number || record.policy_number || 'Sin numero'} - {record.insured_name || record.vendor_sicas_name || ''}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Missing fields indicator */}
        {record.sicas_manual_review_reason && (
          <div className="px-5 pt-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Campos faltantes</p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">{record.sicas_manual_review_reason}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loadingCatalogs ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Cargando catálogos...</span>
            </div>
          ) : (
            OVERRIDE_FIELDS.map((field) => {
              const isMissing = missingFields.includes(field.fieldName);
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
                  isMissing={isMissing}
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

        {/* Footer */}
        <div className="border-t dark:border-neutral-800 p-5">
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>
          )}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Los campos completados se usarán como override para este registro.
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onClose} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Guardar y preparar reintento
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

// ---- Field Selector Sub-Component ----

interface FieldSelectorProps {
  field: FieldDef;
  options: CatalogOption[];
  currentValue: string;
  currentLabel: string | undefined;
  isMissing: boolean;
  searchTerm: string;
  isOpen: boolean;
  onToggle: () => void;
  onSearchChange: (val: string) => void;
  onSelect: (id: string) => void;
  onManualInput: (val: string) => void;
}

function FieldSelector({ field, options, currentValue, currentLabel, isMissing, searchTerm, isOpen, onToggle, onSearchChange, onSelect, onManualInput }: FieldSelectorProps) {
  const filtered = options.filter(o => {
    if (!searchTerm) return true;
    const t = searchTerm.toLowerCase();
    return o.nombre.toLowerCase().includes(t) || o.id_sicas.toLowerCase().includes(t);
  }).slice(0, 25);

  return (
    <div className={`border rounded-lg p-3 transition-colors ${isMissing ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/10' : 'dark:border-neutral-700'}`}>
      <div className="flex items-center justify-between mb-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          {field.label}
          {isMissing && <Badge variant="destructive" className="text-[9px] px-1 py-0">Faltante</Badge>}
        </Label>
        {currentValue && (
          <Badge variant="secondary" className="text-xs">
            {currentLabel || currentValue}
          </Badge>
        )}
      </div>

      {options.length > 0 ? (
        <div className="relative">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
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
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">{options.length} items</span>
          </div>

          {isOpen && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto border rounded-md bg-popover shadow-lg">
              {filtered.length === 0 ? (
                <p className="p-2 text-xs text-muted-foreground text-center">Sin resultados</p>
              ) : (
                filtered.map((opt) => (
                  <button
                    key={opt.id_sicas}
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors border-b last:border-b-0 flex items-center justify-between ${currentValue === opt.id_sicas ? 'bg-accent/50 font-medium' : ''}`}
                    onClick={() => onSelect(opt.id_sicas)}
                  >
                    <span className="truncate">{opt.nombre}</span>
                    <span className="text-[10px] text-muted-foreground ml-2 shrink-0">{opt.id_sicas}</span>
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

// Parse the "missing fields" from the manual review reason string
function parseMissingFields(reason: string | null): string[] {
  if (!reason) return [];
  const fields: string[] = [];
  if (/tipo.?doc/i.test(reason)) fields.push('IDTipoDocto');
  if (/aseguradora|compa[nñ]ia|IDCia/i.test(reason)) fields.push('IDCia');
  if (/\bramo\b/i.test(reason) && !/subramo/i.test(reason)) fields.push('IDRamo');
  if (/subramo/i.test(reason)) fields.push('IDSubRamo');
  if (/moneda/i.test(reason)) fields.push('IDMon');
  if (/forma.?pago/i.test(reason)) fields.push('IDFPago');
  if (/ejecutivo/i.test(reason)) fields.push('IDEjecutivo');
  if (/grupo/i.test(reason)) fields.push('IDGrupo');
  if (/cliente/i.test(reason)) fields.push('IDCli');
  if (/estatus/i.test(reason)) fields.push('Estatus');
  if (/agente|vendedor|IDVend/i.test(reason)) fields.push('IDVend');
  return fields;
}
