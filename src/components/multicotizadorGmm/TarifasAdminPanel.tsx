import { useState, useEffect, useCallback } from 'react';
import { Upload, CircleCheck as CheckCircle, Circle as XCircle, Loader, Trash2, Package, CircleAlert as AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import * as XLSX from 'xlsx';
import { PRODUCT_LABELS, PRODUCT_COLORS } from '../../lib/multicotizadorGmm/types';

interface TariffPackage {
  id: string;
  product: 'BNV' | 'BNP';
  version_name: string;
  source_filename: string | null;
  status: 'draft' | 'active' | 'archived' | 'failed';
  rates_count: number;
  sumas_aseguradas: number[];
  deducibles: number[];
  coaseguros: number[];
  created_at: string;
}

const UPLOADABLE_PRODUCTS: { id: 'BNV' | 'BNP'; label: string }[] = [
  { id: 'BNV', label: 'Bupa Nacional Vital' },
  { id: 'BNP', label: 'Bupa Nacional Plus' },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface ParsedRate {
  lookup_key: string;
  plan_name: string;
  region: string;
  age: number;
  rate: number;
  rate_type: string;
}

function parseExcelFile(file: ArrayBuffer, product: 'BNV' | 'BNP') {
  const uint8 = new Uint8Array(file);
  const workbook = XLSX.read(uint8, { type: 'array', bookVBA: true });
  const sheetNames = workbook.SheetNames;

  if (sheetNames.length === 0) {
    throw new Error('El archivo no contiene hojas');
  }

  const rates: ParsedRate[] = [];
  const detectedSumas: Set<number> = new Set();
  const detectedDeducibles: Set<number> = new Set();
  const detectedCoaseguros: Set<number> = new Set();
  let derechoPoliza = 1600;
  let asistenciaExtranjero = 1632;
  let costoCatastrofica = 5800;

  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const jsonData: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    if (jsonData.length < 2) continue;

    const headers = jsonData[0] as any[];
    if (!headers) continue;

    const lowerSheet = sheetName.toLowerCase();
    if (lowerSheet.includes('config') || lowerSheet.includes('param')) {
      for (const row of jsonData) {
        if (!Array.isArray(row)) continue;
        const label = String(row[0] || '').toLowerCase();
        const val = Number(row[1]);
        if (label.includes('derecho') && !isNaN(val)) derechoPoliza = val;
        if (label.includes('asistencia') && !isNaN(val)) asistenciaExtranjero = val;
        if (label.includes('catastro') && !isNaN(val)) costoCatastrofica = val;
      }
      continue;
    }

    const ageColIdx = headers.findIndex((h: any) => {
      const s = String(h || '').toLowerCase().trim();
      return s === 'age' || s === 'edad' || s === 'edades' || s.includes('edad') || s.includes('age');
    });

    if (ageColIdx === -1) {
      const lookupIdx = headers.findIndex((h: any) => String(h || '').toLowerCase().includes('lookup'));
      const regionIdx = headers.findIndex((h: any) => String(h || '').toLowerCase().includes('region'));
      const rateIdx = headers.findIndex((h: any) => String(h || '').toLowerCase().includes('rate') || String(h || '').toLowerCase().includes('prima') || String(h || '').toLowerCase().includes('tarifa'));
      const typeIdx = headers.findIndex((h: any) => String(h || '').toLowerCase().includes('type') || String(h || '').toLowerCase().includes('sexo') || String(h || '').toLowerCase().includes('genero'));

      // Try to find age column by checking first column with numeric values 0-120
      let inferredAgeIdx = 0;
      if (jsonData.length > 3) {
        for (let ci = 0; ci < headers.length; ci++) {
          const vals = jsonData.slice(1, 10).map((r: any) => Number(r?.[ci])).filter(v => !isNaN(v));
          if (vals.length >= 3 && vals.every(v => v >= 0 && v <= 120) && vals[1] - vals[0] === 1) {
            inferredAgeIdx = ci;
            break;
          }
        }
      }

      if (rateIdx !== -1) {
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          if (!row) continue;
          const age = Number(row[inferredAgeIdx]);
          const rate = Number(row[rateIdx]);
          if (isNaN(age) || isNaN(rate) || rate <= 0) continue;

          const lookupKey = lookupIdx !== -1 ? String(row[lookupIdx] || '') : sheetName;
          const region = regionIdx !== -1 ? String(row[regionIdx] || 'Mexico Region 1') : 'Mexico Region 1';
          const rateType = typeIdx !== -1 ? (String(row[typeIdx] || '').toLowerCase().includes('fem') || String(row[typeIdx] || '').toLowerCase().includes('mujer') ? 'Female' : 'Male') : 'Unisex';

          rates.push({
            lookup_key: lookupKey,
            plan_name: lookupKey.replace(/Mexico Region \d.*$/, '').trim() || lookupKey,
            region,
            age,
            rate,
            rate_type: product === 'BNP' ? rateType : 'Unisex',
          });
        }
      }
      continue;
    }

    for (let colIdx = 1; colIdx < headers.length; colIdx++) {
      const colHeader = String(headers[colIdx] || '');
      if (!colHeader) continue;

      let region = 'Mexico Region 1';
      if (sheetName.toLowerCase().includes('region 2') || sheetName.toLowerCase().includes('zona 2') || colHeader.toLowerCase().includes('region 2')) {
        region = 'Mexico Region 2';
      }

      const saMatch = colHeader.match(/S(\d+)/i) || colHeader.match(/(\d{2,3})(?=D)/);
      const dedMatch = colHeader.match(/D(\d+)/i);
      const coasMatch = colHeader.match(/C(\d+)/i);
      if (saMatch) detectedSumas.add(Number(saMatch[1]));
      if (dedMatch) detectedDeducibles.add(Number(dedMatch[1]));
      if (coasMatch) detectedCoaseguros.add(Number(coasMatch[1]));

      let rateType = 'Unisex';
      if (product === 'BNP') {
        if (colHeader.toLowerCase().includes('female') || colHeader.toLowerCase().includes('mujer') || colHeader.toLowerCase().includes('fem')) {
          rateType = 'Female';
        } else if (colHeader.toLowerCase().includes('male') || colHeader.toLowerCase().includes('hombre') || colHeader.toLowerCase().includes('masc')) {
          rateType = 'Male';
        }
      }

      for (let rowIdx = 1; rowIdx < jsonData.length; rowIdx++) {
        const row = jsonData[rowIdx] as any[];
        if (!row) continue;
        const age = Number(row[ageColIdx]);
        const rate = Number(row[colIdx]);
        if (isNaN(age) || isNaN(rate) || rate <= 0) continue;

        const lookupKey = `${colHeader}${region}${age}${rateType !== 'Unisex' ? rateType : ''}`;
        rates.push({
          lookup_key: lookupKey,
          plan_name: colHeader,
          region,
          age,
          rate,
          rate_type: rateType,
        });
      }
    }
  }

  if (rates.length === 0) {
    throw new Error('No se pudieron extraer tarifas del archivo. Verifique el formato.');
  }

  const uniqueAges = [...new Set(rates.map(r => r.age))];
  if (uniqueAges.length === 1 && uniqueAges[0] === 0) {
    throw new Error(
      'Error de formato: No se detectó la columna de edades en el archivo. ' +
      'Asegúrese de que existe una columna con encabezado "Edad" o "Age" en la hoja de tarifas.'
    );
  }


  return {
    rates,
    derechoPoliza,
    asistenciaExtranjero,
    costoCatastrofica,
    sumas: Array.from(detectedSumas).sort((a, b) => a - b),
    deducibles: Array.from(detectedDeducibles).sort((a, b) => a - b),
    coaseguros: Array.from(detectedCoaseguros).sort((a, b) => a - b),
  };
}

export function TarifasAdminPanel() {
  const [packages, setPackages] = useState<TariffPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadProduct, setUploadProduct] = useState<'BNV' | 'BNP'>('BNV');
  const [versionName, setVersionName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);

  const loadPackages = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('multicotizador_gmm_packages')
      .select('id, product, version_name, source_filename, status, rates_count, sumas_aseguradas, deducibles, coaseguros, created_at')
      .order('created_at', { ascending: false });
    if (data) setPackages(data as TariffPackage[]);
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
      const arrayBuffer = await selectedFile.arrayBuffer();

      setUploadProgress('Procesando Excel...');
      const parsed = parseExcelFile(arrayBuffer, uploadProduct);

      setUploadProgress('Creando paquete de tarifas...');
      const { data: pkg, error: pkgError } = await supabase
        .from('multicotizador_gmm_packages')
        .insert({
          product: uploadProduct,
          version_name: versionName.trim(),
          source_filename: selectedFile.name,
          status: 'draft',
          derecho_poliza: parsed.derechoPoliza,
          asistencia_extranjero: parsed.asistenciaExtranjero,
          costo_catastrofica_extranjero: parsed.costoCatastrofica,
          sumas_aseguradas: parsed.sumas,
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

      if (pkgError) {
        setUploadError('Error creando paquete: ' + pkgError.message);
        return;
      }

      const batchSize = 500;
      const totalBatches = Math.ceil(parsed.rates.length / batchSize);
      for (let i = 0; i < parsed.rates.length; i += batchSize) {
        const batchNum = Math.floor(i / batchSize) + 1;
        setUploadProgress(`Insertando tarifas (${batchNum}/${totalBatches})...`);
        const batch = parsed.rates.slice(i, i + batchSize).map(r => ({
          package_id: pkg.id,
          ...r,
        }));
        const { error: rateError } = await supabase
          .from('multicotizador_gmm_rates')
          .insert(batch);
        if (rateError) {
          await supabase.from('multicotizador_gmm_packages')
            .update({ status: 'failed', validation_errors: { message: rateError.message } })
            .eq('id', pkg.id);
          setUploadError('Error insertando tarifas: ' + rateError.message);
          return;
        }
      }

      setUploadSuccess(`Tarifa cargada: ${parsed.rates.length.toLocaleString()} tarifas procesadas`);
      setSelectedFile(null);
      setVersionName('');
      loadPackages();
    } catch (err: any) {
      setUploadError(err.message || 'Error procesando archivo');
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  const handleActivate = async (pkgId: string) => {
    setActivating(pkgId);
    try {
      const { error } = await supabase.rpc('activate_multicotizador_tariff', { p_package_id: pkgId });
      if (error) {
        setUploadError('Error activando tarifa: ' + error.message);
      } else {
        loadPackages();
      }
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setActivating(null);
    }
  };

  const handleArchive = async (pkgId: string) => {
    await supabase
      .from('multicotizador_gmm_packages')
      .update({ status: 'archived' })
      .eq('id', pkgId);
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
          Sube un archivo Excel (.xlsm, .xlsx) con las tarifas de Bupa Nacional Vital o Bupa Nacional Plus. El archivo se procesa directamente en tu navegador.
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
                      onClick={() => handleActivate(pkg.id)}
                      disabled={activating === pkg.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-xs font-medium hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors disabled:opacity-50"
                    >
                      {activating === pkg.id ? <Loader className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                      Activar
                    </button>
                  )}
                  {(pkg.status === 'draft' || pkg.status === 'active') && (
                    <button
                      onClick={() => handleArchive(pkg.id)}
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

      {/* BX+ Note */}
      <div className="bg-sky-50/50 dark:bg-sky-900/10 rounded-2xl border border-sky-200/50 dark:border-sky-800/20 p-5">
        <div className="flex items-start gap-3">
          <div className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: PRODUCT_COLORS.BXPLUS }} />
          <div>
            <h4 className="text-sm font-semibold text-neutral-900 dark:text-white mb-1">Tarifas BX+</h4>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Las tarifas de BX+ se administran desde el modulo GMM BX+ existente. El multicotizador utiliza automaticamente la tarifa activa de ese modulo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
