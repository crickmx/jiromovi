import React, { useState, useEffect, useMemo } from 'react';
import { 
  HeartHandshake, 
  Package, 
  Building2, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Send,
  ShieldCheck,
  Stethoscope,
  PhoneCall,
  Sparkles,
  Award,
  Calendar,
  CreditCard,
  Check,
  ChevronRight,
  ExternalLink,
  Download,
  FileSpreadsheet,
  Search,
  Filter,
  Users,
  Building
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

// Helper para llamar a la API de salud.today (vía Edge Function proxy para evitar bloqueos de CORS en el navegador)
const callSaludToday = async (path: string, options: { method?: string; body?: any; headers?: Record<string, string> } = {}) => {
  const method = options.method || 'GET';
  const customHeaders = options.headers || {};
  
  // Intentar primero a través del proxy Edge Function de Supabase
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || '';
    
    const proxyHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
    if (customHeaders['Idempotency-Key']) {
      proxyHeaders['Idempotency-Key'] = customHeaders['Idempotency-Key'];
    }

    const proxyRes = await fetch(`https://whnckbbksicffqjscmtl.supabase.co/functions/v1/saludtoday-proxy?path=${encodeURIComponent(path)}`, {
      method,
      headers: proxyHeaders,
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (proxyRes.ok) {
      return await proxyRes.json();
    }
  } catch (proxyErr) {
    console.warn('Proxy request failed, fallbacking to direct fetch:', proxyErr);
  }

  // Fallback directo
  const directHeaders: Record<string, string> = {
    'Authorization': `Bearer ${API_TOKEN}`,
    'Content-Type': 'application/json',
    ...customHeaders
  };

  const res = await fetch(`${API_BASE}/${path.replace(/^\//, '')}`, {
    method,
    headers: directHeaders,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  return await res.json();
};

interface Plan {
  id: string;
  nombre: string;
  descripcion: string;
  precio_centavos: number;
  moneda: string;
  periodicidad: string;
}

interface MembresiaItem {
  id: string;
  folio?: string;
  status: string;
  plan?: {
    id: string;
    nombre: string;
    periodicidad: string;
    precio_centavos: number;
  };
  titular?: {
    nombre: string;
    apellidos: string;
    correo: string;
    telefono: string;
  };
  created_at?: string;
  vigencia_inicio?: string;
  vigencia_fin?: string;
  agente_nombre?: string;
  agente_id_sicas?: string;
  oficina_nombre?: string;
}

export default function SaludToday() {
  const { usuario } = useAuth();
  const isAdmin = usuario?.rol === 'Administrador';

  // Tabs de navegación
  const [activeTab, setActiveTab] = useState<'emision' | 'reportes'>('emision');

  // Form State
  const [tipoEmision, setTipoEmision] = useState<'individual' | 'corporativa'>('individual');
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [cantidad, setCantidad] = useState<number>(1);
  const [nombre, setNombre] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [empresaRazonSocial, setEmpresaRazonSocial] = useState('');
  const [rfc, setRfc] = useState('');
  const [metodoPago, setMetodoPago] = useState('transferencia');
  const [submitting, setSubmitting] = useState(false);
  const [ventaResult, setVentaResult] = useState<any>(null);

  // Vendedor y Oficina asignados
  const [selectedVendedorId, setSelectedVendedorId] = useState<string>('');
  const [selectedOficinaId, setSelectedOficinaId] = useState<string>('');
  const [vendedoresList, setVendedoresList] = useState<Array<{ id: string; nombre: string; id_sicas: string | null }>>([]);
  const [oficinasList, setOficinasList] = useState<Array<{ id: string; nombre: string }>>([]);

  // Reportes State
  const [membresias, setMembresias] = useState<MembresiaItem[]>([]);
  const [loadingReporte, setLoadingReporte] = useState(false);
  const [reportSearch, setReportSearch] = useState('');
  const [filtroOficina, setFiltroOficina] = useState('todas');
  const [filtroVendedor, setFiltroVendedor] = useState('todos');

  // Cargar Catálogos Iniciales
  useEffect(() => {
    fetchPlanes();
    cargarCatalogosMovi();
  }, []);

  const cargarCatalogosMovi = async () => {
    try {
      const [oficinasRes, usuariosRes] = await Promise.all([
        supabase.from('oficinas').select('id, nombre').order('nombre'),
        supabase.from('usuarios').select('id, nombre, apellidos, nombre_completo, id_sicas, oficina_id').order('nombre')
      ]);

      if (oficinasRes.data) {
        setOficinasList(oficinasRes.data);
      }
      if (usuariosRes.data) {
        const mapped = usuariosRes.data.map(u => ({
          id: u.id,
          nombre: u.nombre_completo || `${u.nombre || ''} ${u.apellidos || ''}`.trim() || 'Sin nombre',
          id_sicas: u.id_sicas || null
        }));
        setVendedoresList(mapped);
      }

      if (usuario?.id) {
        setSelectedVendedorId(usuario.id);
      }
      if (usuario?.oficina_id) {
        setSelectedOficinaId(usuario.oficina_id);
      }
    } catch (e) {
      console.error('Error cargando catálogos:', e);
    }
  };

  const fetchPlanes = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await callSaludToday('planes');
      if (data.ok && data.data?.planes) {
        setPlanes(data.data.planes);
        if (data.data.planes.length > 0 && !selectedPlanId) {
          setSelectedPlanId(data.data.planes[0].id);
        }
      } else {
        setError(data.error?.message || 'No fue posible cargar el catálogo de planes.');
      }
    } catch (err: any) {
      setError('Error de comunicación al consultar los planes de salud.today.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMembresiasReporte = async () => {
    setLoadingReporte(true);
    try {
      const data = await callSaludToday('membresias');
      if (data.ok && data.data?.membresias) {
        const rawMembresias = data.data.membresias;
        // Enriquecer con vendedor y oficina por defecto del usuario logueado o catálogos
        const defaultVend = vendedoresList.find(v => v.id === usuario?.id)?.nombre || usuario?.nombre_completo || 'Agente MOVI';
        const defaultIdSicas = vendedoresList.find(v => v.id === usuario?.id)?.id_sicas || (usuario as any)?.id_sicas || 'MOVI-01';
        const defaultOfic = oficinasList.find(o => o.id === usuario?.oficina_id)?.nombre || 'Matriz';

        const parsed = rawMembresias.map((m: any, idx: number) => ({
          ...m,
          agente_nombre: defaultVend,
          agente_id_sicas: defaultIdSicas,
          oficina_nombre: defaultOfic
        }));
        setMembresias(parsed);
      }
    } catch (e) {
      console.error('Error obteniendo membresías:', e);
    } finally {
      setLoadingReporte(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'reportes' && isAdmin) {
      fetchMembresiasReporte();
    }
  }, [activeTab, isAdmin]);

  const selectedPlan = planes.find(p => p.id === selectedPlanId);

  const handleEmitirVenta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanId || !nombre || !correo) {
      setError('Por favor llena los campos requeridos para la emisión.');
      return;
    }

    if (tipoEmision === 'corporativa' && (!empresaRazonSocial || cantidad < 1)) {
      setError('Para emisión corporativa debes indicar la razón social de la empresa y al menos 1 membresía.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    setVentaResult(null);

    const idempotencyKey = `movi-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const vendObj = vendedoresList.find(v => v.id === selectedVendedorId);
    const ofiObj = oficinasList.find(o => o.id === selectedOficinaId);

    try {
      const payload: any = {
        plan_id: selectedPlanId,
        cantidad: tipoEmision === 'corporativa' ? cantidad : 1,
        metodo_pago: metodoPago,
        marcar_pagada: true,
        cliente: {
          nombre: tipoEmision === 'corporativa' ? `${nombre} (${empresaRazonSocial})` : nombre,
          apellidos: apellidos || (tipoEmision === 'corporativa' ? 'Corporativo' : ''),
          correo,
          telefono: telefono || '5500000000'
        },
        notas: `Agente: ${vendObj?.nombre || 'MOVI'} (ID: ${vendObj?.id_sicas || selectedVendedorId}) | Oficina: ${ofiObj?.nombre || selectedOficinaId}`
      };

      if (tipoEmision === 'corporativa' && rfc) {
        payload.notas += ` | RFC: ${rfc} | Razón Social: ${empresaRazonSocial}`;
      }

      const data = await callSaludToday('ventas', {
        method: 'POST',
        headers: {
          'Idempotency-Key': idempotencyKey
        },
        body: payload
      });

      if (data.ok) {
        setSuccessMsg(`¡Emisión exitosa! Folio: ${data.data?.folio || data.data?.id || 'Generado'}`);
        setVentaResult(data.data);
        setNombre('');
        setApellidos('');
        setCorreo('');
        setTelefono('');
        setEmpresaRazonSocial('');
        setRfc('');
        setCantidad(1);
        if (isAdmin) {
          fetchMembresiasReporte();
        }
      } else {
        setError(data.error?.message || data.message || 'Ocurrió un error al procesar la emisión con salud.today.');
      }
    } catch (err: any) {
      setError('Error al procesar la solicitud de venta.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatMoney = (centavos: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(centavos / 100);
  };

  // Filtrado de membresías para el reporte
  const filteredMembresias = useMemo(() => {
    return membresias.filter((m) => {
      const text = `${m.folio || ''} ${m.titular?.nombre || ''} ${m.titular?.apellidos || ''} ${m.titular?.correo || ''} ${m.plan?.nombre || ''} ${m.agente_nombre || ''} ${m.oficina_nombre || ''}`.toLowerCase();
      const matchSearch = !reportSearch || text.includes(reportSearch.toLowerCase());
      const matchOficina = filtroOficina === 'todas' || m.oficina_nombre === filtroOficina;
      const matchVendedor = filtroVendedor === 'todos' || m.agente_nombre === filtroVendedor;
      return matchSearch && matchOficina && matchVendedor;
    });
  }, [membresias, reportSearch, filtroOficina, filtroVendedor]);

  // Exportar Excel en formato / layout SICAS
  const exportarReporteSICAS = () => {
    if (filteredMembresias.length === 0) return;

    const exportRows = filteredMembresias.map((m) => {
      const precioUnitario = (m.plan?.precio_centavos || 0) / 100;
      return {
        'Documento / Folio': m.folio || m.id,
        'Fecha Captura': m.created_at ? new Date(m.created_at).toLocaleDateString('es-MX') : new Date().toLocaleDateString('es-MX'),
        'Vigencia Desde': m.vigencia_inicio ? new Date(m.vigencia_inicio).toLocaleDateString('es-MX') : new Date().toLocaleDateString('es-MX'),
        'Vigencia Hasta': m.vigencia_fin ? new Date(m.vigencia_fin).toLocaleDateString('es-MX') : '—',
        'Cliente / Titular': `${m.titular?.nombre || ''} ${m.titular?.apellidos || ''}`.trim(),
        'Correo': m.titular?.correo || '',
        'Teléfono': m.titular?.telefono || '',
        'Plan Salud': m.plan?.nombre || 'Plan salud.today',
        'Periodicidad': m.plan?.periodicidad === 'year' ? 'Anual' : 'Mensual',
        'Importe Pesos': precioUnitario,
        'Moneda': 'MXN',
        'Estatus': m.status || 'Activa',
        'ID Vendedor SICAS': m.agente_id_sicas || 'MOVI-01',
        'Vendedor SICAS': m.agente_nombre || 'Agente MOVI',
        'Despacho / Oficina': m.oficina_nombre || 'Matriz',
        'Compañía': 'salud.today',
        'Ramo': 'Salud & Asistencias',
        'Forma de Pago': 'Contado / SPEI'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Ventas_SICAS_SaludToday');
    XLSX.writeFile(workbook, `Reporte_SICAS_SaludToday_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-50/80 to-white pb-16">
      {/* Cobranding Header Banner */}
      <div className="bg-white border-b border-slate-200/80 sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-4">
            {/* MOVI Logo */}
            <div className="flex items-center gap-2">
              <img 
                src="/logo_color.png" 
                alt="MOVI Digital" 
                className="h-7 w-auto object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 hidden sm:inline">
                x
              </span>
            </div>

            {/* salud.today Logo */}
            <div className="flex items-center gap-2 border-l sm:border-l-0 pl-3 sm:pl-0 border-slate-200">
              <img 
                src="/salud-today-logo.png" 
                alt="salud.today" 
                className="h-7 w-auto object-contain"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Tab selector para Administradores */}
            {isAdmin && (
              <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 mr-2 border border-slate-200">
                <button
                  onClick={() => setActiveTab('emision')}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer",
                    activeTab === 'emision' ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Emisión
                </button>
                <button
                  onClick={() => setActiveTab('reportes')}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer",
                    activeTab === 'reportes' ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Reporte SICAS
                </button>
              </div>
            )}

            <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Emisión Digital Activa 24/7
            </span>
            <button
              onClick={() => {
                fetchPlanes();
                if (activeTab === 'reportes') fetchMembresiasReporte();
              }}
              disabled={loading || loadingReporte}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", (loading || loadingReporte) && "animate-spin text-emerald-600")} />
              <span className="hidden sm:inline">Sincronizar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white p-6 sm:p-10 shadow-xl border border-slate-800">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-medium backdrop-blur-xs mb-4 border border-emerald-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              Módulo de Salud & Beneficios Integrados
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
              {activeTab === 'reportes' ? 'Reporte de Ventas SICAS' : 'Emisión de Membresías'} <span className="text-emerald-400">salud.today</span>
            </h1>
            <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed">
              {activeTab === 'reportes' 
                ? 'Monitorea las membresías emitidas y exporta el layout compatible con SICAS para el registro y conciliación de producción por vendedor y despacho/oficina.'
                : 'Expide y activa en tiempo real coberturas de telemedicina 24/7, asistencias médicas, plan dental, visión y beneficios para individuos y empresas a través de MOVI Digital.'}
            </p>

            <div className="mt-6 flex flex-wrap gap-4 text-xs sm:text-sm text-slate-200">
              <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl backdrop-blur-xs">
                <Stethoscope className="w-4 h-4 text-emerald-400" />
                <span>Telemedicina 24/7 Ilimitada</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl backdrop-blur-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Activación Inmediata</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl backdrop-blur-xs">
                <Award className="w-4 h-4 text-emerald-400" />
                <span>Red Médica Nacional</span>
              </div>
            </div>
          </div>

          <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-15 pointer-events-none hidden lg:flex items-center justify-center">
            <HeartHandshake className="w-80 h-80 text-emerald-300" />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Alertas */}
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-700 text-sm shadow-xs">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
            <div>
              <p className="font-semibold">Error al procesar la solicitud</p>
              <p className="text-red-600 text-xs mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm shadow-xs">
            <div className="flex items-center gap-2 font-bold text-emerald-800 text-base">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              {successMsg}
            </div>
            <p className="text-xs text-emerald-700 mt-1">
              La membresía ha sido emitida y registrada con éxito en salud.today con trazabilidad para su reporte en SICAS.
            </p>
          </div>
        )}

        {/* CONTENIDO SEGÚN TAB ACTIVA */}
        {activeTab === 'reportes' && isAdmin ? (
          /* TAB DE REPORTE SICAS */
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                    Consolidado de Ventas para SICAS
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Membresías registradas con atribución a vendedores y despachos de MOVI Digital.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={exportarReporteSICAS}
                    disabled={filteredMembresias.length === 0}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download className="w-4 h-4" />
                    Descargar Formato SICAS (.xlsx)
                  </button>
                </div>
              </div>

              {/* Filtros de Reporte */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Buscar por folio, cliente o correo..."
                    value={reportSearch}
                    onChange={(e) => setReportSearch(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <select
                    value={filtroOficina}
                    onChange={(e) => setFiltroOficina(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="todas">Todas las Oficinas</option>
                    {oficinasList.map(o => (
                      <option key={o.id} value={o.nombre}>{o.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <select
                    value={filtroVendedor}
                    onChange={(e) => setFiltroVendedor(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="todos">Todos los Vendedores</option>
                    {vendedoresList.map(v => (
                      <option key={v.id} value={v.nombre}>{v.nombre} {v.id_sicas ? `(${v.id_sicas})` : ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tabla de Resultados */}
              <div className="mt-6 overflow-x-auto border border-slate-200 rounded-2xl">
                {loadingReporte ? (
                  <div className="py-16 text-center text-sm text-slate-500 flex flex-col items-center justify-center gap-3">
                    <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
                    <span>Consultando ventas de membresías...</span>
                  </div>
                ) : filteredMembresias.length === 0 ? (
                  <div className="py-16 text-center text-sm text-slate-500">
                    No se encontraron registros de ventas con los filtros aplicados.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                      <tr>
                        <th className="px-4 py-3">Folio / ID</th>
                        <th className="px-4 py-3">Cliente / Titular</th>
                        <th className="px-4 py-3">Plan</th>
                        <th className="px-4 py-3">Importe</th>
                        <th className="px-4 py-3">Vendedor SICAS</th>
                        <th className="px-4 py-3">Oficina</th>
                        <th className="px-4 py-3">Estatus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredMembresias.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/60 transition">
                          <td className="px-4 py-3 font-mono font-bold text-slate-900">
                            {item.folio || item.id}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">
                              {item.titular?.nombre} {item.titular?.apellidos}
                            </div>
                            <div className="text-[11px] text-slate-400">{item.titular?.correo}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-medium text-slate-800">{item.plan?.nombre || 'Plan Estándar'}</span>
                            <span className="text-[10px] text-slate-400 block">
                              {item.plan?.periodicidad === 'year' ? 'Anual' : 'Mensual'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-bold text-emerald-700">
                            {formatMoney(item.plan?.precio_centavos || 0)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900">{item.agente_nombre}</div>
                            <div className="text-[10px] font-mono text-slate-400">ID: {item.agente_id_sicas}</div>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-700">
                            {item.oficina_nombre}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {item.status || 'Activa'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* TAB DE EMISIÓN DE MEMBRESÍAS */
          <>
            {/* Selector de Tipo de Emisión (Tabs modernas) */}
            <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs inline-flex w-full sm:w-auto mb-8">
              <button
                onClick={() => setTipoEmision('individual')}
                className={cn(
                  "flex-1 sm:flex-initial flex items-center justify-center gap-2.5 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer",
                  tipoEmision === 'individual'
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                <User className="w-4 h-4" />
                Emisión Individual / Familiar
              </button>
              <button
                onClick={() => setTipoEmision('corporativa')}
                className={cn(
                  "flex-1 sm:flex-initial flex items-center justify-center gap-2.5 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer",
                  tipoEmision === 'corporativa'
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                <Building2 className="w-4 h-4" />
                Emisión Corporativa / Colectiva
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Columna Izquierda: Selección de Plan */}
              <div className="lg:col-span-7 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black flex items-center justify-center">1</span>
                    Elige el Plan de Salud
                  </h2>
                  <span className="text-xs text-slate-500">
                    {planes.length} opciones disponibles
                  </span>
                </div>

                {loading ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-sm text-slate-500 flex flex-col items-center justify-center gap-3">
                    <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
                    <span>Cargando catálogo oficial de salud.today...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {planes.map((plan) => {
                      const isSelected = selectedPlanId === plan.id;
                      const isAnual = plan.periodicidad === 'year';

                      return (
                        <div
                          key={plan.id}
                          onClick={() => setSelectedPlanId(plan.id)}
                          className={cn(
                            "relative rounded-2xl p-5 border-2 transition-all cursor-pointer flex flex-col justify-between text-left",
                            isSelected
                              ? "border-emerald-600 bg-emerald-50/40 shadow-md ring-2 ring-emerald-500/20"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs"
                          )}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/70 px-2.5 py-0.5 rounded-full">
                                {isAnual ? 'Anual (Ahorro)' : 'Mensual'}
                              </span>
                              {isSelected && (
                                <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                </div>
                              )}
                            </div>

                            <h3 className="text-base font-bold text-slate-900 mt-3">
                              {plan.nombre}
                            </h3>
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                              {plan.descripcion || 'Acceso total a la red de beneficios médicos, telemedicina y descuentos exclusivos.'}
                            </p>
                          </div>

                          <div className="mt-5 pt-4 border-t border-slate-100 flex items-baseline justify-between">
                            <div>
                              <span className="text-2xl font-black text-slate-900">
                                {formatMoney(plan.precio_centavos)}
                              </span>
                              <span className="text-[11px] text-slate-500 font-medium ml-1">
                                /{isAnual ? 'año' : 'mes'}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 uppercase font-semibold">
                              {plan.moneda}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Coberturas y Beneficios Incluidos */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
                    Servicios y asistencias 24/7 incluidas en todas las membresías
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-slate-700">
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50">
                      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>Orientación médica 24/7</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50">
                      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>Ambulancia de urgencia</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50">
                      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>Médico a domicilio</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50">
                      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>Psicología y Nutrición</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50">
                      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>Plan Dental y Visión</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50">
                      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>Cine 2x1 y Beneficios</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Columna Derecha: Formulario de Registro y Venta */}
              <div className="lg:col-span-5">
                <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-lg sticky top-20">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black flex items-center justify-center">2</span>
                      Datos de Emisión y Cliente
                    </h2>
                  </div>

                  <form onSubmit={handleEmitirVenta} className="mt-5 space-y-4">
                    {/* Atribución a Vendedor y Oficina (Para trazabilidad y reporte SICAS) */}
                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                        Asignación de Venta (SICAS)
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Vendedor / Agente
                          </label>
                          <select
                            value={selectedVendedorId}
                            onChange={(e) => setSelectedVendedorId(e.target.value)}
                            disabled={!isAdmin && !!usuario?.id}
                            className="w-full text-xs border border-slate-300 rounded-xl px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white disabled:bg-slate-100"
                          >
                            {vendedoresList.map(v => (
                              <option key={v.id} value={v.id}>
                                {v.nombre} {v.id_sicas ? `(${v.id_sicas})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Despacho / Oficina
                          </label>
                          <select
                            value={selectedOficinaId}
                            onChange={(e) => setSelectedOficinaId(e.target.value)}
                            disabled={!isAdmin && !!usuario?.oficina_id}
                            className="w-full text-xs border border-slate-300 rounded-xl px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white disabled:bg-slate-100"
                          >
                            {oficinasList.map(o => (
                              <option key={o.id} value={o.id}>
                                {o.nombre}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Campos Corporativos si aplica */}
                    {tipoEmision === 'corporativa' && (
                      <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 space-y-3">
                        <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
                          Datos de la Empresa
                        </span>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Razón Social / Empresa *
                          </label>
                          <input
                            type="text"
                            required
                            value={empresaRazonSocial}
                            onChange={(e) => setEmpresaRazonSocial(e.target.value)}
                            placeholder="Ej. Grupo Industrial S.A. de C.V."
                            className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              RFC Empresa
                            </label>
                            <input
                              type="text"
                              value={rfc}
                              onChange={(e) => setRfc(e.target.value.toUpperCase())}
                              placeholder="XAXX010101000"
                              className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white uppercase"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Cantidad Membresías *
                            </label>
                            <input
                              type="number"
                              min="1"
                              required
                              value={cantidad}
                              onChange={(e) => setCantidad(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          {tipoEmision === 'corporativa' ? 'Nombre Contacto' : 'Nombre(s)'} *
                        </label>
                        <input
                          type="text"
                          required
                          value={nombre}
                          onChange={(e) => setNombre(e.target.value)}
                          placeholder="Ej. Carlos"
                          className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Apellidos *
                        </label>
                        <input
                          type="text"
                          required={tipoEmision === 'individual'}
                          value={apellidos}
                          onChange={(e) => setApellidos(e.target.value)}
                          placeholder="Ej. Martínez Luna"
                          className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Correo Electrónico *
                      </label>
                      <input
                        type="email"
                        required
                        value={correo}
                        onChange={(e) => setCorreo(e.target.value)}
                        placeholder="titular@correo.com"
                        className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Teléfono Móvil
                      </label>
                      <input
                        type="tel"
                        value={telefono}
                        onChange={(e) => setTelefono(e.target.value)}
                        placeholder="10 dígitos (ej. 5512345678)"
                        className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Método de Pago
                      </label>
                      <select
                        value={metodoPago}
                        onChange={(e) => setMetodoPago(e.target.value)}
                        className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                      >
                        <option value="transferencia">Transferencia SPEI / Banco</option>
                        <option value="tarjeta">Tarjeta de Débito / Crédito</option>
                        <option value="efectivo">Efectivo / Depósito</option>
                      </select>
                    </div>

                    {/* Resumen de Pago */}
                    {selectedPlan && (
                      <div className="pt-3 border-t border-slate-200">
                        <div className="p-4 bg-emerald-50/80 rounded-2xl border border-emerald-200/60 flex items-center justify-between">
                          <div>
                            <span className="text-xs text-emerald-800 font-medium block">
                              Total a Pagar {tipoEmision === 'corporativa' && `(${cantidad} membresías)`}:
                            </span>
                            <span className="text-xs text-emerald-600">
                              {selectedPlan.nombre} ({selectedPlan.periodicidad === 'year' ? 'Anual' : 'Mensual'})
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-xl font-black text-emerald-900">
                              {formatMoney(selectedPlan.precio_centavos * (tipoEmision === 'corporativa' ? cantidad : 1))}
                            </span>
                            <span className="text-[10px] text-emerald-700 block">MXN</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={submitting || !selectedPlanId}
                      className="w-full mt-2 py-3.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      <span>
                        {submitting 
                          ? 'Procesando con salud.today...' 
                          : `Completar Emisión ${tipoEmision === 'corporativa' ? 'Corporativa' : 'Individual'}`}
                      </span>
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
