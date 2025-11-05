import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { BaseModal } from './BaseModal';
import { Upload, AlertCircle } from 'lucide-react';

interface PublicarOnDemandModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPublicar: (data: PublicarOnDemandData) => Promise<void>;
  grabacionTitulo: string;
}

export interface PublicarOnDemandData {
  titulo: string;
  descripcion: string;
  categoria_id: string;
  duracion_minutos: number;
  activa: boolean;
  oficina_ids: string[];
}

interface Categoria {
  id: string;
  nombre: string;
}

interface Oficina {
  id: string;
  nombre: string;
}

export function PublicarOnDemandModal({
  isOpen,
  onClose,
  onPublicar,
  grabacionTitulo
}: PublicarOnDemandModalProps) {
  const [titulo, setTitulo] = useState(grabacionTitulo);
  const [descripcion, setDescripcion] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [duracionMinutos, setDuracionMinutos] = useState(0);
  const [activa, setActiva] = useState(true);
  const [oficinasSeleccionadas, setOficinasSeleccionadas] = useState<string[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadOptions();
      setTitulo(grabacionTitulo);
    }
  }, [isOpen, grabacionTitulo]);

  const loadOptions = async () => {
    try {
      const [categoriasData, oficinasData] = await Promise.all([
        supabase
          .from('seguros_categories')
          .select('id, nombre')
          .eq('activa', true)
          .order('orden'),
        supabase
          .from('oficinas')
          .select('id, nombre')
          .order('nombre')
      ]);

      if (categoriasData.data) setCategorias(categoriasData.data);
      if (oficinasData.data) setOficinas(oficinasData.data);
    } catch (err) {
      console.error('Error loading options:', err);
    }
  };

  const handleToggleOficina = (oficinaId: string) => {
    setOficinasSeleccionadas(prev =>
      prev.includes(oficinaId)
        ? prev.filter(id => id !== oficinaId)
        : [...prev, oficinaId]
    );
  };

  const handleToggleTodasOficinas = () => {
    if (oficinasSeleccionadas.length === oficinas.length) {
      setOficinasSeleccionadas([]);
    } else {
      setOficinasSeleccionadas(oficinas.map(o => o.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!titulo.trim()) {
      setError('El título es requerido');
      return;
    }

    if (!descripcion.trim()) {
      setError('La descripción es requerida');
      return;
    }

    if (!categoriaId) {
      setError('Debes seleccionar una categoría');
      return;
    }

    if (duracionMinutos <= 0) {
      setError('La duración debe ser mayor a 0');
      return;
    }

    if (oficinasSeleccionadas.length === 0) {
      setError('Debes seleccionar al menos una oficina');
      return;
    }

    setLoading(true);
    try {
      await onPublicar({
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        categoria_id: categoriaId,
        duracion_minutos: duracionMinutos,
        activa,
        oficina_ids: oficinasSeleccionadas,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al publicar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Publicar en On Demand"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Título de la lección *
          </label>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ej: Introducción a Seguros de Vida"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Descripción *
          </label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={4}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Describe el contenido de la lección..."
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Categoría *
            </label>
            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Selecciona una categoría</option>
              {categorias.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Duración (minutos) *
            </label>
            <input
              type="number"
              value={duracionMinutos}
              onChange={(e) => setDuracionMinutos(parseInt(e.target.value) || 0)}
              min="1"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="30"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">
            Oficinas con acceso *
          </label>
          <div className="border border-slate-300 rounded-lg p-4 max-h-48 overflow-y-auto">
            <label className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-200">
              <input
                type="checkbox"
                checked={oficinasSeleccionadas.length === oficinas.length}
                onChange={handleToggleTodasOficinas}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm font-semibold text-slate-800">Todas las oficinas</span>
            </label>
            <div className="space-y-2">
              {oficinas.map((oficina) => (
                <label key={oficina.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={oficinasSeleccionadas.includes(oficina.id)}
                    onChange={() => handleToggleOficina(oficina.id)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">{oficina.nombre}</span>
                </label>
              ))}
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {oficinasSeleccionadas.length} oficina{oficinasSeleccionadas.length !== 1 ? 's' : ''} seleccionada{oficinasSeleccionadas.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="activa"
            checked={activa}
            onChange={(e) => setActiva(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <label htmlFor="activa" className="text-sm text-slate-700">
            Publicar inmediatamente (visible para usuarios)
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Publicando...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Publicar en On Demand
              </>
            )}
          </button>
        </div>
      </form>
    </BaseModal>
  );
}
