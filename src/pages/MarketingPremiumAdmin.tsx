import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Sparkles, User, CheckCircle, Save, TrendingUp, Users, DollarSign, Calendar, AlertTriangle, Copy, UserPlus, X, Megaphone, Upload, Trash2, Image as ImageIcon, Video as VideoIcon, Loader as Loader2, Zap, Eye, EyeOff, Pencil, Plus, FileText, ExternalLink, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import { useAuth } from '../contexts/AuthContext';
import { supabase, supabaseUrl } from '../lib/supabase';
import { PageHeader } from '@/components/ui/page-header';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { resolveImageUrl } from '../lib/storageUtils';
import { tieneAccesoEquipoMkt } from '../lib/mktUtils';
import { generarThumbnailVideo } from '../lib/videoThumbnail';
import {
  dispararTriggersPremium,
  obtenerMapeoCamposTriggerPremium,
  guardarMapeoCampoTriggerPremium,
  PLACEHOLDERS_TRIGGER_PREMIUM,
} from '../lib/mktPremiumTriggers';
import { obtenerCamposTramiteTipo } from '../lib/storeUtils';
import { UserModal } from '../components/UserModal';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type MetodoPago = 'deposito_jiro' | 'bono_anual' | 'comisiones';
type PlanTipo = 'mensual' | 'anual';

interface Agente {
  id: string;
  nombre: string;
  apellidos: string;
  puesto: string;
  imagen_perfil_url: string;
  plan_mkt_premium: boolean;
  mkt_premium_fecha_inicio: string | null;
  mkt_premium_fecha_pago: string | null;
  mkt_premium_plan: PlanTipo | null;
  mkt_premium_metodo_pago: MetodoPago | null;
  mkt_premium_parcialidades: number | null;
  oficina: { nombre: string } | null;
}

interface FormData {
  plan_mkt_premium: boolean;
  mkt_premium_plan: PlanTipo | '';
  mkt_premium_metodo_pago: MetodoPago | '';
  mkt_premium_fecha_inicio: string;
  mkt_premium_fecha_pago: string;
  mkt_premium_parcialidades: string;
}

const METODOS: { value: MetodoPago; label: string }[] = [
  { value: 'deposito_jiro', label: 'Depósito a cuenta Jiro' },
  { value: 'bono_anual', label: 'Descuento de bono anual' },
  { value: 'comisiones', label: 'Descuento a comisiones' },
];

const PLANES: { value: PlanTipo; label: string; precio: string }[] = [
  { value: 'mensual', label: 'Mensual', precio: '$200 MXN/mes' },
  { value: 'anual', label: 'Anual', precio: '$2,000 MXN/año' },
];

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function formatFecha(iso: string | null | undefined) {
  if (!iso) return '—';
  try { return format(new Date(iso), "d 'de' MMMM, yyyy", { locale: es }); } catch { return '—'; }
}

interface TramiteResumen {
  id: string;
  folio: string;
  tipo_tramite: string;
  tipo_label: string;
  created_at: string;
  custom_estatus_label: string | null;
  creado_por: string | null;
}

interface DisenoAgente {
  id: string;
  titulo: string | null;
  tipo: 'imagen' | 'video' | null;
  archivo_resultante_url: string | null;
  thumbnail_url: string | null;
  created_at: string;
}

function emptyForm(a?: Agente | null): FormData {
  return {
    plan_mkt_premium: a?.plan_mkt_premium ?? false,
    mkt_premium_plan: a?.mkt_premium_plan ?? '',
    mkt_premium_metodo_pago: a?.mkt_premium_metodo_pago ?? '',
    mkt_premium_fecha_inicio: a?.mkt_premium_fecha_inicio ?? '',
    mkt_premium_fecha_pago: a?.mkt_premium_fecha_pago ?? '',
    mkt_premium_parcialidades: a?.mkt_premium_parcialidades ? String(a.mkt_premium_parcialidades) : '',
  };
}

export default function MarketingPremiumAdmin({ embedded }: { embedded?: boolean } = {}) {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [soloConPremium, setSoloConPremium] = useState(false);

  const [seleccionado, setSeleccionado] = useState<Agente | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm());
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [sqlCopiado, setSqlCopiado] = useState(false);
  const [errorValidacion, setErrorValidacion] = useState('');
  const [triggerToast, setTriggerToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);
  const [tieneAcceso, setTieneAcceso] = useState(false);
  const [verificandoAcceso, setVerificandoAcceso] = useState(true);

  const [mostrarNuevoAgente, setMostrarNuevoAgente] = useState(false);
  const [vista, setVista] = useState<'agentes' | 'triggers'>('agentes');

  const [disenosAgente, setDisenosAgente] = useState<DisenoAgente[]>([]);
  const [cargandoDisenos, setCargandoDisenos] = useState(false);
  const [tituloNuevoDiseno, setTituloNuevoDiseno] = useState('');
  const [subiendoDiseno, setSubiendoDiseno] = useState(false);
  const [errorDiseno, setErrorDiseno] = useState('');
  const [avisoDiseno, setAvisoDiseno] = useState('');
  const [arrastrandoDiseno, setArrastrandoDiseno] = useState(false);
  const [archivoPendiente, setArchivoPendiente] = useState<File | null>(null);
  const [previewPendienteUrl, setPreviewPendienteUrl] = useState<string | null>(null);

  const [tramitesAgente, setTramitesAgente] = useState<TramiteResumen[]>([]);
  const [cargandoTramites, setCargandoTramites] = useState(false);
  const [generandoTramite, setGenerandoTramite] = useState(false);

  const [nuevoAgente, setNuevoAgente] = useState({ nombre: '', apellidos: '', email_laboral: '', celular_laboral: '' });
  const [creandoAgente, setCreandoAgente] = useState(false);
  const [errorNuevoAgente, setErrorNuevoAgente] = useState('');

  useEffect(() => {
    (async () => {
      if (!usuario) { setVerificandoAcceso(false); return; }
      const acceso = usuario.rol === 'Administrador' || await tieneAccesoEquipoMkt(usuario.id);
      setTieneAcceso(acceso);
      setVerificandoAcceso(false);
    })();
  }, [usuario?.id]);

  useEffect(() => { cargarAgentes(); }, []);

  async function cargarAgentes() {
    setLoading(true);

    // Intentar query completa (requiere que las migraciones estén aplicadas)
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nombre, apellidos, puesto, imagen_perfil_url, plan_mkt_premium, mkt_premium_fecha_inicio, mkt_premium_fecha_pago, mkt_premium_plan, mkt_premium_metodo_pago, mkt_premium_parcialidades, oficinas:oficina_id(nombre)')
      .eq('activo', true)
      .order('nombre');

    if (error) {
      // Fallback: columnas base sin campos de detalle premium (migraciones pendientes)
      const { data: fallback } = await supabase
        .from('usuarios')
        .select('id, nombre, apellidos, puesto, imagen_perfil_url, plan_mkt_premium, oficinas:oficina_id(nombre)')
        .eq('activo', true)
        .order('nombre');

      setAgentes(
        (fallback ?? []).map((u: any) => ({
          ...u,
          mkt_premium_fecha_inicio: null,
          mkt_premium_fecha_pago: null,
          mkt_premium_plan: null,
          mkt_premium_metodo_pago: null,
          mkt_premium_parcialidades: null,
          oficina: Array.isArray(u.oficinas) ? u.oficinas[0] ?? null : u.oficinas ?? null,
        }))
      );
      setNeedsMigration(true);
    } else {
      setAgentes(
        (data ?? []).map((u: any) => ({
          ...u,
          oficina: Array.isArray(u.oficinas) ? u.oficinas[0] ?? null : u.oficinas ?? null,
        }))
      );
    }

    setLoading(false);
  }

  function seleccionar(agente: Agente) {
    setSeleccionado(agente);
    setForm(emptyForm(agente));
    setGuardado(false);
    setTituloNuevoDiseno('');
    setErrorDiseno('');
    setAvisoDiseno('');
    cancelarArchivoPendiente();
    cargarDisenosAgente(agente.id);
    cargarTramitesAgente(agente.id);
  }

  async function cargarTramitesAgente(agenteId: string) {
    setCargandoTramites(true);
    setTramitesAgente([]);
    try {
      // Construir mapa de labels a partir de los triggers premium configurados
      const tipoMap: Record<string, string> = {};
      const { data: triggers } = await supabase
        .from('mkt_premium_triggers')
        .select('ticket_tipo_id')
        .not('ticket_tipo_id', 'is', null);

      const tipoIds = [...new Set((triggers ?? []).map((t: any) => t.ticket_tipo_id).filter(Boolean))];
      if (tipoIds.length > 0) {
        const { data: tipos } = await supabase
          .from('ticket_tipos')
          .select('id, value, label')
          .in('id', tipoIds);
        (tipos ?? []).forEach((t: any) => {
          if (t.value != null) tipoMap[t.value] = t.label || t.value;
        });
      }

      // Todos los tickets del agente — buscar en agente_id Y agente_usuario_id
      const { data: tickets, error: errTickets } = await supabase
        .from('tickets')
        .select('id, folio, tipo_tramite, created_at, custom_estatus_label, creado_por')
        .or(`agente_id.eq.${agenteId},agente_usuario_id.eq.${agenteId}`)
        .order('created_at', { ascending: false });

      if (errTickets) console.error('[MKT historial] tickets error:', errTickets);

      setTramitesAgente(
        (tickets ?? []).map((t: any) => ({
          ...t,
          tipo_label: tipoMap[t.tipo_tramite] || t.tipo_tramite,
        }))
      );
    } catch (err) {
      console.error('Error cargando trámites premium:', err);
    } finally {
      setCargandoTramites(false);
    }
  }

  async function descargarPDFTramitePremium(tramite: TramiteResumen, agente: Agente) {
    const METODO_LABELS: Record<string, string> = {
      deposito_jiro: 'Depósito a cuenta Jiro',
      bono_anual: 'Descuento de bono anual',
      comisiones: 'Descuento a comisiones',
    };
    const PLAN_LABELS: Record<string, string> = {
      mensual: 'Mensual ($200 MXN/mes)',
      anual: 'Anual ($2,000 MXN/año)',
    };

    let creadorNombre = '—';
    if (tramite.creado_por) {
      const { data: creador } = await supabase
        .from('usuarios')
        .select('nombre, apellidos')
        .eq('id', tramite.creado_por)
        .single();
      if (creador) creadorNombre = `${(creador as any).nombre} ${(creador as any).apellidos}`.trim();
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Encabezado
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('COMPROBANTE DE TRÁMITE', pageWidth / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Marketing Premium · MOVI', pageWidth / 2, y, { align: 'center' });
    y += 4;
    doc.setLineWidth(0.5);
    doc.line(14, y, pageWidth - 14, y);
    y += 10;

    // Folio y fecha
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Folio:', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(tramite.folio, 45, y);
    doc.setFont('helvetica', 'bold');
    doc.text('Fecha:', pageWidth / 2, y);
    doc.setFont('helvetica', 'normal');
    doc.text(format(new Date(tramite.created_at), "d 'de' MMMM yyyy", { locale: es }), pageWidth / 2 + 16, y);
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Tipo de trámite:', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(tramite.tipo_label, 45, y);
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Estatus:', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(tramite.custom_estatus_label || '—', 45, y);
    y += 12;

    // Datos del agente
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DEL AGENTE', 14, y);
    y += 2;
    doc.setLineWidth(0.3);
    doc.line(14, y, pageWidth - 14, y);
    y += 8;
    doc.setFontSize(10);

    const camposAgente: [string, string][] = [
      ['Nombre:', `${agente.nombre} ${agente.apellidos}`],
      ['Oficina:', agente.oficina?.nombre || '—'],
      ['Plan:', PLAN_LABELS[agente.mkt_premium_plan ?? ''] || agente.mkt_premium_plan || '—'],
      ['Método de pago:', METODO_LABELS[agente.mkt_premium_metodo_pago ?? ''] || agente.mkt_premium_metodo_pago || '—'],
    ];
    if (agente.mkt_premium_parcialidades) {
      camposAgente.push(['Parcialidades:', `${agente.mkt_premium_parcialidades}`]);
    }
    if (agente.mkt_premium_fecha_inicio) {
      camposAgente.push(['Fecha de inicio:', format(new Date(agente.mkt_premium_fecha_inicio), "d 'de' MMMM yyyy", { locale: es })]);
    }
    if (agente.mkt_premium_fecha_pago) {
      camposAgente.push(['Fecha de pago:', format(new Date(agente.mkt_premium_fecha_pago), "d 'de' MMMM yyyy", { locale: es })]);
    }

    for (const [label, value] of camposAgente) {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 14, y);
      doc.setFont('helvetica', 'normal');
      doc.text(value, 60, y);
      y += 6;
    }
    y += 6;

    // Generado por
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('GENERADO POR', 14, y);
    y += 2;
    doc.line(14, y, pageWidth - 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Responsable:', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(creadorNombre, 60, y);
    y += 16;

    // Pie
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Generado el ${format(new Date(), "d 'de' MMMM yyyy 'a las' HH:mm", { locale: es })}`, pageWidth / 2, y, { align: 'center' });

    doc.save(`tramite-premium-${tramite.folio}.pdf`);
  }

  async function generarTramiteManual() {
    if (!seleccionado || !usuario) return;
    setGenerandoTramite(true);
    try {
      const res = await dispararTriggersPremium({
        eventoKey: 'activacion',
        agente: { id: seleccionado.id, nombre: seleccionado.nombre, apellidos: seleccionado.apellidos, oficina: seleccionado.oficina },
        form: {
          mkt_premium_plan: seleccionado.mkt_premium_plan ?? '',
          mkt_premium_metodo_pago: seleccionado.mkt_premium_metodo_pago ?? '',
          mkt_premium_parcialidades: seleccionado.mkt_premium_parcialidades?.toString() ?? '',
          mkt_premium_fecha_inicio: seleccionado.mkt_premium_fecha_inicio ?? '',
          mkt_premium_fecha_pago: seleccionado.mkt_premium_fecha_pago ?? '',
        },
        usuarioId: usuario.id,
        usuarioNombre: `${usuario.nombre} ${usuario.apellidos}`.trim(),
      });
      const partes: string[] = [];
      if (res.creados.length > 0)
        partes.push(`Trámite creado: ${res.creados.map(c => `${c.tipoLabel} (${c.folio})`).join(', ')}`);
      if (res.omitidos.length > 0)
        partes.push(`Ya existía: ${res.omitidos.map(o => `${o.tipoLabel} (${o.folio})`).join(', ')}`);
      if (partes.length > 0) {
        const tipo = res.creados.length > 0 ? 'success' : 'info';
        setTriggerToast({ message: partes.join(' · '), type: tipo });
        setTimeout(() => setTriggerToast(null), 6000);
      }
      await cargarTramitesAgente(seleccionado.id);
    } catch (err) {
      console.error('Error generando trámite:', err);
    } finally {
      setGenerandoTramite(false);
    }
  }

  function seleccionarArchivoPendiente(file: File) {
    if (previewPendienteUrl) URL.revokeObjectURL(previewPendienteUrl);
    setArchivoPendiente(file);
    setPreviewPendienteUrl(URL.createObjectURL(file));
    setErrorDiseno('');
    setAvisoDiseno('');
  }

  function cancelarArchivoPendiente() {
    if (previewPendienteUrl) URL.revokeObjectURL(previewPendienteUrl);
    setArchivoPendiente(null);
    setPreviewPendienteUrl(null);
  }

  async function confirmarSubidaPendiente() {
    if (!archivoPendiente) return;
    await subirDisenoSemanal(archivoPendiente);
    cancelarArchivoPendiente();
  }

  async function cargarDisenosAgente(usuarioId: string) {
    setCargandoDisenos(true);
    const { data } = await supabase
      .from('publicidad_disenos')
      .select('id, titulo, tipo, archivo_resultante_url, thumbnail_url, created_at')
      .eq('usuario_id', usuarioId)
      .eq('origen', 'equipo_mkt')
      .order('created_at', { ascending: false });
    setDisenosAgente(data ?? []);
    setCargandoDisenos(false);
  }

  async function subirDisenoSemanal(file: File) {
    if (!seleccionado || !usuario) return;
    setSubiendoDiseno(true);
    setErrorDiseno('');
    setAvisoDiseno('');
    try {
      const tipo: 'imagen' | 'video' = file.type.startsWith('video/') ? 'video' : 'imagen';
      const timestamp = Date.now();
      const path = `equipo-mkt/${seleccionado.id}/${timestamp}-${file.name}`;

      const { error: upErr } = await supabase.storage.from('publicidad-disenos').upload(path, file);
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage.from('publicidad-disenos').getPublicUrl(path);

      let thumbnailUrl: string | null = tipo === 'imagen' ? publicUrl : null;

      if (tipo === 'video') {
        try {
          const thumbBlob = await generarThumbnailVideo(file);
          const thumbPath = `equipo-mkt/${seleccionado.id}/${timestamp}-thumb.jpg`;
          const { error: thumbErr } = await supabase.storage.from('publicidad-disenos').upload(thumbPath, thumbBlob);
          if (thumbErr) throw thumbErr;
          thumbnailUrl = supabase.storage.from('publicidad-disenos').getPublicUrl(thumbPath).data.publicUrl;
        } catch (thumbErr: any) {
          console.warn('[MarketingPremiumAdmin] No se pudo generar miniatura del video:', thumbErr);
          setAvisoDiseno(`El video se subió, pero no se pudo generar su miniatura (${thumbErr?.message || thumbErr}).`);
        }
      }

      const { error: insErr } = await supabase.from('publicidad_disenos').insert({
        usuario_id: seleccionado.id,
        origen: 'equipo_mkt',
        titulo: tituloNuevoDiseno.trim() || null,
        tipo,
        archivo_resultante_url: publicUrl,
        thumbnail_url: thumbnailUrl,
        creado_por: usuario.id,
      });
      if (insErr) throw insErr;

      setTituloNuevoDiseno('');
      cargarDisenosAgente(seleccionado.id);
    } catch (err: any) {
      setErrorDiseno(err.message || 'No se pudo subir el contenido');
    } finally {
      setSubiendoDiseno(false);
    }
  }

  async function eliminarDisenoAgente(id: string) {
    if (!confirm('¿Eliminar este contenido? El agente ya no podrá verlo.')) return;
    const { error } = await supabase.from('publicidad_disenos').delete().eq('id', id);
    if (error) {
      alert(`No se pudo eliminar: ${error.message}`);
      return;
    }
    setDisenosAgente(prev => prev.filter(d => d.id !== id));
  }

  async function subirFotoPerfil(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !seleccionado) return;
    const ext = file.name.split('.').pop();
    const filePath = `${seleccionado.id}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(filePath, file);
    if (upErr) { alert('No se pudo subir la foto: ' + upErr.message); return; }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
    const publicUrl = urlData.publicUrl;
    await supabase.from('usuarios').update({ imagen_perfil_url: publicUrl, updated_at: new Date().toISOString() }).eq('id', seleccionado.id);
    const actualizado = { ...seleccionado, imagen_perfil_url: publicUrl };
    setSeleccionado(actualizado);
    setAgentes(prev => prev.map(a => a.id === seleccionado.id ? actualizado : a));
  }

  function detectarEventosPremium(antes: Agente, despues: Agente): string[] {
    const eventos: string[] = [];
    const eraActivo = antes.plan_mkt_premium;
    const esActivo = despues.plan_mkt_premium;

    if (!eraActivo && esActivo) {
      eventos.push('activacion');
    } else if (eraActivo && !esActivo) {
      eventos.push('desactivacion');
    } else if (eraActivo && esActivo) {
      if (antes.mkt_premium_metodo_pago !== despues.mkt_premium_metodo_pago) {
        eventos.push('cambio_metodo_pago');
      }
      const otrosCambiaron =
        antes.mkt_premium_plan !== despues.mkt_premium_plan ||
        antes.mkt_premium_fecha_inicio !== despues.mkt_premium_fecha_inicio ||
        antes.mkt_premium_fecha_pago !== despues.mkt_premium_fecha_pago ||
        antes.mkt_premium_parcialidades !== despues.mkt_premium_parcialidades;
      if (otrosCambiaron) eventos.push('actualizacion');
    }
    return eventos;
  }

  async function dispararReglasPremium(eventos: string[], agente: Agente) {
    if (!usuario || eventos.length === 0) return;
    const creados: { folio: string; tipoLabel: string }[] = [];
    const omitidos: { folio: string; tipoLabel: string }[] = [];
    for (const eventoKey of eventos) {
      const res = await dispararTriggersPremium({
        eventoKey,
        agente: { id: agente.id, nombre: agente.nombre, apellidos: agente.apellidos, oficina: agente.oficina },
        form: {
          mkt_premium_plan: form.mkt_premium_plan,
          mkt_premium_metodo_pago: form.mkt_premium_metodo_pago,
          mkt_premium_parcialidades: form.mkt_premium_parcialidades,
          mkt_premium_fecha_inicio: form.mkt_premium_fecha_inicio,
          mkt_premium_fecha_pago: form.mkt_premium_fecha_pago,
        },
        usuarioId: usuario.id,
        usuarioNombre: `${usuario.nombre} ${usuario.apellidos}`.trim(),
      });
      creados.push(...res.creados);
      omitidos.push(...res.omitidos);
    }
    if (creados.length === 0 && omitidos.length === 0) return;
    const partes: string[] = [];
    if (creados.length > 0)
      partes.push(`Trámite${creados.length > 1 ? 's' : ''} nuevo${creados.length > 1 ? 's' : ''}: ${creados.map(c => `${c.tipoLabel} (${c.folio})`).join(', ')}`);
    if (omitidos.length > 0)
      partes.push(`Ya existía${omitidos.length > 1 ? 'n' : ''}: ${omitidos.map(o => `${o.tipoLabel} (${o.folio})`).join(', ')}`);
    setTriggerToast({ message: partes.join(' · '), type: omitidos.length > 0 && creados.length === 0 ? 'info' : 'success' });
    setTimeout(() => setTriggerToast(null), 6000);
  }

  async function guardar() {
    if (!seleccionado) return;

    // Validar que si se activa premium, tenga fechas de inicio y pago
    if (form.plan_mkt_premium && !needsMigration) {
      if (!form.mkt_premium_fecha_inicio || !form.mkt_premium_fecha_pago) {
        setErrorValidacion('Para activar el premium debes seleccionar la fecha de inicio y la fecha de pago.');
        return;
      }
      if (form.mkt_premium_metodo_pago === 'comisiones' && !form.mkt_premium_parcialidades) {
        setErrorValidacion('Para diferir a comisiones debes indicar en cuántas parcialidades.');
        return;
      }
    }
    setErrorValidacion('');

    const agenteAntes = seleccionado;

    setGuardando(true);
    setGuardado(false);

    // Si las columnas de detalle no existen, solo actualizar plan_mkt_premium
    const payload: Record<string, unknown> = {
      plan_mkt_premium: form.plan_mkt_premium,
      updated_at: new Date().toISOString(),
    };
    if (!needsMigration) {
      payload.mkt_premium_plan = form.mkt_premium_plan || null;
      payload.mkt_premium_metodo_pago = form.mkt_premium_metodo_pago || null;
      payload.mkt_premium_fecha_inicio = form.mkt_premium_fecha_inicio || null;
      payload.mkt_premium_fecha_pago = form.mkt_premium_fecha_pago || null;
      payload.mkt_premium_parcialidades = form.mkt_premium_metodo_pago === 'comisiones' && form.mkt_premium_parcialidades
        ? parseInt(form.mkt_premium_parcialidades, 10)
        : null;
    }

    const selectCols = needsMigration
      ? 'id, nombre, apellidos, puesto, imagen_perfil_url, plan_mkt_premium, oficinas:oficina_id(nombre)'
      : 'id, nombre, apellidos, puesto, imagen_perfil_url, plan_mkt_premium, mkt_premium_fecha_inicio, mkt_premium_fecha_pago, mkt_premium_plan, mkt_premium_metodo_pago, mkt_premium_parcialidades, oficinas:oficina_id(nombre)';

    const { data, error } = await supabase
      .from('usuarios')
      .update(payload)
      .eq('id', seleccionado.id)
      .select(selectCols)
      .single();

    setGuardando(false);

    if (error || !data) {
      setErrorValidacion(error?.message || 'No se pudo guardar — no tienes permiso para modificar a este agente.');
      return;
    }

    const actualizado: Agente = {
      ...(data as any),
      oficina: Array.isArray((data as any).oficinas) ? (data as any).oficinas[0] ?? null : (data as any).oficinas ?? null,
    };
    setSeleccionado(actualizado);
    setAgentes(prev => prev.map(a => a.id === actualizado.id ? actualizado : a));

    // Disparar las reglas configuradas para el/los eventos que ocurrieron en este guardado
    const eventos = detectarEventosPremium(agenteAntes, actualizado);
    await dispararReglasPremium(eventos, actualizado);
    if (eventos.length > 0) cargarTramitesAgente(actualizado.id);

    setGuardado(true);
    setTimeout(() => setGuardado(false), 3000);
  }

  const agenesFiltrados = agentes.filter(a => {
    const coincide = busqueda === '' ||
      norm(`${a.nombre} ${a.apellidos}`).includes(norm(busqueda)) ||
      norm(a.oficina?.nombre ?? '').includes(norm(busqueda));
    return coincide && (!soloConPremium || a.plan_mkt_premium);
  });

  // Estadísticas
  const totalPremium = agentes.filter(a => a.plan_mkt_premium).length;
  const mensuales = agentes.filter(a => a.plan_mkt_premium && a.mkt_premium_plan === 'mensual').length;
  const anuales = agentes.filter(a => a.plan_mkt_premium && a.mkt_premium_plan === 'anual').length;
  const ingresoEstimado = mensuales * 200 + anuales * (2000 / 12);

  const MIGRATION_SQL = `-- Ejecuta esto en Supabase Dashboard → SQL Editor
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS mkt_premium_fecha_inicio date,
  ADD COLUMN IF NOT EXISTS mkt_premium_fecha_pago date,
  ADD COLUMN IF NOT EXISTS mkt_premium_plan text CHECK (mkt_premium_plan IN ('mensual', 'anual')),
  ADD COLUMN IF NOT EXISTS mkt_premium_metodo_pago text CHECK (mkt_premium_metodo_pago IN ('deposito_jiro', 'bono_anual', 'comisiones')),
  ADD COLUMN IF NOT EXISTS mkt_premium_parcialidades integer CHECK (mkt_premium_parcialidades IS NULL OR mkt_premium_parcialidades BETWEEN 1 AND 12);`;

  function copiarSQL() {
    navigator.clipboard.writeText(MIGRATION_SQL);
    setSqlCopiado(true);
    setTimeout(() => setSqlCopiado(false), 2500);
  }

  async function crearAgente() {
    if (!nuevoAgente.nombre.trim() || !nuevoAgente.apellidos.trim() || !nuevoAgente.email_laboral.trim()) {
      setErrorNuevoAgente('Nombre, apellidos y correo laboral son obligatorios.');
      return;
    }
    setCreandoAgente(true);
    setErrorNuevoAgente('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/create-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          userData: {
            nombre: nuevoAgente.nombre.trim(),
            apellidos: nuevoAgente.apellidos.trim(),
            email_laboral: nuevoAgente.email_laboral.trim(),
            celular_laboral: nuevoAgente.celular_laboral.trim(),
            rol: 'Agente',
          },
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Error al crear el agente');

      setMostrarNuevoAgente(false);
      setNuevoAgente({ nombre: '', apellidos: '', email_laboral: '', celular_laboral: '' });
      await cargarAgentes();
    } catch (e) {
      setErrorNuevoAgente(e instanceof Error ? e.message : 'Error al crear el agente');
    } finally {
      setCreandoAgente(false);
    }
  }

  if (verificandoAcceso) return null;
  if (!tieneAcceso) return null;

  return (
    <>
    <div className="space-y-5">
      {!embedded && (
        <PageHeader
          title="Marketing Premium — Gestión"
          description="Administra suscripciones, planes y métodos de pago de los agentes"
          icon={Sparkles}
        />
      )}

      {/* Banner de migración pendiente */}
      {needsMigration && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800">Migración de base de datos pendiente</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Las columnas de detalle del plan premium no existen aún. Los agentes se muestran, pero no podrás editar plan, método de pago ni fechas hasta aplicar el siguiente SQL en{' '}
                <strong>Supabase Dashboard → SQL Editor</strong>.
              </p>
            </div>
          </div>
          <div className="relative">
            <pre className="text-xs bg-amber-100 border border-amber-200 rounded-xl p-3 overflow-x-auto text-amber-900 whitespace-pre-wrap">
              {MIGRATION_SQL}
            </pre>
            <button
              onClick={copiarSQL}
              className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-amber-300 text-xs text-amber-800 hover:bg-amber-50 transition"
            >
              <Copy className="w-3 h-3" />
              {sqlCopiado ? 'Copiado ✓' : 'Copiar'}
            </button>
          </div>
          <button
            onClick={() => { setNeedsMigration(false); cargarAgentes(); }}
            className="text-xs text-amber-700 underline"
          >
            Ya apliqué la migración — recargar
          </button>
        </div>
      )}

      {/* Tabs: agentes / reglas de tickets */}
      <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-white/8">
        {([
          { key: 'agentes' as const, label: 'Agentes' },
          { key: 'triggers' as const, label: 'Reglas de tickets' },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setVista(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
              vista === t.key
                ? 'border-purple-600 text-purple-700 dark:text-purple-400'
                : 'border-transparent text-neutral-500 dark:text-white/50 hover:text-neutral-700 dark:hover:text-white/70'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {vista === 'triggers' ? (
        <MktPremiumTriggersPanel />
      ) : (
        <>
          {/* Estadísticas */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { icon: Users, label: 'Con Premium', value: totalPremium, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
              { icon: TrendingUp, label: 'Plan mensual', value: mensuales, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
              { icon: Calendar, label: 'Plan anual', value: anuales, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
              { icon: DollarSign, label: 'Ingreso/mes est.', value: `$${Math.round(ingresoEstimado).toLocaleString()}`, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
            ].map(stat => (
              <div key={stat.label} className={`rounded-2xl border border-neutral-200 dark:border-white/8 ${stat.bg} p-4 flex items-center gap-3`}>
                <div className={`w-9 h-9 rounded-xl bg-white dark:bg-black/20 flex items-center justify-center shrink-0`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-xs text-neutral-500 dark:text-white/50">{stat.label}</p>
                  <p className="text-xl font-bold text-neutral-800 dark:text-white">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5 items-start">
            {/* ── Lista de agentes ── */}
            <div className="rounded-2xl border border-neutral-200 dark:border-white/8 bg-white dark:bg-white/3 overflow-hidden">
              <div className="p-4 border-b border-neutral-100 dark:border-white/8 space-y-3">
                <button
                  onClick={() => setMostrarNuevoAgente(true)}
                  className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-xl bg-accent/10 text-accent text-sm font-medium hover:bg-accent/20 transition"
                >
                  <UserPlus className="w-4 h-4" />
                  Nuevo agente
                </button>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Buscar agente…"
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-neutral-800 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={soloConPremium}
                    onChange={e => setSoloConPremium(e.target.checked)}
                    className="accent-purple-600 w-4 h-4"
                  />
                  <span className="text-xs text-neutral-600 dark:text-white/60">Solo con Premium activo</span>
                </label>
              </div>

              <div className="overflow-y-auto max-h-[65vh]">
                {loading ? (
                  <LoadingState text="Cargando agentes…" compact />
                ) : agenesFiltrados.length === 0 ? (
                  <p className="text-sm text-neutral-400 text-center py-8">Sin resultados</p>
                ) : (
                  agenesFiltrados.map(agente => {
                    const activo = seleccionado?.id === agente.id;
                    return (
                      <button
                        key={agente.id}
                        onClick={() => seleccionar(agente)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition border-b border-neutral-100 dark:border-white/5 last:border-0 ${
                          activo ? 'bg-purple-50 dark:bg-purple-900/20' : 'hover:bg-neutral-50 dark:hover:bg-white/4'
                        }`}
                      >
                        {agente.imagen_perfil_url ? (
                          <img
                            src={resolveImageUrl(agente.imagen_perfil_url, 'avatars')}
                            alt=""
                            className="w-9 h-9 rounded-full object-cover shrink-0"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-neutral-100 dark:bg-white/10 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-neutral-400" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-neutral-800 dark:text-white truncate">
                            {agente.nombre} {agente.apellidos}
                          </p>
                          <p className="text-xs text-neutral-400 truncate">{agente.oficina?.nombre ?? '—'}</p>
                        </div>
                        {agente.plan_mkt_premium && (
                          <CheckCircle className="w-4 h-4 text-purple-500 shrink-0" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* ── Panel de edición ── */}
            {!seleccionado ? (
              <div className="rounded-2xl border border-neutral-200 dark:border-white/8 bg-white dark:bg-white/3">
                <EmptyState
                  icon={Sparkles}
                  title="Selecciona un agente"
                  description="Elige un agente de la lista para gestionar su suscripción de Marketing Premium."
                  compact
                />
              </div>
            ) : (
              <div className="rounded-2xl border border-neutral-200 dark:border-white/8 bg-white dark:bg-white/3 overflow-hidden">
                {/* Cabecera */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-neutral-100 dark:border-white/8">
                  <label className="relative group cursor-pointer shrink-0">
                    {seleccionado.imagen_perfil_url ? (
                      <img
                        src={resolveImageUrl(seleccionado.imagen_perfil_url, 'avatars')}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-white/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-neutral-400" />
                      </div>
                    )}
                    <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <Upload className="w-3.5 h-3.5 text-white" />
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={subirFotoPerfil} />
                  </label>
                  <div>
                    <p className="font-semibold text-neutral-800 dark:text-white">
                      {seleccionado.nombre} {seleccionado.apellidos}
                    </p>
                    <p className="text-xs text-neutral-400">{seleccionado.oficina?.nombre ?? '—'} · {seleccionado.puesto}</p>
                  </div>
                </div>

                <div className="p-5 space-y-6">
                  {/* Toggle premium */}
                  <div className="flex items-center justify-between p-4 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/3">
                    <div>
                      <p className="text-sm font-semibold text-neutral-800 dark:text-white">Plan MKT Premium</p>
                      <p className="text-xs text-neutral-400 mt-0.5">Activa o desactiva el acceso premium</p>
                    </div>
                    <button
                      onClick={() => { setForm(f => ({ ...f, plan_mkt_premium: !f.plan_mkt_premium })); setErrorValidacion(''); }}
                      className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${
                        form.plan_mkt_premium ? 'bg-purple-600' : 'bg-neutral-300 dark:bg-white/20'
                      }`}
                    >
                      <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        form.plan_mkt_premium ? 'translate-x-6' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Plan */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-neutral-500 dark:text-white/50 uppercase tracking-wide">
                        Tipo de plan
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {PLANES.map(plan => (
                          <button
                            key={plan.value}
                            onClick={() => setForm(f => ({ ...f, mkt_premium_plan: plan.value }))}
                            className={`p-3 rounded-xl border-2 text-left transition ${
                              form.mkt_premium_plan === plan.value
                                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                                : 'border-neutral-200 dark:border-white/10 hover:border-purple-300'
                            }`}
                          >
                            <p className="text-sm font-semibold text-neutral-800 dark:text-white">{plan.label}</p>
                            <p className="text-xs text-neutral-500 dark:text-white/50">{plan.precio}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Método de pago */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-neutral-500 dark:text-white/50 uppercase tracking-wide">
                        Método de pago
                      </label>
                      <div className="space-y-2">
                        {METODOS.map((metodo, i) => (
                          <button
                            key={metodo.value}
                            onClick={() => setForm(f => ({ ...f, mkt_premium_metodo_pago: metodo.value }))}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition ${
                              form.mkt_premium_metodo_pago === metodo.value
                                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                                : 'border-neutral-200 dark:border-white/10 hover:border-purple-300'
                            }`}
                          >
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                              form.mkt_premium_metodo_pago === metodo.value
                                ? 'bg-purple-600 text-white'
                                : 'bg-neutral-200 dark:bg-white/15 text-neutral-500 dark:text-white/50'
                            }`}>
                              {i + 1}
                            </span>
                            <span className="text-sm text-neutral-700 dark:text-white/80">{metodo.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Parcialidades — solo aplica cuando se difiere a comisiones */}
                    {form.mkt_premium_metodo_pago === 'comisiones' && (
                      <div className="space-y-2 sm:col-span-2">
                        <label className={`text-xs font-medium uppercase tracking-wide ${
                          form.plan_mkt_premium && !form.mkt_premium_parcialidades
                            ? 'text-red-500'
                            : 'text-neutral-500 dark:text-white/50'
                        }`}>
                          Número de parcialidades {form.plan_mkt_premium && !form.mkt_premium_parcialidades && '— requerido'}
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={12}
                          step={1}
                          value={form.mkt_premium_parcialidades}
                          onChange={e => { setForm(f => ({ ...f, mkt_premium_parcialidades: e.target.value })); setErrorValidacion(''); }}
                          placeholder="Ej. 3"
                          className={`w-full px-3 py-2.5 text-sm rounded-xl border bg-neutral-50 dark:bg-white/5 text-neutral-800 dark:text-white focus:outline-none focus:ring-2 ${
                            form.plan_mkt_premium && !form.mkt_premium_parcialidades
                              ? 'border-red-400 focus:ring-red-400'
                              : 'border-neutral-200 dark:border-white/10 focus:ring-purple-400'
                          }`}
                        />
                        <p className="text-xs text-neutral-400">En cuántas comisiones se va a diferir el cobro (1 a 12).</p>
                        {seleccionado.mkt_premium_parcialidades && (
                          <p className="text-xs text-neutral-400">Actual: {seleccionado.mkt_premium_parcialidades} parcialidades</p>
                        )}
                      </div>
                    )}

                    {/* Fecha inicio */}
                    <div className="space-y-2">
                      <label className={`text-xs font-medium uppercase tracking-wide ${
                        form.plan_mkt_premium && !form.mkt_premium_fecha_inicio
                          ? 'text-red-500'
                          : 'text-neutral-500 dark:text-white/50'
                      }`}>
                        Fecha de inicio {form.plan_mkt_premium && !form.mkt_premium_fecha_inicio && '— requerida'}
                      </label>
                      <input
                        type="date"
                        value={form.mkt_premium_fecha_inicio}
                        onChange={e => { setForm(f => ({ ...f, mkt_premium_fecha_inicio: e.target.value })); setErrorValidacion(''); }}
                        className={`w-full px-3 py-2.5 text-sm rounded-xl border bg-neutral-50 dark:bg-white/5 text-neutral-800 dark:text-white focus:outline-none focus:ring-2 ${
                          form.plan_mkt_premium && !form.mkt_premium_fecha_inicio
                            ? 'border-red-400 focus:ring-red-400'
                            : 'border-neutral-200 dark:border-white/10 focus:ring-purple-400'
                        }`}
                      />
                      {seleccionado.mkt_premium_fecha_inicio && (
                        <p className="text-xs text-neutral-400">Actual: {formatFecha(seleccionado.mkt_premium_fecha_inicio)}</p>
                      )}
                    </div>

                    {/* Fecha de pago */}
                    <div className="space-y-2">
                      <label className={`text-xs font-medium uppercase tracking-wide ${
                        form.plan_mkt_premium && !form.mkt_premium_fecha_pago
                          ? 'text-red-500'
                          : 'text-neutral-500 dark:text-white/50'
                      }`}>
                        Fecha de pago / renovación {form.plan_mkt_premium && !form.mkt_premium_fecha_pago && '— requerida'}
                      </label>
                      <input
                        type="date"
                        value={form.mkt_premium_fecha_pago}
                        onChange={e => { setForm(f => ({ ...f, mkt_premium_fecha_pago: e.target.value })); setErrorValidacion(''); }}
                        className={`w-full px-3 py-2.5 text-sm rounded-xl border bg-neutral-50 dark:bg-white/5 text-neutral-800 dark:text-white focus:outline-none focus:ring-2 ${
                          form.plan_mkt_premium && !form.mkt_premium_fecha_pago
                            ? 'border-red-400 focus:ring-red-400'
                            : 'border-neutral-200 dark:border-white/10 focus:ring-purple-400'
                        }`}
                      />
                      {seleccionado.mkt_premium_fecha_pago && (
                        <p className="text-xs text-neutral-400">Actual: {formatFecha(seleccionado.mkt_premium_fecha_pago)}</p>
                      )}
                    </div>
                  </div>

                  {/* Guardar */}
                  <div className="space-y-2 pt-2">
                    {errorValidacion && (
                      <p className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 font-medium">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        {errorValidacion}
                      </p>
                    )}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={guardar}
                        disabled={guardando}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition disabled:opacity-60"
                      >
                        <Save className="w-4 h-4" />
                        {guardando ? 'Guardando…' : 'Guardar cambios'}
                      </button>
                      {guardado && (
                        <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                          <CheckCircle className="w-4 h-4" /> Guardado
                        </span>
                      )}
                    </div>
                    {triggerToast && (
                      <div className={`mt-2 px-3 py-2 rounded-lg text-sm font-medium ${
                        triggerToast.type === 'success'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                          : 'bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300'
                      }`}>
                        {triggerToast.message}
                      </div>
                    )}
                  </div>

                  {/* Historial de Trámites de cargo */}
                  <div className="pt-6 border-t border-neutral-200 dark:border-white/8 space-y-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-purple-600" />
                      <p className="text-sm font-semibold text-neutral-800 dark:text-white flex-1">Historial de Trámites</p>
                      <button
                        onClick={generarTramiteManual}
                        disabled={generandoTramite}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition disabled:opacity-60"
                      >
                        {generandoTramite ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                        {generandoTramite ? 'Generando…' : 'Generar trámite'}
                      </button>
                    </div>
                    {cargandoTramites ? (
                      <p className="text-xs text-neutral-400">Cargando…</p>
                    ) : tramitesAgente.length === 0 ? (
                      <p className="text-xs text-neutral-400">Sin trámites generados para este agente.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {tramitesAgente.map(t => (
                          <div
                            key={t.id}
                            className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-white/10"
                          >
                            <button
                              onClick={() => navigate(`/tramites/${t.id}`)}
                              className="min-w-0 flex-1 text-left hover:opacity-75 transition"
                            >
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">{t.folio}</span>
                                <span className="text-xs text-neutral-500 dark:text-white/50 truncate">{t.tipo_label}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-neutral-400">{formatFecha(t.created_at)}</span>
                                {t.custom_estatus_label && (
                                  <span className="text-xs px-1.5 py-0.5 rounded-md bg-neutral-100 dark:bg-white/10 text-neutral-600 dark:text-white/60">{t.custom_estatus_label}</span>
                                )}
                              </div>
                            </button>
                            <button
                              onClick={() => descargarPDFTramitePremium(t, seleccionado!)}
                              title="Descargar PDF"
                              className="p-1.5 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 text-neutral-400 hover:text-purple-600 transition shrink-0"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => navigate(`/tramites/${t.id}`)}
                              title="Abrir trámite"
                              className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/10 text-neutral-400 hover:text-neutral-600 transition shrink-0"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Contenido semanal de Publicidad */}
                  <div className="pt-6 border-t border-neutral-200 dark:border-white/8 space-y-3">
                    <div className="flex items-center gap-2">
                      <Megaphone className="w-4 h-4 text-purple-600" />
                      <p className="text-sm font-semibold text-neutral-800 dark:text-white">Contenido semanal (Publicidad)</p>
                    </div>
                    <p className="text-xs text-neutral-400">
                      Sube el diseño de esta semana para {seleccionado.nombre}. Aparecerá en su pestaña "Mis Diseños" de Publicidad.
                    </p>

                    <input
                      type="text"
                      value={tituloNuevoDiseno}
                      onChange={e => setTituloNuevoDiseno(e.target.value)}
                      placeholder="Título (opcional, ej. Semana del 4 de agosto)"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-neutral-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />

                    {archivoPendiente && previewPendienteUrl ? (
                      <div className="rounded-xl border-2 border-purple-300 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10 p-3 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-16 h-16 rounded-lg overflow-hidden bg-neutral-200 dark:bg-white/10 shrink-0 flex items-center justify-center">
                            {archivoPendiente.type.startsWith('video/') ? (
                              <video src={previewPendienteUrl} className="w-full h-full object-cover" muted />
                            ) : (
                              <img src={previewPendienteUrl} alt="" className="w-full h-full object-cover" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-neutral-800 dark:text-white truncate">{archivoPendiente.name}</p>
                            <p className="text-xs text-neutral-400">{(archivoPendiente.size / 1024 / 1024).toFixed(1)} MB · confirma para subirlo</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={confirmarSubidaPendiente}
                            disabled={subiendoDiseno}
                            className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition disabled:opacity-60"
                          >
                            {subiendoDiseno ? (
                              <><Loader2 className="w-4 h-4 animate-spin" /> Subiendo...</>
                            ) : (
                              <><CheckCircle className="w-4 h-4" /> Confirmar subida</>
                            )}
                          </button>
                          <button
                            onClick={cancelarArchivoPendiente}
                            disabled={subiendoDiseno}
                            className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 text-sm text-neutral-600 dark:text-white/60 hover:bg-neutral-100 dark:hover:bg-white/5 transition disabled:opacity-60"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label
                        onDragOver={e => { e.preventDefault(); setArrastrandoDiseno(true); }}
                        onDragLeave={e => { e.preventDefault(); setArrastrandoDiseno(false); }}
                        onDrop={e => {
                          e.preventDefault();
                          setArrastrandoDiseno(false);
                          const file = e.dataTransfer.files?.[0];
                          if (file) seleccionarArchivoPendiente(file);
                        }}
                        className={`flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-xl border-2 border-dashed cursor-pointer text-sm font-medium transition ${
                          arrastrandoDiseno
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700'
                            : 'border-purple-300 dark:border-purple-800 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/10'
                        }`}
                      >
                        <Upload className="w-4 h-4" /> {arrastrandoDiseno ? 'Suelta aquí' : 'Subir imagen o video (o arrástralo aquí)'}
                        <input
                          type="file"
                          accept="image/*,video/*"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) seleccionarArchivoPendiente(file);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    )}

                    {errorDiseno && (
                      <p className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 font-medium">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        {errorDiseno}
                      </p>
                    )}
                    {avisoDiseno && (
                      <p className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 font-medium">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        {avisoDiseno}
                      </p>
                    )}

                    {cargandoDisenos ? (
                      <LoadingState text="Cargando contenido..." compact />
                    ) : disenosAgente.length === 0 ? (
                      <p className="text-xs text-neutral-400 text-center py-3">Aún no se ha subido contenido para este agente</p>
                    ) : (
                      <div className="space-y-2">
                        {disenosAgente.map(d => (
                          <div key={d.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-neutral-200 dark:border-white/10">
                            <div className="w-11 h-11 rounded-lg bg-neutral-100 dark:bg-white/5 overflow-hidden shrink-0 flex items-center justify-center">
                              {d.tipo === 'video' ? (
                                <VideoIcon className="w-4 h-4 text-neutral-400" />
                              ) : d.thumbnail_url ? (
                                <img src={d.thumbnail_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <ImageIcon className="w-4 h-4 text-neutral-400" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-neutral-700 dark:text-white/80 truncate">{d.titulo || 'Sin título'}</p>
                              <p className="text-xs text-neutral-400">{formatFecha(d.created_at)}</p>
                            </div>
                            <button
                              onClick={() => eliminarDisenoAgente(d.id)}
                              className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all shrink-0"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>

    {mostrarNuevoAgente && (
      <UserModal
        user={null}
        lockRoleToAgente
        onClose={() => setMostrarNuevoAgente(false)}
        onSave={() => { setMostrarNuevoAgente(false); cargarAgentes(); }}
      />
    )}
    </>
  );
}

interface MktTriggerRow {
  id: string;
  nombre: string;
  evento_id: string;
  ticket_tipo_id: string;
  descripcion_template: string;
  metodo_pago_filtro: string[] | null;
  activo: boolean;
}
interface MktEventoRow { id: string; key: string; nombre: string; }
interface MktTicketTipoRow { id: string; nombre: string; value: string; }

const METODO_PAGO_PREMIUM_OPCIONES: { value: string; label: string }[] = [
  { value: 'deposito_jiro', label: 'Depósito a cuenta Jiro' },
  { value: 'bono_anual', label: 'Descuento de bono anual' },
  { value: 'comisiones', label: 'Descuento a comisiones' },
];

// Campos que se autollenan solos (mismo criterio que el TriggersPanel de Store)
const SISTEMA_KEYS_AUTOMATICOS_PREMIUM = ['area', 'equipo', 'fecha_creacion', 'fecha_finalizacion', 'creado_por', 'estatus', 'asignado_a'];

function MktPremiumTriggersPanel() {
  const [triggers, setTriggers] = useState<MktTriggerRow[]>([]);
  const [eventosList, setEventosList] = useState<MktEventoRow[]>([]);
  const [tiposList, setTiposList] = useState<MktTicketTipoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<MktTriggerRow | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [eventoId, setEventoId] = useState('');
  const [ticketTipoId, setTicketTipoId] = useState('');
  const [descripcionTemplate, setDescripcionTemplate] = useState('');
  const [activoTrigger, setActivoTrigger] = useState(true);
  const [metodoPagoFiltro, setMetodoPagoFiltro] = useState<string[]>([]);
  const [camposTipo, setCamposTipo] = useState<{ id: string; label: string; tipo: string }[]>([]);
  const [mapeoCampos, setMapeoCampos] = useState<Record<string, { fuente: 'vacio' | 'template'; valor_template: string }>>({});

  useEffect(() => {
    if (!ticketTipoId) { setCamposTipo([]); return; }
    obtenerCamposTramiteTipo(ticketTipoId).then(data => {
      setCamposTipo((data ?? [])
        .filter((c: any) => !SISTEMA_KEYS_AUTOMATICOS_PREMIUM.includes(c.sistema_key ?? ''))
        .map((c: any) => ({ id: c.id, label: c.label, tipo: c.tipo })));
    });
  }, [ticketTipoId]);

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    const [triggersRes, eventosRes, tiposRes] = await Promise.all([
      supabase.from('mkt_premium_triggers').select('*').order('created_at'),
      supabase.from('mkt_premium_eventos').select('id, key, nombre').eq('activo', true).order('orden'),
      supabase.from('ticket_tipos').select('id, nombre:label, value').eq('activo', true).order('label'),
    ]);
    setTriggers(triggersRes.data ?? []);
    setEventosList(eventosRes.data ?? []);
    setTiposList(tiposRes.data ?? []);
    setLoading(false);
  };

  const abrirFormNuevo = () => {
    setEditando(null);
    setNombre('');
    setEventoId(eventosList[0]?.id ?? '');
    setTicketTipoId(tiposList[0]?.id ?? '');
    setDescripcionTemplate('Marketing Premium — {{evento}} para {{nombre_completo}}.');
    setActivoTrigger(true);
    setMetodoPagoFiltro([]);
    setMapeoCampos({});
    setShowForm(true);
  };

  const abrirFormEditar = async (t: MktTriggerRow) => {
    setEditando(t);
    setNombre(t.nombre);
    setEventoId(t.evento_id);
    setTicketTipoId(t.ticket_tipo_id);
    setDescripcionTemplate(t.descripcion_template);
    setActivoTrigger(t.activo);
    setMetodoPagoFiltro(t.metodo_pago_filtro ?? []);
    const mapeoExistente = await obtenerMapeoCamposTriggerPremium(t.id);
    const mapeoRecord: Record<string, { fuente: 'vacio' | 'template'; valor_template: string }> = {};
    mapeoExistente.forEach(m => {
      mapeoRecord[m.campo_id] = { fuente: m.fuente, valor_template: m.valor_template ?? '' };
    });
    setMapeoCampos(mapeoRecord);
    setShowForm(true);
  };

  const guardar = async () => {
    if (!nombre.trim() || !eventoId || !ticketTipoId) return;
    setGuardando(true);
    const payload = {
      nombre: nombre.trim(),
      evento_id: eventoId,
      ticket_tipo_id: ticketTipoId,
      descripcion_template: descripcionTemplate,
      activo: activoTrigger,
      metodo_pago_filtro: metodoPagoFiltro.length > 0 ? metodoPagoFiltro : null,
    };
    let triggerId = editando?.id ?? null;
    if (editando) {
      await supabase.from('mkt_premium_triggers').update(payload).eq('id', editando.id);
    } else {
      const { data: nuevoTrigger } = await supabase.from('mkt_premium_triggers').insert(payload).select().single();
      triggerId = nuevoTrigger?.id ?? null;
    }
    if (triggerId) {
      for (const campo of camposTipo) {
        const m = mapeoCampos[campo.id];
        await guardarMapeoCampoTriggerPremium({
          trigger_id: triggerId,
          campo_id: campo.id,
          fuente: m?.fuente ?? 'vacio',
          valor_template: m?.valor_template || null,
        });
      }
    }
    setGuardando(false);
    setShowForm(false);
    await cargar();
  };

  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar este trigger?')) return;
    await supabase.from('mkt_premium_triggers').delete().eq('id', id);
    await cargar();
  };

  const toggleActivo = async (t: MktTriggerRow) => {
    await supabase.from('mkt_premium_triggers').update({ activo: !t.activo }).eq('id', t.id);
    await cargar();
  };

  const getNombreEvento = (id: string) => eventosList.find(e => e.id === id)?.nombre ?? id;
  const getNombreTipo = (id: string) => tiposList.find(t => t.id === id)?.nombre ?? id;

  if (loading) return <LoadingState text="Cargando reglas..." compact />;

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Reglas automáticas</h2>
          <p className="text-sm text-neutral-500 dark:text-white/50 mt-1">
            Cuando pasa un evento en el Marketing Premium de un agente (activación, cambio de método de pago, etc.), se crea automáticamente el trámite que configures aquí.
          </p>
        </div>
        <button
          onClick={abrirFormNuevo}
          className="flex items-center gap-2 bg-purple-600 text-white px-5 py-2.5 rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm shadow-sm whitespace-nowrap"
        >
          <Plus className="w-4 h-4" /><span className="ml-1">Nueva regla</span>
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10 p-6 mb-6">
          <h3 className="font-semibold text-neutral-900 dark:text-white mb-4">
            {editando ? 'Editar regla' : 'Nueva regla'}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">Nombre de la regla</label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej: Cobro al activar premium"
                className="w-full px-3 py-2 border border-neutral-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-neutral-900 dark:text-white text-sm"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">Cuando ocurre el evento</label>
                <select
                  value={eventoId}
                  onChange={e => setEventoId(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-neutral-900 dark:text-white text-sm"
                >
                  <option value="">Selecciona evento...</option>
                  {eventosList.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">Crea trámite de tipo</label>
                <select
                  value={ticketTipoId}
                  onChange={e => setTicketTipoId(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-neutral-900 dark:text-white text-sm"
                >
                  <option value="">Selecciona tipo...</option>
                  {tiposList.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">
                Y el método de pago es <span className="text-neutral-400 font-normal">(opcional, elige varios)</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {METODO_PAGO_PREMIUM_OPCIONES.map(m => {
                  const checked = metodoPagoFiltro.includes(m.value);
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setMetodoPagoFiltro(prev => checked ? prev.filter(x => x !== m.value) : [...prev, m.value])}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        checked
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white dark:bg-white/5 text-neutral-600 dark:text-white/60 border-neutral-300 dark:border-white/10 hover:border-purple-400'
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-neutral-500 dark:text-white/50 mt-1.5">
                Sin ninguno seleccionado = cualquier método de pago.
              </p>
            </div>

            {camposTipo.length > 0 && (
              <div className="border border-neutral-200 dark:border-white/10 rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium text-neutral-700 dark:text-white/70">
                  Autollenado de campos del formulario
                </p>
                <p className="text-xs text-neutral-500 dark:text-white/50">
                  Elige de dónde sale el valor de cada campo al crearse el trámite. Los campos sin autollenado quedan vacíos para que el equipo los complete manualmente.
                </p>
                {camposTipo.map(campo => {
                  const m = mapeoCampos[campo.id] ?? { fuente: 'vacio' as const, valor_template: '' };
                  return (
                    <div key={campo.id} className="border-t border-neutral-100 dark:border-white/5 pt-3 first:border-t-0 first:pt-0">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-neutral-800 dark:text-white/80 flex-1 min-w-0 truncate">{campo.label}</span>
                        <select
                          value={m.fuente}
                          onChange={e => setMapeoCampos(prev => ({
                            ...prev,
                            [campo.id]: { fuente: e.target.value as 'vacio' | 'template', valor_template: prev[campo.id]?.valor_template ?? '' },
                          }))}
                          className="px-2.5 py-1.5 text-xs border border-neutral-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-neutral-900 dark:text-white shrink-0"
                        >
                          <option value="vacio">No autollenar</option>
                          <option value="template">Plantilla de texto</option>
                        </select>
                      </div>
                      {m.fuente === 'template' && (
                        <div className="mt-2 space-y-1.5">
                          <input
                            type="text"
                            value={m.valor_template}
                            onChange={e => setMapeoCampos(prev => ({ ...prev, [campo.id]: { fuente: 'template', valor_template: e.target.value } }))}
                            placeholder="Ej: {{nombre_completo}} — plan {{plan}}"
                            className="w-full px-2.5 py-1.5 text-xs border border-neutral-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-neutral-900 dark:text-white"
                          />
                          <div className="flex flex-wrap gap-1">
                            {PLACEHOLDERS_TRIGGER_PREMIUM.map(p => (
                              <button
                                key={p.key}
                                type="button"
                                title={p.label}
                                onClick={() => setMapeoCampos(prev => ({
                                  ...prev,
                                  [campo.id]: { fuente: 'template', valor_template: `${prev[campo.id]?.valor_template ?? ''}${p.key}` },
                                }))}
                                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-white/10 text-neutral-600 dark:text-white/60 hover:bg-neutral-200 dark:hover:bg-white/20"
                              >
                                {p.key}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">Plantilla de descripción</label>
              <textarea
                value={descripcionTemplate}
                onChange={e => setDescripcionTemplate(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-neutral-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-neutral-900 dark:text-white text-sm resize-none"
              />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {PLACEHOLDERS_TRIGGER_PREMIUM.map(p => (
                  <button
                    key={p.key}
                    type="button"
                    title={p.label}
                    onClick={() => setDescripcionTemplate(prev => `${prev}${p.key}`)}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-white/10 text-neutral-600 dark:text-white/60 hover:bg-neutral-200 dark:hover:bg-white/20"
                  >
                    {p.key}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="mkt-trigger-activo-chk"
                checked={activoTrigger}
                onChange={e => setActivoTrigger(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded"
              />
              <label htmlFor="mkt-trigger-activo-chk" className="text-sm text-neutral-700 dark:text-white/70">Regla activa</label>
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button
              onClick={guardar}
              disabled={guardando || !nombre.trim() || !eventoId || !ticketTipoId}
              className="bg-purple-600 text-white px-5 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : editando ? 'Actualizar' : 'Crear'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="bg-neutral-100 dark:bg-white/10 text-neutral-700 dark:text-white/70 px-5 py-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-white/15 transition-colors text-sm font-medium"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {triggers.length === 0 ? (
        <div className="text-center py-12 text-neutral-400">No hay reglas configuradas. Crea una para empezar.</div>
      ) : (
        <div className="space-y-3">
          {triggers.map(trigger => (
            <div
              key={trigger.id}
              className={`flex items-center justify-between bg-white dark:bg-white/5 rounded-xl border px-5 py-4 ${trigger.activo ? 'border-neutral-200 dark:border-white/10' : 'border-neutral-100 dark:border-white/5 opacity-60'}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className={`w-4 h-4 flex-shrink-0 ${trigger.activo ? 'text-yellow-500' : 'text-neutral-400'}`} />
                  <span className="font-medium text-neutral-900 dark:text-white truncate">{trigger.nombre}</span>
                  {!trigger.activo && (
                    <span className="text-xs bg-neutral-100 dark:bg-white/10 text-neutral-500 px-2 py-0.5 rounded-full">Inactivo</span>
                  )}
                </div>
                <div className="text-xs text-neutral-500 dark:text-white/50">
                  Evento: <strong>{getNombreEvento(trigger.evento_id)}</strong> &middot; Trámite: <strong>{getNombreTipo(trigger.ticket_tipo_id)}</strong>
                  {!!trigger.metodo_pago_filtro?.length && (
                    <> &middot; Método: <strong>{trigger.metodo_pago_filtro.map(v => METODO_PAGO_PREMIUM_OPCIONES.find(o => o.value === v)?.label ?? v).join(', ')}</strong></>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                <button
                  onClick={() => toggleActivo(trigger)}
                  className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors"
                >
                  {trigger.activo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => abrirFormEditar(trigger)}
                  className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => eliminar(trigger.id)}
                  className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
