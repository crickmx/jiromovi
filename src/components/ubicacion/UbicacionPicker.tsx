import { useState } from 'react';
import { MapPin, LocateFixed, Loader2, Check, Pencil } from 'lucide-react';

// Valor de ubicación compartido por perfil propio, admin y la landing /cotizar.
export interface UbicacionValue {
  lat: number | null;
  lng: number | null;
  direccion_manual: string | null;
  metodo: 'gps' | 'manual' | 'oficina' | null;
}

export const UBICACION_VACIA: UbicacionValue = {
  lat: null, lng: null, direccion_manual: null, metodo: null,
};

interface Props {
  value: UbicacionValue;
  onChange: (v: UbicacionValue) => void;
  disabled?: boolean;
  /** Etiqueta del botón de GPS. */
  gpsLabel?: string;
  /** Texto de ayuda del modo manual. */
  manualPlaceholder?: string;
  className?: string;
}

/**
 * Captura de ubicación reutilizable (Parte A/B de seguros.express).
 * - "Usar mi ubicación actual" → navigator.geolocation.getCurrentPosition().
 *   Éxito → lat/lng, metodo='gps'.
 * - Si el usuario niega el permiso o falla → input de dirección/CP manual,
 *   metodo='manual' (sin geocodificar en v1).
 */
export default function UbicacionPicker({
  value,
  onChange,
  disabled = false,
  gpsLabel = 'Usar mi ubicación actual',
  manualPlaceholder = 'Calle, colonia, ciudad o C.P.',
  className = '',
}: Props) {
  const [status, setStatus] = useState<'idle' | 'locating' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState<boolean>(value.metodo === 'manual');

  function solicitarGps() {
    if (disabled) return;
    setErrorMsg(null);
    if (!('geolocation' in navigator)) {
      setStatus('error');
      setErrorMsg('Tu navegador no soporta geolocalización. Escribe tu dirección abajo.');
      setManualMode(true);
      return;
    }
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStatus('idle');
        setManualMode(false);
        onChange({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          direccion_manual: null,
          metodo: 'gps',
        });
      },
      (err) => {
        setStatus('error');
        setErrorMsg(
          err.code === err.PERMISSION_DENIED
            ? 'No diste permiso de ubicación. Escribe tu dirección o C.P. abajo.'
            : 'No pudimos obtener tu ubicación. Escribe tu dirección o C.P. abajo.'
        );
        setManualMode(true);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  function setManual(texto: string) {
    onChange({ lat: null, lng: null, direccion_manual: texto, metodo: texto.trim() ? 'manual' : null });
  }

  const tieneGps = value.metodo === 'gps' && value.lat != null && value.lng != null;
  const usaOficina = value.metodo === 'oficina';

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={solicitarGps}
          disabled={disabled || status === 'locating'}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'locating'
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <LocateFixed className="h-4 w-4" />}
          {status === 'locating' ? 'Obteniendo ubicación…' : gpsLabel}
        </button>
        {!manualMode && !disabled && (
          <button
            type="button"
            onClick={() => setManualMode(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <Pencil className="h-3.5 w-3.5" />
            Escribir dirección
          </button>
        )}
      </div>

      {tieneGps && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
          <Check className="h-4 w-4 shrink-0" />
          <span>
            Ubicación GPS guardada
            <span className="ml-1 text-emerald-600/70 dark:text-emerald-400/70">
              ({value.lat}, {value.lng})
            </span>
          </span>
        </div>
      )}

      {usaOficina && (
        <div className="flex items-start gap-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Ubicación heredada de la oficina
            {value.direccion_manual && (
              <span className="mt-0.5 block text-xs text-sky-600/75 dark:text-sky-400/75">
                {value.direccion_manual}
              </span>
            )}
          </span>
        </div>
      )}

      {errorMsg && (
        <p className="text-sm text-amber-600 dark:text-amber-400">{errorMsg}</p>
      )}

      {(manualMode || value.metodo === 'manual') && (
        <div>
          <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
            <MapPin className="h-3.5 w-3.5" />
            Dirección o código postal
          </label>
          <input
            type="text"
            value={value.direccion_manual ?? ''}
            onChange={(e) => setManual(e.target.value)}
            disabled={disabled}
            placeholder={manualPlaceholder}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:disabled:bg-gray-900"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            No geolocalizamos la dirección; se guarda tal cual para referencia del asesor.
          </p>
        </div>
      )}
    </div>
  );
}
