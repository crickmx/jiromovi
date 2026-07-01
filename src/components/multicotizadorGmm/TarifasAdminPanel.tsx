import { useState, useEffect, useCallback } from 'react';
import { Upload, CircleCheck as CheckCircle, Circle as XCircle, Loader, Trash2, Package, CircleAlert as AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import * as XLSX from 'xlsx';
import { PRODUCT_LABELS, PRODUCT_COLORS } from '../../lib/multicotizadorGmm/types';

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
  { id: 'BXPLUS', label: 'BX+ Unikuz' },
  { id: 'BNV', label: 'Bupa Nacional Vital' },
  { id: 'BNP', label: 'Bupa Nacional Plus' },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function resolveSheetName(workbook: XLSX.WorkBook, targetName: string): string | null {
  if (workbook.Sheets[targetName]) return targetName;
  const targetLower = targetName.toLowerCase().trim();
  for (const name of workbook.SheetNames) {
    if (name.toLowerCase().trim() === targetLower) return name;
  }
  for (const name of workbook.SheetNames) {
    if (name.toLowerCase().trim().startsWith(targetLower)) return name;
  }
  return null;
}

interface ParsedBupaRate {
  plan_name: string;
  region: string;
  age: number;
  rate: number;
  rate_type: string;
}

interface ParsedBupaResult {
  rates: ParsedBupaRate[];
  sumas_aseguradas: number[];
  deducibles: number[];
  coaseguros: number[];
  derecho_poliza: number;
  asistencia_extranjero: number;
  costo_catastrofica: number;
  errors: string[];
}

function parseBupaExcel(file: ArrayBuffer, product: 'BNV' | 'BNP'): ParsedBupaResult {
  const uint8 = new Uint8Array(file);
  const workbook = XLSX.read(uint8, { type: 'array', bookVBA: true });

  const rates: ParsedBupaRate[] = [];
  const detectedSumas = new Set<number>();
  const detectedDeducibles = new Set<number>();
  const detectedCoaseguros = new Set<number>();
  const errors: string[] = [];
  let derechoPoliza = 1600;
  let asistenciaExtranjero = 1632;
  let costoCatastrofica = 5800;

  const rateSheets = ['Master', 'MasterBase'];
  let foundRateSheet = false;

  for (const targetSheet of rateSheets) {
    const resolvedName = resolveSheetName(workbook, targetSheet);
    if (!resolvedName) continue;

    const sheet = workbook.Sheets[resolvedName];
    const jsonData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    if (jsonData.length < 3) continue;

    // Find the header row - look for a row with "Edad" or numeric age pattern
    let headerRowIdx = -1;
    let ageColIdx = -1;

    for (let r = 0; r < Math.min(jsonData.length, 15); r++) {
      const row = jsonData[r];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        const cell = String(row[c] || '').toLowerCase().trim();
        if (cell === 'edad' || cell === 'age' || cell === 'edades') {
          headerRowIdx = r;
          ageColIdx = c;
          break;
        }
      }
      if (headerRowIdx !== -1) break;
    }

    // If no explicit "Edad" header found, check if first column starts with 0 or small numbers
    if (headerRowIdx === -1) {
      for (let r = 0; r < Math.min(jsonData.length, 10); r++) {
        const row = jsonData[r];
        if (!row) continue;
        const firstVal = Number(row[0]);
        if (firstVal === 0 || firstVal === 1) {
          // Check if subsequent rows are incrementing ages
          const nextVal = jsonData[r + 1] ? Number(jsonData[r + 1][0]) : NaN;
          if (!isNaN(nextVal) && nextVal === firstVal + 1) {
            headerRowIdx = r - 1;
            ageColIdx = 0;
            break;
          }
        }
      }
    }

    if (headerRowIdx === -1 || ageColIdx === -1) {
      errors.push(`Hoja "${resolvedName}": no se encontro columna de edad`);
      continue;
    }

    foundRateSheet = true;

    // Parse column headers for plan identification
    const headers = jsonData[headerRowIdx] || [];
    const dataStartRow = headerRowIdx + 1;

    for (let colIdx = 0; colIdx < headers.length; colIdx++) {
      if (colIdx === ageColIdx) continue;
      const colHeader = String(headers[colIdx] || '').trim();
      if (!colHeader) continue;

      // Detect plan parameters from column header
      // Common patterns: "S5D50C10", "SA5000000_D50000_C10", "5MDP_50K_10%", etc.
      let region = 'Mexico Region 1';
      if (colHeader.toLowerCase().includes('region 2') || colHeader.toLowerCase().includes('zona 2') || colHeader.includes('R2')) {
        region = 'Mexico Region 2';
      }

      // Detect gender from column header (for BNP)
      let rateType = 'Unisex';
      if (product === 'BNP') {
        const lowerHeader = colHeader.toLowerCase();
        if (lowerHeader.includes('fem') || lowerHeader.includes('mujer') || lowerHeader.includes('female') || lowerHeader.endsWith('f')) {
          rateType = 'Female';
        } else if (lowerHeader.includes('masc') || lowerHeader.includes('hombre') || lowerHeader.includes('male') || lowerHeader.endsWith('m')) {
          rateType = 'Male';
        }
      }

      // Extract SA, deducible, coaseguro from header
      const saMatch = colHeader.match(/S(\d+)/i) || colHeader.match(/(\d+)\s*(?:MDP|M)/i);
      const dedMatch = colHeader.match(/D(\d+)/i) || colHeader.match(/(?:ded|DED)[\s_-]*(\d+)/i);
      const coasMatch = colHeader.match(/C(\d+)/i) || colHeader.match(/(?:coas|COAS)[\s_-]*(\d+)/i);

      if (saMatch) detectedSumas.add(Number(saMatch[1]));
      if (dedMatch) detectedDeducibles.add(Number(dedMatch[1]));
      if (coasMatch) detectedCoaseguros.add(Number(coasMatch[1]));

      // Parse rate data for each age row
      let validRatesInCol = 0;
      for (let rowIdx = dataStartRow; rowIdx < jsonData.length; rowIdx++) {
        const row = jsonData[rowIdx];
        if (!row) continue;
        const age = Number(row[ageColIdx]);
        const rate = Number(row[colIdx]);
        if (isNaN(age) || age < 0 || age > 120) continue;
        if (isNaN(rate) || rate <= 0) continue;

        rates.push({
          plan_name: colHeader,
          region,
          age,
          rate,
          rate_type: rateType,
        });
        validRatesInCol++;
      }

      if (validRatesInCol === 0 && colIdx > ageColIdx) {
        // Column had a header but no valid rates - might not be a rate column
      }
    }

    if (rates.length > 0) break; // Found rates in first valid sheet
  }

  // If no rates found in Master/MasterBase, try all other sheets
  if (!foundRateSheet || rates.length === 0) {
    for (const sheetName of workbook.SheetNames) {
      const lowerName = sheetName.toLowerCase();
      // Skip known non-rate sheets
      if (lowerName.includes('instruc') || lowerName.includes('template') ||
          lowerName.includes('brochure') || lowerName.includes('version') ||
          lowerName.includes('objetos') || lowerName.includes('comparativ') ||
          lowerName.includes('datos asegurado')) continue;

      const sheet = workbook.Sheets[sheetName];
      const jsonData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
      if (jsonData.length < 10) continue;

      // Look for a large numeric data block (ages 0-99 with rates)
      let ageColIdx = -1;
      let dataStartRow = -1;

      for (let r = 0; r < Math.min(jsonData.length, 20); r++) {
        const row = jsonData[r];
        if (!row) continue;

        // Check each cell for start of an age sequence
        for (let c = 0; c < Math.min(row.length, 5); c++) {
          const val = Number(row[c]);
          if (val === 0 || val === 1) {
            const nextRow = jsonData[r + 1];
            const nextVal = nextRow ? Number(nextRow[c]) : NaN;
            if (!isNaN(nextVal) && nextVal === val + 1) {
              ageColIdx = c;
              dataStartRow = r;
              break;
            }
          }
        }
        if (ageColIdx !== -1) break;
      }

      if (ageColIdx === -1 || dataStartRow === -1) continue;

      // Found an age column. Get headers from row above.
      const headerRow = dataStartRow > 0 ? jsonData[dataStartRow - 1] : null;

      for (let colIdx = 0; colIdx < (jsonData[dataStartRow]?.length || 0); colIdx++) {
        if (colIdx === ageColIdx) continue;

        const colHeader = headerRow ? String(headerRow[colIdx] || `Col${colIdx}`) : `Col${colIdx}`;

        let region = 'Mexico Region 1';
        if (colHeader.toLowerCase().includes('region 2') || colHeader.toLowerCase().includes('zona 2')) {
          region = 'Mexico Region 2';
        }

        let rateType = 'Unisex';
        if (product === 'BNP') {
          const lh = colHeader.toLowerCase();
          if (lh.includes('fem') || lh.includes('mujer')) rateType = 'Female';
          else if (lh.includes('masc') || lh.includes('hombre')) rateType = 'Male';
        }

        let validRates = 0;
        for (let rowIdx = dataStartRow; rowIdx < jsonData.length; rowIdx++) {
          const row = jsonData[rowIdx];
          if (!row) continue;
          const age = Number(row[ageColIdx]);
          const rate = Number(row[colIdx]);
          if (isNaN(age) || age < 0 || age > 120) continue;
          if (isNaN(rate) || rate <= 0) continue;

          rates.push({
            plan_name: colHeader,
            region,
            age,
            rate,
            rate_type: rateType,
          });
          validRates++;
        }
      }

      if (rates.length > 50) break;
    }
  }

  // Try to extract config values (derecho poliza, asistencia) from known locations
  for (const sheetName of workbook.SheetNames) {
    const lowerName = sheetName.toLowerCase();
    if (lowerName.includes('config') || lowerName.includes('param') || lowerName.includes('datos')) {
      const sheet = workbook.Sheets[sheetName];
      const jsonData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
      for (const row of jsonData) {
        if (!Array.isArray(row)) continue;
        const label = String(row[0] || '').toLowerCase();
        for (let c = 1; c < row.length; c++) {
          const val = Number(row[c]);
          if (isNaN(val) || val <= 0) continue;
          if (label.includes('derecho') || label.includes('poliza')) { derechoPoliza = val; break; }
          if (label.includes('asistencia') && !label.includes('catastro')) { asistenciaExtranjero = val; break; }
          if (label.includes('catastro')) { costoCatastrofica = val; break; }
        }
      }
    }
  }

  if (rates.length === 0) {
    const available = workbook.SheetNames.join(', ');
    throw new Error(
      `No se pudieron extraer tarifas del archivo. Hojas disponibles: [${available}]. ` +
      'Verifique que el archivo contenga una tabla de tarifas por edad.'
    );
  }

  return {
    rates,
    sumas_aseguradas: Array.from(detectedSumas).sort((a, b) => a - b),
    deducibles: Array.from(detectedDeducibles).sort((a, b) => a - b),
    coaseguros: Array.from(detectedCoaseguros).sort((a, b) => a - b),
    derecho_poliza: derechoPoliza,
    asistencia_extranjero: asistenciaExtranjero,
    costo_catastrofica: costoCatastrofica,
    errors,
  };
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

    setUploadSuccess('Tarifa BX+ Unikuz cargada exitosamente');
    setSelectedFile(null);
    setVersionName('');
    loadPackages();
  };

  const handleUploadBupa = async () => {
    const arrayBuffer = await selectedFile!.arrayBuffer();

    setUploadProgress('Extrayendo tarifas del Excel...');
    const parsed = parseBupaExcel(arrayBuffer, uploadProduct as 'BNV' | 'BNP');

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
        derecho_poliza: parsed.derecho_poliza,
        asistencia_extranjero: parsed.asistencia_extranjero,
        costo_catastrofica_extranjero: parsed.costo_catastrofica,
        sumas_aseguradas: parsed.sumas_aseguradas,
        deducibles: parsed.deducibles,
        coaseguros: parsed.coaseguros,
        topes_coaseguro: [],
        client_types: [],
        internal_factors: {},
        rates_count: parsed.rates.length,
        created_by: (await supabase.auth.getUser()).data.user?.id || null,
      })
      .select('id')
      .single();

    if (pkgError) throw new Error('Error creando paquete: ' + pkgError.message);

    setUploadProgress(`Insertando ${parsed.rates.length.toLocaleString()} tarifas...`);
    const batchSize = 500;
    for (let i = 0; i < parsed.rates.length; i += batchSize) {
      const batch = parsed.rates.slice(i, i + batchSize).map(r => ({
        package_id: pkg.id,
        lookup_key: `${r.plan_name}|${r.region}|${r.age}|${r.rate_type}`,
        plan_name: r.plan_name,
        region: r.region,
        age: r.age,
        rate: r.rate,
        rate_type: r.rate_type,
      }));
      const { error: rateError } = await supabase
        .from('multicotizador_gmm_rates')
        .insert(batch);
      if (rateError) {
        await supabase.from('multicotizador_gmm_packages')
          .update({ status: 'failed', validation_errors: { message: rateError.message } })
          .eq('id', pkg.id);
        throw new Error('Error insertando tarifas: ' + rateError.message);
      }
      setUploadProgress(`Insertando tarifas... ${Math.min(i + batchSize, parsed.rates.length).toLocaleString()} / ${parsed.rates.length.toLocaleString()}`);
    }

    setUploadSuccess(`Tarifa cargada: ${parsed.rates.length.toLocaleString()} registros de tarifa extraidos correctamente`);
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
              onChange={e => setUploadProduct(e.target.value as UploadableProduct)}
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
