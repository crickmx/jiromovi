import { useState, useEffect } from 'react';
import { X, Upload, User, AlertCircle, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { BaseModal } from '../BaseModal';

interface TramiteEstatus {
  id: string;
  nombre: string;
}

interface Usuario {
  id: string;
  nombre_completo: string;
  rol: string;
}

interface NuevoTramiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  estatusList: TramiteEstatus[];
}

export function NuevoTramiteModal({ isOpen, onClose, onSuccess, estatusList }: NuevoTramiteModalProps) {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [agentes, setAgentes] = useState<Usuario[]>([]);
  const [ejecutivos, setEjecutivos] = useState<Usuario[]>([]);

  const [agenteId, setAgenteId] = useState('');
  const [prioridad, setPrioridad] = useState<'Alta' | 'Media' | 'Baja'>('Media');
  const [poliza, setPoliza] = useState('');
  const [instrucciones, setInstrucciones] = useState('');
  const [ejecutivosSeleccionados, setEjecutivosSeleccionados] = useState<string[]>([]);
  const [archivos, setArchivos] = useState<File[]>([]);

  const isAdmin = usuario?.rol === 'Administrador';
  const isGerente = usuario?.rol === 'Gerente';
  const canAssignExecutives = isAdmin || isGerente;

  useEffect(() => {
    if (isOpen) {
      loadUsuarios();
      resetForm();
    }
  }, [isOpen]);

  const loadUsuarios = async () => {
    const { data: agentesData } = await supabase
      .from('usuarios')
      .select('id, nombre_completo, rol')
      .eq('rol', 'Agente')
      .eq('estado', 'activo')
      .order('nombre_completo');

    if (agentesData) setAgentes(agentesData);

    const { data: ejecutivosData } = await supabase
      .from('usuarios')
      .select('id, nombre_completo, rol')
      .in('rol', ['Gerente', 'Administrador'])
      .eq('estado', 'activo')
      .order('nombre_completo');

    if (ejecutivosData) setEjecutivos(ejecutivosData);
  };

  const resetForm = () => {
    if (usuario?.rol === 'Agente') {
      setAgenteId(usuario.id);
    } else {
      setAgenteId('');
    }
    setPrioridad('Media');
    setPoliza('');
    setInstrucciones('');
    setEjecutivosSeleccionados([]);
    setArchivos([]);
    setError('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setArchivos(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setArchivos(prev => prev.filter((_, i) => i !== index));
  };

  const toggleEjecutivo = (ejecutivoId: string) => {
    setEjecutivosSeleccionados(prev =>
      prev.includes(ejecutivoId)
        ? prev.filter(id => id !== ejecutivoId)
        : [...prev, ejecutivoId]
    );
  };

  const handleSubmit = async () => {
    if (!agenteId || !instrucciones.trim()) {
      setError('Por favor completa todos los campos requeridos');
      return;
    }

    if (!usuario) {
      setError('Usuario no autenticado');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const estatusNuevo = estatusList.find(e => e.nombre === 'Nuevo');
      if (!estatusNuevo) {
        throw new Error('No se encontró el estatus "Nuevo"');
      }

      const { data: tramite, error: tramiteError } = await supabase
        .from('tramites')
        .insert({
          agente_id: agenteId,
          estatus_id: estatusNuevo.id,
          prioridad,
          poliza: poliza.trim() || null,
          instrucciones: instrucciones.trim(),
          creado_por: usuario.id,
          modificado_por: usuario.id
        })
        .select()
        .single();

      if (tramiteError) throw tramiteError;

      if (ejecutivosSeleccionados.length > 0) {
        const asignaciones = ejecutivosSeleccionados.map(ejecutivoId => ({
          tramite_id: tramite.id,
          ejecutivo_id: ejecutivoId,
          asignado_por: usuario.id
        }));

        const { error: asignacionError } = await supabase
          .from('tramite_asignaciones')
          .insert(asignaciones);

        if (asignacionError) throw asignacionError;
      }

      if (archivos.length > 0) {
        for (const archivo of archivos) {
          const fileExt = archivo.name.split('.').pop();
          const fileName = `${tramite.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('tramite-archivos')
            .upload(fileName, archivo);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('tramite-archivos')
            .getPublicUrl(fileName);

          const { error: archivoError } = await supabase
            .from('tramite_archivos')
            .insert({
              tramite_id: tramite.id,
              usuario_id: usuario.id,
              nombre: archivo.name,
              url: publicUrl,
              tipo: archivo.type,
              tamano: archivo.size
            });

          if (archivoError) throw archivoError;
        }
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error creando tramite:', err);
      setError(err.message || 'Error al crear el tramite');
    } finally {
      setLoading(false);
    }
  };

  const footer = (
    <>
      <button
        onClick={onClose}
        className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg text-sm font-medium transition-all"
      >
        Cancelar
      </button>
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all disabled:opacity-50"
      >
        {loading ? 'Creando...' : 'Crear'}
      </button>
    </>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Nuevo Tramite"
      footer={footer}
      maxWidth="2xl"
    >
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm mb-3">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              <User className="w-4 h-4 inline mr-2" />
              Agente *
            </label>
            {usuario?.rol === 'Agente' ? (
              <input
                type="text"
                value={usuario.nombre_completo}
                disabled
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed"
              />
            ) : (
              <select
                value={agenteId}
                onChange={(e) => setAgenteId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecciona un agente</option>
                {agentes.map(agente => (
                  <option key={agente.id} value={agente.id}>{agente.nombre_completo}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              <AlertCircle className="w-4 h-4 inline mr-2" />
              Prioridad *
            </label>
            <select
              value={prioridad}
              onChange={(e) => setPrioridad(e.target.value as 'Alta' | 'Media' | 'Baja')}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Baja">Baja</option>
              <option value="Media">Media</option>
              <option value="Alta">Alta</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            <FileText className="w-4 h-4 inline mr-2" />
            Número de Póliza
          </label>
          <input
            type="text"
            value={poliza}
            onChange={(e) => setPoliza(e.target.value)}
            placeholder="Ej: POL-2024-001"
            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Instrucciones / Descripción *
          </label>
          <textarea
            value={instrucciones}
            onChange={(e) => setInstrucciones(e.target.value)}
            rows={3}
            placeholder="Describe el motivo del tramite..."
            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {canAssignExecutives && ejecutivos.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Asignar a Ejecutivos
            </label>
            <div className="border border-slate-300 rounded-xl p-4 max-h-48 overflow-y-auto space-y-2">
              {ejecutivos.map(ejecutivo => (
                <label
                  key={ejecutivo.id}
                  className="flex items-center space-x-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={ejecutivosSeleccionados.includes(ejecutivo.id)}
                    onChange={() => toggleEjecutivo(ejecutivo.id)}
                    className="w-4 h-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm text-slate-700">{ejecutivo.nombre_completo}</span>
                  <span className="text-xs text-slate-500">({ejecutivo.rol})</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            <Upload className="w-4 h-4 inline mr-2" />
            Archivos Adjuntos
          </label>
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-primary-500 transition-all">
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <Upload className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <p className="text-slate-700 font-medium text-sm">Haz clic para subir archivos</p>
              <p className="text-xs text-slate-500 mt-1">PDF, imágenes, documentos</p>
            </label>
          </div>

          {archivos.length > 0 && (
            <div className="mt-4 space-y-2">
              {archivos.map((archivo, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                >
                  <div className="flex items-center space-x-3">
                    <FileText className="w-5 h-5 text-slate-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{archivo.name}</p>
                      <p className="text-xs text-slate-500">
                        {(archivo.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    className="text-red-600 hover:text-red-700 p-1"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </BaseModal>
  );
}
