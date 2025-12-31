import { useState, useEffect } from 'react';
import { X, Folder, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { supabase } from '../../lib/supabase';
import type { CarpetaFormData, CentroDigitalCarpeta } from '../../lib/centroDigitalTypes';
import { ROLES_DISPONIBLES } from '../../lib/centroDigitalTypes';

interface CarpetaModalProps {
  carpeta?: CentroDigitalCarpeta | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface Oficina {
  id: string;
  nombre: string;
}

export function CarpetaModal({ carpeta, onClose, onSuccess }: CarpetaModalProps) {
  const [formData, setFormData] = useState<CarpetaFormData>({
    nombre: '',
    descripcion: '',
    todas_oficinas: true,
    todos_roles: true,
    oficinas_seleccionadas: [],
    roles_seleccionados: []
  });

  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    cargarOficinas();

    if (carpeta) {
      setFormData({
        nombre: carpeta.nombre,
        descripcion: carpeta.descripcion || '',
        todas_oficinas: carpeta.todas_oficinas,
        todos_roles: carpeta.todos_roles,
        oficinas_seleccionadas:
          carpeta.oficinas_permitidas?.map((o) => o.oficina_id) || [],
        roles_seleccionados: carpeta.roles_permitidos?.map((r) => r.rol) || []
      });
    }
  }, [carpeta]);

  async function cargarOficinas() {
    const { data } = await supabase
      .from('oficinas')
      .select('id, nombre')
      .eq('activa', true)
      .order('nombre');

    setOficinas(data || []);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { crearCarpeta, actualizarCarpeta } = await import(
        '../../lib/centroDigitalUtils'
      );

      if (carpeta) {
        await actualizarCarpeta(carpeta.id, formData);
      } else {
        await crearCarpeta(formData);
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleOficina(oficinaId: string) {
    setFormData((prev) => ({
      ...prev,
      oficinas_seleccionadas: prev.oficinas_seleccionadas.includes(oficinaId)
        ? prev.oficinas_seleccionadas.filter((id) => id !== oficinaId)
        : [...prev.oficinas_seleccionadas, oficinaId]
    }));
  }

  function toggleRol(rol: string) {
    setFormData((prev) => ({
      ...prev,
      roles_seleccionados: prev.roles_seleccionados.includes(rol)
        ? prev.roles_seleccionados.filter((r) => r !== rol)
        : [...prev.roles_seleccionados, rol]
    }));
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Folder className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {carpeta ? 'Editar carpeta' : 'Nueva carpeta'}
              </h2>
              <p className="text-sm text-gray-500">
                {carpeta
                  ? 'Modifica los datos de la carpeta'
                  : 'Crea una nueva carpeta para organizar documentos'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900">Error</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor="nombre">Nombre de la carpeta *</Label>
              <Input
                id="nombre"
                value={formData.nombre}
                onChange={(e) =>
                  setFormData({ ...formData, nombre: e.target.value })
                }
                placeholder="Ej: Documentos fiscales 2024"
                required
              />
            </div>

            <div>
              <Label htmlFor="descripcion">Descripción</Label>
              <textarea
                id="descripcion"
                value={formData.descripcion}
                onChange={(e) =>
                  setFormData({ ...formData, descripcion: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Descripción opcional de la carpeta"
              />
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="font-medium text-gray-900 mb-4">
              Visibilidad por oficinas
            </h3>

            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={formData.todas_oficinas}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, todas_oficinas: !!checked })
                  }
                />
                <span className="text-sm text-gray-700">Todas las oficinas</span>
              </label>

              {!formData.todas_oficinas && (
                <div className="ml-8 space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                  {oficinas.map((oficina) => (
                    <label
                      key={oficina.id}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Checkbox
                        checked={formData.oficinas_seleccionadas.includes(
                          oficina.id
                        )}
                        onCheckedChange={() => toggleOficina(oficina.id)}
                      />
                      <span className="text-sm text-gray-700">
                        {oficina.nombre}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="font-medium text-gray-900 mb-4">Visibilidad por roles</h3>

            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={formData.todos_roles}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, todos_roles: !!checked })
                  }
                />
                <span className="text-sm text-gray-700">Todos los roles</span>
              </label>

              {!formData.todos_roles && (
                <div className="ml-8 space-y-2">
                  {ROLES_DISPONIBLES.map((rol) => (
                    <label
                      key={rol}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Checkbox
                        checked={formData.roles_seleccionados.includes(rol)}
                        onCheckedChange={() => toggleRol(rol)}
                      />
                      <span className="text-sm text-gray-700">{rol}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading
                ? 'Guardando...'
                : carpeta
                  ? 'Guardar cambios'
                  : 'Crear carpeta'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
