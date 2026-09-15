import React, { useState, useEffect } from 'react';
import { 
  HeartHandshake, 
  Package, 
  ShoppingCart, 
  Building2, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Send,
  Sparkles,
  Users
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

export default function SaludToday() {
  const [tipoEmision, setTipoEmision] = useState<'individual' | 'corporativa'>('individual');
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
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

  // Cargar catálogo de planes disponibles desde salud.today
  const fetchPlanes = async () => {
    setLoading(true);
    setError(null);
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
      } else {
        setError(data.error?.message || 'No fue posible cargar el catálogo de planes.');
      }
    } catch (err: any) {
      setError('Error de comunicación al consultar los planes de salud.today.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlanes();
  }, []);

  const selectedPlan = planes.find(p => p.id === selectedPlanId);

  // Flujo de Venta y Emisión Directa
  const handleEmitirVenta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanId || !nombre || !correo) {
      setError('Por favor llena los datos requeridos.');
      return;
    }

    if (tipoEmision === 'corporativa' && (!empresaRazonSocial || cantidad < 1)) {
      setError('Para emisión corporativa debes indicar la razón social de la empresa y la cantidad.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    setVentaResult(null);

    const idempotencyKey = `movi-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    try {
      const payload: any = {
        plan_id: selectedPlanId,
        cantidad: tipoEmision === 'corporativa' ? cantidad : 1,
        metodo_pago: metodoPago,
        marcar_pagada: true, // Emisión y activación inmediata
        cliente: {
          nombre: tipoEmision === 'corporativa' ? `${nombre} (${empresaRazonSocial})` : nombre,
          apellidos: apellidos || (tipoEmision === 'corporativa' ? 'Corporativo' : ''),
          correo,
          telefono: telefono || '5500000000'
        }
      };

      if (tipoEmision === 'corporativa' && rfc) {
        payload.notas = `RFC: ${rfc} | Razón Social: ${empresaRazonSocial}`;
      }

      const res = await fetch(`${API_BASE}/ventas`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.ok) {
        setSuccessMsg(`¡Emisión exitosa! Folio: ${data.data?.folio || data.data?.id || 'Generado'}`);
        setVentaResult(data.data);
        // Reset campos cliente
        setNombre('');
        setApellidos('');
        setCorreo('');
        setTelefono('');
        setEmpresaRazonSocial('');
        setRfc('');
        setCantidad(1);
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

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-6 border-b border-surface-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/20">
            <HeartHandshake className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Emisión salud.today</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
                24/7 Digital
              </span>
            </div>
            <p className="text-sm text-surface-500 mt-0.5">
              Emisión directa de membresías de salud individuales y corporativas con activación inmediata.
            </p>
          </div>
        </div>

        <div className="mt-4 md:mt-0 flex items-center gap-2">
          <button
            onClick={fetchPlanes}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-surface-700 bg-white border border-surface-300 rounded-lg hover:bg-surface-50 transition shadow-sm"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            Actualizar Planes
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
        <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            {successMsg}
          </div>
          {ventaResult && (
            <p className="text-xs text-emerald-700 mt-1">
              La membresía ha sido activada de inmediato en salud.today.
            </p>
          )}
        </div>
      )}

      {/* Selector de Tipo de Emisión */}
      <div className="mt-8 flex border-b border-surface-200 gap-4">
        <button
          onClick={() => setTipoEmision('individual')}
          className={cn(
            "pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition",
            tipoEmision === 'individual'
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-surface-500 hover:text-surface-800"
          )}
        >
          <User className="w-4 h-4" />
          Emisión Individual / Familiar
        </button>
        <button
          onClick={() => setTipoEmision('corporativa')}
          className={cn(
            "pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition",
            tipoEmision === 'corporativa'
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-surface-500 hover:text-surface-800"
          )}
        >
          <Building2 className="w-4 h-4" />
          Emisión Corporativa / Colectiva
        </button>
      </div>

      {/* Planes Disponibles (Catálogo) */}
      <div className="mt-6">
        <h2 className="text-sm font-bold text-surface-900 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Package className="w-4 h-4 text-emerald-600" />
          1. Selecciona el Plan ({planes.length} disponibles)
        </h2>

        {loading ? (
          <div className="p-8 text-center text-sm text-surface-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
            Cargando catálogo de salud.today...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {planes.map((plan) => {
              const isSelected = selectedPlanId === plan.id;
              return (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={cn(
                    "cursor-pointer rounded-2xl border p-5 transition flex flex-col justify-between relative",
                    isSelected
                      ? "border-emerald-600 bg-emerald-50/40 shadow-sm ring-2 ring-emerald-500/20"
                      : "border-surface-200 bg-white hover:border-surface-300 shadow-sm"
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                        {plan.periodicidad === 'year' ? 'Anual' : 'Mensual'}
                      </span>
                      {isSelected && (
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-surface-900 mt-3">{plan.nombre}</h3>
                    <div className="mt-1 text-xl font-extrabold text-surface-900">
                      {formatMoney(plan.precio_centavos)}
                      <span className="text-xs font-normal text-surface-500 ml-1">
                        / {plan.periodicidad === 'year' ? 'año' : 'mes'}
                      </span>
                    </div>
                    <p className="text-xs text-surface-600 mt-3 line-clamp-3 leading-relaxed">
                      {plan.descripcion}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-surface-200/60 flex items-center justify-between text-xs font-semibold">
                    <span className={isSelected ? "text-emerald-700 font-bold" : "text-surface-500"}>
                      {isSelected ? "Seleccionado" : "Elegir"}
                    </span>
                    <div className={cn(
                      "w-4 h-4 rounded-full border flex items-center justify-center",
                      isSelected ? "border-emerald-600 bg-emerald-600 text-white" : "border-surface-300"
                    )}>
                      {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Formulario de Emisión Directa */}
      <div className="mt-8 bg-white rounded-2xl border border-surface-200 p-6 md:p-8 shadow-sm">
        <h2 className="text-base font-bold text-surface-900 mb-1 flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-emerald-600" />
          2. Datos de Emisión y {tipoEmision === 'corporativa' ? 'Contratante Corporativo' : 'Titular'}
        </h2>
        <p className="text-xs text-surface-500 mb-6">
          Los montos se procesan en MXN y se genera la activación inmediata en salud.today.
        </p>

        <form onSubmit={handleEmitirVenta} className="space-y-4 max-w-3xl">
          {tipoEmision === 'corporativa' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-surface-50 rounded-xl border border-surface-200 mb-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-surface-700 mb-1">
                  Razón Social / Empresa *
                </label>
                <input
                  type="text"
                  required
                  value={empresaRazonSocial}
                  onChange={(e) => setEmpresaRazonSocial(e.target.value)}
                  placeholder="Ej. Grupo Comercial Jiro S.A. de C.V."
                  className="w-full text-sm border border-surface-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">
                  RFC Empresa
                </label>
                <input
                  type="text"
                  value={rfc}
                  onChange={(e) => setRfc(e.target.value.toUpperCase())}
                  placeholder="XAXX010101000"
                  className="w-full text-sm border border-surface-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">
                  Cantidad de Membresías *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={cantidad}
                  onChange={(e) => setCantidad(parseInt(e.target.value) || 1)}
                  className="w-full text-sm border border-surface-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-surface-700 mb-1">
                {tipoEmision === 'corporativa' ? 'Contacto / Representante (Nombre)' : 'Nombre(s) del Titular'} *
              </label>
              <input
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Roberto"
                className="w-full text-sm border border-surface-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-700 mb-1">
                Apellidos *
              </label>
              <input
                type="text"
                required={tipoEmision === 'individual'}
                value={apellidos}
                onChange={(e) => setApellidos(e.target.value)}
                placeholder="Ej. Hernández Morales"
                className="w-full text-sm border border-surface-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-surface-700 mb-1">
                Correo Electrónico (para envío de accesos) *
              </label>
              <input
                type="email"
                required
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="titular@empresa.com"
                className="w-full text-sm border border-surface-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-700 mb-1">
                Teléfono de Contacto
              </label>
              <input
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="10 dígitos"
                className="w-full text-sm border border-surface-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-surface-700 mb-1">
                Método de Pago
              </label>
              <select
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value)}
                className="w-full text-sm border border-surface-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="transferencia">Transferencia Electrónica / SPEI</option>
                <option value="tarjeta">Tarjeta de Crédito / Débito</option>
                <option value="efectivo">Efectivo</option>
              </select>
            </div>

            {selectedPlan && (
              <div className="p-3 bg-surface-50 rounded-xl border border-surface-200 flex flex-col justify-center">
                <span className="text-[11px] text-surface-500">Total a Emitir:</span>
                <span className="text-lg font-bold text-surface-900">
                  {formatMoney(selectedPlan.precio_centavos * (tipoEmision === 'corporativa' ? cantidad : 1))} MXN
                </span>
              </div>
            )}
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={submitting || !selectedPlanId}
              className="w-full sm:w-auto px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl transition shadow flex items-center justify-center gap-2"
            >
              {submitting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {submitting ? 'Emitiendo en salud.today...' : `Emitir Membresía ${tipoEmision === 'corporativa' ? 'Corporativa' : 'Individual'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
