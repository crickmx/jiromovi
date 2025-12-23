import { useState, useEffect } from 'react';
import { X, Upload, User, AlertCircle, FileText, Package, DollarSign, Building2, Plus, Trash2 } from 'lucide-react';
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

interface CommissionBatch {
  id: string;
  name: string;
  date_from: string;
  date_to: string;
  status: string;
  documents_count: number;
}

interface CommissionDocument {
  id: string;
  poliza: string;
  nombre_asegurado: string | null;
  aseguradora: string | null;
  importe_base: number;
  prima_neta: number;
  date_fpago: string | null;
  concepto: string | null;
}

interface Aseguradora {
  nombre: string;
}

interface PolizaFile {
  id: string;
  file: File | null;
  aseguradora: string;
  claveAgente: string;
}

interface NuevoTramiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  estatusList: TramiteEstatus[];
  preloadedData?: {
    tipoTramite?: string;
    comisionesLoteId?: string;
    comisionesLoteLabel?: string;
  };
}

export function NuevoTramiteModal({
  isOpen,
  onClose,
  onSuccess,
  estatusList,
  preloadedData
}: NuevoTramiteModalProps) {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [tipoTramite, setTipoTramite] = useState<string>('correccion_poliza_registrada');
  const [usuariosDisponibles, setUsuariosDisponibles] = useState<Usuario[]>([]);
  const [asignado, setAsignado] = useState<string>('');
  const [prioridad, setPrioridad] = useState<'Alta' | 'Media' | 'Baja'>('Media');
  const [descripcion, setDescripcion] = useState('');
  const [archivos, setArchivos] = useState<File[]>([]);

  const [polizaNumero, setPolizaNumero] = useState('');

  const [loteSeleccionado, setLoteSeleccionado] = useState('');
  const [documentoSeleccionado, setDocumentoSeleccionado] = useState('');
  const [lotesDisponibles, setLotesDisponibles] = useState<CommissionBatch[]>([]);
  const [documentosLote, setDocumentosLote] = useState<CommissionDocument[]>([]);
  const [loadingDocumentos, setLoadingDocumentos] = useState(false);

  const [aseguradoras, setAseguradoras] = useState<Aseguradora[]>([]);
  const [polizaFiles, setPolizaFiles] = useState<PolizaFile[]>([
    { id: '1', file: null, aseguradora: '', claveAgente: '' }
  ]);

  const isAgent = usuario?.rol === 'Agente';
  const canAssignOthers = !isAgent;

  useEffect(() => {
    if (isOpen && usuario) {
      resetForm();
      loadUsuarios();
      loadLotesDisponibles();
      if (preloadedData) {
        if (preloadedData.tipoTramite) {
          setTipoTramite(preloadedData.tipoTramite);
        }
        if (preloadedData.comisionesLoteId) {
          setLoteSeleccionado(preloadedData.comisionesLoteId);
        }
      }
    }
  }, [isOpen, preloadedData]);

  useEffect(() => {
    if (tipoTramite === 'correccion_comisiones' && usuario) {
      loadLotesDisponibles();
    }
  }, [tipoTramite, usuario]);

  useEffect(() => {
    if (loteSeleccionado) {
      loadDocumentosLote();
    } else {
      setDocumentosLote([]);
      setDocumentoSeleccionado('');
    }
  }, [loteSeleccionado]);

  useEffect(() => {
    if (tipoTramite === 'registro_poliza') {
      loadAseguradoras();
    }
  }, [tipoTramite]);

  const resetForm = () => {
    if (preloadedData?.tipoTramite) {
      setTipoTramite(preloadedData.tipoTramite);
    } else {
      setTipoTramite('correccion_poliza_registrada');
    }

    if (isAgent && usuario) {
      setAsignado(usuario.id);
    } else {
      setAsignado('');
    }

    setPrioridad('Media');
    setDescripcion('');
    setArchivos([]);
    setPolizaNumero('');
    setLoteSeleccionado('');
    setDocumentoSeleccionado('');
    setPolizaFiles([{ id: '1', file: null, aseguradora: '', claveAgente: '' }]);
    setError('');
  };

  const loadUsuarios = async () => {
    const { data } = await supabase
      .from('usuarios')
      .select('id, nombre_completo, rol')
      .order('nombre_completo');

    if (data) setUsuariosDisponibles(data);
  };

  const loadLotesDisponibles = async () => {
    if (!usuario) return;

    const { data } = await supabase
      .from('commission_batches')
      .select('*')
      .eq('status', 'completed')
      .order('date_from', { ascending: false })
      .limit(20);

    if (data) setLotesDisponibles(data);
  };

  const loadDocumentosLote = async () => {
    if (!loteSeleccionado) return;

    setLoadingDocumentos(true);
    try {
      const { data } = await supabase
        .from('commission_details')
        .select('id, poliza, nombre_asegurado, aseguradora, importe_base, prima_neta, date_fpago, concepto')
        .eq('batch_id', loteSeleccionado)
        .order('poliza');

      if (data) setDocumentosLote(data);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoadingDocumentos(false);
    }
  };

  const loadAseguradoras = async () => {
    const { data } = await supabase
      .from('cat_aseguradoras')
      .select('nombre')
      .eq('activo', true)
      .order('nombre');

    if (data) setAseguradoras(data);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const maxFiles = 5;

    if (archivos.length + files.length > maxFiles) {
      setError(`Máximo ${maxFiles} archivos permitidos`);
      return;
    }

    setArchivos(prev => [...prev, ...files]);
    setError('');
  };

  const removeFile = (index: number) => {
    setArchivos(prev => prev.filter((_, i) => i !== index));
  };

  const addPolizaFile = () => {
    if (polizaFiles.length >= 10) {
      setError('Máximo 10 archivos permitidos');
      return;
    }

    setPolizaFiles(prev => [
      ...prev,
      { id: Date.now().toString(), file: null, aseguradora: '', claveAgente: '' }
    ]);
    setError('');
  };

  const removePolizaFile = (id: string) => {
    if (polizaFiles.length === 1) {
      setError('Debe haber al menos un archivo');
      return;
    }
    setPolizaFiles(prev => prev.filter(f => f.id !== id));
  };

  const updatePolizaFile = (id: string, field: keyof PolizaFile, value: any) => {
    setPolizaFiles(prev => prev.map(f =>
      f.id === id ? { ...f, [field]: value } : f
    ));
  };

  const validateForm = (): boolean => {
    if (!descripcion.trim()) {
      setError('La descripción es obligatoria');
      return false;
    }

    if (!isAgent && !asignado) {
      setError('Debe seleccionar a quién asignar el trámite');
      return false;
    }

    if (tipoTramite === 'correccion_comisiones') {
      if (!loteSeleccionado) {
        setError('Debe seleccionar un lote de comisiones');
        return false;
      }
      if (!documentoSeleccionado) {
        setError('Debe seleccionar un documento del lote');
        return false;
      }
    }

    if (tipoTramite === 'registro_poliza') {
      const filesWithData = polizaFiles.filter(f => f.file !== null);

      if (filesWithData.length === 0) {
        setError('Debe adjuntar al menos 1 archivo');
        return false;
      }

      for (const pf of filesWithData) {
        if (!pf.aseguradora) {
          setError('Todos los archivos deben tener una aseguradora seleccionada');
          return false;
        }
        if (!pf.claveAgente || !/^[a-zA-Z0-9]+$/.test(pf.claveAgente)) {
          setError('Todos los archivos deben tener una clave de agente válida (alfanumérica)');
          return false;
        }
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !usuario) return;

    setLoading(true);
    setError('');

    try {
      const estatusNuevo = estatusList.find(e => e.nombre === 'Nuevo');
      if (!estatusNuevo) {
        throw new Error('No se encontró el estatus "Nuevo"');
      }

      const assignedTo = isAgent ? usuario.id : asignado;

      const ticketData: any = {
        tipo_tramite: tipoTramite,
        estatus_id: estatusNuevo.id,
        prioridad,
        instrucciones: descripcion.trim(),
        creado_por: usuario.id,
        modificado_por: usuario.id,
        assigned_to_user_id: assignedTo,
        agente_id: isAgent ? usuario.id : null
      };

      if (tipoTramite === 'correccion_poliza_registrada') {
        ticketData.poliza = polizaNumero.trim() || null;
      }

      if (tipoTramite === 'correccion_comisiones') {
        const lote = lotesDisponibles.find(l => l.id === loteSeleccionado);
        const documento = documentosLote.find(d => d.id === documentoSeleccionado);

        ticketData.comisiones_lote_id = loteSeleccionado;
        ticketData.comisiones_lote_label = lote?.name || '';
        ticketData.comisiones_documento_id = documentoSeleccionado;
        ticketData.comisiones_poliza_ref = documento?.poliza || '';
        ticketData.comisiones_context_snapshot = {
          lote: lote,
          documento: documento
        };
      }

      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .insert(ticketData)
        .select()
        .single();

      if (ticketError) throw ticketError;

      // Procesar archivos según el tipo de trámite
      if (tipoTramite === 'registro_poliza') {
        const filesWithData = polizaFiles.filter(f => f.file !== null);

        for (const pf of filesWithData) {
          if (!pf.file) continue;

          // Subir archivo
          const fileExt = pf.file.name.split('.').pop();
          const fileName = `${ticket.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('tramite-archivos')
            .upload(fileName, pf.file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('tramite-archivos')
            .getPublicUrl(fileName);

          // Guardar registro del archivo
          const { error: archivoError } = await supabase
            .from('tramite_archivos')
            .insert({
              tramite_id: ticket.id,
              usuario_id: usuario.id,
              nombre: pf.file.name,
              url: publicUrl,
              tipo: pf.file.type,
              tamano: pf.file.size
            });

          if (archivoError) throw archivoError;

          // Crear comentario con la información del archivo
          const comentarioTexto = `📎 Documento adjunto:\n• Nombre: ${pf.file.name}\n• Aseguradora: ${pf.aseguradora}\n• Clave de agente: ${pf.claveAgente}`;

          const { error: comentarioError } = await supabase
            .from('tramite_comentarios')
            .insert({
              tramite_id: ticket.id,
              usuario_id: usuario.id,
              comentario: comentarioTexto,
              es_sistema: false
            });

          if (comentarioError) throw comentarioError;
        }
      } else {
        // Para otros tipos de trámite, subir archivos normalmente
        if (archivos.length > 0) {
          for (const archivo of archivos) {
            const fileExt = archivo.name.split('.').pop();
            const fileName = `${ticket.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

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
                tramite_id: ticket.id,
                usuario_id: usuario.id,
                nombre: archivo.name,
                url: publicUrl,
                tipo: archivo.type,
                tamano: archivo.size
              });

            if (archivoError) throw archivoError;
          }
        }
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error creando tramite:', err);
      setError(err.message || 'Error al crear el trámite');
    } finally {
      setLoading(false);
    }
  };

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'correccion_poliza_registrada':
        return 'Corrección de póliza registrada';
      case 'correccion_comisiones':
        return 'Corrección de comisiones';
      case 'registro_poliza':
        return 'Registro de póliza';
      default:
        return tipo;
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Nuevo Trámite"
      maxWidth="4xl"
    >
      <div className="space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-neutral-900 mb-2">
            Tipo de Trámite
          </label>
          <select
            value={tipoTramite}
            onChange={(e) => setTipoTramite(e.target.value)}
            disabled={!!preloadedData?.tipoTramite}
            className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-neutral-100 disabled:cursor-not-allowed"
          >
            <option value="correccion_poliza_registrada">Corrección de póliza registrada</option>
            <option value="correccion_comisiones">Corrección de comisiones</option>
            <option value="registro_poliza">Registro de póliza</option>
          </select>
          <p className="text-xs text-neutral-500 mt-1">
            {getTipoLabel(tipoTramite)}
          </p>
        </div>

        {canAssignOthers && (
          <div>
            <label className="block text-sm font-semibold text-neutral-900 mb-2">
              <User className="w-4 h-4 inline mr-2" />
              Asignar a
            </label>
            <select
              value={asignado}
              onChange={(e) => setAsignado(e.target.value)}
              className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Selecciona un usuario</option>
              {usuariosDisponibles.map(u => (
                <option key={u.id} value={u.id}>
                  {u.nombre_completo} ({u.rol})
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-neutral-900 mb-2">
            Prioridad
          </label>
          <select
            value={prioridad}
            onChange={(e) => setPrioridad(e.target.value as 'Alta' | 'Media' | 'Baja')}
            className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="Baja">Baja</option>
            <option value="Media">Media</option>
            <option value="Alta">Alta</option>
          </select>
        </div>

        {tipoTramite === 'correccion_poliza_registrada' && (
          <div>
            <label className="block text-sm font-semibold text-neutral-900 mb-2">
              <FileText className="w-4 h-4 inline mr-2" />
              Número de Póliza
            </label>
            <input
              type="text"
              value={polizaNumero}
              onChange={(e) => setPolizaNumero(e.target.value)}
              placeholder="Ingresa el número de póliza"
              className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        )}

        {tipoTramite === 'correccion_comisiones' && (
          <>
            <div>
              <label className="block text-sm font-semibold text-neutral-900 mb-2">
                <Package className="w-4 h-4 inline mr-2" />
                Lote de Comisiones *
              </label>
              <select
                value={loteSeleccionado}
                onChange={(e) => setLoteSeleccionado(e.target.value)}
                disabled={!!preloadedData?.comisionesLoteId}
                className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-neutral-100"
              >
                <option value="">Selecciona un lote</option>
                {lotesDisponibles.map(lote => (
                  <option key={lote.id} value={lote.id}>
                    {lote.name} ({lote.documents_count} documentos)
                  </option>
                ))}
              </select>
            </div>

            {loteSeleccionado && (
              <div>
                <label className="block text-sm font-semibold text-neutral-900 mb-2">
                  <DollarSign className="w-4 h-4 inline mr-2" />
                  Documento del Lote *
                </label>
                {loadingDocumentos ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="text-sm text-neutral-600 mt-2">Cargando documentos...</p>
                  </div>
                ) : (
                  <select
                    value={documentoSeleccionado}
                    onChange={(e) => setDocumentoSeleccionado(e.target.value)}
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Selecciona un documento</option>
                    {documentosLote.map(doc => (
                      <option key={doc.id} value={doc.id}>
                        {doc.poliza} - {doc.nombre_asegurado || 'Sin asegurado'} - {doc.aseguradora || 'Sin aseguradora'} - ${doc.importe_base?.toFixed(2) || '0.00'}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </>
        )}

        {tipoTramite === 'registro_poliza' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-neutral-900">
                Documentos a Registrar *
              </label>
              <span className="text-xs text-neutral-500">
                {polizaFiles.filter(f => f.file !== null).length} de 10 archivos
              </span>
            </div>

            <div className="space-y-3">
              {polizaFiles.map((pf, index) => (
                <div key={pf.id} className="border border-neutral-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-700">
                      Documento {index + 1}
                    </span>
                    {polizaFiles.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePolizaFile(pf.id)}
                        className="text-red-600 hover:text-red-700 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Archivo *
                    </label>
                    <input
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        updatePolizaFile(pf.id, 'file', file);
                      }}
                      className="w-full text-sm text-neutral-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                    />
                    {pf.file && (
                      <p className="text-xs text-green-600 mt-1">
                        ✓ {pf.file.name}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        <Building2 className="w-4 h-4 inline mr-1" />
                        Aseguradora *
                      </label>
                      <select
                        value={pf.aseguradora}
                        onChange={(e) => updatePolizaFile(pf.id, 'aseguradora', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">Selecciona...</option>
                        {aseguradoras.map(aseg => (
                          <option key={aseg.nombre} value={aseg.nombre}>
                            {aseg.nombre}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Clave de Agente *
                      </label>
                      <input
                        type="text"
                        value={pf.claveAgente}
                        onChange={(e) => updatePolizaFile(pf.id, 'claveAgente', e.target.value)}
                        placeholder="Ej: ABC123"
                        className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {polizaFiles.length < 10 && (
              <button
                type="button"
                onClick={addPolizaFile}
                className="w-full py-2.5 border-2 border-dashed border-neutral-300 rounded-lg text-neutral-600 hover:border-primary-500 hover:text-primary-600 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Añadir otro documento
              </button>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-neutral-900 mb-2">
            Descripción / Notas *
          </label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={4}
            placeholder="Describe el motivo del trámite con el mayor detalle posible..."
            className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          />
        </div>

        {tipoTramite !== 'registro_poliza' && (
          <div>
            <label className="block text-sm font-semibold text-neutral-900 mb-2">
              <Upload className="w-4 h-4 inline mr-2" />
              Archivos Adjuntos
              <span className="text-xs font-normal text-neutral-500 ml-2">(Máximo 5)</span>
            </label>
            <div className="border-2 border-dashed border-neutral-300 rounded-xl p-6 text-center hover:border-primary-500 transition-all">
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center justify-center"
              >
                <Upload className="w-10 h-10 text-neutral-400 mb-2" />
                <p className="text-sm text-neutral-600 mb-1">
                  Haz clic para seleccionar archivos
                </p>
                <p className="text-xs text-neutral-500">
                  PDF, imágenes, documentos (máx. 5 archivos)
                </p>
              </label>
            </div>

            {archivos.length > 0 && (
              <div className="mt-3 space-y-2">
                {archivos.map((archivo, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileText className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-neutral-900 truncate">{archivo.name}</p>
                        <p className="text-xs text-neutral-500">
                          {(archivo.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="text-red-600 hover:text-red-700 ml-2 flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-6 py-2.5 text-neutral-700 bg-white border border-neutral-300 rounded-xl hover:bg-neutral-50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Creando...
              </>
            ) : (
              'Crear Trámite'
            )}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
