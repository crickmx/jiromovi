import { useState, useEffect } from 'react';
import { Filter, X, Calendar } from 'lucide-react';

interface ProductionFilters {
  fechaDesde: string;
  fechaHasta: string;
  ramos: string[];
  aseguradoras: string[];
  clienteSearch: string;
}

interface FiltrosProduccionAgenteProps {
  filters: ProductionFilters;
  onFiltersChange: (filters: ProductionFilters) => void;
  availableRamos: string[];
  availableAseguradoras: string[];
}

export default function FiltrosProduccionAgente({
  filters,
  onFiltersChange,
  availableRamos,
  availableAseguradoras,
}: FiltrosProduccionAgenteProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [localFilters, setLocalFilters] = useState<ProductionFilters>(filters);

  const handleApply = () => {
    onFiltersChange(localFilters);
  };

  const handleClear = () => {
    const clearedFilters: ProductionFilters = {
      fechaDesde: '',
      fechaHasta: '',
      ramos: [],
      aseguradoras: [],
      clienteSearch: '',
    };
    setLocalFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  const toggleRamo = (ramo: string) => {
    setLocalFilters(prev => ({
      ...prev,
      ramos: prev.ramos.includes(ramo)
        ? prev.ramos.filter(r => r !== ramo)
        : [...prev.ramos, ramo],
    }));
  };

  const toggleAseguradora = (aseguradora: string) => {
    setLocalFilters(prev => ({
      ...prev,
      aseguradoras: prev.aseguradoras.includes(aseguradora)
        ? prev.aseguradoras.filter(a => a !== aseguradora)
        : [...prev.aseguradoras, aseguradora],
    }));
  };

  const activeFiltersCount =
    (localFilters.fechaDesde ? 1 : 0) +
    (localFilters.fechaHasta ? 1 : 0) +
    localFilters.ramos.length +
    localFilters.aseguradoras.length +
    (localFilters.clienteSearch ? 1 : 0);

  return (
    <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
      <button
        onClick={() => setShowFilters(!showFilters)}
        className="flex items-center justify-between w-full mb-4"
      >
        <div className="flex items-center space-x-2">
          <Filter className="w-5 h-5 text-neutral-600" />
          <h3 className="font-semibold text-neutral-900">Filtros Avanzados</h3>
          {activeFiltersCount > 0 && (
            <span className="bg-primary-600 text-white text-xs px-2 py-0.5 rounded-full">
              {activeFiltersCount}
            </span>
          )}
        </div>
        <span className="text-neutral-600">
          {showFilters ? '−' : '+'}
        </span>
      </button>

      {showFilters && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2 flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Fecha Desde
              </label>
              <input
                type="date"
                value={localFilters.fechaDesde}
                onChange={(e) => setLocalFilters(prev => ({ ...prev, fechaDesde: e.target.value }))}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2 flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Fecha Hasta
              </label>
              <input
                type="date"
                value={localFilters.fechaHasta}
                onChange={(e) => setLocalFilters(prev => ({ ...prev, fechaHasta: e.target.value }))}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Buscar Cliente
            </label>
            <input
              type="text"
              value={localFilters.clienteSearch}
              onChange={(e) => setLocalFilters(prev => ({ ...prev, clienteSearch: e.target.value }))}
              placeholder="Nombre del cliente..."
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Ramos ({localFilters.ramos.length} seleccionados)
            </label>
            <div className="max-h-48 overflow-y-auto border border-neutral-200 rounded-lg p-2 bg-white">
              <div className="space-y-1">
                {availableRamos.map(ramo => (
                  <label key={ramo} className="flex items-center space-x-2 p-2 hover:bg-neutral-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={localFilters.ramos.includes(ramo)}
                      onChange={() => toggleRamo(ramo)}
                      className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-neutral-700">{ramo}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Aseguradoras ({localFilters.aseguradoras.length} seleccionadas)
            </label>
            <div className="max-h-48 overflow-y-auto border border-neutral-200 rounded-lg p-2 bg-white">
              <div className="space-y-1">
                {availableAseguradoras.map(aseguradora => (
                  <label key={aseguradora} className="flex items-center space-x-2 p-2 hover:bg-neutral-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={localFilters.aseguradoras.includes(aseguradora)}
                      onChange={() => toggleAseguradora(aseguradora)}
                      className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-neutral-700">{aseguradora}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-neutral-200">
            <button
              onClick={handleClear}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors font-medium"
            >
              <X className="w-4 h-4" />
              <span>Limpiar Filtros</span>
            </button>

            <button
              onClick={handleApply}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              <Filter className="w-4 h-4" />
              <span>Aplicar Filtros</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
