import { TipoCampo } from './types';

export function FormPreview({ campos }: { campos: TipoCampo[] }) {
  if (campos.length === 0) return null;
  return (
    <div className="space-y-4 border border-neutral-200 rounded-xl p-4 bg-white">
      <p className="text-[11px] text-neutral-400 text-center uppercase tracking-wider mb-2">Vista previa — solo lectura</p>
      {campos.map(campo => (
        <div key={campo.id} className="space-y-1">
          <label className="block text-sm font-medium text-neutral-700">
            {campo.label}
            {campo.requerido && <span className="text-red-500 ml-1">*</span>}
          </label>
          {campo.ayuda && <p className="text-xs text-neutral-400">{campo.ayuda}</p>}
          {campo.tipo === 'texto_corto' && (
            <input disabled type="text" placeholder="Texto corto..."
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg bg-neutral-50 text-sm text-neutral-400 cursor-not-allowed" />
          )}
          {campo.tipo === 'texto_largo' && (
            <textarea disabled placeholder="Texto largo..." rows={3}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg bg-neutral-50 text-sm text-neutral-400 resize-none cursor-not-allowed" />
          )}
          {campo.tipo === 'numerico' && (
            <input disabled type="number" placeholder="0"
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg bg-neutral-50 text-sm text-neutral-400 cursor-not-allowed" />
          )}
          {campo.tipo === 'fecha' && (
            <input disabled type="date"
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg bg-neutral-50 text-sm text-neutral-400 cursor-not-allowed" />
          )}
          {campo.tipo === 'booleano' && (
            <label className="flex items-center gap-2 cursor-not-allowed opacity-60">
              <input type="checkbox" disabled className="rounded" />
              <span className="text-sm text-neutral-500">{campo.label}</span>
            </label>
          )}
          {campo.tipo === 'adjunto' && (
            <div className="w-full py-5 border-2 border-dashed border-neutral-200 rounded-lg bg-neutral-50 text-center text-xs text-neutral-400">
              Arrastra archivos o haz clic para adjuntar
            </div>
          )}
          {(campo.tipo === 'estatus' || campo.tipo === 'dropdown') && (
            <select disabled className="w-full px-3 py-2 border border-neutral-200 rounded-lg bg-neutral-50 text-sm text-neutral-400 cursor-not-allowed">
              <option>Selecciona una opción...</option>
              {(campo.config?.opciones || []).map((opt: { label: string; slug: string }) => (
                <option key={opt.slug}>{opt.label}</option>
              ))}
            </select>
          )}
          {campo.tipo === 'seleccion_multiple' && (
            <div className="space-y-1.5 opacity-60">
              {(campo.config?.opciones || []).map((opt: { label: string; slug: string }) => (
                <label key={opt.slug} className="flex items-center gap-2 cursor-not-allowed">
                  <input type="checkbox" disabled className="rounded" />
                  <span className="text-sm text-neutral-500">{opt.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
