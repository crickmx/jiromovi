import React, { useState, useEffect } from 'react';
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
  ExternalLink
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
            <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Emisión Digital Activa 24/7
            </span>
            <button
              onClick={fetchPlanes}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin text-emerald-600")} />
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
              Emisión de Membresías <span className="text-emerald-400">salud.today</span>
            </h1>
            <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed">
              Expide y activa en tiempo real coberturas de telemedicina 24/7, asistencias médicas, plan dental, visión y beneficios para individuos y empresas a través de MOVI Digital.
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
              La membresía ha sido emitida y registrada con éxito en el catálogo de salud.today. El titular recibirá los datos de acceso a su correo electrónico.
            </p>
          </div>
        )}

        {/* Selector de Tipo de Emisión (Tabs modernas) */}
        <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs inline-flex w-full sm:w-auto mb-8">
          <button
            onClick={() => setTipoEmision('individual')}
            className={cn(
              "flex-1 sm:flex-initial flex items-center justify-center gap-2.5 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all",
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
              "flex-1 sm:flex-initial flex items-center justify-center gap-2.5 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all",
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
                        "relative cursor-pointer rounded-2xl p-5 transition-all flex flex-col justify-between text-left",
                        isSelected
                          ? "bg-emerald-50/50 border-2 border-emerald-600 shadow-md ring-4 ring-emerald-500/10"
                          : "bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm"
                      )}
                    >
                      {isAnual && (
                        <div className="absolute -top-3 right-4 bg-emerald-600 text-white text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full shadow-xs">
                          Ahorro 2 meses gratis
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className={cn(
                            "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md",
                            isAnual ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
                          )}>
                            {isAnual ? 'Plan Anual' : 'Plan Mensual'}
                          </span>
                          <div className={cn(
                            "w-5 h-5 rounded-full border flex items-center justify-center transition-colors",
                            isSelected ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white"
                          )}>
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </div>

                        <h3 className="text-lg font-bold text-slate-900 mt-1">{plan.nombre}</h3>
                        <div className="mt-2 text-2xl font-black text-slate-900">
                          {formatMoney(plan.precio_centavos)}
                          <span className="text-xs font-normal text-slate-500 ml-1">
                            / {isAnual ? 'año' : 'mes'}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                          {plan.descripcion}
                        </p>
                      </div>

                      <div className="mt-5 pt-3 border-t border-slate-100 flex items-center text-xs font-medium text-emerald-700">
                        <span>{isSelected ? 'Plan seleccionado' : 'Seleccionar este plan'}</span>
                        <ChevronRight className="w-3.5 h-3.5 ml-auto" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Coberturas Destacadas */}
            <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Beneficios incluidos en salud.today
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Telemedicina 24/7</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Médico a domicilio</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Ambulancia de emergencia</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Plan Dental y Visión</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Psicología y Nutrición</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Club 10K+ & Cine 2x1</span>
                </div>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Formulario de Emisión */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-lg shadow-slate-200/50 sticky top-20">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-1">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black flex items-center justify-center">2</span>
                {tipoEmision === 'corporativa' ? 'Datos Corporativos & Titular' : 'Datos del Titular'}
              </h2>
              <p className="text-xs text-slate-500 mb-5">
                Ingresa los datos para registrar y activar la membresía al instante.
              </p>

              <form onSubmit={handleEmitirVenta} className="space-y-4">
                {tipoEmision === 'corporativa' && (
                  <div className="space-y-3.5 p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Razón Social / Empresa *
                      </label>
                      <input
                        type="text"
                        required
                        value={empresaRazonSocial}
                        onChange={(e) => setEmpresaRazonSocial(e.target.value)}
                        placeholder="Ej. Grupo Empresarial S.A. de C.V."
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
                          className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
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
      </div>
    </div>
  );
}
