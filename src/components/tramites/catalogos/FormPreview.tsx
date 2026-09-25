import type { TipoCampo, TramiteSeccion } from './types';
import { agruparCamposPorSeccion } from '../../../lib/tramiteSecciones';

export function FormPreview({ campos, secciones = [] }: { campos: TipoCampo[]; secciones?: TramiteSeccion[] }) {
  if (campos.length === 0) return null;
  // La vista previa agrupa por sección igual que el formulario real. Antes aplanaba todo
  // (sistema primero, luego custom) e ignoraba las secciones, así que no se parecía a lo
  // que el usuario iba a ver — justo lo que una vista previa no debe hacer.
  const ordenados = [...campos].sort((a, b) => a.display_order - b.display_order);
  const grupos = agruparCamposPorSeccion(ordenados, secciones);

  const renderCampo = (campo: TipoCampo) => (
        <div key={campo.id} className="space-y-1">
          <label className="block text-sm font-medium text-neutral-700">
            {campo.label}
            {campo.requerido && <span className="text-red-500 ml-1">*</span>}
          </label>
          {campo.ayuda && <p className="text-xs text-neutral-400">{campo.ayuda}</p>}

          {/* badge sistema */}
          {campo.is_sistema && (
            <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-500 border border-violet-200">
              🔒 Sistema
            </span>
          )}

          {/* badge de campo condicional */}
          {campo.config?.condicion_activa && campo.config?.campo_fuente && (
            <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-1.5 py-0.5 inline-flex items-center gap-1">
              <span>⚡</span>
              <span>
                Visible si: {campo.config.campo_fuente}{' '}
                {campo.config.condicion_operador === 'tiene_valor'
                  ? 'tiene valor'
                  : `${campo.config.condicion_operador === 'distinto_a' ? '≠' : '='} "${campo.config.condicion_valor}"`}
              </span>
            </p>
          )}

          {/* ── renders por tipo ── */}
          {campo.tipo === 'texto_corto' && (
            <input disabled type="text" placeholder="Texto corto..."
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg bg-neutral-50 text-sm text-neutral-400 cursor-not-allowed" />
          )}
          {campo.tipo === 'texto_largo' && (
            <textarea disabled placeholder="Texto largo..." rows={3}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg bg-neutral-50 text-sm text-neutral-400 resize-none cursor-not-allowed" />
          )}
          {campo.tipo === 'email' && (
            <input disabled type="email" placeholder="ejemplo@correo.com"
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg bg-neutral-50 text-sm text-neutral-400 cursor-not-allowed" />
          )}
          {campo.tipo === 'telefono' && (
            <div className="flex items-center gap-2">
              {campo.config?.formato === 'internacional' && (
                <span className="px-3 py-2 bg-neutral-100 border border-neutral-200 rounded-lg text-sm text-neutral-400 shrink-0">+52</span>
              )}
              <input disabled type="tel"
                placeholder={campo.config?.formato === 'internacional' ? '55 1234 5678' : '(55) 1234-5678'}
                className="flex-1 px-3 py-2 border border-neutral-200 rounded-lg bg-neutral-50 text-sm text-neutral-400 cursor-not-allowed" />
            </div>
          )}
          {campo.tipo === 'rfc' && (
            <input disabled type="text"
              placeholder={campo.config?.tipo_persona === 'moral' ? 'AAAA000000AAA' : 'AAAA000000AAAAA'}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg bg-neutral-50 text-sm text-neutral-400 cursor-not-allowed font-mono uppercase tracking-widest" />
          )}
          {campo.tipo === 'curp' && (
            <input disabled type="text" placeholder="AAAA000000AAAAAA00"
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg bg-neutral-50 text-sm text-neutral-400 cursor-not-allowed font-mono uppercase tracking-widest" />
          )}
          {campo.tipo === 'numerico' && (
            <div className="relative">
              {campo.config?.formato === 'moneda' && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">$</span>
              )}
              <input disabled type="number" placeholder="0"
                className={`w-full py-2 border border-neutral-200 rounded-lg bg-neutral-50 text-sm text-neutral-400 cursor-not-allowed ${campo.config?.formato === 'moneda' ? 'pl-7 pr-3' : 'px-3'}`} />
            </div>
          )}
          {campo.tipo === 'porcentaje' && (
            <div className="relative w-36">
              <input disabled type="number" placeholder="0"
                className="w-full px-3 py-2 pr-8 border border-neutral-200 rounded-lg bg-neutral-50 text-sm text-neutral-400 cursor-not-allowed" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm font-medium">%</span>
            </div>
          )}
          {campo.tipo === 'codigo_postal' && (
            <input disabled type="text" placeholder="00000"
              className="w-28 px-3 py-2 border border-neutral-200 rounded-lg bg-neutral-50 text-sm text-neutral-400 cursor-not-allowed font-mono" />
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
          {campo.tipo === 'aseguradora' && (
            <select disabled className="w-full px-3 py-2 border border-neutral-200 rounded-lg bg-neutral-50 text-sm text-neutral-400 cursor-not-allowed">
              <option>Selecciona aseguradora...</option>
            </select>
          )}
          {campo.tipo === 'ramo' && (
            <select disabled className="w-full px-3 py-2 border border-neutral-200 rounded-lg bg-neutral-50 text-sm text-neutral-400 cursor-not-allowed">
              <option>
                {campo.config?.filtrar_por_aseguradora !== false
                  ? 'Ramo (filtra por aseguradora)...'
                  : 'Selecciona ramo...'}
              </option>
            </select>
          )}

          {/* ── Renders de campos sistema ── */}
          {campo.tipo === 'area' && (
            <div className="w-full px-3 py-2 border border-violet-200 rounded-lg bg-violet-50 text-sm text-violet-500 flex items-center gap-2">
              <span className="font-mono text-xs bg-violet-100 px-1.5 py-0.5 rounded">Auto</span>
              Área asignada desde el tipo de trámite
            </div>
          )}
          {campo.tipo === 'equipo' && (
            <div className="w-full px-3 py-2 border border-violet-200 rounded-lg bg-violet-50 text-sm text-violet-500 flex items-center gap-2">
              <span className="font-mono text-xs bg-violet-100 px-1.5 py-0.5 rounded">Auto</span>
              Equipo auto-asignado al crear
            </div>
          )}
          {campo.tipo === 'agente_vendedor' && (
            <select disabled className="w-full px-3 py-2 border border-violet-200 rounded-lg bg-violet-50 text-sm text-violet-400 cursor-not-allowed">
              <option>Selecciona usuario asignado...</option>
            </select>
          )}
          {campo.tipo === 'oficina_jiro' && (
            <select disabled className="w-full px-3 py-2 border border-violet-200 rounded-lg bg-violet-50 text-sm text-violet-400 cursor-not-allowed">
              <option>Oficina Jiro (filtrada por agente)...</option>
            </select>
          )}
          {campo.tipo === 'fecha_creacion' && (
            <div className="flex items-center gap-2">
              <input disabled type="datetime-local"
                className="flex-1 px-3 py-2 border border-violet-200 rounded-lg bg-violet-50 text-sm text-violet-400 cursor-not-allowed" />
              <span className="text-[10px] text-violet-400 shrink-0">Autofill</span>
            </div>
          )}
          {campo.tipo === 'fecha_finalizacion' && (
            <div className="flex items-center gap-2">
              <input disabled type="datetime-local"
                className="flex-1 px-3 py-2 border border-violet-200 rounded-lg bg-violet-50 text-sm text-violet-400 cursor-not-allowed" />
              <span className="text-[10px] text-violet-400 shrink-0">Al cerrar</span>
            </div>
          )}
          {campo.tipo === 'creado_por' && (
            <div className="w-full px-3 py-2 border border-violet-200 rounded-lg bg-violet-50 text-sm text-violet-500 flex items-center gap-2">
              <span className="font-mono text-xs bg-violet-100 px-1.5 py-0.5 rounded">Auto</span>
              Usuario que crea el trámite
            </div>
          )}
        </div>
  );

  return (
    <div className="space-y-4 border border-neutral-200 rounded-xl p-4 bg-white">
      <p className="text-[11px] text-neutral-400 text-center uppercase tracking-wider mb-2">Vista previa — solo lectura</p>
      {grupos.map((grupo, i) => (
        <div key={grupo.seccion?.id ?? `sin-seccion-${i}`} className="space-y-4">
          {grupo.seccion && (
            <div className="pt-2 border-t border-neutral-100 first:border-t-0 first:pt-0">
              <h4 className="text-sm font-semibold text-neutral-800">
                {grupo.seccion.nombre}
                {grupo.seccion.opcional && (
                  <span className="ml-2 text-[10px] font-normal text-neutral-400 uppercase tracking-wide">Opcional</span>
                )}
              </h4>
              {grupo.seccion.descripcion && (
                <p className="text-xs text-neutral-400 mt-0.5">{grupo.seccion.descripcion}</p>
              )}
              {(grupo.seccion.condicion_campo_id || grupo.seccion.depende_de_seccion_id) && (
                <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-1.5 py-0.5 inline-flex items-center gap-1 mt-1">
                  <span>⚡</span>
                  <span>{grupo.seccion.condicion_campo_id ? 'Condicionada a un campo' : 'Se desbloquea al completar otra sección'}</span>
                </p>
              )}
            </div>
          )}
          {grupo.campos.map(renderCampo)}
        </div>
      ))}
    </div>
  );
}
