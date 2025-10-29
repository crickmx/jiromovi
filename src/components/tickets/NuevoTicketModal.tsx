import { useState, useEffect } from 'react';
import { X, Upload, User, AlertCircle, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { BaseModal } from '../BaseModal';

interface TicketEstatus {
  id: string;
  nombre: string;
}

interface Usuario {
  id: string;
  nombre_completo: string;
  rol: string;
}

interface NuevoTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  estatusList: TicketEstatus[];
}

export function NuevoTicketModal({ isOpen, onClose, onSuccess, estatusList }: NuevoTicketModalProps) {
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

      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
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

      if (ticketError) throw ticketError;

      if (ejecutivosSeleccionados.length > 0) {
        const asignaciones = ejecutivosSeleccionados.map(ejecutivoId => ({
          ticket_id: ticket.id,
          ejecutivo_id: ejecutivoId,
          asignado_por: usuario.id
        }));

        const { error: asignacionError } = await supabase
          .from('ticket_asignaciones')
          .insert(asignaciones);

        if (asignacionError) throw asignacionError;
      }

      if (archivos.length > 0) {
        for (const archivo of archivos) {
          const fileExt = archivo.name.split('.').pop();
          const fileName = `${ticket.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('ticket-archivos')
            .upload(fileName, archivo);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('ticket-archivos')
            .getPublicUrl(fileName);

          const { error: archivoError } = await supabase
            .from('ticket_archivos')
            .insert({
              ticket_id: ticket.id,
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
      console.error('Error creando ticket:', err);
      setError(err.message || 'Error al crear el ticket');
    } finally {
      setLoading(false);
    }
  };

  const footer = (
    <>
      <button
        onClick={onClose}
        className="px-6 py-2.5 text-neutral-700 hover:bg-neutral-200 rounded-xl font-semibold transition-all"
      >
        Cancelar
      </button>
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="px-6 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:shadow-medium transition-all duration-200 hover:scale-105 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Creando...' : 'Crear Ticket'}
      </button>
    </>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Nuevo Ticket"
      footer={footer}
      maxWidth="3xl"
    >
      {error && (
        <div className="bg-accent-50 border border-accent-200 text-accent-700 px-4 py-3 rounded-xl mb-6">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-2">
              <User className="w-4 h-4 inline mr-2" />
              Agente *
            </label>
            {usuario?.rol === 'Agente' ? (
              <input
                type="text"
                value={usuario.nombre_completo}
                disabled
                className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl bg-neutral-50 text-neutral-600 cursor-not-allowed"
              />
            ) : (
              <select
                value={agenteId}
                onChange={(e) => setAgenteId(e.target.value)}
                className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
              >
                <option value="">Selecciona un agente</option>
                {agentes.map(agente => (
                  <option key={agente.id} value={agente.id}>{agente.nombre_completo}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-2">
              <AlertCircle className="w-4 h-4 inline mr-2" />
              Prioridad *
            </label>
            <select
              value={prioridad}
              onChange={(e) => setPrioridad(e.target.value as 'Alta' | 'Media' | 'Baja')}
              className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
            >
              <option value="Baja">Baja</option>
              <option value="Media">Media</option>
              <option value="Alta">Alta</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">
            <FileText className="w-4 h-4 inline mr-2" />
            Número de Póliza
          </label>
          <input
            type="text"
            value={poliza}
            onChange={(e) => setPoliza(e.target.value)}
            placeholder="Ej: POL-2024-001"
            className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">
            Instrucciones / Descripción *
          </label>
          <textarea
            value={instrucciones}
            onChange={(e) => setInstrucciones(e.target.value)}
            rows={5}
            placeholder="Describe el motivo del ticket..."
            className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all resize-none"
          />
        </div>

        {canAssignExecutives && ejecutivos.length > 0 && (
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-2">
              Asignar a Ejecutivos
            </label>
            <div className="border border-neutral-300 rounded-xl p-4 max-h-48 overflow-y-auto space-y-2">
              {ejecutivos.map(ejecutivo => (
                <label
                  key={ejecutivo.id}
                  className="flex items-center space-x-3 p-2 hover:bg-neutral-50 rounded-lg cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={ejecutivosSeleccionados.includes(ejecutivo.id)}
                    onChange={() => toggleEjecutivo(ejecutivo.id)}
                    className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm text-neutral-700">{ejecutivo.nombre_completo}</span>
                  <span className="text-xs text-neutral-500">({ejecutivo.rol})</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">
            <Upload className="w-4 h-4 inline mr-2" />
            Archivos Adjuntos
          </label>
          <div className="border-2 border-dashed border-neutral-300 rounded-xl p-6 text-center hover:border-primary-500 transition-all">
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <Upload className="w-10 h-10 text-neutral-400 mx-auto mb-2" />
              <p className="text-neutral-700 font-medium text-sm">Haz clic para subir archivos</p>
              <p className="text-xs text-neutral-500 mt-1">PDF, imágenes, documentos</p>
            </label>
          </div>

          {archivos.length > 0 && (
            <div className="mt-4 space-y-2">
              {archivos.map((archivo, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg border border-neutral-200"
                >
                  <div className="flex items-center space-x-3">
                    <FileText className="w-5 h-5 text-neutral-500" />
                    <div>
                      <p className="text-sm font-medium text-neutral-900">{archivo.name}</p>
                      <p className="text-xs text-neutral-500">
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
