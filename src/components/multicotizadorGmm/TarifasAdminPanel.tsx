import { useState, useEffect, useCallback } from 'react';
import { Upload, CircleCheck as CheckCircle, Circle as XCircle, Loader, Trash2, Package, CircleAlert as AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import * as XLSX from 'xlsx';
import { PRODUCT_LABELS, PRODUCT_COLORS } from '../../lib/multicotizadorGmm/types';
import { EXCEL_RANGES } from '../../lib/gmmTypes';

type UploadableProduct = 'BNV' | 'BNP' | 'BXPLUS';

interface TariffPackage {
  id: string;
  product: UploadableProduct;
  version_name: string;
  source_filename: string | null;
  status: 'draft' | 'active' | 'archived' | 'failed';
  rates_count: number;
  sumas_aseguradas: number[];
  deducibles: number[];
  coaseguros: number[];
  created_at: string;
  source_table: 'multicotizador_gmm_packages' | 'tariff_packages';
}

const UPLOADABLE_PRODUCTS: { id: UploadableProduct; label: string }[] = [
  { id: 'BXPLUS', label: 'BX+' },
  { id: 'BNV', label: 'Bupa Nacional Vital' },
  { id: 'BNP', label: 'Bupa Nacional Plus' },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function parseRange(workbook: XLSX.WorkBook, sheetName: string, rangeStr: string, type: string) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return null;

  if (type === 'value') {
    const cell = sheet[rangeStr];
    return cell ? cell.v : null;
  }

  if (type === 'array') {
    const range = XLSX.utils.decode_range(rangeStr);
    const result: any[] = [];
    for (let R = range.s.r; R <= range.e.r; ++R) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: range.s.c });
      const cell = sheet[cellAddress];
      result.push(cell ? cell.v : null);
    }
    return result;
  }

  if (type === 'table') {
    const range = XLSX.utils.decode_range(rangeStr);
    const result: any[] = [];
    for (let R = range.s.r; R <= range.e.r; ++R) {
      const row: any = {};
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = sheet[cellAddress];
        const colName = `col_${C - range.s.c}`;
        row[colName] = cell ? cell.v : null;
      }
      result.push(row);
    }
    return result;
  }

  return null;
}

interface ParsedTariffTables {
  tables: Array<{ table_key: string; data_json: any; row_count: number | null }>;
  errors: string[];
}

function parseExcelFactorTables(file: ArrayBuffer): ParsedTariffTables {
  const uint8 = new Uint8Array(file);
  const workbook = XLSX.read(uint8, { type: 'array', bookVBA: true });

  const requiredSheets = ['Tarifa'];
  for (const sheetName of requiredSheets) {
    if (!workbook.Sheets[sheetName]) {
      throw new Error(`Hoja "${sheetName}" no encontrada. Este archivo no tiene el formato de cotizador GNP/Bupa esperado.`);
    }
  }

  const tables: ParsedTariffTables['tables'] = [];
  const errors: string[] = [];

  for (const [tableKey, definition] of Object.entries(EXCEL_RANGES)) {
    try {
      const rawData = parseRange(workbook, definition.sheet, definition.range, definition.type);
      const data = rawData ?? (definition.type === 'value' ? null : []);
      tables.push({
        table_key: tableKey,
        data_json: data === null ? { value: null } : data,
        row_count: Array.isArray(data) ? data.length : null,
      });
    } catch (error: any) {
      errors.push(`${tableKey}: ${error.message}`);
    }
  }

  const baseTable = tables.find(t => t.table_key === 'base_intermedia_edad_sexo');
  if (!baseTable || !Array.isArray(baseTable.data_json) || baseTable.data_json.length < 10) {
    throw new Error(
      'No se pudo extraer la tabla base de tarifas por edad/sexo. ' +
      'Verifique que el archivo sea un cotizador GNP/Bupa valido con hoja "Tarifa".'
    );
  }

  const validAges = baseTable.data_json.filter(
    (r: any) => typeof r.col_0 === 'number' && r.col_0 >= 0 && r.col_0 <= 120 && r.col_1 > 0
  );
  if (validAges.length < 10) {
    throw new Error(
      `Solo se encontraron ${validAges.length} edades validas en la tabla base. ` +
      'El archivo no parece contener tarifas correctas.'
    );
  }

  return { tables, errors };
}

export function TarifasAdminPanel() {
  const [packages, setPackages] = useState<TariffPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadProduct, setUploadProduct] = useState<UploadableProduct>('BXPLUS');
  const [versionName, setVersionName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);

  const loadPackages = useCallback(async () => {
    setLoading(true);
    const [{ data: multiPkgs }, { data: bxPkgs }] = await Promise.all([
      supabase
        .from('multicotizador_gmm_packages')
        .select('id, product, version_name, source_filename, status, rates_count, sumas_aseguradas, deducibles, coaseguros, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('tariff_packages')
        .select('id, name, source_filename, status, rates_count, created_at')
        .order('created_at', { ascending: false }),
    ]);

    const combined: TariffPackage[] = [];
    if (multiPkgs) {
      for (const p of multiPkgs) {
        combined.push({ ...p, source_table: 'multicotizador_gmm_packages' } as TariffPackage);
      }
    }
    if (bxPkgs) {
      for (const p of bxPkgs) {
        combined.push({
          id: p.id,
          product: 'BXPLUS' as UploadableProduct,
          version_name: p.name || 'Sin nombre',
          source_filename: p.source_filename,
          status: p.status,
          rates_count: p.rates_count || 0,
          sumas_aseguradas: [],
          deducibles: [],
          coaseguros: [],
          created_at: p.created_at,
          source_table: 'tariff_packages',
        });
      }
    }
    combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setPackages(combined);
    setLoading(false);
  }, []);

  useEffect(() => { loadPackages(); }, [loadPackages]);

  const handleUpload = async () => {
    if (!selectedFile || !versionName.trim()) {
      setUploadError('Selecciona un archivo e ingresa el nombre de la version');
      return;
    }
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);
    setUploadProgress('Leyendo archivo...');

    try {
      if (uploadProduct === 'BXPLUS') {
        await handleUploadBxplus();
      } else {
        await handleUploadBupa();
      }
    } catch (err: any) {
      setUploadError(err.message || 'Error procesando archivo');
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  const handleUploadBxplus = async () => {
    setUploadProgress('Subiendo archivo al servidor...');
    const formData = new FormData();
    formData.append('file', selectedFile!);
    formData.append('name', versionName.trim());

    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmm-upload-tariff`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
        body: formData,
      }
    );

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Error uploading file');

    setUploadSuccess('Tarifa BX+ cargada exitosamente');
    setSelectedFile(null);
    setVersionName('');
    loadPackages();
  };

  const handleUploadBupa = async () => {
    const arrayBuffer = await selectedFile!.arrayBuffer();

    setUploadProgress('Extrayendo tablas de factores del Excel...');
    const parsed = parseExcelFactorTables(arrayBuffer);

    if (parsed.errors.length > 0) {
      setUploadError('Advertencias al procesar: ' + parsed.errors.slice(0, 3).join('; '));
    }

    setUploadProgress('Creando paquete de tarifas...');
    const { data: pkg, error: pkgError } = await supabase
      .from('multicotizador_gmm_packages')
      .insert({
        product: uploadProduct,
        version_name: versionName.trim(),
        source_filename: selectedFile!.name,
        status: 'draft',
        derecho_poliza: 0,
        asistencia_extranjero: 0,
        costo_catastrofica_extranjero: 0,
        sumas_aseguradas: [],
        deducibles: [],
        coaseguros: [],
        topes_coaseguro: [],
        client_types: [],
        internal_factors: {},
        rates_count: parsed.tables.length,
        created_by: (await supabase.auth.getUser()).data.user?.id || null,
      })
      .select('id')
      .single();

    if (pkgError) throw new Error('Error creando paquete: ' + pkgError.message);

    setUploadProgress('Insertando tablas de factores...');
    const tablesToInsert = parsed.tables.map(t => ({
      tariff_package_id: pkg.id,
      table_key: t.table_key,
      data_json: t.data_json,
      row_count: t.row_count,
    }));

    const batchSize = 10;
    for (let i = 0; i < tablesToInsert.length; i += batchSize) {
      const batch = tablesToInsert.slice(i, i + batchSize);
      const { error: tableError } = await supabase
        .from('tariff_tables')
        .insert(batch);
      if (tableError) {
        await supabase.from('multicotizador_gmm_packages')
          .update({ status: 'failed', validation_errors: { message: tableError.message } })
          .eq('id', pkg.id);
        throw new Error('Error insertando tablas: ' + tableError.message);
      }
    }

    setUploadSuccess(`Tarifa cargada: ${parsed.tables.length} tablas de factores extraidas correctamente`);
    setSelectedFile(null);
    setVersionName('');
    loadPackages();
  };

  const handleActivate = async (pkg: TariffPackage) => {
    setActivating(pkg.id);
    try {
      if (pkg.source_table === 'tariff_packages') {
        const { error } = await supabase.rpc('activate_tariff_package', { p_package_id: pkg.id });
        if (error) {
          setUploadError('Error activando tarifa: ' + error.message);
        } else {
          loadPackages();
        }
      } else {
        const { error } = await supabase.rpc('activate_multicotizador_tariff', { p_package_id: pkg.id });
        if (error) {
          setUploadError('Error activando tarifa: ' + error.message);
        } else {
          loadPackages();
        }
      }
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setActivating(null);
    }
  };

  const handleArchive = async (pkg: TariffPackage) => {
    const table = pkg.source_table === 'tariff_packages' ? 'tariff_packages' : 'multicotizador_gmm_packages';
    await supabase
      .from(table)
      .update({ status: 'archived' })
      .eq('id', pkg.id);
    loadPackages();
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
      draft: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
      archived: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400',
      failed: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${styles[status] || styles.draft}`}>
        {status === 'active' && <CheckCircle className="w-3 h-3" />}
        {status === 'failed' && <XCircle className="w-3 h-3" />}
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-white/[0.06] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Upload className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Subir Nueva Tarifa</h3>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
          Sube un archivo Excel (.xlsm, .xlsx) con las tarifas. BX+ se procesa en el servidor; BNV/BNP se procesan en el navegador.
        </p>

        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Producto</label>
            <select
              value={uploadProduct}
              onChange={e => setUploadProduct(e.target.value as 'BNV' | 'BNP')}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] text-sm text-neutral-900 dark:text-white"
            >
              {UPLOADABLE_PRODUCTS.map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Nombre de Version</label>
            <input
              type="text"
              value={versionName}
              onChange={e => setVersionName(e.target.value)}
              placeholder="ej. Enero 2026"
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Archivo Excel</label>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-neutral-300 dark:border-white/10 cursor-pointer hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors">
              <Upload className="w-4 h-4 text-neutral-400" />
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                {selectedFile ? selectedFile.name : 'Seleccionar archivo'}
              </span>
              <input
                type="file"
                accept=".xlsm,.xlsx,.xls"
                className="hidden"
                onChange={e => { setSelectedFile(e.target.files?.[0] || null); setUploadError(null); setUploadSuccess(null); }}
              />
            </label>
          </div>
        </div>

        {uploadError && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 text-red-700 dark:text-red-300 text-xs mb-4">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {uploadError}
          </div>
        )}
        {uploadSuccess && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30 text-emerald-700 dark:text-emerald-300 text-xs mb-4">
            <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {uploadSuccess}
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={uploading || !selectedFile || !versionName.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          {uploading ? <Loader className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? (uploadProgress || 'Procesando...') : 'Subir Tarifa'}
        </button>
      </div>

      {/* Packages List */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-white/[0.06] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Paquetes de Tarifas</h3>
          </div>
          <button
            onClick={loadPackages}
            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/[0.05] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-5 h-5 animate-spin text-neutral-400" />
          </div>
        ) : packages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-neutral-400 dark:text-neutral-500">
            <Package className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm">No hay paquetes de tarifas</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-white/[0.04]">
            {packages.map(pkg => (
              <div key={pkg.id} className="px-5 py-4 flex items-center gap-4">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PRODUCT_COLORS[pkg.product] }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-neutral-900 dark:text-white truncate">{pkg.version_name}</span>
                    {statusBadge(pkg.status)}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
                    <span>{PRODUCT_LABELS[pkg.product]}</span>
                    <span>{pkg.rates_count.toLocaleString()} tarifas</span>
                    <span>{formatDate(pkg.created_at)}</span>
                    {pkg.source_filename && <span className="truncate max-w-[160px]">{pkg.source_filename}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {pkg.status === 'draft' && (
                    <button
                      onClick={() => handleActivate(pkg)}
                      disabled={activating === pkg.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-xs font-medium hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors disabled:opacity-50"
                    >
                      {activating === pkg.id ? <Loader className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                      Activar
                    </button>
                  )}
                  {(pkg.status === 'draft' || pkg.status === 'active') && (
                    <button
                      onClick={() => handleArchive(pkg)}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Archivar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
