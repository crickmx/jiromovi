import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  Database, Upload, Download, Plus, Trash2, Search, CheckCircle2,
  XCircle, History, Building2, Users, Link2, ChevronDown, ChevronRight,
  AlertTriangle, FileSpreadsheet, RefreshCw, Edit2, Save, X,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Ramo         { id: string; nombre: string; activo: boolean }
interface Subramo      { id: string; nombre: string; ramo_id: string; activo: boolean }
interface Compania     { id: string; nombre: string; convenio: boolean; activo: boolean }
interface Combinacion  { id: string; compania_id: string; ramo_id: string; subramo_id: string; activo: boolean }

interface Despacho  { id: string; nombre: string; activo: boolean }
interface Gerencia  { id: string; nombre: string; despacho_id: string; activo: boolean }
interface Agente    { id: string; nombre: string; despacho_id: string; gerencia_id: string | null; activo: boolean; es_primario: boolean }

interface UsuarioMOVI { id: string; nombre: string; email: string }
interface MapeoUsuario {
  id: string; user_id: string; agente_id: string; activo: boolean;
  usuarios?: { nombre: string; email_laboral: string | null }
  maestro_agentes?: { nombre: string; origen?: string; maestro_despachos?: { nombre: string } }
}
interface MapeoPendiente {
  id: string; agente_id: string; user_id_propuesto: string; ticket_id: string | null; created_at: string;
  propuesto_por_usuario?: { nombre: string };
  maestro_agentes?: { nombre: string };
  usuarios?: { nombre: string; email_laboral: string | null };
}

interface Importacion {
  id: string; pestana: string; modo: string; nombre_archivo: string;
  total_filas: number; exitosas: number; omitidas: number;
  errores_json: { fila: number; error: string }[] | null;
  created_at: string;
  usuarios?: { nombre: string }
}

interface CodigoPostal { id: string; codigo: string; colonia: string; municipio: string; estado: string }

type TabId = 'catalogo' | 'vendedores' | 'mapeo' | 'historial' | 'codigos_postales'
type ImportMode = 'adicion' | 'reemplazo'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toast(msg: string, type: 'ok' | 'err' = 'ok') {
  const el = document.createElement('div');
  el.textContent = msg;
  el.className = `fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white
    ${type === 'ok' ? 'bg-green-600' : 'bg-red-600'} transition-opacity`;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 400); }, 3500);
}

const normalize = (s: string) => (s ?? '').trim();

// ─── Componente ───────────────────────────────────────────────────────────────

export default function BaseDatosMaestrosAdmin() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>('catalogo');

  // ── Catálogo ────────────────────────────────────────────────────────────────
  const [ramos, setRamos]             = useState<Ramo[]>([]);
  const [subramos, setSubramos]       = useState<Subramo[]>([]);
  const [companias, setCompanias]     = useState<Compania[]>([]);
  const [combinaciones, setCombinaciones] = useState<Combinacion[]>([]);
  const [loadingCat, setLoadingCat]   = useState(false);
  const [searchCat, setSearchCat]     = useState('');
  const [expandedRamos, setExpandedRamos] = useState<Set<string>>(new Set());

  // ── Vendedores ──────────────────────────────────────────────────────────────
  const [despachos, setDespachos] = useState<Despacho[]>([]);
  const [gerencias, setGerencias] = useState<Gerencia[]>([]);
  const [agentes, setAgentes]     = useState<Agente[]>([]);
  const [loadingVend, setLoadingVend] = useState(false);
  const [searchVend, setSearchVend]   = useState('');
  const [expandedDespachos, setExpandedDespachos] = useState<Set<string>>(new Set());
  const [vendGroupMode, setVendGroupMode] = useState<'despacho' | 'vendedor'>('despacho');
  const [editingRow, setEditingRow] = useState<{ table: string; id: string; nombre: string } | null>(null);

  // ── Mapeo ───────────────────────────────────────────────────────────────────
  const [mapeos, setMapeos]           = useState<MapeoUsuario[]>([]);
  const [usuariosMOVI, setUsuariosMOVI] = useState<UsuarioMOVI[]>([]);
  const [agentesList, setAgentesList] = useState<Agente[]>([]);
  const [loadingMapeo, setLoadingMapeo] = useState(false);
  const [searchMapeo, setSearchMapeo]   = useState('');
  const [newMapeoUserId,   setNewMapeoUserId]   = useState('');
  const [newMapeoAgenteId, setNewMapeoAgenteId] = useState('');
  const [savingMapeo, setSavingMapeo] = useState(false);
  const [mapeoMode, setMapeoMode] = useState<'sicas' | 'movi'>('sicas');
  const [newMapeoMOVIUserId, setNewMapeoMOVIUserId] = useState('');
  const [savingMapeoMOVI, setSavingMapeoMOVI] = useState(false);
  const [pendientesMapeo, setPendientesMapeo] = useState<MapeoPendiente[]>([]);
  const [loadingPendientes, setLoadingPendientes] = useState(false);

  // ── Import ──────────────────────────────────────────────────────────────────
  const [importMode, setImportMode]     = useState<ImportMode>('adicion');
  const [importLoading, setImportLoading] = useState(false);
  const [importTarget, setImportTarget] = useState<TabId>('catalogo');
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Historial ───────────────────────────────────────────────────────────────
  const [historial, setHistorial]     = useState<Importacion[]>([]);
  const [loadingHist, setLoadingHist] = useState(false);

  // ── Códigos Postales ────────────────────────────────────────────────────────
  const [codigosPostales, setCodigosPostales] = useState<CodigoPostal[]>([]);
  const [cpCount, setCpCount]                 = useState(0);
  const [loadingCP, setLoadingCP]             = useState(false);
  const [searchCP, setSearchCP]               = useState('');

  // ── Inline add forms ────────────────────────────────────────────────────────
  const [addRamoNombre,     setAddRamoNombre]     = useState('');
  const [addCompaniaNombre, setAddCompaniaNombre] = useState('');
  const [addCompaniaConvenio, setAddCompaniaConvenio] = useState(false);
  const [addDespachoNombre, setAddDespachoNombre] = useState('');
  const [showAddRamo,     setShowAddRamo]     = useState(false);
  const [showAddCompania, setShowAddCompania] = useState(false);
  const [showAddDespacho, setShowAddDespacho] = useState(false);

  // ─── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (usuario && usuario.rol !== 'Administrador') navigate('/');
  }, [usuario, navigate]);

  // ─── Carga inicial por tab ────────────────────────────────────────────────
  useEffect(() => {
    if (tab === 'catalogo')          loadCatalogo();
    if (tab === 'vendedores')        loadVendedores();
    if (tab === 'mapeo')             loadMapeo();
    if (tab === 'historial')         loadHistorial();
    if (tab === 'codigos_postales')  loadCodigosPostales();
  }, [tab]);

  // ─── Loaders ─────────────────────────────────────────────────────────────────

  async function loadCatalogo() {
    setLoadingCat(true);
    const [{ data: r }, { data: s }, { data: c }, { data: comb }] = await Promise.all([
      supabase.from('maestro_ramos').select('*').order('nombre'),
      supabase.from('maestro_subramos').select('*').order('nombre'),
      supabase.from('maestro_companias').select('*').order('nombre'),
      supabase.from('maestro_combinaciones').select('*'),
    ]);
    setRamos(r ?? []);
    setSubramos(s ?? []);
    setCompanias(c ?? []);
    setCombinaciones(comb ?? []);
    setLoadingCat(false);
  }

  async function loadVendedores() {
    setLoadingVend(true);
    const [{ data: d }, { data: g }, { data: a }] = await Promise.all([
      supabase.from('maestro_despachos').select('*').order('nombre'),
      supabase.from('maestro_gerencias').select('*').order('nombre'),
      supabase.from('maestro_agentes').select('*').order('nombre'),
    ]);
    setDespachos(d ?? []);
    setGerencias(g ?? []);
    setAgentes(a ?? []);
    setLoadingVend(false);
  }

  async function loadMapeo() {
    setLoadingMapeo(true);
    setLoadingPendientes(true);
    const [{ data: m }, { data: u }, { data: a }, { data: p }] = await Promise.all([
      supabase.from('maestro_usuario_agente')
        .select('*, usuarios(nombre, email_laboral), maestro_agentes(nombre, origen, maestro_despachos(nombre))')
        .order('created_at', { ascending: false }),
      supabase.from('usuarios').select('id, nombre, email_laboral').order('nombre'),
      supabase.from('maestro_agentes').select('*').eq('activo', true).order('nombre'),
      supabase.from('maestro_mapeo_pendiente')
        .select('*, maestro_agentes(nombre), usuarios!maestro_mapeo_pendiente_user_id_propuesto_fkey(nombre, email_laboral), propuesto_por_usuario:usuarios!maestro_mapeo_pendiente_propuesto_por_fkey(nombre)')
        .order('created_at', { ascending: false }),
    ]);
    setMapeos(m ?? []);
    setUsuariosMOVI((u ?? []).map((x: any) => ({ id: x.id, nombre: x.nombre, email: x.email_laboral ?? '' })));
    setAgentesList(a ?? []);
    setPendientesMapeo(p ?? []);
    setLoadingMapeo(false);
    setLoadingPendientes(false);
  }

  async function loadHistorial() {
    setLoadingHist(true);
    const { data } = await supabase.from('maestro_importaciones')
      .select('*, usuarios(nombre)').order('created_at', { ascending: false }).limit(50);
    setHistorial(data ?? []);
    setLoadingHist(false);
  }

  async function loadCodigosPostales() {
    setLoadingCP(true);
    const [{ count }, { data }] = await Promise.all([
      supabase.from('codigos_postales').select('*', { count: 'exact', head: true }),
      supabase.from('codigos_postales').select('*').order('codigo').limit(100),
    ]);
    setCpCount(count ?? 0);
    setCodigosPostales(data ?? []);
    setLoadingCP(false);
  }

  // ─── CRUD manual ─────────────────────────────────────────────────────────────

  async function addRamo() {
    const n = normalize(addRamoNombre); if (!n) return;
    const { error } = await supabase.from('maestro_ramos').insert({ nombre: n });
    if (error) { toast('Error: ' + error.message, 'err'); return; }
    toast('Ramo agregado'); setAddRamoNombre(''); setShowAddRamo(false); loadCatalogo();
  }

  async function addCompania() {
    const n = normalize(addCompaniaNombre); if (!n) return;
    const { error } = await supabase.from('maestro_companias').insert({ nombre: n, convenio: addCompaniaConvenio });
    if (error) { toast('Error: ' + error.message, 'err'); return; }
    toast('Compañía agregada'); setAddCompaniaNombre(''); setAddCompaniaConvenio(false); setShowAddCompania(false); loadCatalogo();
  }

  async function addDespacho() {
    const n = normalize(addDespachoNombre); if (!n) return;
    const { error } = await supabase.from('maestro_despachos').insert({ nombre: n });
    if (error) { toast('Error: ' + error.message, 'err'); return; }
    toast('Despacho agregado'); setAddDespachoNombre(''); setShowAddDespacho(false); loadVendedores();
  }

  async function toggleActivo(table: string, id: string, current: boolean, reload: () => void) {
    const { error } = await supabase.from(table).update({ activo: !current }).eq('id', id);
    if (error) { toast('Error: ' + error.message, 'err'); return; }
    reload();
  }

  async function saveEditRow() {
    if (!editingRow) return;
    const n = normalize(editingRow.nombre);
    if (!n) { toast('El nombre no puede estar vacío', 'err'); return; }
    const { error } = await supabase.from(editingRow.table).update({ nombre: n }).eq('id', editingRow.id);
    if (error) { toast('Error: ' + error.message, 'err'); return; }
    toast('Actualizado');
    setEditingRow(null);
    const isVend = ['maestro_agentes', 'maestro_gerencias', 'maestro_despachos'].includes(editingRow.table);
    if (isVend) loadVendedores(); else loadCatalogo();
  }

  async function deleteRow(table: string, id: string, reload: () => void) {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) {
      if (error.code === '23503') toast('No se puede eliminar: tiene registros vinculados', 'err');
      else toast('Error: ' + error.message, 'err');
      return;
    }
    toast('Eliminado');
    reload();
  }

  async function setPrimario(agenteId: string, agenteNombre: string) {
    const { error: e1 } = await supabase.from('maestro_agentes').update({ es_primario: false }).eq('nombre', agenteNombre);
    if (e1) { toast('Error: ' + e1.message, 'err'); return; }
    const { error: e2 } = await supabase.from('maestro_agentes').update({ es_primario: true }).eq('id', agenteId);
    if (e2) { toast('Error: ' + e2.message, 'err'); return; }
    toast('Oficina principal actualizada');
    loadVendedores();
  }

  async function addMapeo() {
    if (!newMapeoUserId || !newMapeoAgenteId) { toast('Selecciona usuario y agente', 'err'); return; }
    setSavingMapeo(true);
    const { error } = await supabase.from('maestro_usuario_agente')
      .upsert({ user_id: newMapeoUserId, agente_id: newMapeoAgenteId, activo: true }, { onConflict: 'user_id' });
    setSavingMapeo(false);
    if (error) { toast('Error: ' + error.message, 'err'); return; }
    toast('Mapeo guardado'); setNewMapeoUserId(''); setNewMapeoAgenteId(''); loadMapeo();
  }

  async function addMapeoMOVI() {
    if (!newMapeoMOVIUserId) { toast('Selecciona un usuario MOVI', 'err'); return; }
    const user = usuariosMOVI.find(u => u.id === newMapeoMOVIUserId);
    if (!user) return;
    setSavingMapeoMOVI(true);
    const { data: newAgente, error: e1 } = await supabase
      .from('maestro_agentes')
      .insert({ nombre: user.nombre, activo: true, origen: 'movi' })
      .select('id')
      .single();
    if (e1 || !newAgente) { toast('Error al crear agente: ' + (e1?.message ?? ''), 'err'); setSavingMapeoMOVI(false); return; }
    const { error: e2 } = await supabase
      .from('maestro_usuario_agente')
      .insert({ user_id: newMapeoMOVIUserId, agente_id: newAgente.id, activo: true });
    setSavingMapeoMOVI(false);
    if (e2) { toast('Error al crear mapeo: ' + e2.message, 'err'); return; }
    toast('Usuario MOVI agregado al catálogo de asignables');
    setNewMapeoMOVIUserId('');
    loadMapeo();
  }

  async function deleteMapeo(id: string) {
    if (!confirm('¿Eliminar este mapeo?')) return;
    const { error } = await supabase.from('maestro_usuario_agente').delete().eq('id', id);
    if (error) { toast('Error: ' + error.message, 'err'); return; }
    toast('Mapeo eliminado'); loadMapeo();
  }

  async function validarMapeo(pendiente: MapeoPendiente) {
    const { error: e1 } = await supabase.from('maestro_usuario_agente')
      .upsert({ agente_id: pendiente.agente_id, user_id: pendiente.user_id_propuesto, activo: true }, { onConflict: 'user_id' });
    if (e1) { toast('Error al validar: ' + e1.message, 'err'); return; }
    await supabase.from('maestro_mapeo_pendiente').delete().eq('id', pendiente.id);
    toast('Mapeo validado y activado');
    loadMapeo();
  }

  async function rechazarMapeo(id: string) {
    if (!confirm('¿Rechazar esta propuesta? Se eliminará sin crear el mapeo.')) return;
    await supabase.from('maestro_mapeo_pendiente').delete().eq('id', id);
    toast('Propuesta rechazada');
    loadMapeo();
  }

  // ─── EXPORTAR ────────────────────────────────────────────────────────────────

  function exportarPlantillaVacia() {
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['compania', 'ramo', 'subramo', 'convenio'],
    ]), 'catalogo');

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['vendedor', 'despacho', 'gerencia'],
    ]), 'vendedores');

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['vendedor', 'email_movi'],
    ]), 'mapeo');

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['codigo', 'colonia', 'municipio', 'estado'],
    ]), 'codigos_postales');

    XLSX.writeFile(wb, 'plantilla_catalogos_maestros.xlsx');
    toast('Plantilla descargada');
  }

  function exportarDatosActuales() {
    const wb = XLSX.utils.book_new();

    // Pestaña catalogo (desnormalizada: una fila por combinación)
    const catRows: any[][] = [['compania', 'ramo', 'subramo', 'convenio']];
    for (const comb of combinaciones.filter(c => c.activo)) {
      const comp = companias.find(x => x.id === comb.compania_id);
      const ramo = ramos.find(x => x.id === comb.ramo_id);
      const sub  = subramos.find(x => x.id === comb.subramo_id);
      if (comp && ramo && sub) {
        catRows.push([comp.nombre, ramo.nombre, sub.nombre, comp.convenio ? 'Sí' : 'No']);
      }
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(catRows), 'catalogo');

    // Pestaña vendedores
    const vendRows: any[][] = [['vendedor', 'despacho', 'gerencia']];
    for (const ag of agentes.filter(a => a.activo)) {
      const des = despachos.find(x => x.id === ag.despacho_id);
      const ger = gerencias.find(x => x.id === ag.gerencia_id);
      vendRows.push([ag.nombre, des?.nombre ?? '', ger?.nombre ?? '']);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(vendRows), 'vendedores');

    // Pestaña mapeo
    const mapRows: any[][] = [['vendedor', 'email_movi']];
    for (const m of mapeos.filter(x => x.activo)) {
      const ag   = (m.maestro_agentes as any)?.nombre ?? '';
      const mail = (m.usuarios as any)?.email_laboral ?? '';
      mapRows.push([ag, mail]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(mapRows), 'mapeo');

    XLSX.writeFile(wb, `catalogos_maestros_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast('Datos exportados');
  }

  // ─── IMPORTAR ────────────────────────────────────────────────────────────────

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file) return;
    setImportLoading(true);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });

      const pestanas: TabId[] = ['catalogo', 'vendedores', 'mapeo', 'codigos_postales'];
      const encontradas = pestanas.filter(p => wb.SheetNames.includes(p));

      if (encontradas.length === 0) {
        toast('El archivo no tiene pestañas válidas (catalogo, vendedores, mapeo)', 'err');
        setImportLoading(false);
        return;
      }

      let totalExitosas = 0;
      let totalOmitidas = 0;
      const errores: { fila: number; error: string }[] = [];

      for (const pestana of encontradas) {
        const ws   = wb.Sheets[pestana];
        const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: '' });

        if (rows.length === 0) continue;

        if (importMode === 'reemplazo' && pestana !== 'codigos_postales') {
          const { error } = await supabase.rpc('reemplazar_maestro_catalogo', { p_pestana: pestana });
          if (error) throw new Error(`Error al limpiar ${pestana}: ${error.message}`);
        }

        if (pestana === 'catalogo') {
          const res = await importarCatalogo(rows, importMode);
          totalExitosas += res.exitosas;
          totalOmitidas += res.omitidas;
          errores.push(...res.errores);
        }
        if (pestana === 'vendedores') {
          const res = await importarVendedores(rows, importMode);
          totalExitosas += res.exitosas;
          totalOmitidas += res.omitidas;
          errores.push(...res.errores);
        }
        if (pestana === 'mapeo') {
          const res = await importarMapeo(rows, importMode);
          totalExitosas += res.exitosas;
          totalOmitidas += res.omitidas;
          errores.push(...res.errores);
        }
        if (pestana === 'codigos_postales') {
          const res = await importarCodigosPostales(rows, importMode);
          totalExitosas += res.exitosas;
          totalOmitidas += res.omitidas;
          errores.push(...res.errores);
        }
      }

      // Guardar log
      await supabase.from('maestro_importaciones').insert({
        pestana: encontradas.join('+'),
        modo: importMode,
        nombre_archivo: file.name,
        total_filas: totalExitosas + totalOmitidas + errores.length,
        exitosas: totalExitosas,
        omitidas: totalOmitidas,
        errores_json: errores.length > 0 ? errores : null,
        importado_por: usuario!.id,
      });

      toast(`Importación completada: ${totalExitosas} filas, ${totalOmitidas} omitidas${errores.length > 0 ? `, ${errores.length} errores` : ''}`);

      // Recargar datos del tab actual
      if (tab === 'catalogo')          loadCatalogo();
      if (tab === 'vendedores')        loadVendedores();
      if (tab === 'mapeo')             loadMapeo();
      if (tab === 'codigos_postales')  loadCodigosPostales();

    } catch (err: any) {
      toast('Error durante la importación: ' + err.message, 'err');
    } finally {
      setImportLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [importMode, tab, usuario]);

  async function importarCatalogo(rows: any[], mode: ImportMode) {
    let exitosas = 0, omitidas = 0;
    const errores: { fila: number; error: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const compNombre = normalize(r.compania || r.Compania || r.COMPANIA);
      const ramoNombre = normalize(r.ramo || r.Ramo || r.RAMO);
      const subNombre  = normalize(r.subramo || r.Subramo || r.SUBRAMO);
      const convenio   = String(r.convenio || r.Convenio || '').toLowerCase() === 'sí' ||
                         String(r.convenio || r.Convenio || '').toLowerCase() === 'si';

      if (!compNombre || !ramoNombre || !subNombre) {
        errores.push({ fila: i + 2, error: 'Faltan campos requeridos (compania, ramo, subramo)' });
        continue;
      }

      try {
        // Upsert compañía
        const { data: comp } = await supabase.from('maestro_companias')
          .upsert({ nombre: compNombre, convenio }, { onConflict: 'nombre', ignoreDuplicates: mode === 'adicion' })
          .select('id').single();

        // Upsert ramo
        const { data: ramo } = await supabase.from('maestro_ramos')
          .upsert({ nombre: ramoNombre }, { onConflict: 'nombre', ignoreDuplicates: mode === 'adicion' })
          .select('id').single();

        // Upsert subramo
        const ramoId = ramo?.id ?? (await supabase.from('maestro_ramos').select('id').eq('nombre', ramoNombre).single()).data?.id;
        const { data: sub } = await supabase.from('maestro_subramos')
          .upsert({ nombre: subNombre, ramo_id: ramoId }, { onConflict: 'nombre,ramo_id', ignoreDuplicates: mode === 'adicion' })
          .select('id').single();

        const compId = comp?.id ?? (await supabase.from('maestro_companias').select('id').eq('nombre', compNombre).single()).data?.id;
        const subId  = sub?.id  ?? (await supabase.from('maestro_subramos').select('id').eq('nombre', subNombre).eq('ramo_id', ramoId).single()).data?.id;

        // Upsert combinación
        const { error: errComb } = await supabase.from('maestro_combinaciones')
          .upsert({ compania_id: compId, ramo_id: ramoId, subramo_id: subId },
            { onConflict: 'compania_id,ramo_id,subramo_id', ignoreDuplicates: mode === 'adicion' });

        if (errComb) throw new Error(errComb.message);
        exitosas++;
      } catch (e: any) {
        errores.push({ fila: i + 2, error: e.message });
      }
    }
    return { exitosas, omitidas, errores };
  }

  async function importarVendedores(rows: any[], mode: ImportMode) {
    let exitosas = 0, omitidas = 0;
    const errores: { fila: number; error: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const vendNombre = normalize(r.vendedor || r.Vendedor || r.VENDEDOR);
      const despNombre = normalize(r.despacho || r.Despacho || r.DESPACHO);
      const gerNombre  = normalize(r.gerencia || r.Gerencia || r.GERENCIA);

      if (!vendNombre || !despNombre) {
        errores.push({ fila: i + 2, error: 'Faltan campos requeridos (vendedor, despacho)' });
        continue;
      }

      try {
        // Upsert despacho
        const { data: desp } = await supabase.from('maestro_despachos')
          .upsert({ nombre: despNombre }, { onConflict: 'nombre', ignoreDuplicates: mode === 'adicion' })
          .select('id').single();
        const despId = desp?.id ?? (await supabase.from('maestro_despachos').select('id').eq('nombre', despNombre).single()).data?.id;

        // Upsert gerencia (opcional)
        let gerId: string | null = null;
        if (gerNombre) {
          const { data: ger } = await supabase.from('maestro_gerencias')
            .upsert({ nombre: gerNombre, despacho_id: despId }, { onConflict: 'nombre,despacho_id', ignoreDuplicates: mode === 'adicion' })
            .select('id').single();
          gerId = ger?.id ?? (await supabase.from('maestro_gerencias').select('id').eq('nombre', gerNombre).eq('despacho_id', despId).single()).data?.id ?? null;
        }

        // Upsert agente
        const { error: errAg } = await supabase.from('maestro_agentes')
          .upsert({ nombre: vendNombre, despacho_id: despId, gerencia_id: gerId },
            { onConflict: 'nombre,despacho_id', ignoreDuplicates: mode === 'adicion' });

        if (errAg) throw new Error(errAg.message);
        exitosas++;
      } catch (e: any) {
        errores.push({ fila: i + 2, error: e.message });
      }
    }
    return { exitosas, omitidas, errores };
  }

  async function importarMapeo(rows: any[], _mode: ImportMode) {
    let exitosas = 0, omitidas = 0;
    const errores: { fila: number; error: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const vendNombre = normalize(r.vendedor || r.Vendedor);
      const emailMovi  = normalize(r.email_movi || r['Email MOVI'] || r.email).toLowerCase();

      if (!vendNombre || !emailMovi) {
        errores.push({ fila: i + 2, error: 'Faltan campos (vendedor, email_movi)' });
        continue;
      }

      try {
        const { data: ag } = await supabase.from('maestro_agentes').select('id').eq('nombre', vendNombre).maybeSingle();
        if (!ag) { omitidas++; continue; }

        const { data: usr } = await supabase.from('usuarios').select('id').eq('email_laboral', emailMovi).maybeSingle();
        if (!usr) { omitidas++; continue; }

        const { error } = await supabase.from('maestro_usuario_agente')
          .upsert({ user_id: usr.id, agente_id: ag.id, activo: true }, { onConflict: 'user_id' });
        if (error) throw new Error(error.message);
        exitosas++;
      } catch (e: any) {
        errores.push({ fila: i + 2, error: e.message });
      }
    }
    return { exitosas, omitidas, errores };
  }

  async function importarCodigosPostales(rows: any[], mode: ImportMode) {
    let exitosas = 0, omitidas = 0;
    const errores: { fila: number; error: string }[] = [];

    if (mode === 'reemplazo') {
      const { error } = await supabase.from('codigos_postales').delete().not('id', 'is', null);
      if (error) throw new Error('Error al limpiar códigos postales: ' + error.message);
    }

    const validRows: { codigo: string; colonia: string; municipio: string; estado: string }[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const codigo    = normalize(String(r.codigo ?? r.Codigo ?? r.CODIGO ?? r['Código Postal'] ?? r['codigo_postal'] ?? r.C_CP ?? ''));
      const colonia   = normalize(String(r.colonia ?? r.Colonia ?? r.COLONIA ?? r.Asentamiento ?? r.asentamiento ?? ''));
      const municipio = normalize(String(r.municipio ?? r.Municipio ?? r.MUNICIPIO ?? r.Delegacion ?? r.delegacion ?? r.D_mnpio ?? ''));
      const estado    = normalize(String(r.estado ?? r.Estado ?? r.ESTADO ?? r.D_estado ?? ''));

      if (!codigo || !colonia) {
        if (errores.length < 100) errores.push({ fila: i + 2, error: 'Faltan campos (codigo, colonia)' });
        continue;
      }
      if (!/^\d{5}$/.test(codigo)) {
        if (errores.length < 100) errores.push({ fila: i + 2, error: `CP inválido: "${codigo}"` });
        continue;
      }
      validRows.push({ codigo, colonia, municipio, estado });
    }

    const BATCH = 500;
    for (let b = 0; b < validRows.length; b += BATCH) {
      const batch = validRows.slice(b, b + BATCH);
      const { error } = await supabase.from('codigos_postales')
        .upsert(batch, { onConflict: 'codigo,colonia', ignoreDuplicates: mode === 'adicion' });
      if (error) throw new Error('Error al insertar lote CP: ' + error.message);
      exitosas += batch.length;
    }
    return { exitosas, omitidas, errores };
  }

  async function exportarCodigosPostales() {
    const { data } = await supabase.from('codigos_postales').select('codigo,colonia,municipio,estado').order('codigo');
    const rows: any[][] = [['codigo', 'colonia', 'municipio', 'estado']];
    for (const cp of (data ?? [])) rows.push([cp.codigo, cp.colonia, cp.municipio, cp.estado]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'codigos_postales');
    XLSX.writeFile(wb, `codigos_postales_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast('Códigos postales exportados');
  }

  // ─── Render helpers ───────────────────────────────────────────────────────────

  function BadgeActivo({ activo }: { activo: boolean }) {
    return activo
      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full"><CheckCircle2 className="w-3 h-3"/>Activo</span>
      : <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-neutral-100 text-neutral-500 text-xs rounded-full"><XCircle className="w-3 h-3"/>Inactivo</span>;
  }

  function SectionHeader({ title, count, onAdd }: { title: string; count: number; onAdd?: () => void }) {
    return (
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-neutral-800 dark:text-neutral-100">
          {title} <span className="text-neutral-400 font-normal text-sm">({count})</span>
        </h3>
        {onAdd && (
          <button onClick={onAdd} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition">
            <Plus className="w-3.5 h-3.5"/> Agregar
          </button>
        )}
      </div>
    );
  }

  // ─── Panel de importación (reutilizable para cada tab) ────────────────────────

  function ImportPanel() {
    return (
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-neutral-700 dark:text-neutral-200">
          <Upload className="w-4 h-4 text-blue-600"/>
          Importar desde Excel
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex rounded-lg border border-neutral-200 dark:border-neutral-600 overflow-hidden text-xs">
            {(['adicion', 'reemplazo'] as ImportMode[]).map(m => (
              <button key={m} onClick={() => setImportMode(m)}
                className={`px-3 py-2 font-medium transition ${importMode === m
                  ? 'bg-blue-600 text-white'
                  : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700'}`}>
                {m === 'adicion' ? 'Adición (ignorar duplicados)' : 'Reemplazo total'}
              </button>
            ))}
          </div>

          {importMode === 'reemplazo' && (
            <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0"/>
              Borra todos los datos existentes antes de insertar. El mapeo también se limpia si reemplazas vendedores.
            </div>
          )}
        </div>

        <div
          className="border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition"
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f); }}
        >
          {importLoading ? (
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin"/>
              <p className="text-sm text-blue-600 font-medium">Importando...</p>
            </div>
          ) : (
            <>
              <FileSpreadsheet className="w-10 h-10 text-neutral-300 mx-auto mb-2"/>
              <p className="text-sm text-neutral-600 dark:text-neutral-300">Arrastra tu archivo Excel aquí o <span className="text-blue-600 font-medium">haz click para seleccionar</span></p>
              <p className="text-xs text-neutral-400 mt-1">Pestañas válidas: <code className="bg-neutral-100 dark:bg-neutral-700 px-1 rounded">catalogo</code>, <code className="bg-neutral-100 dark:bg-neutral-700 px-1 rounded">vendedores</code>, <code className="bg-neutral-100 dark:bg-neutral-700 px-1 rounded">mapeo</code>, <code className="bg-neutral-100 dark:bg-neutral-700 px-1 rounded">codigos_postales</code></p>
            </>
          )}
        </div>

        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />

        <div className="flex gap-2">
          <button onClick={exportarPlantillaVacia}
            className="flex items-center gap-2 text-xs px-3 py-2 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-200 rounded-lg transition">
            <Download className="w-3.5 h-3.5"/> Descargar plantilla vacía
          </button>
          <button onClick={exportarDatosActuales}
            className="flex items-center gap-2 text-xs px-3 py-2 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-200 rounded-lg transition">
            <Download className="w-3.5 h-3.5"/> Exportar datos actuales
          </button>
        </div>
      </div>
    );
  }

  // ─── TAB: Catálogo ────────────────────────────────────────────────────────────

  function TabCatalogo() {
    const ramosFiltrados = ramos.filter(r => r.nombre.toLowerCase().includes(searchCat.toLowerCase()));

    return (
      <div className="space-y-6">
        <ImportPanel />

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400"/>
          <input type="text" placeholder="Buscar ramo, compañía o subramo..." value={searchCat}
            onChange={e => setSearchCat(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-neutral-800 dark:text-white"/>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Ramos */}
          <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-5">
            <SectionHeader title="Ramos" count={ramos.length} onAdd={() => setShowAddRamo(v => !v)}/>
            {showAddRamo && (
              <div className="flex gap-2 mb-3">
                <input value={addRamoNombre} onChange={e => setAddRamoNombre(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addRamo()}
                  placeholder="Nombre del ramo" className="flex-1 border border-neutral-300 dark:border-neutral-600 rounded-lg px-3 py-2 text-sm dark:bg-neutral-700 dark:text-white"/>
                <button onClick={addRamo} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"><Save className="w-4 h-4"/></button>
                <button onClick={() => setShowAddRamo(false)} className="px-3 py-2 bg-neutral-100 dark:bg-neutral-700 rounded-lg text-sm"><X className="w-4 h-4"/></button>
              </div>
            )}
            {loadingCat ? <Skeleton/> : (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {ramosFiltrados.map(ramo => {
                  const subsDeRamo = subramos.filter(s => s.ramo_id === ramo.id);
                  const expanded = expandedRamos.has(ramo.id);
                  return (
                    <div key={ramo.id}>
                      <div className="flex items-center justify-between py-1.5 px-2 hover:bg-neutral-50 dark:hover:bg-neutral-700 rounded-lg group">
                        <button className="flex items-center gap-2 flex-1 text-left" onClick={() =>
                          setExpandedRamos(prev => { const s = new Set(prev); s.has(ramo.id) ? s.delete(ramo.id) : s.add(ramo.id); return s; })}>
                          {expanded ? <ChevronDown className="w-3.5 h-3.5 text-neutral-400"/> : <ChevronRight className="w-3.5 h-3.5 text-neutral-400"/>}
                          <span className="text-sm font-medium text-neutral-800 dark:text-neutral-100">{ramo.nombre}</span>
                          <span className="text-xs text-neutral-400">{subsDeRamo.length} subramos</span>
                        </button>
                        <button onClick={() => toggleActivo('maestro_ramos', ramo.id, ramo.activo, loadCatalogo)}
                          className="opacity-0 group-hover:opacity-100 transition">
                          <BadgeActivo activo={ramo.activo}/>
                        </button>
                      </div>
                      {expanded && (
                        <div className="ml-6 space-y-0.5">
                          {subsDeRamo.map(s => (
                            <div key={s.id} className="flex items-center justify-between py-1 px-2 text-xs text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 rounded group">
                              <span>{s.nombre}</span>
                              <button onClick={() => toggleActivo('maestro_subramos', s.id, s.activo, loadCatalogo)}
                                className="opacity-0 group-hover:opacity-100 transition">
                                <BadgeActivo activo={s.activo}/>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {ramosFiltrados.length === 0 && <EmptyState msg="Sin ramos. Importa un Excel o agrega uno manualmente."/>}
              </div>
            )}
          </div>

          {/* Compañías */}
          <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-5">
            <SectionHeader title="Compañías" count={companias.length} onAdd={() => setShowAddCompania(v => !v)}/>
            {showAddCompania && (
              <div className="flex flex-col gap-2 mb-3">
                <input value={addCompaniaNombre} onChange={e => setAddCompaniaNombre(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCompania()}
                  placeholder="Nombre de la compañía" className="border border-neutral-300 dark:border-neutral-600 rounded-lg px-3 py-2 text-sm dark:bg-neutral-700 dark:text-white"/>
                <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
                  <input type="checkbox" checked={addCompaniaConvenio} onChange={e => setAddCompaniaConvenio(e.target.checked)} className="rounded"/>
                  Tiene convenio (compañía preferente)
                </label>
                <div className="flex gap-2">
                  <button onClick={addCompania} className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Guardar</button>
                  <button onClick={() => setShowAddCompania(false)} className="px-3 py-2 bg-neutral-100 dark:bg-neutral-700 rounded-lg text-sm"><X className="w-4 h-4"/></button>
                </div>
              </div>
            )}
            {loadingCat ? <Skeleton/> : (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {companias.filter(c => c.nombre.toLowerCase().includes(searchCat.toLowerCase())).map(comp => (
                  <div key={comp.id} className="flex items-center justify-between py-1.5 px-2 hover:bg-neutral-50 dark:hover:bg-neutral-700 rounded-lg group">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-neutral-800 dark:text-neutral-100">{comp.nombre}</span>
                      {comp.convenio && <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">Convenio</span>}
                    </div>
                    <button onClick={() => toggleActivo('maestro_companias', comp.id, comp.activo, loadCatalogo)}
                      className="opacity-0 group-hover:opacity-100 transition">
                      <BadgeActivo activo={comp.activo}/>
                    </button>
                  </div>
                ))}
                {companias.length === 0 && <EmptyState msg="Sin compañías. Importa un Excel o agrega manualmente."/>}
              </div>
            )}
          </div>
        </div>

        {/* Resumen combinaciones */}
        <div className="bg-neutral-50 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-4">
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            <span className="font-semibold text-neutral-800 dark:text-white">{combinaciones.filter(c => c.activo).length}</span> combinaciones válidas cargadas
            (compañía + ramo + subramo). Estas alimentan los filtros en cascada de los trámites.
          </p>
        </div>
      </div>
    );
  }

  // ─── TAB: Vendedores ──────────────────────────────────────────────────────────

  function TabVendedores() {
    const lc = searchVend.toLowerCase();
    const despFiltrados = despachos.filter(d => d.nombre.toLowerCase().includes(lc));

    // Agrupación por nombre del vendedor para la vista "Por Vendedor"
    const vendedorMap = new Map<string, Agente[]>();
    agentes.forEach(ag => {
      if (!ag.nombre.toLowerCase().includes(lc)) return;
      if (!vendedorMap.has(ag.nombre)) vendedorMap.set(ag.nombre, []);
      vendedorMap.get(ag.nombre)!.push(ag);
    });
    const vendedorGroups = Array.from(vendedorMap.entries()).sort(([a], [b]) => a.localeCompare(b));
    const dupCount = vendedorGroups.filter(([, ags]) => ags.length > 1).length;

    function AgentRowDespacho({ ag, paddingClass = 'px-4' }: { ag: Agente; paddingClass?: string }) {
      const isEdit = editingRow?.id === ag.id;
      return (
        <div className={`flex items-center gap-2 ${paddingClass} py-2 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 group`}>
          {isEdit ? (
            <div className="flex-1 flex items-center gap-2">
              <input value={editingRow!.nombre} onChange={e => setEditingRow({ ...editingRow!, nombre: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') saveEditRow(); if (e.key === 'Escape') setEditingRow(null); }}
                className="flex-1 border border-neutral-300 dark:border-neutral-600 rounded px-2 py-1 text-sm dark:bg-neutral-700 dark:text-white" autoFocus/>
              <button onClick={saveEditRow} className="p-1 text-green-600 hover:text-green-700"><Save className="w-3.5 h-3.5"/></button>
              <button onClick={() => setEditingRow(null)} className="p-1 text-neutral-400 hover:text-neutral-600"><X className="w-3.5 h-3.5"/></button>
            </div>
          ) : (
            <>
              <span className="flex-1 text-sm text-neutral-700 dark:text-neutral-200">{ag.nombre}</span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                <button onClick={() => toggleActivo('maestro_agentes', ag.id, ag.activo, loadVendedores)} className="flex-shrink-0">
                  <BadgeActivo activo={ag.activo}/>
                </button>
                <button onClick={() => setEditingRow({ table: 'maestro_agentes', id: ag.id, nombre: ag.nombre })}
                  className="p-1 text-neutral-400 hover:text-blue-600 rounded" title="Editar nombre">
                  <Edit2 className="w-3.5 h-3.5"/>
                </button>
                <button onClick={() => { if (window.confirm(`¿Eliminar vendedor "${ag.nombre}"?`)) deleteRow('maestro_agentes', ag.id, loadVendedores); }}
                  className="p-1 text-neutral-400 hover:text-red-600 rounded" title="Eliminar">
                  <Trash2 className="w-3.5 h-3.5"/>
                </button>
              </div>
            </>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <ImportPanel />

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400"/>
          <input type="text" placeholder="Buscar despacho, gerencia o vendedor..." value={searchVend}
            onChange={e => setSearchVend(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 dark:bg-neutral-800 dark:text-white"/>
        </div>

        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-5">
          {/* Header con toggle de vista y botón de agregar */}
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <h3 className="font-semibold text-neutral-800 dark:text-neutral-100">
              Despachos y vendedores <span className="text-neutral-400 font-normal text-sm">({agentes.length})</span>
            </h3>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-neutral-200 dark:border-neutral-600 overflow-hidden text-xs font-medium">
                <button onClick={() => setVendGroupMode('despacho')}
                  className={`px-3 py-1.5 flex items-center gap-1 transition ${vendGroupMode === 'despacho' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700'}`}>
                  <Building2 className="w-3 h-3"/>
                  Por Despacho
                </button>
                <button onClick={() => setVendGroupMode('vendedor')}
                  className={`px-3 py-1.5 flex items-center gap-1.5 transition ${vendGroupMode === 'vendedor' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700'}`}>
                  <Users className="w-3 h-3"/>
                  Por Vendedor
                  {dupCount > 0 && (
                    <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold leading-none ${vendGroupMode === 'vendedor' ? 'bg-amber-200 text-amber-900' : 'bg-amber-100 text-amber-700'}`}>{dupCount}</span>
                  )}
                </button>
              </div>
              <button onClick={() => setShowAddDespacho(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition">
                <Plus className="w-3.5 h-3.5"/>
                Nuevo despacho
              </button>
            </div>
          </div>

          {showAddDespacho && (
            <div className="flex gap-2 mb-3">
              <input value={addDespachoNombre} onChange={e => setAddDespachoNombre(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addDespacho()}
                placeholder="Nombre del despacho" className="flex-1 border border-neutral-300 dark:border-neutral-600 rounded-lg px-3 py-2 text-sm dark:bg-neutral-700 dark:text-white"/>
              <button onClick={addDespacho} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm"><Save className="w-4 h-4"/></button>
              <button onClick={() => setShowAddDespacho(false)} className="px-3 py-2 bg-neutral-100 dark:bg-neutral-700 rounded-lg text-sm"><X className="w-4 h-4"/></button>
            </div>
          )}

          {loadingVend ? <Skeleton/> : (
            <div className="space-y-2 max-h-[520px] overflow-y-auto">

              {/* ─── VISTA POR DESPACHO ─────────────────────────────────────── */}
              {vendGroupMode === 'despacho' && (
                <>
                  {despFiltrados.map(desp => {
                    const gersDeDesp = gerencias.filter(g => g.despacho_id === desp.id);
                    const agtsDeDesp = agentes.filter(a => a.despacho_id === desp.id);
                    const expanded = expandedDespachos.has(desp.id);
                    const isEditDesp = editingRow?.id === desp.id;
                    return (
                      <div key={desp.id} className="border border-neutral-200 dark:border-neutral-600 rounded-lg overflow-hidden">
                        {/* Header del despacho */}
                        <div className="flex items-center gap-2 px-4 py-3 bg-neutral-50 dark:bg-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-600 group">
                          <button
                            onClick={() => setExpandedDespachos(prev => { const s = new Set(prev); s.has(desp.id) ? s.delete(desp.id) : s.add(desp.id); return s; })}
                            className="flex-shrink-0">
                            {expanded ? <ChevronDown className="w-4 h-4 text-neutral-500"/> : <ChevronRight className="w-4 h-4 text-neutral-500"/>}
                          </button>
                          <Building2 className="w-4 h-4 text-blue-500 flex-shrink-0"/>
                          {isEditDesp ? (
                            <div className="flex-1 flex items-center gap-2">
                              <input value={editingRow!.nombre} onChange={e => setEditingRow({ ...editingRow!, nombre: e.target.value })}
                                onKeyDown={e => { if (e.key === 'Enter') saveEditRow(); if (e.key === 'Escape') setEditingRow(null); }}
                                className="flex-1 border border-neutral-300 dark:border-neutral-600 rounded px-2 py-1 text-sm dark:bg-neutral-700 dark:text-white" autoFocus/>
                              <button onClick={saveEditRow} className="p-1 text-green-600"><Save className="w-3.5 h-3.5"/></button>
                              <button onClick={() => setEditingRow(null)} className="p-1 text-neutral-400"><X className="w-3.5 h-3.5"/></button>
                            </div>
                          ) : (
                            <>
                              <button onClick={() => setExpandedDespachos(prev => { const s = new Set(prev); s.has(desp.id) ? s.delete(desp.id) : s.add(desp.id); return s; })}
                                className="flex-1 flex items-center gap-2 text-left">
                                <span className="font-medium text-neutral-800 dark:text-neutral-100 text-sm">{desp.nombre}</span>
                                <span className="text-xs text-neutral-400 ml-auto">{agtsDeDesp.length} vendedores</span>
                                <BadgeActivo activo={desp.activo}/>
                              </button>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                                <button onClick={() => setEditingRow({ table: 'maestro_despachos', id: desp.id, nombre: desp.nombre })}
                                  className="p-1 text-neutral-400 hover:text-blue-600 rounded" title="Editar nombre">
                                  <Edit2 className="w-3.5 h-3.5"/>
                                </button>
                                <button onClick={() => { if (window.confirm(`¿Eliminar despacho "${desp.nombre}"?`)) deleteRow('maestro_despachos', desp.id, loadVendedores); }}
                                  className="p-1 text-neutral-400 hover:text-red-600 rounded" title="Eliminar">
                                  <Trash2 className="w-3.5 h-3.5"/>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                        {expanded && (
                          <div className="divide-y divide-neutral-100 dark:divide-neutral-700">
                            {gersDeDesp.map(ger => {
                              const isEditGer = editingRow?.id === ger.id;
                              return (
                                <div key={ger.id}>
                                  <div className="px-4 py-2 bg-neutral-50/50 dark:bg-neutral-800 flex items-center gap-2 group">
                                    <Users className="w-3.5 h-3.5 text-purple-400 flex-shrink-0"/>
                                    {isEditGer ? (
                                      <div className="flex-1 flex items-center gap-2">
                                        <input value={editingRow!.nombre} onChange={e => setEditingRow({ ...editingRow!, nombre: e.target.value })}
                                          onKeyDown={e => { if (e.key === 'Enter') saveEditRow(); if (e.key === 'Escape') setEditingRow(null); }}
                                          className="flex-1 border border-neutral-300 dark:border-neutral-600 rounded px-2 py-1 text-xs dark:bg-neutral-700 dark:text-white" autoFocus/>
                                        <button onClick={saveEditRow} className="p-1 text-green-600"><Save className="w-3 h-3"/></button>
                                        <button onClick={() => setEditingRow(null)} className="p-1 text-neutral-400"><X className="w-3 h-3"/></button>
                                      </div>
                                    ) : (
                                      <>
                                        <span className="flex-1 text-xs font-semibold text-neutral-600 dark:text-neutral-300 uppercase tracking-wide">{ger.nombre}</span>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                                          <button onClick={() => setEditingRow({ table: 'maestro_gerencias', id: ger.id, nombre: ger.nombre })}
                                            className="p-1 text-neutral-400 hover:text-blue-600 rounded" title="Editar nombre">
                                            <Edit2 className="w-3 h-3"/>
                                          </button>
                                          <button onClick={() => { if (window.confirm(`¿Eliminar gerencia "${ger.nombre}"?`)) deleteRow('maestro_gerencias', ger.id, loadVendedores); }}
                                            className="p-1 text-neutral-400 hover:text-red-600 rounded" title="Eliminar">
                                            <Trash2 className="w-3 h-3"/>
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                  {agentes.filter(a => a.gerencia_id === ger.id).map(ag => (
                                    <AgentRowDespacho key={ag.id} ag={ag} paddingClass="px-6"/>
                                  ))}
                                </div>
                              );
                            })}
                            {agentes.filter(a => a.despacho_id === desp.id && !a.gerencia_id).map(ag => (
                              <AgentRowDespacho key={ag.id} ag={ag} paddingClass="px-4"/>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {despFiltrados.length === 0 && <EmptyState msg="Sin despachos. Importa un Excel o agrega uno manualmente."/>}
                </>
              )}

              {/* ─── VISTA POR VENDEDOR ─────────────────────────────────────── */}
              {vendGroupMode === 'vendedor' && (
                <>
                  {dupCount > 0 && (
                    <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg text-xs text-amber-700 dark:text-amber-400 mb-2">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"/>
                      <span>
                        <strong>{dupCount} vendedor{dupCount > 1 ? 'es' : ''}</strong> con registros en múltiples despachos.
                        Haz clic en "Hacer principal" para definir cuál se muestra en el sistema.
                      </span>
                    </div>
                  )}
                  {vendedorGroups.map(([nombre, ags]) => {
                    const isDup = ags.length > 1;
                    return (
                      <div key={nombre} className={`border rounded-lg overflow-hidden ${isDup ? 'border-amber-300 dark:border-amber-700' : 'border-neutral-200 dark:border-neutral-600'}`}>
                        <div className={`flex items-center gap-2 px-4 py-2.5 ${isDup ? 'bg-amber-50/70 dark:bg-amber-900/20' : 'bg-neutral-50 dark:bg-neutral-700'}`}>
                          {isDup && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0"/>}
                          <span className="font-medium text-sm text-neutral-800 dark:text-neutral-100 flex-1">{nombre}</span>
                          {isDup && <span className="text-xs text-amber-600 dark:text-amber-400">{ags.length} despachos</span>}
                        </div>
                        <div className="divide-y divide-neutral-100 dark:divide-neutral-700">
                          {ags.map(ag => {
                            const desp = despachos.find(d => d.id === ag.despacho_id);
                            const ger  = gerencias.find(g => g.id === ag.gerencia_id);
                            const isEdit = editingRow?.id === ag.id;
                            return (
                              <div key={ag.id} className="flex items-center gap-3 px-4 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 group">
                                <Building2 className="w-3.5 h-3.5 text-blue-400 flex-shrink-0"/>
                                {isEdit ? (
                                  <div className="flex-1 flex items-center gap-2">
                                    <input value={editingRow!.nombre} onChange={e => setEditingRow({ ...editingRow!, nombre: e.target.value })}
                                      onKeyDown={e => { if (e.key === 'Enter') saveEditRow(); if (e.key === 'Escape') setEditingRow(null); }}
                                      className="flex-1 border border-neutral-300 dark:border-neutral-600 rounded px-2 py-1 text-sm dark:bg-neutral-700 dark:text-white" autoFocus
                                      placeholder="Nombre del vendedor"/>
                                    <button onClick={saveEditRow} className="p-1 text-green-600"><Save className="w-3.5 h-3.5"/></button>
                                    <button onClick={() => setEditingRow(null)} className="p-1 text-neutral-400"><X className="w-3.5 h-3.5"/></button>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex-1 min-w-0">
                                      <span className="text-sm text-neutral-700 dark:text-neutral-200">{desp?.nombre ?? '—'}</span>
                                      {ger && <span className="ml-1.5 text-xs text-neutral-400">· {ger.nombre}</span>}
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                      {isDup && (
                                        ag.es_primario
                                          ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 text-xs rounded-full font-medium">Principal</span>
                                          : <button onClick={() => setPrimario(ag.id, ag.nombre)}
                                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 text-xs rounded-full hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-900/40 dark:hover:text-green-400 transition opacity-0 group-hover:opacity-100">
                                              Hacer principal
                                            </button>
                                      )}
                                      <BadgeActivo activo={ag.activo}/>
                                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                                        <button onClick={() => setEditingRow({ table: 'maestro_agentes', id: ag.id, nombre: ag.nombre })}
                                          className="p-1 text-neutral-400 hover:text-blue-600 rounded" title="Editar nombre">
                                          <Edit2 className="w-3.5 h-3.5"/>
                                        </button>
                                        <button onClick={() => { if (window.confirm(`¿Eliminar "${ag.nombre}" del despacho "${desp?.nombre}"?`)) deleteRow('maestro_agentes', ag.id, loadVendedores); }}
                                          className="p-1 text-neutral-400 hover:text-red-600 rounded" title="Eliminar">
                                          <Trash2 className="w-3.5 h-3.5"/>
                                        </button>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {vendedorGroups.length === 0 && <EmptyState msg="Sin vendedores encontrados."/>}
                </>
              )}

            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── TAB: Mapeo ───────────────────────────────────────────────────────────────

  function TabMapeo() {
    const mapeosFiltrados = mapeos.filter(m => {
      const agt  = (m.maestro_agentes as any)?.nombre?.toLowerCase() ?? '';
      const usr  = (m.usuarios as any)?.nombre?.toLowerCase() ?? '';
      const mail = (m.usuarios as any)?.email_laboral?.toLowerCase() ?? '';
      return agt.includes(searchMapeo.toLowerCase()) || usr.includes(searchMapeo.toLowerCase()) || mail.includes(searchMapeo.toLowerCase());
    });

    return (
      <div className="space-y-6">
        <ImportPanel />

        {/* Agregar mapeo */}
        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-700 dark:text-neutral-200">
              <Link2 className="w-4 h-4 text-purple-500"/>
              Agregar mapeo
            </div>
            {/* Modo selector */}
            <div className="flex rounded-lg border border-neutral-200 dark:border-neutral-600 overflow-hidden text-xs font-medium">
              <button
                onClick={() => setMapeoMode('sicas')}
                className={`px-3 py-1.5 transition-colors ${mapeoMode === 'sicas' ? 'bg-blue-600 text-white' : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-700'}`}
              >
                Vincular con agente SICAS
              </button>
              <button
                onClick={() => setMapeoMode('movi')}
                className={`px-3 py-1.5 transition-colors ${mapeoMode === 'movi' ? 'bg-purple-600 text-white' : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-700'}`}
              >
                Solo MOVI (sin SICAS)
              </button>
            </div>
          </div>

          {mapeoMode === 'sicas' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-neutral-500 mb-1 block">Usuario MOVI</label>
                <select value={newMapeoUserId} onChange={e => setNewMapeoUserId(e.target.value)}
                  className="w-full border border-neutral-300 dark:border-neutral-600 rounded-lg px-3 py-2 text-sm dark:bg-neutral-700 dark:text-white">
                  <option value="">Seleccionar usuario...</option>
                  {usuariosMOVI.map(u => <option key={u.id} value={u.id}>{u.nombre} — {u.email}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-neutral-500 mb-1 block">Agente SICAS</label>
                <select value={newMapeoAgenteId} onChange={e => setNewMapeoAgenteId(e.target.value)}
                  className="w-full border border-neutral-300 dark:border-neutral-600 rounded-lg px-3 py-2 text-sm dark:bg-neutral-700 dark:text-white">
                  <option value="">Seleccionar agente...</option>
                  {agentesList.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button onClick={addMapeo} disabled={savingMapeo || !newMapeoUserId || !newMapeoAgenteId}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition">
                  {savingMapeo ? 'Guardando...' : 'Guardar mapeo'}
                </button>
              </div>
            </div>
          )}

          {mapeoMode === 'movi' && (
            <div className="space-y-3">
              <p className="text-xs text-neutral-500">
                Agrega un usuario MOVI que no tiene contraparte en SICAS. Se creará un registro en el catálogo de asignables y quedará disponible en el campo <strong>Usuario Asignado</strong>.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="text-xs text-neutral-500 mb-1 block">Usuario MOVI (sin mapeo existente)</label>
                  <select value={newMapeoMOVIUserId} onChange={e => setNewMapeoMOVIUserId(e.target.value)}
                    className="w-full border border-neutral-300 dark:border-neutral-600 rounded-lg px-3 py-2 text-sm dark:bg-neutral-700 dark:text-white">
                    <option value="">Seleccionar usuario...</option>
                    {usuariosMOVI
                      .filter(u => !mapeos.some(m => m.user_id === u.id))
                      .map(u => <option key={u.id} value={u.id}>{u.nombre} — {u.email}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                  <button onClick={addMapeoMOVI} disabled={savingMapeoMOVI || !newMapeoMOVIUserId}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition">
                    {savingMapeoMOVI ? 'Guardando...' : 'Agregar al catálogo'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mapeos pendientes de validación */}
        {pendientesMapeo.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-700 overflow-hidden">
            <div className="px-5 py-3 border-b border-amber-200 dark:border-amber-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Propuestas pendientes de validación
              </span>
              <span className="ml-auto text-xs font-bold bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">
                {pendientesMapeo.length}
              </span>
            </div>
            {loadingPendientes ? (
              <div className="p-6 flex justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600"/></div>
            ) : (
              <div className="divide-y divide-amber-100 dark:divide-amber-800">
                {pendientesMapeo.map(p => (
                  <div key={p.id} className="px-5 py-3 flex items-center gap-4">
                    <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-6">
                      <div>
                        <p className="text-xs text-amber-600 font-medium uppercase tracking-wide mb-0.5">Agente SICAS</p>
                        <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100 truncate">
                          {(p.maestro_agentes as any)?.nombre ?? '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-amber-600 font-medium uppercase tracking-wide mb-0.5">Usuario MOVI propuesto</p>
                        <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100 truncate">
                          {(p.usuarios as any)?.nombre ?? '—'}
                        </p>
                        <p className="text-xs text-neutral-400 truncate">{(p.usuarios as any)?.email_laboral ?? ''}</p>
                      </div>
                    </div>
                    <div className="text-xs text-neutral-400 shrink-0 text-right">
                      <p>Por: {(p.propuesto_por_usuario as any)?.nombre ?? '—'}</p>
                      <p>{new Date(p.created_at).toLocaleDateString('es-MX')}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => validarMapeo(p)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Validar
                      </button>
                      <button
                        onClick={() => rechazarMapeo(p.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-medium rounded-lg transition"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Rechazar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tabla de mapeos */}
        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400"/>
              <input type="text" placeholder="Buscar usuario o agente..." value={searchMapeo}
                onChange={e => setSearchMapeo(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm dark:bg-neutral-700 dark:text-white"/>
            </div>
          </div>
          {loadingMapeo ? (
            <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"/></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 dark:bg-neutral-700/50 border-b border-neutral-200 dark:border-neutral-700">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Usuario MOVI</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Agente</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Origen</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Despacho</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Estado</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700">
                  {mapeosFiltrados.map(m => (
                    <tr key={m.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-700/30">
                      <td className="px-5 py-3">
                        <p className="font-medium text-neutral-800 dark:text-neutral-100">{(m.usuarios as any)?.nombre ?? '—'}</p>
                        <p className="text-xs text-neutral-400">{(m.usuarios as any)?.email_laboral ?? ''}</p>
                      </td>
                      <td className="px-5 py-3 text-neutral-700 dark:text-neutral-200">{(m.maestro_agentes as any)?.nombre ?? '—'}</td>
                      <td className="px-5 py-3">
                        {(m.maestro_agentes as any)?.origen === 'movi'
                          ? <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">MOVI</span>
                          : <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">SICAS</span>}
                      </td>
                      <td className="px-5 py-3 text-neutral-500 text-xs">{(m.maestro_agentes as any)?.maestro_despachos?.nombre ?? '—'}</td>
                      <td className="px-5 py-3"><BadgeActivo activo={m.activo}/></td>
                      <td className="px-5 py-3">
                        <button onClick={() => deleteMapeo(m.id)} className="p-1.5 hover:bg-red-100 text-red-500 rounded-lg transition">
                          <Trash2 className="w-4 h-4"/>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {mapeosFiltrados.length === 0 && (
                    <tr><td colSpan={5} className="px-5 py-10 text-center text-neutral-400 text-sm">Sin mapeos. Importa el Excel o agrega uno arriba.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── TAB: Historial ───────────────────────────────────────────────────────────

  function TabHistorial() {
    return (
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
        {loadingHist ? (
          <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"/></div>
        ) : historial.length === 0 ? (
          <div className="p-10 text-center">
            <History className="w-10 h-10 text-neutral-300 mx-auto mb-3"/>
            <p className="text-neutral-500 text-sm">No hay importaciones registradas aún.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-700/50 border-b border-neutral-200 dark:border-neutral-700">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Fecha</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Archivo</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Pestañas</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Modo</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Resultado</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Por</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700">
                {historial.map(h => (
                  <tr key={h.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-700/30">
                    <td className="px-5 py-3 text-neutral-600 dark:text-neutral-300 whitespace-nowrap">
                      {new Date(h.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-5 py-3 text-neutral-700 dark:text-neutral-200 font-mono text-xs max-w-[180px] truncate" title={h.nombre_archivo}>{h.nombre_archivo}</td>
                    <td className="px-5 py-3">
                      {h.pestana.split('+').map(p => (
                        <span key={p} className="inline-block mr-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{p}</span>
                      ))}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${h.modo === 'reemplazo' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                        {h.modo}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-xs space-x-2">
                        <span className="text-green-700">{h.exitosas} ok</span>
                        {h.omitidas > 0 && <span className="text-neutral-400">{h.omitidas} omitidas</span>}
                        {h.errores_json && h.errores_json.length > 0 && (
                          <span className="text-red-600">{h.errores_json.length} errores</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-neutral-500 text-xs">{(h.usuarios as any)?.nombre ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ─── TAB: Códigos Postales ────────────────────────────────────────────────────

  function TabCodigosPostales() {
    const cpFiltrados = codigosPostales.filter(cp =>
      cp.codigo.includes(searchCP) ||
      cp.colonia.toLowerCase().includes(searchCP.toLowerCase()) ||
      cp.estado.toLowerCase().includes(searchCP.toLowerCase())
    );

    return (
      <div className="space-y-6">
        <ImportPanel />

        <div className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-neutral-800 dark:text-white">
              {cpCount.toLocaleString('es-MX')} códigos postales cargados
            </p>
            <p className="text-xs text-neutral-500 mt-0.5">
              Alimenta la validación del campo "Código Postal" en formularios de trámites. Formato: 5 dígitos.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={exportarCodigosPostales}
              className="flex items-center gap-2 text-xs px-3 py-2 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-200 rounded-lg transition">
              <Download className="w-3.5 h-3.5"/> Exportar CPs
            </button>
          </div>
        </div>

        {cpCount === 0 && (
          <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 shrink-0"/>
            Catálogo vacío — importa un Excel con la pestaña <code className="bg-amber-100 px-1 rounded mx-1">codigos_postales</code> para activar la validación.
          </div>
        )}

        {cpCount > 0 && (
          <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-5">
            <SectionHeader title="Vista previa" count={cpCount} />
            <p className="text-xs text-neutral-400 mb-3">Primeros 100 registros · Filtra por CP, colonia o estado</p>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400"/>
              <input type="text" placeholder="Buscar por CP, colonia, estado..."
                value={searchCP} onChange={e => setSearchCP(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm dark:bg-neutral-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            {loadingCP ? <Skeleton /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 dark:bg-neutral-700/50 border-b border-neutral-200 dark:border-neutral-700">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">CP</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Colonia</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Municipio</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700">
                    {cpFiltrados.map(cp => (
                      <tr key={cp.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-700/30">
                        <td className="px-4 py-2.5 font-mono font-medium text-neutral-800 dark:text-neutral-100">{cp.codigo}</td>
                        <td className="px-4 py-2.5 text-neutral-700 dark:text-neutral-200">{cp.colonia}</td>
                        <td className="px-4 py-2.5 text-neutral-500 dark:text-neutral-300">{cp.municipio}</td>
                        <td className="px-4 py-2.5 text-neutral-500 dark:text-neutral-300">{cp.estado}</td>
                      </tr>
                    ))}
                    {cpFiltrados.length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-10 text-center text-neutral-400 text-sm">Sin resultados para esa búsqueda.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ─── Main render ──────────────────────────────────────────────────────────────

  const tabs: { id: TabId; label: string; icon: typeof Database }[] = [
    { id: 'catalogo',          label: 'Catálogo',         icon: Database },
    { id: 'vendedores',        label: 'Vendedores',        icon: Users },
    { id: 'mapeo',             label: 'Mapeo MOVI ↔ Agente', icon: Link2 },
    { id: 'codigos_postales',  label: 'Cód. Postales',    icon: Building2 },
    { id: 'historial',         label: 'Historial',         icon: History },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <PageHeader
          title="Base de Datos Maestros"
          description="Importa, exporta y gestiona los catálogos de compañías, ramos, subramos, despachos y vendedores. Estos datos alimentan los filtros en cascada de toda la plataforma."
          icon={Database}
          backTo="/configuracion"
          backLabel="Volver a Configuración"
        />
      </div>

      {/* Stats rápidos */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Compañías', value: companias.filter(c => c.activo).length, color: 'blue' },
          { label: 'Ramos',     value: ramos.filter(r => r.activo).length,     color: 'violet' },
          { label: 'Vendedores', value: agentes.filter(a => a.activo).length,  color: 'amber' },
          { label: 'Mapeos activos', value: mapeos.filter(m => m.activo).length, color: 'green' },
          { label: 'Cód. Postales', value: cpCount, color: 'teal' },
        ].map(s => (
          <div key={s.label} className={`bg-${s.color}-50 border border-${s.color}-100 rounded-xl p-4`}>
            <p className={`text-xs text-${s.color}-600 font-medium`}>{s.label}</p>
            <p className={`text-2xl font-bold text-${s.color}-800 mt-1`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl w-fit">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                tab === t.id ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm' : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}>
              <Icon className="w-4 h-4"/>
              {t.label}
              {t.id === 'mapeo' && pendientesMapeo.length > 0 && (
                <span className="flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-amber-500 text-white rounded-full">
                  {pendientesMapeo.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Contenido del tab activo */}
      {tab === 'catalogo'          && <TabCatalogo />}
      {tab === 'vendedores'        && <TabVendedores />}
      {tab === 'mapeo'             && <TabMapeo />}
      {tab === 'codigos_postales'  && <TabCodigosPostales />}
      {tab === 'historial'         && <TabHistorial />}
    </div>
  );
}

// ─── Sub-componentes pequeños ──────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[1,2,3].map(i => <div key={i} className="h-8 bg-neutral-100 dark:bg-neutral-700 rounded-lg"/>)}
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="py-8 text-center">
      <Database className="w-8 h-8 text-neutral-200 dark:text-neutral-600 mx-auto mb-2"/>
      <p className="text-xs text-neutral-400">{msg}</p>
    </div>
  );
}
