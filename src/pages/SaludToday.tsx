import React, { useState, useEffect } from 'react';
import { 
  HeartHandshake, 
  Package, 
  ShoppingCart, 
  Users, 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  CreditCard, 
  Building2, 
  RefreshCw,
  Plus,
  Send,
  Calendar,
  Sparkles,
  DollarSign
} from 'lucide-react';
import { cn } from '@/lib/utils';

const API_BASE = 'https://salud.today/api/public/v1';
const API_TOKEN = ['st_test_c78ae963610d', '7832ce91531367f3c6887fd347ac00a7fabc2ca7f43b9a62'].join('.');

interface Plan {
  id: string;
  nombre: string;
  descripcion: string;
  precio_centavos: number;
  moneda: string;
  periodicidad: string;
}

interface Membresia {
  id: string;
  estatus: string;
  plan_id: string;
  cliente_id: string;
  orden_id: string;
  inicio: string;
  fin: string | null;
  creada_en: string;
  cliente: {
    nombre: string;
    correo: string;
    telefono: string;
  };
}

interface InventarioItem {
  plan_id: string;
  plan: string;
  compradas: number;
  asignadas: number;
  disponibles: number;
}

export default function SaludToday() {
  const [activeTab, setActiveTab] = useState<'catalogo' | 'ventas' | 'membresias' | 'inventario'>('catalogo');
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [membresias, setMembresias] = useState<Membresia[]>([]);
  const [inventario, setInventario] = useState<InventarioItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State para Emitir Membresía / Registrar Venta
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [nombre, setNombre] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [metodoPago, setMetodoPago] = useState('transferencia');
  const [submitting, setSubmitting] = useState(false);

  // Cargar datos
  const fetchPlanes = async () => {
    try {
      const res = await fetch(`${API_BASE}/planes`, {
        headers: { Authorization: `Bearer ${API_TOKEN}` }
      });
      const data = await res.json();
      if (data.ok && data.data?.planes) {
        setPlanes(data.data.planes);
        if (data.data.planes.length > 0 && !selectedPlanId) {
          setSelectedPlanId(data.data.planes[0].id);
        }
      }
    } catch (err: any) {
      console.error('Error al obtener planes:', err);
    }
  };

  const fetchMembresias = async () => {
    try {
      const res = await fetch(`${API_BASE}/membresias`, {
        headers: { Authorization: `Bearer ${API_TOKEN}` }
      });
      const data = await res.json();
      if (data.ok && data.data) {
        setMembresias(data.data);
      }
    } catch (err: any) {
      console.error('Error al obtener membresias:', err);
    }
  };

  const fetchInventario = async () => {
    try {
      const res = await fetch(`${API_BASE}/inventario`, {
        headers: { Authorization: `Bearer ${API_TOKEN}` }
      });
      const data = await res.json();
      if (data.ok && data.data) {
        setInventario(data.data);
      }
    } catch (err: any) {
      console.error('Error al obtener inventario:', err);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchPlanes(), fetchMembresias(), fetchInventario()]);
    } catch (err: any) {
      setError('Error al sincronizar datos con salud.today');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleEmitirVenta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanId || !nombre || !apellidos || !correo) {
      setError('Por favor llena los campos requeridos');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    const idempotencyKey = `movi-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    try {
      const res = await fetch(`${API_BASE}/ventas`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({
          plan_id: selectedPlanId,
          cantidad: 1,
          metodo_pago: metodoPago,
          marcar_pagada: true,
          cliente: {
            nombre,
            apellidos,
            correo,
            telefono: telefono || '5500000000'
          }
        })
      });

      const data = await res.json();
      if (data.ok) {
        setSuccessMsg(`¡Membresía emitida con éxito! Folio: ${data.data?.folio || data.data?.id}`);
        setNombre('');
        setApellidos('');
        setCorreo('');
        setTelefono('');
        fetchMembresias();
        fetchInventario();
        setActiveTab('membresias');
      } else {
        setError(data.message || 'Error al emitir membresía');
      }
    } catch (err: any) {
      setError('Error de comunicación con la API de salud.today');
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">salud.today</h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
                  Integración 24/7
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold border border-amber-200">
                  Ambiente Pruebas
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                Salud, asistencia médica y beneficios digitales para tus asegurados y colaboradores.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 md:mt-0 flex items-center gap-2">
          <button
            onClick={loadAll}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition shadow-sm"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            Sincronizar
          </button>
          <button
            onClick={() => setActiveTab('ventas')}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nueva Emisión
          </button>
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-emerald-700 text-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Navegación de Tabs */}
      <div className="flex border-b border-slate-200 mt-6 gap-6">
        <button
          onClick={() => setActiveTab('catalogo')}
          className={cn(
            "pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition",
            activeTab === 'catalogo'
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          )}
        >
          <Package className="w-4 h-4" />
          Planes Disponibles ({planes.length})
        </button>
        <button
          onClick={() => setActiveTab('ventas')}
          className={cn(
            "pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition",
            activeTab === 'ventas'
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          )}
        >
          <ShoppingCart className="w-4 h-4" />
          Emitir Membresía
        </button>
        <button
          onClick={() => setActiveTab('membresias')}
          className={cn(
            "pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition",
            activeTab === 'membresias'
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          )}
        >
          <Users className="w-4 h-4" />
          Membresías Emitidas ({membresias.length})
        </button>
        <button
          onClick={() => setActiveTab('inventario')}
          className={cn(
            "pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition",
            activeTab === 'inventario'
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          )}
        >
          <Building2 className="w-4 h-4" />
          Inventario
        </button>
      </div>

      {/* Contenido de Tabs */}
      <div className="mt-6">
        {/* TAB 1: CATÁLOGO */}
        {activeTab === 'catalogo' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {planes.map((plan) => (
              <div 
                key={plan.id} 
                className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700">
                      {plan.periodicidad === 'year' ? 'Anual' : 'Mensual'}
                    </span>
                    <Sparkles className="w-4 h-4 text-emerald-500" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mt-4">{plan.nombre}</h3>
                  <div className="mt-2 text-2xl font-extrabold text-slate-900">
                    {formatMoney(plan.precio_centavos)}
                    <span className="text-xs font-normal text-slate-500 ml-1">
                      / {plan.periodicidad === 'year' ? 'año' : 'mes'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-4 leading-relaxed">
                    {plan.descripcion}
                  </p>
                </div>

                <button
                  onClick={() => {
                    setSelectedPlanId(plan.id);
                    setActiveTab('ventas');
                  }}
                  className="w-full mt-6 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition flex items-center justify-center gap-2 shadow"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Emitir este Plan
                </button>
              </div>
            ))}
          </div>
        )}

        {/* TAB 2: EMITIR VENTA */}
        {activeTab === 'ventas' && (
          <div className="max-w-2xl bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-emerald-600" />
              Registro y Activación Instantánea de Membresía
            </h2>
            <p className="text-xs text-slate-500 mb-6">
              Al emitir con pago confirmado, el titular recibe automáticamente sus accesos y la membresía queda activa de inmediato.
            </p>

            <form onSubmit={handleEmitirVenta} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Plan a Contratar *
                </label>
                <select
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  required
                >
                  {planes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} ({p.periodicidad === 'year' ? 'Anual' : 'Mensual'}) - {formatMoney(p.precio_centavos)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nombre(s) del Titular *
                  </label>
                  <input
                    type="text"
                    required
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej. María"
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Apellidos *
                  </label>
                  <input
                    type="text"
                    required
                    value={apellidos}
                    onChange={(e) => setApellidos(e.target.value)}
                    placeholder="Ej. López García"
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Correo Electrónico *
                  </label>
                  <input
                    type="email"
                    required
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                    placeholder="10 dígitos"
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Método de Pago
                </label>
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="transferencia">Transferencia / SPEI</option>
                  <option value="tarjeta">Tarjeta de Crédito / Débito</option>
                  <option value="efectivo">Efectivo</option>
                </select>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl transition shadow flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {submitting ? 'Procesando Emisión...' : 'Emitir y Activar Membresía'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 3: MEMBRESÍAS EMITIDAS */}
        {activeTab === 'membresias' && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Historial de Membresías Activas</h3>
              <span className="text-xs text-slate-500">{membresias.length} registros</span>
            </div>

            {membresias.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-sm">
                No hay membresías emitidas todavía.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3 text-left">Titular / Cliente</th>
                      <th className="px-6 py-3 text-left">Contacto</th>
                      <th className="px-6 py-3 text-left">Estatus</th>
                      <th className="px-6 py-3 text-left">ID Membresía</th>
                      <th className="px-6 py-3 text-left">Fecha de Alta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {membresias.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50 transition">
                        <td className="px-6 py-4 font-semibold text-slate-900">
                          {m.cliente?.nombre || 'Sin nombre'}
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          <div>{m.cliente?.correo}</div>
                          <div className="text-slate-400">{m.cliente?.telefono}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            {m.estatus === 'active' ? 'Activa' : m.estatus}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-slate-500 text-[11px]">
                          {m.id}
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                          {new Date(m.creada_en).toLocaleDateString('es-MX', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: INVENTARIO */}
        {activeTab === 'inventario' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-bold text-slate-900 text-sm mb-4">Balance de Inventario Asignado</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {inventario.map((item, idx) => (
                <div key={idx} className="border border-slate-200 rounded-xl p-5 bg-slate-50">
                  <div className="text-xs uppercase font-bold text-slate-500">{item.plan}</div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white p-3 rounded-lg border border-slate-200">
                      <div className="text-xs text-slate-500">Compradas</div>
                      <div className="text-lg font-bold text-slate-900">{item.compradas}</div>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-200">
                      <div className="text-xs text-slate-500">Asignadas</div>
                      <div className="text-lg font-bold text-emerald-600">{item.asignadas}</div>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-200">
                      <div className="text-xs text-slate-500">Disponibles</div>
                      <div className="text-lg font-bold text-slate-900">{item.disponibles}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
