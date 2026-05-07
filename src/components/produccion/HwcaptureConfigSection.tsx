import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, CheckCircle, XCircle, Search, Settings2, Database, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { supabase } from '../../lib/supabase';

interface HwcaptureDefault {
  id: string;
  field_name: string;
  field_label: string;
  default_value: string | null;
  default_label: string | null;
  catalog_type_id: number | null;
  is_required: boolean;
  notes: string | null;
  updated_at: string;
}

interface CatalogOption {
  id: string;
  id_sicas: string;
  nombre: string;
  raw: any;
}

interface SyncResult {
  catalog_type_id: number;
  label: string;
  status: string;
  records_found: number;
  records_inserted: number;
  records_updated: number;
  error?: string;
}

export default function HwcaptureConfigSection() {
  const [defaults, setDefaults] = useState<HwcaptureDefault[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState<SyncResult[] | null>(null);
  const [catalogOptions, setCatalogOptions] = useState<Record<number, CatalogOption[]>>({});
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadDefaults();
  }, []);

  async function loadDefaults() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sicas_hwcapture_defaults')
        .select('*')
        .order('field_name');

      if (error) throw error;
      setDefaults(data || []);

      // Load catalog options for each field that has a catalog_type_id
      const catalogTypeIds = [...new Set((data || []).map(d => d.catalog_type_id).filter(Boolean))] as number[];
      for (const ctId of catalogTypeIds) {
        await loadCatalogOptions(ctId);
      }
    } catch (error: any) {
      console.error('Error loading HWCAPTURE defaults:', error);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  }

  async function loadCatalogOptions(catalogTypeId: number) {
    const { data } = await supabase
      .from('sicas_catalogos')
      .select('id, id_sicas, nombre, raw')
      .eq('catalog_type_id', catalogTypeId)
      .order('nombre');

    if (data) {
      setCatalogOptions(prev => ({ ...prev, [catalogTypeId]: data }));
    }
  }

  async function handleSyncCatalogs() {
    setSyncing(true);
    setSyncResults(null);
    setMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

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

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error sincronizando catálogos');
      }

      setSyncResults(result.results);
      setMessage({
        type: 'success',
        text: `Sincronización completa: ${result.summary.success} catálogos exitosos, ${result.summary.total_records} registros totales`,
      });

      // Reload catalog options after sync
      const catalogTypeIds = [...new Set(defaults.map(d => d.catalog_type_id).filter(Boolean))] as number[];
      for (const ctId of catalogTypeIds) {
        await loadCatalogOptions(ctId);
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSyncing(false);
    }
  }

  async function handleSelectValue(fieldId: string, fieldName: string, sicasId: string, label: string) {
    setSaving(prev => ({ ...prev, [fieldId]: true }));
    try {
      const { error } = await supabase
        .from('sicas_hwcapture_defaults')
        .update({
          default_value: sicasId,
          default_label: label,
        })
        .eq('id', fieldId);

      if (error) throw error;

      setDefaults(prev =>
        prev.map(d => d.id === fieldId ? { ...d, default_value: sicasId, default_label: label } : d)
      );
      setMessage({ type: 'success', text: `${fieldName} actualizado a: ${label} (${sicasId})` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(prev => ({ ...prev, [fieldId]: false }));
    }
  }

  async function handleManualValue(fieldId: string, fieldName: string, value: string) {
    setSaving(prev => ({ ...prev, [fieldId]: true }));
    try {
      const { error } = await supabase
        .from('sicas_hwcapture_defaults')
        .update({
          default_value: value,
          default_label: `Manual: ${value}`,
        })
        .eq('id', fieldId);

      if (error) throw error;

      setDefaults(prev =>
        prev.map(d => d.id === fieldId ? { ...d, default_value: value, default_label: `Manual: ${value}` } : d)
      );
      setMessage({ type: 'success', text: `${fieldName} actualizado manualmente a: ${value}` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(prev => ({ ...prev, [fieldId]: false }));
    }
  }

  const configuredCount = defaults.filter(d => d.default_value).length;
  const requiredMissing = defaults.filter(d => d.is_required && !d.default_value);
  const isFullyConfigured = requiredMissing.length === 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <Card className={isFullyConfigured ? 'border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800' : 'border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800'}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isFullyConfigured ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              )}
              <div>
                <p className={`font-medium ${isFullyConfigured ? 'text-green-900 dark:text-green-100' : 'text-amber-900 dark:text-amber-100'}`}>
                  {isFullyConfigured
                    ? 'Configuración HWCAPTURE completa'
                    : `Faltan ${requiredMissing.length} campo(s) obligatorio(s) por configurar`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {configuredCount}/{defaults.length} campos configurados
                </p>
              </div>
            </div>
            <Badge variant={isFullyConfigured ? 'default' : 'destructive'} className={isFullyConfigured ? 'bg-green-600' : ''}>
              {isFullyConfigured ? 'Listo' : 'Pendiente'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Message */}
      {message && (
        <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-200' : 'bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-200'}`}>
          {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      {/* Sync Catalogs Button */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Sincronizar Catálogos SICAS
          </CardTitle>
          <CardDescription>
            Descarga los catálogos necesarios desde SICAS para poder seleccionar valores correctos.
            Incluye: Tipos de Documento, Aseguradoras, Ramos, SubRamos, Monedas, Formas de Pago, Ejecutivos, Grupos y Estatus.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleSyncCatalogs} disabled={syncing} className="w-full sm:w-auto">
            {syncing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sincronizando catálogos...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sincronizar catálogos HWCAPTURE
              </>
            )}
          </Button>

          {/* Sync Results */}
          {syncResults && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium">Resultados de sincronización:</p>
              <div className="grid gap-2">
                {syncResults.map((r) => (
                  <div key={r.catalog_type_id} className="flex items-center justify-between p-2 rounded border bg-card">
                    <div className="flex items-center gap-2">
                      {r.status === 'success' ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : r.status === 'not_available' ? (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-sm">{r.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.status === 'success' && (
                        <Badge variant="secondary" className="text-xs">
                          {r.records_found} registros
                        </Badge>
                      )}
                      {r.error && (
                        <span className="text-xs text-muted-foreground max-w-[200px] truncate" title={r.error}>
                          {r.error}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Individual Field Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Valores por Defecto HWCAPTURE
          </CardTitle>
          <CardDescription>
            Configure el valor por defecto de cada campo obligatorio para el registro en SICAS.
            Primero sincronice los catálogos, luego seleccione el valor apropiado para cada campo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {defaults.map((field) => (
              <FieldConfigRow
                key={field.id}
                field={field}
                options={field.catalog_type_id ? catalogOptions[field.catalog_type_id] || [] : []}
                searchTerm={searchTerms[field.id] || ''}
                onSearchChange={(val) => setSearchTerms(prev => ({ ...prev, [field.id]: val }))}
                onSelectValue={(sicasId, label) => handleSelectValue(field.id, field.field_label, sicasId, label)}
                onManualValue={(val) => handleManualValue(field.id, field.field_label, val)}
                isSaving={saving[field.id] || false}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---- Field Config Row Component ----

interface FieldConfigRowProps {
  field: HwcaptureDefault;
  options: CatalogOption[];
  searchTerm: string;
  onSearchChange: (val: string) => void;
  onSelectValue: (sicasId: string, label: string) => void;
  onManualValue: (val: string) => void;
  isSaving: boolean;
}

function FieldConfigRow({ field, options, searchTerm, onSearchChange, onSelectValue, onManualValue, isSaving }: FieldConfigRowProps) {
  const [showOptions, setShowOptions] = useState(false);
  const [manualInput, setManualInput] = useState('');

  const filteredOptions = options.filter(opt => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      opt.nombre.toLowerCase().includes(term) ||
      opt.id_sicas.toLowerCase().includes(term)
    );
  });

  const displayOptions = filteredOptions.slice(0, 20);

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className="font-medium">{field.field_label}</Label>
          {field.is_required && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Obligatorio</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {field.default_value ? (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200">
              {field.default_label || field.default_value}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">Sin configurar</Badge>
          )}
          {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
        </div>
      </div>

      {field.notes && (
        <p className="text-xs text-muted-foreground">{field.notes}</p>
      )}

      {/* Catalog selector */}
      {options.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Buscar en ${options.length} opciones...`}
                value={searchTerm}
                onChange={(e) => {
                  onSearchChange(e.target.value);
                  setShowOptions(true);
                }}
                onFocus={() => setShowOptions(true)}
                className="pl-9 h-9"
              />
            </div>
            <Badge variant="secondary" className="text-xs whitespace-nowrap">
              {options.length} opciones
            </Badge>
          </div>

          {showOptions && (
            <div className="max-h-48 overflow-y-auto border rounded-md bg-popover">
              {displayOptions.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground text-center">
                  {options.length === 0 ? 'Sin datos. Sincronice los catálogos primero.' : 'Sin resultados'}
                </p>
              ) : (
                displayOptions.map((opt) => (
                  <button
                    key={opt.id}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors border-b last:border-b-0 flex items-center justify-between ${field.default_value === opt.id_sicas ? 'bg-accent/50 font-medium' : ''}`}
                    onClick={() => {
                      onSelectValue(opt.id_sicas, opt.nombre);
                      setShowOptions(false);
                    }}
                  >
                    <span className="truncate">{opt.nombre}</span>
                    <span className="text-xs text-muted-foreground ml-2 shrink-0">ID: {opt.id_sicas}</span>
                  </button>
                ))
              )}
              {filteredOptions.length > 20 && (
                <p className="p-2 text-xs text-center text-muted-foreground border-t">
                  Mostrando 20 de {filteredOptions.length} resultados. Refine su búsqueda.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Manual input for fields without catalog or as fallback */}
      {(options.length === 0 || !field.catalog_type_id) && (
        <div className="flex items-center gap-2">
          <Input
            placeholder="Ingresar ID SICAS manualmente"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            className="h-9 flex-1"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (manualInput.trim()) {
                onManualValue(manualInput.trim());
                setManualInput('');
              }
            }}
            disabled={!manualInput.trim() || isSaving}
          >
            Guardar
          </Button>
        </div>
      )}
    </div>
  );
}
