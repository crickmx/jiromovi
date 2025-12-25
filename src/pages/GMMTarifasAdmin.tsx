import { useState, useEffect } from 'react';
import { Upload, Check, X, AlertCircle, FileSpreadsheet, Calendar } from 'lucide-react';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/ui/page-header';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { supabase } from '../lib/supabase';
import type { TariffPackage } from '../lib/gmmTypes';

export default function GMMTarifasAdmin() {
  const [packages, setPackages] = useState<TariffPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadPackages();
  }, []);

  async function loadPackages() {
    try {
      const { data, error } = await supabase
        .from('tariff_packages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPackages(data || []);
    } catch (error) {
      console.error('Error loading packages:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload() {
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', name || file.name);
      formData.append('notes', notes);

      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmm-upload-tariff`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error uploading file');
      }

      alert('Tarifa cargada exitosamente');
      setFile(null);
      setName('');
      setNotes('');
      loadPackages();
    } catch (error: any) {
      console.error('Error:', error);
      alert(error.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleActivate(packageId: string) {
    if (!confirm('¿Desactivar la tarifa actual y activar esta versión?')) return;

    try {
      const { error } = await supabase.rpc('activate_tariff_package', {
        p_package_id: packageId,
      });

      if (error) throw error;

      alert('Tarifa activada exitosamente');
      loadPackages();
    } catch (error: any) {
      console.error('Error:', error);
      alert(error.message);
    }
  }

  function getStatusBadge(status: string) {
    const styles = {
      active: 'bg-green-100 text-green-800',
      draft: 'bg-primary-100 text-primary-800',
      archived: 'bg-gray-100 text-gray-800',
      failed: 'bg-red-100 text-red-800',
    };

    const labels = {
      active: 'Activa',
      draft: 'Borrador',
      archived: 'Archivada',
      failed: 'Error',
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  }

  return (
    <Layout>
      <PageHeader
        title="Administración de Tarifas GMM BX+"
        subtitle="Gestiona las versiones de tarifas del cotizador"
      />

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Cargar Nueva Tarifa</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre de la versión
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Tarifas 2024 Q1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Archivo Excel
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept=".xlsx,.xlsm"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="flex-1"
                />
                {file && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <FileSpreadsheet className="w-4 h-4" />
                    {file.name}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas (opcional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Descripción de cambios, vigencia, etc."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="w-full"
            >
              {uploading ? (
                'Cargando...'
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Cargar Tarifa
                </>
              )}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Versiones de Tarifas</h3>

          {loading ? (
            <div className="text-center py-8 text-gray-500">Cargando...</div>
          ) : packages.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No hay tarifas cargadas
            </div>
          ) : (
            <div className="space-y-3">
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-primary-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold text-gray-900">{pkg.name}</h4>
                        {getStatusBadge(pkg.status)}
                      </div>

                      <div className="text-sm text-gray-600 space-y-1">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4" />
                          {pkg.source_filename}
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          {new Date(pkg.created_at).toLocaleDateString('es-MX', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </div>
                        {pkg.notes && (
                          <div className="text-gray-500 mt-2">{pkg.notes}</div>
                        )}
                      </div>

                      {pkg.validation_errors && (
                        <div className="mt-3 p-3 bg-red-50 rounded-md">
                          <div className="flex items-center gap-2 text-red-800 text-sm font-medium mb-2">
                            <AlertCircle className="w-4 h-4" />
                            Errores de validación
                          </div>
                          <pre className="text-xs text-red-700 overflow-auto">
                            {JSON.stringify(pkg.validation_errors, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>

                    <div className="ml-4">
                      {pkg.status === 'draft' && !pkg.validation_errors && (
                        <Button
                          onClick={() => handleActivate(pkg.id)}
                          variant="outline"
                          size="sm"
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Activar
                        </Button>
                      )}

                      {pkg.status === 'active' && (
                        <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                          <Check className="w-4 h-4" />
                          En uso
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
}
