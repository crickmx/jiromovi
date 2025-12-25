import { useState, useEffect } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Template {
  id: string;
  nombre: string;
}

interface Asignacion {
  id: string;
  template_id: string;
  tipo: 'global' | 'oficina' | 'rol' | 'usuario';
  prioridad: number;
  ref_oficina_id: string | null;
  ref_rol: string | null;
  ref_usuario_id: string | null;
  firma_templates: { nombre: string };
}

export function AsignacionesFirma() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [oficinas, setOficinas] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [newAsignacion, setNewAsignacion] = useState({
    tipo: 'global' as 'global' | 'oficina' | 'rol' | 'usuario',
    template_id: '',
    ref_oficina_id: '',
    ref_rol: '',
    ref_usuario_id: '',
    prioridad: 0
  });

  const roles = ['Administrador', 'Gerente', 'Empleado', 'Agente'];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [templatesRes, asignacionesRes, oficinasRes, usuariosRes] = await Promise.all([
      supabase.from('firma_templates').select('id, nombre').eq('es_activa', true),
      supabase.from('firma_asignaciones').select('*, firma_templates(nombre)').order('prioridad', { ascending: false }),
      supabase.from('oficinas').select('id, nombre').eq('activa', true),
      supabase.from('usuarios').select('id, nombre, rol, oficina_id')
    ]);

    if (templatesRes.data) setTemplates(templatesRes.data);
    if (asignacionesRes.data) setAsignaciones(asignacionesRes.data);
    if (oficinasRes.data) setOficinas(oficinasRes.data);
    if (usuariosRes.data) setUsuarios(usuariosRes.data);

    setLoading(false);
  };

  const handleAdd = async () => {
    if (!newAsignacion.template_id) return;

    const data: any = {
      template_id: newAsignacion.template_id,
      tipo: newAsignacion.tipo,
      prioridad: newAsignacion.prioridad
    };

    if (newAsignacion.tipo === 'oficina') data.ref_oficina_id = newAsignacion.ref_oficina_id;
    if (newAsignacion.tipo === 'rol') data.ref_rol = newAsignacion.ref_rol;
    if (newAsignacion.tipo === 'usuario') data.ref_usuario_id = newAsignacion.ref_usuario_id;

    await supabase.from('firma_asignaciones').insert(data);

    setNewAsignacion({
      tipo: 'global',
      template_id: '',
      ref_oficina_id: '',
      ref_rol: '',
      ref_usuario_id: '',
      prioridad: 0
    });

    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta asignación?')) return;

    await supabase.from('firma_asignaciones').delete().eq('id', id);
    loadData();
  };

  const getAsignacionLabel = (asignacion: Asignacion) => {
    if (asignacion.tipo === 'global') return 'Global (predeterminada)';
    if (asignacion.tipo === 'rol') return `Rol: ${asignacion.ref_rol}`;
    if (asignacion.tipo === 'oficina') {
      const oficina = oficinas.find(o => o.id === asignacion.ref_oficina_id);
      return `Oficina: ${oficina?.nombre || 'Desconocida'}`;
    }
    if (asignacion.tipo === 'usuario') {
      const usuario = usuarios.find(u => u.id === asignacion.ref_usuario_id);
      return `Usuario: ${usuario?.nombre || 'Desconocido'}`;
    }
    return '';
  };

  if (loading) {
    return <div className="text-center py-12">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-neutral-900 mb-4">Asignaciones de Firma</h2>
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-6">
          <h4 className="font-semibold text-primary-900 mb-2">Orden de prioridad:</h4>
          <ol className="list-decimal list-inside text-sm text-primary-800 space-y-1">
            <li>Usuario específico (prioridad más alta)</li>
            <li>Rol del usuario</li>
            <li>Oficina del usuario</li>
            <li>Global (predeterminada si no hay otras)</li>
          </ol>
        </div>
      </div>

      <div className="border border-neutral-200 rounded-xl p-6 bg-neutral-50">
        <h3 className="font-bold text-neutral-900 mb-4">Nueva Asignación</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-2">Tipo</label>
            <select
              value={newAsignacion.tipo}
              onChange={(e) => setNewAsignacion({ ...newAsignacion, tipo: e.target.value as any })}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="global">Global</option>
              <option value="oficina">Oficina</option>
              <option value="rol">Rol</option>
              <option value="usuario">Usuario</option>
            </select>
          </div>

          {newAsignacion.tipo === 'oficina' && (
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">Oficina</label>
              <select
                value={newAsignacion.ref_oficina_id}
                onChange={(e) => setNewAsignacion({ ...newAsignacion, ref_oficina_id: e.target.value })}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccionar</option>
                {oficinas.map((o) => (
                  <option key={o.id} value={o.id}>{o.nombre}</option>
                ))}
              </select>
            </div>
          )}

          {newAsignacion.tipo === 'rol' && (
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">Rol</label>
              <select
                value={newAsignacion.ref_rol}
                onChange={(e) => setNewAsignacion({ ...newAsignacion, ref_rol: e.target.value })}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccionar</option>
                {roles.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          )}

          {newAsignacion.tipo === 'usuario' && (
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">Usuario</label>
              <select
                value={newAsignacion.ref_usuario_id}
                onChange={(e) => setNewAsignacion({ ...newAsignacion, ref_usuario_id: e.target.value })}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccionar</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>{u.nombre} ({u.rol})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-2">Plantilla</label>
            <select
              value={newAsignacion.template_id}
              onChange={(e) => setNewAsignacion({ ...newAsignacion, template_id: e.target.value })}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccionar</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleAdd}
              disabled={!newAsignacion.template_id}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all disabled:opacity-50"
            >
              <Plus className="w-5 h-5" />
              <span>Agregar</span>
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {asignaciones.map((asignacion) => (
          <div key={asignacion.id} className="border border-neutral-200 rounded-lg p-4 flex items-center justify-between hover:shadow-md transition-all">
            <div className="flex-1">
              <div className="flex items-center space-x-3">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  asignacion.tipo === 'global' ? 'bg-neutral-100 text-neutral-700' :
                  asignacion.tipo === 'usuario' ? 'bg-primary-100 text-primary-700' :
                  asignacion.tipo === 'rol' ? 'bg-green-100 text-green-700' :
                  'bg-purple-100 text-purple-700'
                }`}>
                  {asignacion.tipo.toUpperCase()}
                </span>
                <span className="font-semibold text-neutral-900">{getAsignacionLabel(asignacion)}</span>
                <span className="text-neutral-600">→</span>
                <span className="text-primary-600">{asignacion.firma_templates.nombre}</span>
              </div>
            </div>
            <button
              onClick={() => handleDelete(asignacion.id)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
