import { useState, useEffect } from 'react';
import { X, Upload, File, AlertCircle, Users, Building2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { subirArchivo } from '../../lib/centroDigitalUtils';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface SubirArchivoModalProps {
  carpetaId: string;
  carpetaNombre: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface Usuario {
  id: string;
  nombre_completo: string;
  oficina_id: string | null;
}

interface Oficina {
  id: string;
  nombre: string;
}

export function SubirArchivoModal({
  carpetaId,
  carpetaNombre,
  onClose,
  onSuccess
}: SubirArchivoModalProps) {
  const { usuario } = useAuth();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [nombre, setNombre] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progreso, setProgreso] = useState(0);

  const [visibleParaTodos, setVisibleParaTodos] = useState(false);
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [oficinaSeleccionada, setOficinaSeleccionada] = useState<string>('');
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [usuariosSeleccionados, setUsuariosSeleccionados] = useState<string[]>([]);
  const [mostrarPermisos, setMostrarPermisos] = useState(false);

  const esAdmin = usuario?.rol === 'Administrador';
  const esGerente = usuario?.rol === 'Gerente';

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    const { data: oficinasData } = await supabase
      .from('oficinas')
      .select('id, nombre')
      .eq('activa', true)
      .order('nombre');

    if (oficinasData) {
      setOficinas(oficinasData);

      if (esGerente && usuario?.oficina_id) {
        setOficinaSeleccionada(usuario.oficina_id);
      }
    }

    let query = supabase
      .from('usuarios')
      .select('id, nombre_completo, oficina_id')
      .order('nombre_completo');

    if (esGerente && usuario?.oficina_id) {
      query = query.eq('oficina_id', usuario.oficina_id);
    }

    const { data: usuariosData } = await query;
    if (usuariosData) {
      setUsuarios(usuariosData);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setArchivo(file);
      setNombre(file.name.replace(/\.[^/.]+$/, ''));
    }
  }

  function toggleUsuario(usuarioId: string) {
    setUsuariosSeleccionados(prev =>
      prev.includes(usuarioId)
        ? prev.filter(id => id !== usuarioId)
        : [...prev, usuarioId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!archivo || !nombre.trim()) {
      setError('Selecciona un archivo y proporciona un nombre');
      return;
    }

    if (esGerente && oficinaSeleccionada !== usuario?.oficina_id) {
      setError('Solo puedes asignar archivos a tu oficina');
      return;
    }

    setLoading(true);
    setError('');
    setProgreso(0);

    try {
      const progressInterval = setInterval(() => {
        setProgreso((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      await subirArchivo({
        file: archivo,
        nombre: nombre.trim(),
        carpeta_id: carpetaId,
        visible_para_todos: visibleParaTodos,
        visible_para_oficina: oficinaSeleccionada || null,
        usuarios_con_permiso: usuariosSeleccionados
      });

      clearInterval(progressInterval);
      setProgreso(100);

      setTimeout(() => {
        onSuccess();
      }, 500);
    } catch (err: any) {
      setError(err.message);
      setProgreso(0);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Upload className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Subir archivo</h2>
              <p className="text-sm text-gray-500">A: {carpetaNombre}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={loading}
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

          <div>
            <Label htmlFor="archivo">Seleccionar archivo *</Label>
            <div className="mt-2">
              <label className="block">
                <input
                  type="file"
                  id="archivo"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={loading}
                />
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
                  {archivo ? (
                    <div className="flex items-center justify-center gap-3">
                      <File className="w-8 h-8 text-accent" />
                      <div className="text-left">
                        <p className="font-medium text-gray-900">{archivo.name}</p>
                        <p className="text-sm text-gray-500">
                          {(archivo.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm font-medium text-gray-700">
                        Haz clic para seleccionar un archivo
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Máximo 100 MB
                      </p>
                    </>
                  )}
                </div>
              </label>
            </div>
          </div>

          {archivo && (
            <>
              <div>
                <Label htmlFor="nombre">Nombre del archivo *</Label>
                <Input
                  id="nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Nombre descriptivo"
                  required
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Este nombre aparecerá en el Centro Digital
                </p>
              </div>

              <div className="border-t pt-4">
                <button
                  type="button"
                  onClick={() => setMostrarPermisos(!mostrarPermisos)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 mb-3"
                >
                  <Users className="w-4 h-4" />
                  Configurar permisos de visibilidad
                  <span className="text-xs text-gray-500">
                    ({mostrarPermisos ? 'ocultar' : 'mostrar'})
                  </span>
                </button>

                {mostrarPermisos && (
                  <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Visible para todos</Label>
                        <p className="text-xs text-gray-500">
                          Todos los usuarios podrán ver este archivo
                        </p>
                      </div>
                      <Switch
                        checked={visibleParaTodos}
                        onCheckedChange={setVisibleParaTodos}
                        disabled={loading}
                      />
                    </div>

                    {!visibleParaTodos && (
                      <>
                        <div>
                          <Label htmlFor="oficina">
                            <Building2 className="w-4 h-4 inline mr-2" />
                            Visible para oficina específica
                          </Label>
                          <select
                            id="oficina"
                            value={oficinaSeleccionada}
                            onChange={(e) => setOficinaSeleccionada(e.target.value)}
                            disabled={loading || (esGerente && !!usuario?.oficina_id)}
                            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          >
                            <option value="">Ninguna (hereda de carpeta)</option>
                            {oficinas.map((oficina) => (
                              <option key={oficina.id} value={oficina.id}>
                                {oficina.nombre}
                              </option>
                            ))}
                          </select>
                          {esGerente && (
                            <p className="text-xs text-amber-600 mt-1">
                              Solo puedes asignar a tu oficina
                            </p>
                          )}
                        </div>

                        <div>
                          <Label>
                            <Users className="w-4 h-4 inline mr-2" />
                            Usuarios con permiso individual
                          </Label>
                          <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md">
                            {usuarios.map((u) => (
                              <label
                                key={u.id}
                                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={usuariosSeleccionados.includes(u.id)}
                                  onChange={() => toggleUsuario(u.id)}
                                  disabled={loading}
                                  className="rounded"
                                />
                                <span className="text-sm text-gray-700">
                                  {u.nombre_completo}
                                </span>
                              </label>
                            ))}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {usuariosSeleccionados.length} usuario(s) seleccionado(s)
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {loading && progreso > 0 && (
            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Subiendo archivo...</span>
                <span>{progreso}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-accent h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progreso}%` }}
                />
              </div>
            </div>
          )}

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
            <Button
              type="submit"
              disabled={loading || !archivo || !nombre.trim()}
              className="flex-1"
            >
              {loading ? 'Subiendo...' : 'Subir archivo'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
