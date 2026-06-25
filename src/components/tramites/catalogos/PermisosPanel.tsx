import { useEffect } from 'react';
import { ChevronDown, Users } from 'lucide-react';
import { usePermisos } from './usePermisos';
import { Tooltip } from './Tooltip';

const PERM_TOOLTIPS = {
  puede_ver:    'Puede ver este tipo en la lista de trámites',
  puede_crear:  'Puede abrir nuevos trámites de este tipo',
  puede_editar: 'Puede modificar campos y estado del trámite',
} as const;

interface Props {
  tipoId: string;
  usuarioId: string | undefined;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export function PermisosPanel({ tipoId, usuarioId, showToast }: Props) {
  const {
    equiposPermisos, permisos: _permisos, loadingPermisos,
    rolPermisos, usuarioOverrides,
    savingPermId, savingVisibilidad, equiposColapsados,
    loadPermisos, hasPermiso, togglePermiso,
    toggleRolVisibilidad, toggleUsuarioOverride,
    toggleEquipoColapsado, toggleEquipoOverride,
  } = usePermisos(tipoId, usuarioId, showToast);

  useEffect(() => { loadPermisos(); }, [tipoId]);

  return (
    <div className="p-4 overflow-auto space-y-6">

      {/* ── Visibilidad por Rol ── */}
      <div>
        <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">Visibilidad por Rol</p>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 text-xs text-amber-700">
          <strong>Ver</strong> = acceso al trámite. <strong>Crear</strong> = puede abrir nuevos trámites. <strong>Editar</strong> = puede modificar estatus y campos. Administrador y Gerente siempre tienen acceso total.
        </div>
        <table className="w-full text-sm border border-neutral-200 rounded-xl overflow-hidden">
          <thead className="bg-neutral-50">
            <tr>
              <th className="text-left px-4 py-2 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Rol</th>
              <th className="text-center px-4 py-2 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider w-20">
                <Tooltip text={PERM_TOOLTIPS.puede_ver}><span className="cursor-default underline decoration-dotted">Ver</span></Tooltip>
              </th>
              <th className="text-center px-4 py-2 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider w-20">
                <Tooltip text={PERM_TOOLTIPS.puede_crear}><span className="cursor-default underline decoration-dotted">Crear</span></Tooltip>
              </th>
              <th className="text-center px-4 py-2 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider w-20">
                <Tooltip text={PERM_TOOLTIPS.puede_editar}><span className="cursor-default underline decoration-dotted">Editar</span></Tooltip>
              </th>
            </tr>
          </thead>
          <tbody>
            {rolPermisos.map(rp => (
              <tr key={rp.rol} className="border-t border-neutral-100 hover:bg-neutral-50">
                <td className="px-4 py-2.5 text-sm font-medium text-neutral-800">{rp.rol}</td>
                {(['puede_ver', 'puede_crear', 'puede_editar'] as const).map(campo => {
                  const key = `rol-${rp.rol}-${campo}`;
                  const active = rp[campo];
                  const isSaving = savingVisibilidad === key;
                  return (
                    <td key={campo} className="text-center px-4 py-2.5">
                      <button
                        onClick={() => toggleRolVisibilidad(rp.rol, campo)}
                        disabled={isSaving}
                        className={`w-6 h-6 rounded-md border-2 transition-colors mx-auto flex items-center justify-center text-xs ${
                          active ? 'bg-green-600 border-green-600 text-white' : 'border-neutral-300 bg-white hover:border-red-400 hover:bg-red-50 hover:text-red-600'
                        } ${isSaving ? 'opacity-40' : ''}`}
                      >
                        {active ? '✓' : '✗'}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Overrides por Usuario ── */}
      {equiposPermisos.length > 0 && (
        <div>
          <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">Override por Usuario</p>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3 text-xs text-blue-700">
            <strong>Gris</strong> = hereda del rol. <strong>Verde</strong> = permitido. <strong>Rojo</strong> = bloqueado.
          </div>
          <div className="space-y-2">
            {equiposPermisos.map(equipo => {
              const expanded = !equiposColapsados.has(equipo.id);
              const miembrosUO = equipo.miembros.map(m =>
                usuarioOverrides.find(u => u.user_id === m.usuario_id)
                ?? { user_id: m.usuario_id, nombre_completo: m.nombre_completo, puede_ver: null as boolean | null, puede_crear: null as boolean | null, puede_editar: null as boolean | null }
              );
              return (
                <div key={equipo.id} className="border border-neutral-200 rounded-xl overflow-hidden">
                  <div className="bg-neutral-50 px-3 py-2.5 flex items-center gap-2 border-b border-neutral-200">
                    <button onClick={() => toggleEquipoColapsado(equipo.id)} className="flex items-center gap-2 flex-1 text-left min-w-0">
                      <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 flex-shrink-0 transition-transform ${expanded ? '' : '-rotate-90'}`} />
                      <span className="text-xs font-bold text-neutral-700 uppercase tracking-wider truncate">{equipo.nombre}</span>
                      <span className="text-xs text-neutral-400 flex-shrink-0">({equipo.miembros.length})</span>
                    </button>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {(['puede_ver', 'puede_crear', 'puede_editar'] as const).map(campo => {
                        const vals = miembrosUO.map(m => m[campo]);
                        const allTrue = vals.every(v => v === true);
                        const allNull = vals.every(v => v === null);
                        const label = campo === 'puede_ver' ? 'Ver' : campo === 'puede_crear' ? 'Crear' : 'Editar';
                        return (
                          <div key={campo} className="flex items-center gap-1">
                            <span className="text-[10px] text-neutral-400">{label}</span>
                            <button
                              onClick={() => toggleEquipoOverride(equipo, campo)}
                              className={`w-6 h-6 rounded-md border-2 transition-colors flex items-center justify-center text-xs ${
                                allTrue ? 'bg-green-600 border-green-600 text-white'
                                : allNull ? 'border-neutral-300 bg-neutral-100 text-neutral-400'
                                : 'border-yellow-400 bg-yellow-50 text-yellow-600'
                              }`}
                            >
                              {allTrue ? '✓' : allNull ? '—' : '~'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {expanded && (
                    <table className="w-full text-sm">
                      <tbody>
                        {miembrosUO.map(uo => (
                          <tr key={uo.user_id} className="border-t border-neutral-100 hover:bg-neutral-50">
                            <td className="px-4 py-2 pl-8 text-sm text-neutral-700">{uo.nombre_completo}</td>
                            {(['puede_ver', 'puede_crear', 'puede_editar'] as const).map(campo => {
                              const key = `user-${uo.user_id}-${campo}`;
                              const val = uo[campo];
                              const isSaving = savingVisibilidad === key;
                              return (
                                <td key={campo} className="text-center px-4 py-2 w-20">
                                  <button
                                    onClick={() => toggleUsuarioOverride(uo.user_id, campo)}
                                    disabled={isSaving}
                                    className={`w-6 h-6 rounded-md border-2 transition-colors mx-auto flex items-center justify-center text-xs ${
                                      val === null ? 'border-neutral-300 bg-neutral-100 text-neutral-400'
                                      : val ? 'bg-green-600 border-green-600 text-white'
                                      : 'bg-red-500 border-red-500 text-white'
                                    } ${isSaving ? 'opacity-40' : ''}`}
                                  >
                                    {val === null ? '—' : val ? '✓' : '✗'}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Permisos por Equipo ── */}
      <div>
        <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">Permisos por Equipo</p>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-xs text-blue-700">
          Define quién puede <strong>crear</strong> o <strong>editar</strong> este tipo de trámite dentro de cada equipo.
        </div>
        {loadingPermisos ? (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => <div key={i} className="h-24 bg-neutral-100 rounded-xl animate-pulse" />)}
          </div>
        ) : equiposPermisos.length === 0 ? (
          <div className="text-center py-10 text-neutral-400">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay equipos con miembros asignados.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {equiposPermisos.map(equipo => (
              <div key={equipo.id} className="border border-neutral-200 rounded-xl overflow-hidden">
                <div className="bg-neutral-50 px-4 py-2.5 border-b border-neutral-200">
                  <p className="text-xs font-bold text-neutral-700 uppercase tracking-wider">{equipo.nombre}</p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left px-4 py-2 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Usuario</th>
                      <th className="text-center px-4 py-2 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider w-20">
                        <Tooltip text="Puede crear trámites de este tipo"><span className="cursor-default underline decoration-dotted">Crear</span></Tooltip>
                      </th>
                      <th className="text-center px-4 py-2 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider w-20">
                        <Tooltip text="Puede editar trámites de este tipo"><span className="cursor-default underline decoration-dotted">Editar</span></Tooltip>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipo.miembros.map(miembro => (
                      <tr key={miembro.usuario_id} className="border-t border-neutral-100 hover:bg-neutral-50">
                        <td className="px-4 py-2.5">
                          <p className="text-sm font-medium text-neutral-800">{miembro.nombre_completo}</p>
                        </td>
                        {(['crear_tramite', 'editar_tramite'] as const).map(action => {
                          const active = hasPermiso(miembro.usuario_id, equipo.id, action);
                          const saving = savingPermId === `${miembro.usuario_id}-${equipo.id}-${action}`;
                          return (
                            <td key={action} className="text-center px-4 py-2.5">
                              <button
                                onClick={() => togglePermiso(miembro.usuario_id, equipo.id, action)}
                                disabled={saving}
                                className={`w-6 h-6 rounded-md border-2 transition-colors mx-auto flex items-center justify-center text-xs ${
                                  active ? 'bg-blue-600 border-blue-600 text-white' : 'border-neutral-300 bg-white hover:border-blue-400'
                                } ${saving ? 'opacity-40' : ''}`}
                              >
                                {active && '✓'}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
