// ============================================================================
// /admin/altas — Panel interno de altas de agentes (/alta).
// Lista, filtra por estado, muestra el detalle (datos, documentos, verificación,
// firma, bitácora) y permite ASIGNAR OFICINA (la oficina la asigna el equipo,
// no el agente). Solo Administrador. Lectura/escritura vía RLS de admin.
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  Loader as Loader2, RefreshCw, ChevronDown, ChevronRight, Check, Building2,
  FileText, ShieldCheck, PenLine, Clock,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

type Estado =
  | 'draft' | 'in_progress' | 'identity_pending' | 'signature_pending'
  | 'awaiting_review' | 'approved' | 'rejected' | 'completed'
  | 'needs_retry' | 'resume_later' | 'human_review' | 'incomplete';

interface Alta {
  id: string; folio: string | null; tipo_agente: string | null; estado: Estado;
  nombre: string | null; apellidos: string | null; email: string | null; whatsapp: string | null;
  rfc: string | null; cedula: string | null; oficina_id: string | null; usuario_id: string | null;
  revision_notas: string | null; created_at: string; completed_at: string | null;
  banco: string | null; clabe: string | null; poliza_rc_numero: string | null; poliza_rc_aseguradora: string | null;
}

interface Oficina { id: string; nombre: string; }

const ESTADO_META: Record<Estado, { label: string; cls: string }> = {
  draft: { label: 'Borrador', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
  in_progress: { label: 'En captura', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  identity_pending: { label: 'Verificando identidad', cls: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' },
  signature_pending: { label: 'Esperando firma', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' },
  awaiting_review: { label: 'En revisión', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  approved: { label: 'Aprobado', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  rejected: { label: 'Rechazado', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  completed: { label: 'Completado', cls: 'bg-emerald-600 text-white' },
  needs_retry: { label: 'Requiere reintento', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  resume_later: { label: 'Retomar después', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
  human_review: { label: 'Revisión humana', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
  incomplete: { label: 'Incompleta / abandono', cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
};

const FILTROS: { key: string; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'in_progress', label: 'En captura' },
  { key: 'identity_pending', label: 'Identidad' },
  { key: 'signature_pending', label: 'Firma' },
  { key: 'needs_retry', label: 'Reintento' },
  { key: 'human_review', label: 'Revisión humana' },
  { key: 'incomplete', label: 'Abandonos' },
  { key: 'completed', label: 'Completadas' },
];

function Badge({ estado }: { estado: Estado }) {
  const m = ESTADO_META[estado] || ESTADO_META.draft;
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${m.cls}`}>{m.label}</span>;
}

export default function AdminAltas() {
  const [altas, setAltas] = useState<Alta[]>([]);
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todas');
  const [expandida, setExpandida] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    const [{ data: a }, { data: o }] = await Promise.all([
      supabase.from('alta_agente').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('oficinas').select('id, nombre').eq('activa', true).order('nombre'),
    ]);
    setAltas((a as Alta[]) || []);
    setOficinas((o as Oficina[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const mostrarToast = (msg: string, tipo: 'ok' | 'error' = 'ok') => {
    setToast({ msg, tipo }); setTimeout(() => setToast(null), 4000);
  };

  const visibles = filtro === 'todas' ? altas : altas.filter((a) => a.estado === filtro);
  const conteo = (k: string) => (k === 'todas' ? altas.length : altas.filter((a) => a.estado === k).length);

  async function asignarOficina(alta: Alta, oficinaId: string) {
    const { error } = await supabase.from('alta_agente').update({ oficina_id: oficinaId || null }).eq('id', alta.id);
    if (error) { mostrarToast('No se pudo asignar la oficina', 'error'); return; }
    // Si ya existe el usuario Agente, propagar la oficina a su perfil.
    if (alta.usuario_id) {
      await supabase.from('usuarios').update({ oficina_id: oficinaId || null }).eq('id', alta.usuario_id);
    }
    setAltas((prev) => prev.map((x) => (x.id === alta.id ? { ...x, oficina_id: oficinaId || null } : x)));
    mostrarToast('Oficina asignada');
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Altas de agentes</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Onboarding vía <code>/alta</code>. Asigna oficina y da seguimiento.</p>
        </div>
        <button onClick={cargar} className="ml-auto flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button key={f.key} onClick={() => setFiltro(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              filtro === f.key ? 'bg-[#164281] text-white border-[#164281]' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}>
            {f.label} <span className="opacity-60">({conteo(f.key)})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-[#164281]" /></div>
      ) : visibles.length === 0 ? (
        <div className="text-center py-16 text-sm text-gray-400">No hay altas en este filtro.</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700/50">
          {visibles.map((a) => (
            <div key={a.id}>
              <button onClick={() => setExpandida(expandida === a.id ? null : a.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40">
                {expandida === a.id ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white truncate">{a.nombre || '—'} {a.apellidos || ''}</span>
                    <span className="text-[11px] text-gray-400">{a.tipo_agente === 'con_cedula' ? 'Con cédula' : a.tipo_agente === 'en_desarrollo' ? 'En desarrollo' : ''}</span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{a.email || ''} {a.whatsapp ? `· ${a.whatsapp}` : ''} · <span className="font-mono">{a.folio}</span></div>
                </div>
                {!a.oficina_id && (a.estado === 'completed' || a.estado === 'approved') && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 shrink-0">Falta oficina</span>
                )}
                <Badge estado={a.estado} />
              </button>
              {expandida === a.id && <Detalle alta={a} oficinas={oficinas} onAsignar={asignarOficina} />}
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-lg text-sm text-white shadow-lg ${toast.tipo === 'ok' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function Detalle({ alta, oficinas, onAsignar }: { alta: Alta; oficinas: Oficina[]; onAsignar: (a: Alta, oficinaId: string) => void }) {
  const [docs, setDocs] = useState<{ tipo_documento: string; nombre_archivo: string }[]>([]);
  const [verif, setVerif] = useState<string>('—');
  const [firma, setFirma] = useState<string>('—');
  const [bitacora, setBitacora] = useState<{ evento: string; created_at: string }[]>([]);
  const [oficinaSel, setOficinaSel] = useState(alta.oficina_id || '');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      const [d, v, f, b] = await Promise.all([
        supabase.from('alta_agente_documento').select('tipo_documento, nombre_archivo').eq('alta_id', alta.id),
        supabase.from('alta_agente_verificacion').select('estado').eq('alta_id', alta.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('alta_agente_firma').select('estado').eq('alta_id', alta.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('alta_agente_bitacora').select('evento, created_at').eq('alta_id', alta.id).order('created_at', { ascending: false }).limit(12),
      ]);
      setDocs((d.data as { tipo_documento: string; nombre_archivo: string }[]) || []);
      setVerif((v.data as { estado?: string } | null)?.estado || '—');
      setFirma((f.data as { estado?: string } | null)?.estado || '—');
      setBitacora((b.data as { evento: string; created_at: string }[]) || []);
      setCargando(false);
    })();
  }, [alta.id]);

  return (
    <div className="px-4 pb-4 pt-1 bg-gray-50/60 dark:bg-gray-900/30 grid md:grid-cols-2 gap-5">
      {/* Datos + acciones */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <Dato k="RFC" v={alta.rfc} />
          <Dato k="Cédula" v={alta.cedula} />
          <Dato k="Banco" v={alta.banco} />
          <Dato k="CLABE" v={alta.clabe} />
          <Dato k="Póliza RC" v={alta.poliza_rc_numero} />
          <Dato k="Aseguradora RC" v={alta.poliza_rc_aseguradora} />
          <Dato k="Usuario creado" v={alta.usuario_id ? 'Sí' : 'No'} />
          <Dato k="Completada" v={alta.completed_at ? new Date(alta.completed_at).toLocaleString('es-MX') : '—'} />
        </div>

        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1 text-gray-600 dark:text-gray-300"><ShieldCheck className="w-3.5 h-3.5" /> Identidad: <strong>{verif}</strong></span>
          <span className="flex items-center gap-1 text-gray-600 dark:text-gray-300"><PenLine className="w-3.5 h-3.5" /> Firma: <strong>{firma}</strong></span>
        </div>

        {/* Asignar oficina */}
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-gray-400" />
          <select value={oficinaSel} onChange={(e) => setOficinaSel(e.target.value)}
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100">
            <option value="">— Sin asignar —</option>
            {oficinas.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
          </select>
          <button onClick={() => onAsignar(alta, oficinaSel)} disabled={oficinaSel === (alta.oficina_id || '')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-40" style={{ background: '#164281' }}>
            <Check className="w-4 h-4" /> Asignar
          </button>
        </div>
      </div>

      {/* Documentos + bitácora */}
      <div className="space-y-4">
        <div>
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Documentos ({docs.length})</h4>
          {cargando ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : (
            <div className="flex flex-wrap gap-1.5">
              {docs.length ? docs.map((d, i) => (
                <span key={i} className="text-[11px] px-2 py-0.5 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">{d.tipo_documento}</span>
              )) : <span className="text-xs text-gray-400">Sin documentos</span>}
            </div>
          )}
        </div>
        <div>
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Bitácora</h4>
          <ul className="space-y-1 max-h-40 overflow-y-auto">
            {bitacora.map((b, i) => (
              <li key={i} className="text-[11px] text-gray-500 dark:text-gray-400 flex justify-between gap-2">
                <span>{b.evento}</span>
                <span className="text-gray-300 dark:text-gray-600 shrink-0">{new Date(b.created_at).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Dato({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-400">{k}</span>
      <span className="text-gray-700 dark:text-gray-200 text-right truncate">{v || '—'}</span>
    </div>
  );
}
