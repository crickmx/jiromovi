import { useState, useEffect, useCallback } from 'react';
import { Upload, CircleCheck as CheckCircle, Circle as XCircle, Loader, Trash2, Package, CircleAlert as AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { ProductId } from '../../lib/multicotizadorGmm/types';
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

export function TarifasAdminPanel() {
  const [packages, setPackages] = useState<TariffPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
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

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('product', uploadProduct);
      formData.append('version_name', versionName.trim());

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
      const res = await fetch(`${supabaseUrl}/functions/v1/multicotizador-gmm-upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        setUploadError(json.error || 'Error al subir archivo');
      } else {
        setUploadSuccess(`Tarifa cargada: ${json.rates_loaded} tarifas procesadas`);
        setSelectedFile(null);
        setVersionName('');
        loadPackages();
      }
    } catch (err: any) {
      setUploadError(err.message || 'Error de conexion');
    } finally {
      setUploading(false);
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
          Sube un archivo Excel (.xlsx) con las tarifas de Bupa Nacional Vital o Bupa Nacional Plus. La tarifa se guarda como borrador hasta que la actives.
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
          {uploading ? 'Subiendo...' : 'Subir Tarifa'}
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
