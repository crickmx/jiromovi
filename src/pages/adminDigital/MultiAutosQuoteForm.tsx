import { useState } from 'react';
import { User, Car, ChevronRight, ChevronLeft } from 'lucide-react';
import type { Cliente, Vehiculo, PaqueteCobertura, FormaPago, CoberturasPersonalizadasCliente } from './multiAutosTypes';
import { getAvailableBrands, getModelsForBrand, getVersionsForModel } from './multiAutosCatalog';

interface QuoteFormProps {
  onCalculate: (
    cliente: Cliente,
    vehiculo: Vehiculo,
    paquete: PaqueteCobertura,
    formaPago: FormaPago,
    coberturas: CoberturasPersonalizadasCliente
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

export function MultiAutosQuoteForm({ onCalculate, isCalculating }: QuoteFormProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [cliente, setCliente] = useState<Partial<Cliente>>({
    tipoPersona: 'Fisica',
    genero: 'Masculino',
  });
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehiculo | null>(null);
  const [paquete, setPaquete] = useState<PaqueteCobertura>('Amplia');
  const [formaPago, setFormaPago] = useState<FormaPago>('Anual');
  const [coberturas, setCoberturas] = useState<CoberturasPersonalizadasCliente>(DEFAULT_COBERTURAS);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const brands = getAvailableBrands();
  const models = selectedBrand ? getModelsForBrand(selectedBrand) : [];
  const versions = selectedBrand && selectedModel ? getVersionsForModel(selectedBrand, selectedModel) : [];

  const validateStep1 = (): boolean => {
    const e: Record<string, string> = {};
    if (!cliente.nombre?.trim()) e.nombre = 'Nombre requerido';
    if (!cliente.codigoPostal?.match(/^\d{5}$/)) e.codigoPostal = 'CP de 5 digitos';
    if (!cliente.edad || cliente.edad < 18 || cliente.edad > 99) e.edad = 'Edad entre 18 y 99';
    if (!cliente.genero) e.genero = 'Genero requerido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (validateStep1()) setStep(2);
  };

  const handleCalculate = () => {
    if (!selectedVehicle) {
      setErrors({ vehiculo: 'Selecciona un vehiculo' });
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
    onCalculate(fullCliente, selectedVehicle, paquete, formaPago, coberturas);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      {/* Step indicator */}
      <div className="bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${step === 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}`}>
            <User className="w-4 h-4" />
            1. Cliente
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${step === 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}`}>
            <Car className="w-4 h-4" />
            2. Vehiculo
          </div>
        </div>
      </div>

      <div className="p-6">
        {step === 1 ? (
          <div className="space-y-5">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Datos del Cliente</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre completo *</label>
                <input
                  type="text"
                  value={cliente.nombre || ''}
                  onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })}
                  className={`w-full px-4 py-2.5 rounded-xl border ${errors.nombre ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
                  placeholder="Nombre del asegurado"
                />
                {errors.nombre && <p className="text-xs text-red-500 mt-1">{errors.nombre}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo Persona</label>
                <select
                  value={cliente.tipoPersona}
                  onChange={(e) => setCliente({ ...cliente, tipoPersona: e.target.value as 'Fisica' | 'Moral' })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Fisica">Fisica</option>
                  <option value="Moral">Moral</option>
                </select>
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
                  className={`w-full px-4 py-2.5 rounded-xl border ${errors.genero ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                >
                  <option value="Masculino">Masculino</option>
                  <option value="Femenino">Femenino</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Correo</label>
                <input
                  type="email"
                  value={cliente.correo || ''}
                  onChange={(e) => setCliente({ ...cliente, correo: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="correo@ejemplo.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Telefono</label>
                <input
                  type="tel"
                  value={cliente.telefono || ''}
                  onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="55 1234 5678"
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
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
              >
                Siguiente
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Seleccionar Vehiculo</h3>
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                <ChevronLeft className="w-4 h-4" />
                Volver
              </button>
            </div>

            {/* Vehicle selection */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Marca</label>
                <select
                  value={selectedBrand}
                  onChange={(e) => { setSelectedBrand(e.target.value); setSelectedModel(''); setSelectedVehicle(null); }}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Seleccionar marca</option>
                  {brands.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Modelo</label>
                <select
                  value={selectedModel}
                  onChange={(e) => { setSelectedModel(e.target.value); setSelectedVehicle(null); }}
                  disabled={!selectedBrand}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                >
                  <option value="">Seleccionar modelo</option>
                  {models.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Version</label>
                <select
                  value={selectedVehicle?.id || ''}
                  onChange={(e) => setSelectedVehicle(versions.find((v) => v.id === e.target.value) || null)}
                  disabled={!selectedModel}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                >
                  <option value="">Seleccionar version</option>
                  {versions.map((v) => <option key={v.id} value={v.id}>{v.version} - ${v.valorReferencia.toLocaleString()}</option>)}
                </select>
              </div>
            </div>

            {selectedVehicle && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-200">{selectedVehicle.descripcionCompleta}</p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">Valor referencia: ${selectedVehicle.valorReferencia.toLocaleString()} MXN</p>
              </div>
            )}

            {errors.vehiculo && <p className="text-xs text-red-500">{errors.vehiculo}</p>}

            {/* Coverage config */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-5 space-y-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Configuracion de Cobertura</h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Paquete</label>
                  <div className="flex gap-2">
                    {(['Amplia', 'Limitada', 'RC'] as PaqueteCobertura[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPaquete(p)}
                        className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg border transition-all ${
                          paquete === p
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Forma de Pago</label>
                  <select
                    value={formaPago}
                    onChange={(e) => setFormaPago(e.target.value as FormaPago)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Anual">Anual</option>
                    <option value="Semestral">Semestral</option>
                    <option value="Trimestral">Trimestral</option>
                    <option value="Mensual">Mensual</option>
                  </select>
                </div>
              </div>

              {paquete === 'Amplia' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Deducible Danos Materiales</label>
                    <select
                      value={coberturas.deducibleDanosMateriales}
                      onChange={(e) => setCoberturas({ ...coberturas, deducibleDanosMateriales: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="5%">5%</option>
                      <option value="10%">10%</option>
                      <option value="15%">15%</option>
                      <option value="20%">20%</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Deducible Robo Total</label>
                    <select
                      value={coberturas.deducibleRoboTotal}
                      onChange={(e) => setCoberturas({ ...coberturas, deducibleRoboTotal: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="10%">10%</option>
                      <option value="15%">15%</option>
                      <option value="20%">20%</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Add-ons toggles */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { key: 'gastosMedicos', label: 'Gastos Medicos' },
                  { key: 'asistenciaVial', label: 'Asistencia Vial' },
                  { key: 'autoSustituto', label: 'Auto Sustituto' },
                  { key: 'defensa_legal', label: 'Defensa Legal' },
                ].map(({ key, label }) => (
                  <label
                    key={key}
                    className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
                      coberturas[key as keyof CoberturasPersonalizadasCliente]
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={!!coberturas[key as keyof CoberturasPersonalizadasCliente]}
                      onChange={(e) => setCoberturas({ ...coberturas, [key]: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleCalculate}
                disabled={isCalculating}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCalculating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Cotizando...
                  </>
                ) : (
                  'Cotizar Multi-Aseguradora'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
