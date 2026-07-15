import { useState, useEffect, useCallback } from 'react';
import { User, Car, ChevronRight, ChevronLeft, Plus, X, Truck, Loader2 } from 'lucide-react';
import type { Cliente, Vehiculo, PaqueteCobertura, FormaPago, CoberturasPersonalizadasCliente, FleetVehicleConfig } from './multiAutosTypes';
import { fetchMarcas, fetchAniosForMarca, fetchModelosForMarcaAnio, fetchVersiones, fetchCatalogSyncStatus, type CatalogSyncStatus } from './multiAutosCatalog';

interface QuoteFormProps {
  onCalculate: (
    cliente: Cliente,
    vehiculos: FleetVehicleConfig[],
    formaPago: FormaPago
  ) => void;
  isCalculating: boolean;
}

const DEFAULT_COBERTURAS: CoberturasPersonalizadasCliente = {
  deducibleDanosMateriales: '5%',
  deducibleRoboTotal: '10%',
  sumaAseguradaRC: '$3,000,000',
  gastosMedicos: true,
  asistenciaVial: true,
  autoSustituto: false,
  defensa_legal: true,
};

interface VehicleFormState {
  id: string;
  brand: string;
  anio: string;
  model: string;
  vehicle: Vehiculo | null;
  paquete: PaqueteCobertura;
  coberturas: CoberturasPersonalizadasCliente;
}

function VehicleSelector({ state, onChange, onRemove, index, canRemove, allMarcas }: {
  state: VehicleFormState;
  onChange: (s: VehicleFormState) => void;
  onRemove: () => void;
  index: number;
  canRemove: boolean;
  allMarcas: string[];
}) {
  const [anios, setAnios] = useState<number[]>([]);
  const [modelos, setModelos] = useState<string[]>([]);
  const [versiones, setVersiones] = useState<Vehiculo[]>([]);
  const [loadingAnios, setLoadingAnios] = useState(false);
  const [loadingModelos, setLoadingModelos] = useState(false);
  const [loadingVersiones, setLoadingVersiones] = useState(false);

  useEffect(() => {
    if (!state.brand) { setAnios([]); return; }
    setLoadingAnios(true);
    fetchAniosForMarca(state.brand).then((a) => { setAnios(a); setLoadingAnios(false); });
  }, [state.brand]);

  useEffect(() => {
    if (!state.brand || !state.anio) { setModelos([]); return; }
    setLoadingModelos(true);
    fetchModelosForMarcaAnio(state.brand, parseInt(state.anio)).then((m) => { setModelos(m); setLoadingModelos(false); });
  }, [state.brand, state.anio]);

  useEffect(() => {
    if (!state.brand || !state.anio || !state.model) { setVersiones([]); return; }
    setLoadingVersiones(true);
    fetchVersiones(state.brand, parseInt(state.anio), state.model).then((v) => { setVersiones(v); setLoadingVersiones(false); });
  }, [state.brand, state.anio, state.model]);

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3 relative">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <span className="text-xs font-bold text-blue-700 dark:text-blue-300">{index + 1}</span>
          </div>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {state.vehicle?.descripcionCompleta || 'Nuevo vehiculo'}
          </span>
        </div>
        {canRemove && (
          <button onClick={onRemove} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative">
          <select
            value={state.brand}
            onChange={(e) => onChange({ ...state, brand: e.target.value, anio: '', model: '', vehicle: null })}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Marca</option>
            {allMarcas.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        <div className="relative">
          <select
            value={state.anio}
            onChange={(e) => onChange({ ...state, anio: e.target.value, model: '', vehicle: null })}
            disabled={!state.brand || loadingAnios}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          >
            <option value="">{loadingAnios ? 'Cargando...' : 'Anio'}</option>
            {anios.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          {loadingAnios && <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin absolute right-8 top-1/2 -translate-y-1/2" />}
        </div>

        <div className="relative">
          <select
            value={state.model}
            onChange={(e) => onChange({ ...state, model: e.target.value, vehicle: null })}
            disabled={!state.anio || loadingModelos}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          >
            <option value="">{loadingModelos ? 'Cargando...' : 'Modelo'}</option>
            {modelos.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          {loadingModelos && <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin absolute right-8 top-1/2 -translate-y-1/2" />}
        </div>

        <div className="relative">
          <select
            value={state.vehicle?.id || ''}
            onChange={(e) => onChange({ ...state, vehicle: versiones.find((v) => v.id === e.target.value) || null })}
            disabled={!state.model || loadingVersiones}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          >
            <option value="">{loadingVersiones ? 'Cargando...' : 'Version'}</option>
            {versiones.map((v) => <option key={v.id} value={v.id}>{v.version}{v.valorReferencia > 0 ? ` - $${v.valorReferencia.toLocaleString()}` : ''}</option>)}
          </select>
          {loadingVersiones && <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin absolute right-8 top-1/2 -translate-y-1/2" />}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">Paquete:</span>
        {(['Amplia', 'Limitada', 'RC'] as PaqueteCobertura[]).map((p) => (
          <button
            key={p}
            onClick={() => onChange({ ...state, paquete: p })}
            className={`px-3 py-1 text-xs font-medium rounded-lg border transition-all ${
              state.paquete === p
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MultiAutosQuoteForm({ onCalculate, isCalculating }: QuoteFormProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [cliente, setCliente] = useState<Partial<Cliente>>({
    tipoPersona: 'Fisica',
    genero: 'Masculino',
  });
  const [formaPago, setFormaPago] = useState<FormaPago>('Anual');
  const [vehicles, setVehicles] = useState<VehicleFormState[]>([
    { id: 'v_1', brand: '', anio: '', model: '', vehicle: null, paquete: 'Amplia', coberturas: DEFAULT_COBERTURAS },
  ]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [marcas, setMarcas] = useState<string[]>([]);
  const [loadingMarcas, setLoadingMarcas] = useState(false);
  const [catalogStatus, setCatalogStatus] = useState<CatalogSyncStatus | null>(null);

  useEffect(() => {
    setLoadingMarcas(true);
    fetchMarcas().then((m) => { setMarcas(m); setLoadingMarcas(false); });
    fetchCatalogSyncStatus().then(setCatalogStatus);
  }, []);

  const validateStep1 = (): boolean => {
    const e: Record<string, string> = {};
    if (!cliente.nombre?.trim()) e.nombre = 'Nombre requerido';
    if (!cliente.codigoPostal?.match(/^\d{5}$/)) e.codigoPostal = 'CP de 5 digitos';
    if (!cliente.edad || cliente.edad < 18 || cliente.edad > 99) e.edad = 'Edad 18-99';
    if (!cliente.genero) e.genero = 'Genero requerido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (validateStep1()) setStep(2);
  };

  const addVehicle = () => {
    setVehicles([...vehicles, {
      id: `v_${Date.now()}`,
      brand: '', anio: '', model: '', vehicle: null,
      paquete: 'Amplia', coberturas: DEFAULT_COBERTURAS,
    }]);
  };

  const removeVehicle = (id: string) => {
    setVehicles(vehicles.filter((v) => v.id !== id));
  };

  const updateVehicle = useCallback((id: string, state: VehicleFormState) => {
    setVehicles((prev) => prev.map((v) => v.id === id ? state : v));
  }, []);

  const handleCalculate = () => {
    const configured = vehicles.filter((v) => v.vehicle !== null);
    if (configured.length === 0) {
      setErrors({ vehiculo: 'Selecciona al menos un vehiculo' });
      return;
    }
    const fullCliente: Cliente = {
      id: `cli_${Date.now()}`,
      nombre: cliente.nombre || '',
      tipoPersona: cliente.tipoPersona || 'Fisica',
      rfc: cliente.rfc || '',
      correo: cliente.correo || '',
      telefono: cliente.telefono || '',
      codigoPostal: cliente.codigoPostal || '',
      edad: cliente.edad || 30,
      genero: cliente.genero as 'Masculino' | 'Femenino',
    };
    const fleetConfigs: FleetVehicleConfig[] = configured.map((v) => ({
      vehiculo: v.vehicle!,
      paquete: v.paquete,
      coberturas: v.coberturas,
    }));
    onCalculate(fullCliente, fleetConfigs, formaPago);
  };

  const configuredCount = vehicles.filter((v) => v.vehicle).length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      {/* Step indicator */}
      <div className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${step === 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
              <User className="w-4 h-4" />
              1. Cliente
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${step === 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
              <Car className="w-4 h-4" />
              2. Flota
            </div>
          </div>
          {step === 2 && configuredCount >= 2 && (
            <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-medium px-3 py-1.5 rounded-full">
              <Truck className="w-3.5 h-3.5" />
              {configuredCount >= 4 ? '10% dto. volumen' : '5% dto. volumen'}
            </div>
          )}
        </div>
      </div>

      <div className="p-6">
        {step === 1 ? (
          <div className="space-y-5">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Datos del Conductor / Contratante</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre completo *</label>
                <input
                  type="text"
                  value={cliente.nombre || ''}
                  onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })}
                  className={`w-full px-4 py-2.5 rounded-xl border ${errors.nombre ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                  placeholder="Nombre del asegurado"
                />
                {errors.nombre && <p className="text-xs text-red-500 mt-1">{errors.nombre}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Codigo Postal *</label>
                <input
                  type="text"
                  maxLength={5}
                  value={cliente.codigoPostal || ''}
                  onChange={(e) => setCliente({ ...cliente, codigoPostal: e.target.value.replace(/\D/g, '') })}
                  className={`w-full px-4 py-2.5 rounded-xl border ${errors.codigoPostal ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                  placeholder="06600"
                />
                {errors.codigoPostal && <p className="text-xs text-red-500 mt-1">{errors.codigoPostal}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Edad *</label>
                <input
                  type="number"
                  min={18}
                  max={99}
                  value={cliente.edad || ''}
                  onChange={(e) => setCliente({ ...cliente, edad: parseInt(e.target.value) || 0 })}
                  className={`w-full px-4 py-2.5 rounded-xl border ${errors.edad ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                  placeholder="35"
                />
                {errors.edad && <p className="text-xs text-red-500 mt-1">{errors.edad}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Genero *</label>
                <select
                  value={cliente.genero}
                  onChange={(e) => setCliente({ ...cliente, genero: e.target.value as 'Masculino' | 'Femenino' })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Masculino">Masculino</option>
                  <option value="Femenino">Femenino</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Correo electronico</label>
                <input
                  type="email"
                  value={cliente.correo || ''}
                  onChange={(e) => setCliente({ ...cliente, correo: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="correo@ejemplo.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">RFC</label>
                <input
                  type="text"
                  value={cliente.rfc || ''}
                  onChange={(e) => setCliente({ ...cliente, rfc: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="XAXX010101000"
                />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={handleNext} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
                Siguiente <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Flota de Vehiculos</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  Catálogo oficial Quálitas en base propia · {marcas.length} marcas · {catalogStatus?.row_count?.toLocaleString() || 0} versiones
                </p>
                {catalogStatus?.source_file_date && (
                  <p className="text-[11px] text-gray-400 mt-1">
                    Fuente EMICAT: {catalogStatus.source_file_date} · {catalogStatus.status === 'awaiting_source' ? 'verificación diaria; esperando fuente vigente' : 'sincronización automática diaria'}
                  </p>
                )}
              </div>
              <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
                <ChevronLeft className="w-4 h-4" /> Volver
              </button>
            </div>

            {loadingMarcas ? (
              <div className="flex items-center justify-center py-8 gap-3 text-gray-500 dark:text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Cargando catalogo Qualitas...</span>
              </div>
            ) : (
              <div className="space-y-3">
                {vehicles.map((v, i) => (
                  <VehicleSelector
                    key={v.id}
                    state={v}
                    onChange={(s) => updateVehicle(v.id, s)}
                    onRemove={() => removeVehicle(v.id)}
                    index={i}
                    canRemove={vehicles.length > 1}
                    allMarcas={marcas}
                  />
                ))}
              </div>
            )}

            <button
              onClick={addVehicle}
              className="w-full py-2.5 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Agregar vehiculo a la flota
            </button>

            {errors.vehiculo && <p className="text-xs text-red-500">{errors.vehiculo}</p>}

            {/* Payment and global config */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Forma de Pago</label>
                  <select
                    value={formaPago}
                    onChange={(e) => setFormaPago(e.target.value as FormaPago)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Anual">Anual (sin recargo)</option>
                    <option value="Semestral">Semestral</option>
                    <option value="Trimestral">Trimestral</option>
                    <option value="Mensual">Mensual</option>
                  </select>
                </div>
                <div className="pt-6">
                  <button
                    onClick={handleCalculate}
                    disabled={isCalculating || configuredCount === 0}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCalculating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Cotizando...
                      </>
                    ) : (
                      <>Cotizar {configuredCount > 1 ? `${configuredCount} vehiculos` : ''}</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
