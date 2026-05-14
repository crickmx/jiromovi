import { useState, useEffect, useRef } from 'react';
import { X, Upload, User, AlertCircle, FileText, Package, DollarSign, Building2, Plus, Trash2, Calendar, Shield, Clock, CheckCircle2, ChevronRight, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { BaseModal } from '../BaseModal';
import {
  canAccessRegistroActividades,
  getInsuranceTypes,
  getAseguradoras as getAseguradorasRA,
  getUsersByOffice,
  createRegistroActividad,
  formatDateTimeForInput,
  formatDateTimeFromInput
} from '../../lib/registroActividadesUtils';
import {
  REGISTRO_ACTIVIDAD_ESTATUS,
  isEstatusFinal,
  getTipoTramitesByArea,
  getTipoTramiteArea,
  AREA_CONFIG,
  isCommercialTicketType,
  type InsuranceType,
  type Aseguradora as AseguradoraRA,
  type UsuarioOficina
} from '../../lib/registroActividadesTypes';

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

interface ComisionPendiente {
  id: string;
  numeroPoliza: string;
  aseguradora: string;
  fechaPago: string;
  archivo: File | null;
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
  const [prioridad, setPrioridad] = useState<'Alta' | 'Media' | 'Baja'>('Baja');
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

  const [comisionesPendientes, setComisionesPendientes] = useState<ComisionPendiente[]>([
    { id: '1', numeroPoliza: '', aseguradora: '', fechaPago: '', archivo: null }
  ]);

  // --- Estado para Cotización / Emisión ---
  const [ceAgenteUserId, setCeAgenteUserId] = useState('');
  const [ceInsuranceTypeId, setCeInsuranceTypeId] = useState('');
  const [ceSelectedInsurers, setCeSelectedInsurers] = useState<string[]>([]);
  const [ceRequestDatetime, setCeRequestDatetime] = useState(formatDateTimeForInput(new Date()));
  const [ceCompletionDatetime, setCeCompletionDatetime] = useState('');
  const [ceEstatusNombre, setCeEstatusNombre] = useState('Iniciado');
  const [ceShowInsurerDropdown, setCeShowInsurerDropdown] = useState(false);
  const [ceInsurerSearchTerm, setCeInsurerSearchTerm] = useState('');

  // --- Estado para trámites comerciales (Renovaciones/Cobranza/Otros) ---
  const [comAgenteUserId, setComAgenteUserId] = useState('');
  const [comCliente, setComCliente] = useState('');
  const [comPoliza, setComPoliza] = useState('');
  const [comAseguradora, setComAseguradora] = useState('');
  const [comFechaVencimiento, setComFechaVencimiento] = useState('');
  const [comMonto, setComMonto] = useState('');
  const [comAsunto, setComAsunto] = useState('');

  const [ceInsuranceTypes, setCeInsuranceTypes] = useState<InsuranceType[]>([]);
  const [ceAseguradorasRA, setCeAseguradorasRA] = useState<AseguradoraRA[]>([]);
  const [ceAgenteUsers, setCeAgenteUsers] = useState<UsuarioOficina[]>([]);

  // Ref para rastrear si estamos inicializando con datos precargados
  const isInitializingWithPreloadedData = useRef(false);

  const isAgent = usuario?.rol === 'Agente';
  const canAssignOthers = !isAgent;
  const [canAccessRegistroAct, setCanAccessRegistroAct] = useState(false);

  useEffect(() => {
    if (isOpen && usuario) {
      // Marcar si estamos inicializando con datos precargados
      isInitializingWithPreloadedData.current = !!preloadedData?.comisionesLoteId;

      resetForm();
      loadUsuarios();
      loadLotesDisponibles();
      checkRegistroAccess();

      // Resetear la bandera después de un breve delay para permitir que los efectos se ejecuten
      setTimeout(() => {
        isInitializingWithPreloadedData.current = false;
      }, 100);
    }
  }, [isOpen, preloadedData]);

  const checkRegistroAccess = async () => {
    const access = await canAccessRegistroActividades();
    setCanAccessRegistroAct(access);
  };

  const COTIZACION_EMISION_SUBTYPE_ID = '2ef883f9-96fc-452e-92eb-ff6826be412d';


  useEffect(() => {
    if (tipoTramite === 'correccion_comisiones' && usuario) {
      loadLotesDisponibles();
    }
  }, [tipoTramite, usuario]);

  useEffect(() => {
    if (tipoTramite === 'correccion_comisiones' && asignado) {
      // Reset lote selection when assigned user changes, unless we're initializing with preloaded data
      if (!isInitializingWithPreloadedData.current) {
        setLoteSeleccionado('');
      }
      loadLotesDisponibles(asignado);
    }
  }, [asignado]);

  useEffect(() => {
    if (loteSeleccionado) {
      loadDocumentosLote();
    } else {
      setDocumentosLote([]);
      setDocumentoSeleccionado('');
    }
  }, [loteSeleccionado]);

  useEffect(() => {
    if (tipoTramite === 'registro_poliza' || tipoTramite === 'solicitud_comisiones_pendientes' || isCommercialTicketType(tipoTramite)) {
      loadAseguradoras();
    }
    if (tipoTramite === 'cotizacion_emision' || isCommercialTicketType(tipoTramite)) {
      loadCeCatalogs();
    }
  }, [tipoTramite]);


  useEffect(() => {
    if (isEstatusFinal(ceEstatusNombre) && !ceCompletionDatetime) {
      setCeCompletionDatetime(formatDateTimeForInput(new Date()));
    }
  }, [ceEstatusNombre]);

  const loadCeCatalogs = async () => {
    if (!usuario) return;
    try {
      const [insurance, insurers, agentes] = await Promise.all([
        getInsuranceTypes(),
        getAseguradorasRA(),
        usuario.oficina_id ? getUsersByOffice(usuario.oficina_id) : Promise.resolve([])
      ]);
      setCeInsuranceTypes(insurance);
      setCeAseguradorasRA(insurers);
      setCeAgenteUsers(agentes);
    } catch (err) {
      console.error('Error loading CE catalogs:', err);
    }
  };

  const resetForm = () => {
    if (preloadedData?.tipoTramite) {
      setTipoTramite(preloadedData.tipoTramite);
    } else if (isAgent) {
      setTipoTramite('cotizacion_emision');
    } else {
      setTipoTramite('correccion_poliza_registrada');
    }

    if (isAgent && usuario) {
      setAsignado(usuario.id);
    } else {
      setAsignado('');
    }

    setPrioridad('Baja');
    setDescripcion('');
    setArchivos([]);
    setPolizaNumero('');

    // Respetar lote precargado si existe
    if (preloadedData?.comisionesLoteId) {
      setLoteSeleccionado(preloadedData.comisionesLoteId);
    } else {
      setLoteSeleccionado('');
    }

    setDocumentoSeleccionado('');
    setPolizaFiles([{ id: '1', file: null, aseguradora: '', claveAgente: '' }]);
    setComisionesPendientes([{ id: '1', numeroPoliza: '', aseguradora: '', fechaPago: '', archivo: null }]);
    setError('');

    // Reset CE fields
    setCeAgenteUserId('');
    setCeInsuranceTypeId('');
    setCeSelectedInsurers([]);
    setCeRequestDatetime(formatDateTimeForInput(new Date()));
    setCeCompletionDatetime('');
    setCeEstatusNombre('Iniciado');
    setCeShowInsurerDropdown(false);
    setCeInsurerSearchTerm('');

    // Reset commercial fields
    setComAgenteUserId('');
    setComCliente('');
    setComPoliza('');
    setComAseguradora('');
    setComFechaVencimiento('');
    setComMonto('');
    setComAsunto('');
  };

  const loadUsuarios = async () => {
    const { data } = await supabase
      .from('usuarios')
      .select('id, nombre_completo, rol')
      .order('nombre_completo');

    if (data) setUsuariosDisponibles(data);
  };

  const loadLotesDisponibles = async (forUserId?: string) => {
    if (!usuario) return;

    try {
      const targetUserId = forUserId || asignado;

      if (targetUserId) {
        // Get user email to find agent
        const { data: userData } = await supabase
          .from('usuarios')
          .select('email_laboral')
          .eq('id', targetUserId)
          .single();

        if (userData?.email_laboral) {
          // Get batches that have commission details for this user
          const { data } = await supabase
            .from('commission_batches')
            .select(`
              *,
              details:commission_details!inner(id)
            `)
            .eq('details.usuario_id', targetUserId)
            .in('status', ['draft', 'confirmed', 'closed'])
            .order('date_from', { ascending: false })
            .limit(20);

          if (data) {
            // Remove the details field from the response
            const batches = data.map(({ details, ...batch }) => batch);
            setLotesDisponibles(batches);
            return;
          }
        }
      }

      // Fallback: load all batches if no agent specified or not found
      const { data } = await supabase
        .from('commission_batches')
        .select('*')
        .in('status', ['draft', 'confirmed', 'closed'])
        .order('date_from', { ascending: false })
        .limit(20);

      if (data) setLotesDisponibles(data);
    } catch (error) {
      console.error('Error loading commission batches:', error);
      setLotesDisponibles([]);
    }
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
    const maxFiles = 20;

    if (archivos.length + files.length > maxFiles) {
      setError('Este trámite permite un máximo de 20 documentos adjuntos. Elimina algún archivo o reduce la cantidad para continuar.');
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

  const addComisionPendiente = () => {
    if (comisionesPendientes.length >= 10) {
      setError('Máximo 10 comisiones pendientes permitidas');
      return;
    }

    setComisionesPendientes(prev => [
      ...prev,
      { id: Date.now().toString(), numeroPoliza: '', aseguradora: '', fechaPago: '', archivo: null }
    ]);
    setError('');
  };

  const removeComisionPendiente = (id: string) => {
    if (comisionesPendientes.length === 1) {
      setError('Debe haber al menos una comisión pendiente');
      return;
    }
    setComisionesPendientes(prev => prev.filter(c => c.id !== id));
  };

  const updateComisionPendiente = (id: string, field: keyof ComisionPendiente, value: any) => {
    setComisionesPendientes(prev => prev.map(c =>
      c.id === id ? { ...c, [field]: value } : c
    ));
  };

  const validateForm = (): boolean => {
    if (isCommercialTicketType(tipoTramite)) {
      if (!comAgenteUserId) {
        setError('Debe seleccionar un agente relacionado para trámites comerciales');
        return false;
      }
      return true;
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

    if (tipoTramite === 'solicitud_comisiones_pendientes') {
      if (comisionesPendientes.length === 0) {
        setError('Debe agregar al menos 1 comisión pendiente');
        return false;
      }
    }

    return true;
  };

  const buildCommercialDescription = (): string => {
    const parts: string[] = [];
    if (comAsunto) parts.push(`Asunto: ${comAsunto}`);
    if (comCliente) parts.push(`Cliente: ${comCliente}`);
    if (comPoliza) parts.push(`Póliza: ${comPoliza}`);
    if (comAseguradora) parts.push(`Aseguradora: ${comAseguradora}`);
    if (comFechaVencimiento) parts.push(`Fecha: ${new Date(comFechaVencimiento).toLocaleDateString('es-MX')}`);
    if (comMonto) parts.push(`Monto: $${comMonto}`);
    if (descripcion.trim()) parts.push(descripcion.trim());
    return parts.join('\n') || 'Sin descripción';
  };

  const handleSubmitCotizacionEmision = async () => {
    if (!usuario) return;

    const effectiveAgenteId = isAgent ? usuario.id : ceAgenteUserId;

    const formData = {
      tipo_tramite: 'cotizacion_emision',
      activity_subtype_id: COTIZACION_EMISION_SUBTYPE_ID,
      agente_usuario_id: effectiveAgenteId,
      insurance_type_id: ceInsuranceTypeId,
      insurers: ceSelectedInsurers,
      attending_user_id: isAgent ? '' : usuario.id,
      request_datetime: formatDateTimeFromInput(ceRequestDatetime),
      completion_datetime: (!isAgent && ceCompletionDatetime) ? formatDateTimeFromInput(ceCompletionDatetime) : undefined,
      estatus_nombre: isAgent ? 'Iniciado' : ceEstatusNombre,
      prioridad: isAgent ? 'Media' : prioridad,
      instrucciones: descripcion
    };

    if (!effectiveAgenteId) { setError('El agente es obligatorio'); return; }
    if (!ceInsuranceTypeId) { setError('El tipo de seguro es obligatorio'); return; }
    if (ceSelectedInsurers.length === 0) { setError('Debe seleccionar al menos una aseguradora'); return; }
    if (!ceRequestDatetime) { setError('La fecha de inicio es obligatoria'); return; }

    setLoading(true);
    setError('');
    try {
      await createRegistroActividad({ ...formData, creado_por: usuario.id });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al crear el trámite');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (tipoTramite === 'cotizacion_emision') {
      await handleSubmitCotizacionEmision();
      return;
    }

    if (!validateForm() || !usuario) return;

    setLoading(true);
    setError('');

    try {
      const estatusNuevo = estatusList.find(e => e.nombre === 'Iniciado');
      if (!estatusNuevo) {
        throw new Error('No se encontró el estatus "Iniciado"');
      }

      const isCommercial = isCommercialTicketType(tipoTramite);
      const assignedTo = isCommercial ? usuario.id : (isAgent ? usuario.id : asignado);

      const ticketData: any = {
        tipo_tramite: tipoTramite,
        estatus_id: estatusNuevo.id,
        prioridad,
        instrucciones: isCommercial ? buildCommercialDescription() : (descripcion.trim() || 'Sin descripción'),
        creado_por: usuario.id,
        modificado_por: usuario.id,
        agente_id: isCommercial ? comAgenteUserId : assignedTo,
        agente_usuario_id: isCommercial ? comAgenteUserId : undefined,
        assigned_to_user_id: usuario.id
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

      // Crear asignación en ticket_asignaciones
      if (assignedTo) {
        const { error: assignError } = await supabase
          .from('ticket_asignaciones')
          .insert({
            ticket_id: ticket.id,
            ejecutivo_id: assignedTo,
            asignado_por: usuario.id
          });

        if (assignError) console.error('Error creating assignment:', assignError);
      }

      // Procesar archivos según el tipo de trámite
      if (tipoTramite === 'solicitud_comisiones_pendientes') {
        // Guardar comisiones pendientes
        for (let i = 0; i < comisionesPendientes.length; i++) {
          const comision = comisionesPendientes[i];

          // Insertar comisión pendiente
          const { error: comisionError } = await supabase
            .from('ticket_comisiones_pendientes')
            .insert({
              ticket_id: ticket.id,
              numero_poliza: comision.numeroPoliza.trim() || null,
              aseguradora: comision.aseguradora || null,
              fecha_pago: comision.fechaPago || null,
              orden: i + 1
            });

          if (comisionError) throw comisionError;

          // Si hay archivo adjunto, subirlo
          if (comision.archivo) {
            const fileExt = comision.archivo.name.split('.').pop();
            const fileName = `${ticket.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
              .from('ticket-archivos')
              .upload(fileName, comision.archivo);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
              .from('ticket-archivos')
              .getPublicUrl(fileName);

            // Guardar registro del archivo
            const { error: archivoError } = await supabase
              .from('ticket_archivos')
              .insert({
                ticket_id: ticket.id,
                usuario_id: usuario.id,
                nombre: comision.archivo.name,
                url: publicUrl,
                tipo: comision.archivo.type,
                tamano: comision.archivo.size
              });

            if (archivoError) throw archivoError;
          }

          // Crear comentario con información de la comisión
          let comentarioTexto = `💰 Comisión pendiente #${i + 1}:`;
          if (comision.numeroPoliza) {
            comentarioTexto += `\n• Póliza: ${comision.numeroPoliza}`;
          }
          if (comision.aseguradora) {
            comentarioTexto += `\n• Aseguradora: ${comision.aseguradora}`;
          }
          if (comision.fechaPago) {
            comentarioTexto += `\n• Fecha de pago: ${new Date(comision.fechaPago).toLocaleDateString('es-MX')}`;
          }
          if (comision.archivo) {
            comentarioTexto += `\n• Archivo: ${comision.archivo.name}`;
          }

          const { error: comentarioError } = await supabase
            .from('ticket_comentarios')
            .insert({
              ticket_id: ticket.id,
              usuario_id: usuario.id,
              mensaje: comentarioTexto
            });

          if (comentarioError) throw comentarioError;
        }
      } else if (tipoTramite === 'registro_poliza') {
        const filesWithData = polizaFiles.filter(f => f.file !== null);

        for (const pf of filesWithData) {
          if (!pf.file) continue;

          // Subir archivo
          const fileExt = pf.file.name.split('.').pop();
          const fileName = `${ticket.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('ticket-archivos')
            .upload(fileName, pf.file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('ticket-archivos')
            .getPublicUrl(fileName);

          // Guardar registro del archivo
          const { error: archivoError } = await supabase
            .from('ticket_archivos')
            .insert({
              ticket_id: ticket.id,
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
            .from('ticket_comentarios')
            .insert({
              ticket_id: ticket.id,
              usuario_id: usuario.id,
              mensaje: comentarioTexto
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
      case 'cotizacion_emision':
        return 'Cotización / Emisión - Proceso completo de cotización y emisión de pólizas';
      case 'correccion_poliza_registrada':
        return 'Corrección de póliza registrada';
      case 'correccion_comisiones':
        return 'Corrección de comisiones';
      case 'registro_poliza':
        return 'Registro de póliza';
      case 'solicitud_comisiones_pendientes':
        return 'Solicitud de comisiones pendientes';
      case 'renovaciones':
        return 'Renovaciones - Seguimiento de renovación de pólizas';
      case 'cobranza':
        return 'Cobranza - Seguimiento de pagos y cobranza';
      case 'otros_comercial':
        return 'Otros - Trámite comercial general';
      default:
        return tipo;
    }
  };

  // No renderizar nada si el modal está cerrado
  if (!isOpen) {
    return null;
  }

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
            className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent disabled:bg-neutral-100 disabled:cursor-not-allowed"
          >
            <optgroup label="Comercial">
              {canAccessRegistroAct && (
                <option value="cotizacion_emision">Cotización / Emisión</option>
              )}
              {getTipoTramitesByArea('Comercial')
                .filter(t => t.value !== 'cotizacion_emision' && t.value !== 'formulario_cotizacion')
                .filter(t => !isAgent || !isCommercialTicketType(t.value))
                .map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </optgroup>
            <optgroup label="Operaciones">
              {getTipoTramitesByArea('Operaciones')
                .filter(t => t.value !== 'cambio_bancario')
                .map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </optgroup>
          </select>
          <p className="text-xs text-neutral-500 mt-1">
            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold mr-1.5 ${AREA_CONFIG[getTipoTramiteArea(tipoTramite)].bg} ${AREA_CONFIG[getTipoTramiteArea(tipoTramite)].color}`}>
              {getTipoTramiteArea(tipoTramite)}
            </span>
            {getTipoLabel(tipoTramite)}
          </p>
        </div>

        {/* ===== SECCIÓN COTIZACIÓN / EMISIÓN ===== */}
        {tipoTramite === 'cotizacion_emision' && (
          <div className="space-y-4">
            {/* Pipeline de estatus - solo para no-agentes */}
            {!isAgent && (
              <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                <label className="block text-xs font-semibold text-neutral-700 mb-3 uppercase tracking-wide">
                  Estatus del Trámite
                </label>
                <div className="flex flex-wrap items-center gap-1">
                  {REGISTRO_ACTIVIDAD_ESTATUS.map((est, idx) => {
                    const isActive = ceEstatusNombre === est.nombre;
                    const isPassed = REGISTRO_ACTIVIDAD_ESTATUS.findIndex(e => e.nombre === ceEstatusNombre) > idx;
                    const isLast = idx === REGISTRO_ACTIVIDAD_ESTATUS.length - 1;
                    return (
                      <div key={est.nombre} className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setCeEstatusNombre(est.nombre)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all duration-200 ${
                            isActive
                              ? 'text-white border-transparent shadow-md scale-105'
                              : isPassed
                              ? 'text-white border-transparent opacity-60'
                              : 'bg-white border-neutral-200 text-neutral-500 hover:border-neutral-400'
                          }`}
                          style={{
                            backgroundColor: (isActive || isPassed) ? est.color : undefined,
                            borderColor: isActive ? est.color : undefined,
                          }}
                        >
                          {(isActive || isPassed) && <CheckCircle2 className="w-3 h-3" />}
                          {est.nombre}
                        </button>
                        {!isLast && <ChevronRight className="w-3.5 h-3.5 text-neutral-300 flex-shrink-0" />}
                      </div>
                    );
                  })}
                </div>
                {isEstatusFinal(ceEstatusNombre) && (
                  <div className="mt-3 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 bg-neutral-100 text-neutral-600">
                    <Lock className="w-3.5 h-3.5" />
                    Este es un estatus final. El trámite quedará cerrado.
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Agente - auto-asignado si es Agente */}
              {isAgent ? (
                <div>
                  <label className="block text-sm font-semibold text-neutral-900 mb-2">
                    <User className="w-4 h-4 inline mr-1.5" />
                    Agente
                  </label>
                  <div className="w-full px-4 py-2.5 bg-neutral-100 border border-neutral-200 rounded-xl text-sm text-neutral-700">
                    {usuario?.nombre_completo || 'Tu'}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-neutral-900 mb-2">
                    <User className="w-4 h-4 inline mr-1.5" />
                    Agente *
                  </label>
                  <select
                    value={ceAgenteUserId}
                    onChange={(e) => setCeAgenteUserId(e.target.value)}
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                  >
                    <option value="">Seleccione...</option>
                    {ceAgenteUsers.map(user => (
                      <option key={user.id} value={user.id}>{user.nombre_completo}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Tipo de Seguro */}
              <div>
                <label className="block text-sm font-semibold text-neutral-900 mb-2">
                  <Shield className="w-4 h-4 inline mr-1.5" />
                  Tipo de Seguro *
                </label>
                <select
                  value={ceInsuranceTypeId}
                  onChange={(e) => setCeInsuranceTypeId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                >
                  <option value="">Seleccione...</option>
                  {ceInsuranceTypes.map(type => (
                    <option key={type.id} value={type.id}>{type.nombre}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Aseguradoras multiselect */}
            <div className="relative">
              <label className="block text-sm font-semibold text-neutral-900 mb-2">
                <Building2 className="w-4 h-4 inline mr-1.5" />
                Aseguradoras * (seleccione una o más)
              </label>
              <div
                className="w-full px-4 py-2.5 text-sm border border-neutral-300 rounded-xl cursor-pointer"
                onClick={() => setCeShowInsurerDropdown(!ceShowInsurerDropdown)}
              >
                {ceSelectedInsurers.length === 0
                  ? <span className="text-neutral-400">Seleccione aseguradoras...</span>
                  : <span className="text-neutral-900">{ceAseguradorasRA.filter(a => ceSelectedInsurers.includes(a.id)).map(a => a.nombre).join(', ')}</span>
                }
              </div>
              {ceShowInsurerDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-neutral-300 rounded-xl shadow-lg max-h-48 overflow-auto">
                  <div className="p-2 border-b border-neutral-200">
                    <input
                      type="text"
                      placeholder="Buscar..."
                      value={ceInsurerSearchTerm}
                      onChange={(e) => setCeInsurerSearchTerm(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                  <div className="p-1">
                    {ceAseguradorasRA
                      .filter(a => (a.nombre ?? '').toLowerCase().includes(ceInsurerSearchTerm.toLowerCase()))
                      .map(aseg => (
                        <label key={aseg.id} className="flex items-center gap-2 p-1.5 hover:bg-neutral-100 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={ceSelectedInsurers.includes(aseg.id)}
                            onChange={() => setCeSelectedInsurers(prev =>
                              prev.includes(aseg.id) ? prev.filter(x => x !== aseg.id) : [...prev, aseg.id]
                            )}
                            className="w-3.5 h-3.5 rounded border-neutral-300"
                          />
                          <span className="text-xs text-neutral-700">{aseg.nombre}</span>
                        </label>
                      ))}
                  </div>
                </div>
              )}
            </div>

            <div className={`grid grid-cols-1 ${!isAgent ? 'md:grid-cols-2' : ''} gap-4`}>
              {/* Fecha de Inicio */}
              <div>
                <label className="block text-sm font-semibold text-neutral-900 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1.5" />
                  Fecha de Inicio *
                </label>
                <input
                  type="datetime-local"
                  value={ceRequestDatetime}
                  onChange={(e) => setCeRequestDatetime(e.target.value)}
                  className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                />
              </div>

              {/* Fecha de Finalización - solo para no-agentes */}
              {!isAgent && (
                <div>
                  <label className="block text-sm font-semibold text-neutral-900 mb-2">
                    <Clock className="w-4 h-4 inline mr-1.5" />
                    Fecha de Finalización
                    {isEstatusFinal(ceEstatusNombre) && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <input
                    type="datetime-local"
                    value={ceCompletionDatetime}
                    onChange={(e) => setCeCompletionDatetime(e.target.value)}
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                  />
                </div>
              )}
            </div>

            {/* Prioridad dentro del bloque CE - solo para no-agentes */}
            {!isAgent && (
              <div>
                <label className="block text-sm font-semibold text-neutral-900 mb-2">
                  Prioridad
                </label>
                <select
                  value={prioridad}
                  onChange={(e) => setPrioridad(e.target.value as 'Alta' | 'Media' | 'Baja')}
                  className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="Baja">Baja</option>
                  <option value="Media">Media</option>
                  <option value="Alta">Alta</option>
                </select>
              </div>
            )}
          </div>
        )}

        {/* ===== SECCIÓN TRÁMITES COMERCIALES (Renovaciones/Cobranza/Otros) ===== */}
        {isCommercialTicketType(tipoTramite) && (
          <div className="space-y-4">
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-3">
              <p className="text-xs text-sky-700 font-medium">
                Este trámite se asignará automáticamente a ti ({usuario?.nombre_completo}).
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-900 mb-2">
                <User className="w-4 h-4 inline mr-1.5" />
                Agente Relacionado *
              </label>
              <select
                value={comAgenteUserId}
                onChange={(e) => setComAgenteUserId(e.target.value)}
                className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent text-sm"
              >
                <option value="">Seleccione un agente...</option>
                {ceAgenteUsers.map(user => (
                  <option key={user.id} value={user.id}>{user.nombre_completo}</option>
                ))}
              </select>
            </div>


            {tipoTramite === 'otros_comercial' && (
              <div>
                <label className="block text-sm font-semibold text-neutral-900 mb-2">
                  Asunto
                </label>
                <input
                  type="text"
                  value={comAsunto}
                  onChange={(e) => setComAsunto(e.target.value)}
                  placeholder="Describe brevemente el asunto del trámite"
                  className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-neutral-900 mb-2">
                Prioridad
              </label>
              <select
                value={prioridad}
                onChange={(e) => setPrioridad(e.target.value as 'Alta' | 'Media' | 'Baja')}
                className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="Baja">Baja</option>
                <option value="Media">Media</option>
                <option value="Alta">Alta</option>
              </select>
            </div>
          </div>
        )}

        {canAssignOthers && tipoTramite !== 'cotizacion_emision' && !isCommercialTicketType(tipoTramite) && (
          <div>
            <label className="block text-sm font-semibold text-neutral-900 mb-2">
              <User className="w-4 h-4 inline mr-2" />
              Asignar a
            </label>
            <select
              value={asignado}
              onChange={(e) => setAsignado(e.target.value)}
              className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent"
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

        {!isAgent && tipoTramite !== 'cotizacion_emision' && !isCommercialTicketType(tipoTramite) && (
          <div>
            <label className="block text-sm font-semibold text-neutral-900 mb-2">
              Prioridad
            </label>
            <select
              value={prioridad}
              onChange={(e) => setPrioridad(e.target.value as 'Alta' | 'Media' | 'Baja')}
              className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="Baja">Baja</option>
              <option value="Media">Media</option>
              <option value="Alta">Alta</option>
            </select>
          </div>
        )}

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
              className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent"
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
                className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent disabled:bg-neutral-100"
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
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent mx-auto"></div>
                    <p className="text-sm text-neutral-600 mt-2">Cargando documentos...</p>
                  </div>
                ) : (
                  <select
                    value={documentoSeleccionado}
                    onChange={(e) => setDocumentoSeleccionado(e.target.value)}
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent"
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
                        className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
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
                        className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
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
                className="w-full py-2.5 border-2 border-dashed border-neutral-300 rounded-lg text-neutral-600 hover:border-accent hover:text-accent transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Añadir otro documento
              </button>
            )}
          </div>
        )}

        {tipoTramite === 'solicitud_comisiones_pendientes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-neutral-900">
                Comisiones Pendientes
              </label>
              <span className="text-xs text-neutral-500">
                {comisionesPendientes.length} de 10 comisiones
              </span>
            </div>

            <div className="space-y-3">
              {comisionesPendientes.map((comision, index) => (
                <div key={comision.id} className="border border-neutral-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-700">
                      Comisión #{index + 1}
                    </span>
                    {comisionesPendientes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeComisionPendiente(comision.id)}
                        className="text-red-600 hover:text-red-700 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        <FileText className="w-4 h-4 inline mr-1" />
                        Número de Póliza
                      </label>
                      <input
                        type="text"
                        value={comision.numeroPoliza}
                        onChange={(e) => updateComisionPendiente(comision.id, 'numeroPoliza', e.target.value)}
                        placeholder="Ej: 12345678"
                        className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        <Building2 className="w-4 h-4 inline mr-1" />
                        Aseguradora
                      </label>
                      <select
                        value={comision.aseguradora}
                        onChange={(e) => updateComisionPendiente(comision.id, 'aseguradora', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        <option value="">Selecciona...</option>
                        {aseguradoras.map(aseg => (
                          <option key={aseg.nombre} value={aseg.nombre}>
                            {aseg.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        <Calendar className="w-4 h-4 inline mr-1" />
                        Fecha de Pago
                      </label>
                      <input
                        type="date"
                        value={comision.fechaPago}
                        onChange={(e) => updateComisionPendiente(comision.id, 'fechaPago', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Archivo Adjunto
                      </label>
                      <input
                        type="file"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          updateComisionPendiente(comision.id, 'archivo', file);
                        }}
                        className="w-full text-sm text-neutral-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                      />
                      {comision.archivo && (
                        <p className="text-xs text-green-600 mt-1">
                          ✓ {comision.archivo.name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {comisionesPendientes.length < 10 && (
              <button
                type="button"
                onClick={addComisionPendiente}
                className="w-full py-2.5 border-2 border-dashed border-neutral-300 rounded-lg text-neutral-600 hover:border-accent hover:text-accent transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Añadir otra comisión pendiente
              </button>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-neutral-900 mb-2">
            Descripción / Notas
          </label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={4}
            placeholder="Describe el motivo del trámite con el mayor detalle posible... (Opcional)"
            className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent resize-none"
          />
        </div>

        {tipoTramite !== 'registro_poliza' && tipoTramite !== 'solicitud_comisiones_pendientes' && tipoTramite !== 'cotizacion_emision' && (
          <div>
            <label className="block text-sm font-semibold text-neutral-900 mb-2">
              <Upload className="w-4 h-4 inline mr-2" />
              Archivos Adjuntos
              <span className="text-xs font-normal text-neutral-500 ml-2">
                Documentos adjuntos: {archivos.length} / 20
              </span>
            </label>
            <div className="border-2 border-dashed border-neutral-300 rounded-xl p-6 text-center hover:border-accent transition-all">
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
                  PDF, imágenes, documentos (máx. 20 archivos)
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
            className="px-6 py-2.5 bg-accent text-white rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-50 flex items-center gap-2"
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
