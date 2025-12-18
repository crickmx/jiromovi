import { useState, useEffect } from 'react';
import { X, Upload, User, AlertCircle, FileText, Package, DollarSign, Building2 } from 'lucide-react';
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

  const [aseguradoraSeleccionada, setAseguradoraSeleccionada] = useState('');
  const [claveAgente, setClaveAgente] = useState('');
  const [numeroPolizaRegistro, setNumeroPolizaRegistro] = useState('');
  const [clienteRegistro, setClienteRegistro] = useState('');
  const [vigenciaInicio, setVigenciaInicio] = useState('');
  const [vigenciaFin, setVigenciaFin] = useState('');
  const [aseguradoras, setAseguradoras] = useState<Aseguradora[]>([]);

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

    if (preloadedData?.comisionesLoteId) {
      setLoteSeleccionado(preloadedData.comisionesLoteId);
    } else {
      setLoteSeleccionado('');
    }
    setDocumentoSeleccionado('');

    setAseguradoraSeleccionada('');
    setClaveAgente('');
    setNumeroPolizaRegistro('');
    setClienteRegistro('');
    setVigenciaInicio('');
    setVigenciaFin('');
    setError('');
  };

  const loadUsuarios = async () => {
    if (isAgent) {
      setUsuariosDisponibles([]);
      return;
    }

    const { data } = await supabase
      .from('usuarios')
      .select('id, nombre_completo, rol')
      .in('rol', ['Agente', 'Empleado', 'Gerente', 'Administrador'])
      .eq('estado', 'activo')
      .order('nombre_completo');

    if (data) setUsuariosDisponibles(data);
  };

  const loadLotesDisponibles = async () => {
    if (!usuario) return;

    const { data, error } = await supabase
      .rpc('get_available_commission_batches_for_user', { p_user_id: usuario.id });

    if (error) {
      console.error('Error loading lotes:', error);
    } else if (data) {
      setLotesDisponibles(data);
    }
  };

  const loadDocumentosLote = async () => {
    if (!loteSeleccionado) return;

    setLoadingDocumentos(true);
    const { data, error } = await supabase
      .rpc('get_commission_documents_for_batch', { p_batch_id: loteSeleccionado });

    if (error) {
      console.error('Error loading documentos:', error);
      setError('Error al cargar documentos del lote');
    } else if (data) {
      setDocumentosLote(data);
    }
    setLoadingDocumentos(false);
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
  };

  const removeFile = (index: number) => {
    setArchivos(prev => prev.filter((_, i) => i !== index));
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
      if (!aseguradoraSeleccionada) {
        setError('La aseguradora es obligatoria');
        return false;
      }
      if (!claveAgente || !/^[a-zA-Z0-9]+$/.test(claveAgente)) {
        setError('La clave de agente es obligatoria y debe ser alfanumérica');
        return false;
      }
      if (archivos.length === 0) {
        setError('Debe adjuntar al menos 1 archivo');
        return false;
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

      if (tipoTramite === 'registro_poliza') {
        ticketData.registro_aseguradora = aseguradoraSeleccionada;
        ticketData.registro_clave_agente = claveAgente.trim();
        ticketData.registro_numero_poliza = numeroPolizaRegistro.trim() || null;
        ticketData.registro_cliente = clienteRegistro.trim() || null;
        ticketData.registro_vigencia_inicio = vigenciaInicio || null;
        ticketData.registro_vigencia_fin = vigenciaFin || null;
      }

      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .insert(ticketData)
        .select()
        .single();

      if (ticketError) throw ticketError;

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

  const footer = (
    <>
      <button
        onClick={onClose}
        className="px-4 py-2 text-neutral-700 hover:bg-neutral-100 rounded-lg text-sm font-medium transition-all"
      >
        Cancelar
      </button>
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-all disabled:opacity-50"
      >
        {loading ? 'Creando...' : 'Crear Trámite'}
      </button>
    </>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Nuevo Trámite"
      footer={footer}
      maxWidth="3xl"
    >
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-4 flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-neutral-900 mb-2">
            <Package className="w-4 h-4 inline mr-2" />
            Tipo de Trámite *
          </label>
          <select
            value={tipoTramite}
            onChange={(e) => setTipoTramite(e.target.value)}
            disabled={!!preloadedData?.tipoTramite}
            className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-neutral-100"
          >
            <option value="correccion_poliza_registrada">Corrección de póliza registrada</option>
            <option value="correccion_comisiones">Corrección de comisiones</option>
            <option value="registro_poliza">Registro de póliza</option>
          </select>
          <p className="text-xs text-neutral-500 mt-1">{getTipoLabel(tipoTramite)}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {canAssignOthers && (
            <div>
              <label className="block text-sm font-semibold text-neutral-900 mb-2">
                <User className="w-4 h-4 inline mr-2" />
                Asignar a *
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
              <AlertCircle className="w-4 h-4 inline mr-2" />
              Prioridad *
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
              placeholder="Ej: POL-2024-001"
              className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        )}

        {tipoTramite === 'correccion_comisiones' && (
          <>
            <div>
              <label className="block text-sm font-semibold text-neutral-900 mb-2">
                <DollarSign className="w-4 h-4 inline mr-2" />
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
                  <FileText className="w-4 h-4 inline mr-2" />
                  Documento/Póliza a Corregir *
                </label>
                {loadingDocumentos ? (
                  <div className="text-sm text-neutral-500">Cargando documentos...</div>
                ) : documentosLote.length === 0 ? (
                  <div className="text-sm text-orange-600">Este lote no tiene documentos</div>
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
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-neutral-900 mb-2">
                  <Building2 className="w-4 h-4 inline mr-2" />
                  Aseguradora *
                </label>
                <select
                  value={aseguradoraSeleccionada}
                  onChange={(e) => setAseguradoraSeleccionada(e.target.value)}
                  className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Selecciona una aseguradora</option>
                  {aseguradoras.map(aseg => (
                    <option key={aseg.nombre} value={aseg.nombre}>
                      {aseg.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-900 mb-2">
                  Clave de Agente *
                </label>
                <input
                  type="text"
                  value={claveAgente}
                  onChange={(e) => setClaveAgente(e.target.value)}
                  placeholder="Ej: ABC123"
                  className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-neutral-500 mt-1">Solo letras y números</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-neutral-900 mb-2">
                  Número de Póliza
                </label>
                <input
                  type="text"
                  value={numeroPolizaRegistro}
                  onChange={(e) => setNumeroPolizaRegistro(e.target.value)}
                  placeholder="Opcional"
                  className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-900 mb-2">
                  Cliente
                </label>
                <input
                  type="text"
                  value={clienteRegistro}
                  onChange={(e) => setClienteRegistro(e.target.value)}
                  placeholder="Opcional"
                  className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-neutral-900 mb-2">
                  Vigencia Inicio
                </label>
                <input
                  type="date"
                  value={vigenciaInicio}
                  onChange={(e) => setVigenciaInicio(e.target.value)}
                  className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-900 mb-2">
                  Vigencia Fin
                </label>
                <input
                  type="date"
                  value={vigenciaFin}
                  onChange={(e) => setVigenciaFin(e.target.value)}
                  className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </>
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

        <div>
          <label className="block text-sm font-semibold text-neutral-900 mb-2">
            <Upload className="w-4 h-4 inline mr-2" />
            Archivos Adjuntos {tipoTramite === 'registro_poliza' && '*'}
            <span className="text-xs font-normal text-neutral-500 ml-2">(Máximo 5)</span>
          </label>
          <div className="border-2 border-dashed border-neutral-300 rounded-xl p-6 text-center hover:border-primary-500 transition-all">
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
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
                  className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-200"
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
                    className="text-red-600 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 transition-colors"
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
