import { useEffect, useMemo, useState } from 'react';
import { Building2, Loader2, Pencil, Plus, Search, Share2, Trash2, UserRound, Users, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type Scope = 'personal' | 'oficina' | 'grupo' | 'empresa';

interface CorporateContact {
  id: string;
  nombre: string | null;
  apellidos: string | null;
  nombre_completo: string | null;
  email_laboral: string | null;
  celular_laboral: string | null;
  puesto: string | null;
  oficina_id: string | null;
  oficina: { nombre: string } | null;
}

interface SavedContact {
  id: string;
  usuario_id: string | null;
  nombre: string;
  apellido: string | null;
  email: string;
  telefono: string | null;
  empresa: string | null;
  visibilidad: Scope;
  compartir_oficina_id: string | null;
  compartir_grupo_id: string | null;
}

interface Group {
  id: string;
  nombre: string;
}

const emptyForm = {
  id: '',
  nombre: '',
  apellido: '',
  email: '',
  telefono: '',
  empresa: '',
  visibilidad: 'personal' as Scope,
  compartir_grupo_id: '',
};

export function ContactosMovi({ onClose }: { onClose: () => void }) {
  const { usuario } = useAuth();
  const [corporate, setCorporate] = useState<CorporateContact[]>([]);
  const [saved, setSaved] = useState<SavedContact[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const load = async () => {
    if (!usuario) return;
    setLoading(true);
    setError('');

    let directoryQuery = supabase
      .from('usuarios')
      .select('id,nombre,apellidos,nombre_completo,email_laboral,celular_laboral,puesto,oficina_id,oficina:oficinas!oficina_id(nombre)')
      .eq('activo', true)
      .eq('is_deleted', false)
      .not('email_laboral', 'is', null)
      .order('nombre');

    // Administradores consultan toda la empresa; los demás sólo su oficina.
    if (usuario.rol !== 'Administrador' && usuario.oficina_id) {
      directoryQuery = directoryQuery.eq('oficina_id', usuario.oficina_id);
    }

    const [directoryResult, savedResult, groupResult] = await Promise.all([
      directoryQuery,
      supabase.from('contactos').select('*').eq('eliminado', false).order('nombre'),
      supabase
        .from('tramites_grupos_miembros')
        .select('grupo:tramites_grupos_visualizacion!grupo_id(id,nombre,activo)')
        .eq('usuario_id', usuario.id),
    ]);

    const firstError = directoryResult.error || savedResult.error || groupResult.error;
    if (firstError) setError(firstError.message);
    setCorporate((directoryResult.data || []) as unknown as CorporateContact[]);
    setSaved((savedResult.data || []) as unknown as SavedContact[]);
    setGroups(
      (groupResult.data || [])
        .map((row: any) => row.grupo)
        .filter((group: any) => group?.activo)
        .map(({ id, nombre }: any) => ({ id, nombre }))
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, [usuario?.id]);

  const normalizedQuery = query.trim().toLowerCase();
  const matches = (values: Array<string | null | undefined>) =>
    !normalizedQuery || values.some(value => value?.toLowerCase().includes(normalizedQuery));
  const filteredCorporate = useMemo(
    () => corporate.filter(c => matches([c.nombre_completo, c.nombre, c.apellidos, c.email_laboral, c.puesto, c.oficina?.nombre])),
    [corporate, normalizedQuery]
  );
  const filteredSaved = useMemo(
    () => saved.filter(c => matches([c.nombre, c.apellido, c.email, c.telefono, c.empresa])),
    [saved, normalizedQuery]
  );

  const beginEdit = (contact: SavedContact) => {
    setForm({
      id: contact.id,
      nombre: contact.nombre || '',
      apellido: contact.apellido || '',
      email: contact.email || '',
      telefono: contact.telefono || '',
      empresa: contact.empresa || '',
      visibilidad: contact.visibilidad || 'personal',
      compartir_grupo_id: contact.compartir_grupo_id || '',
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!usuario || !form.nombre.trim() || !form.email.trim()) return;
    setSaving(true);
    setError('');
    const payload = {
      usuario_id: usuario.id,
      asignado_a: usuario.id,
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim() || null,
      email: form.email.trim().toLowerCase(),
      telefono: form.telefono.trim() || null,
      empresa: form.empresa.trim() || null,
      visibilidad: form.visibilidad,
      compartir_oficina_id: form.visibilidad === 'oficina' ? usuario.oficina_id : null,
      compartir_grupo_id: form.visibilidad === 'grupo' ? form.compartir_grupo_id : null,
      compartido_at: form.visibilidad === 'personal' ? null : new Date().toISOString(),
      origen: 'email',
      eliminado: false,
    };
    const result = form.id
      ? await (supabase.from('contactos') as any).update(payload).eq('id', form.id)
      : await (supabase.from('contactos') as any).insert(payload);
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setShowForm(false);
    setForm(emptyForm);
    await load();
  };

  const remove = async (contact: SavedContact) => {
    if (!window.confirm(`¿Eliminar a ${contact.nombre}?`)) return;
    const { error: deleteError } = await (supabase.from('contactos') as any)
      .update({ eliminado: true })
      .eq('id', contact.id);
    if (deleteError) setError(deleteError.message);
    else await load();
  };

  const scopeLabel = (scope: Scope) => ({
    personal: 'Sólo yo',
    oficina: 'Mi oficina',
    grupo: 'Grupo',
    empresa: 'Toda la empresa',
  }[scope]);

  return (
    <div className="h-full flex flex-col bg-neutral-50 dark:bg-neutral-900">
      <div className="bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 px-4 py-3 flex items-center gap-3">
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700" title="Cerrar contactos">
          <X className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-neutral-900 dark:text-white">Contactos MOVI</h2>
          <p className="text-[11px] text-neutral-500">Directorio permitido y contactos compartidos</p>
        </div>
        <button onClick={() => { setForm(emptyForm); setShowForm(true); }} className="flex items-center gap-2 bg-accent text-white px-3 py-2 rounded-lg text-xs font-semibold">
          <Plus className="w-4 h-4" /> Nuevo contacto
        </button>
      </div>

      <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
        <div className="max-w-xl relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por nombre, correo, oficina o puesto..." className="w-full pl-9 pr-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm" />
        </div>
      </div>

      {error && <div className="mx-4 mt-3 rounded-lg bg-red-50 text-red-700 px-3 py-2 text-xs">{error}</div>}

      <div className="flex-1 overflow-auto p-4 space-y-6">
        {loading ? (
          <div className="h-40 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>
        ) : (
          <>
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4 text-accent" />
                <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-600 dark:text-neutral-300">Directorio corporativo ({filteredCorporate.length})</h3>
              </div>
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
                {filteredCorporate.map(contact => (
                  <ContactCard key={contact.id} name={contact.nombre_completo || `${contact.nombre || ''} ${contact.apellidos || ''}`.trim()} email={contact.email_laboral || ''} detail={[contact.puesto, contact.oficina?.nombre].filter(Boolean).join(' · ')} />
                ))}
              </div>
            </section>

            <section>
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-accent" />
                <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-600 dark:text-neutral-300">Guardados y compartidos ({filteredSaved.length})</h3>
              </div>
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
                {filteredSaved.map(contact => (
                  <div key={contact.id} className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-3 flex gap-3">
                    <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center text-accent"><UserRound className="w-4 h-4" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{contact.nombre} {contact.apellido}</p>
                      <a href={`mailto:${contact.email}`} className="block text-xs text-accent truncate">{contact.email}</a>
                      <p className="text-[10px] text-neutral-500 flex items-center gap-1 mt-1"><Share2 className="w-3 h-3" /> {scopeLabel(contact.visibilidad)}</p>
                    </div>
                    {contact.usuario_id === usuario?.id && (
                      <div className="flex flex-col gap-1">
                        <button onClick={() => beginEdit(contact)} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => remove(contact)} className="p-1.5 hover:bg-red-50 text-red-500 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>

      {showForm && (
        <div className="absolute inset-0 z-30 bg-black/30 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-neutral-800 rounded-2xl shadow-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">{form.id ? 'Editar contacto' : 'Nuevo contacto'}</h3>
              <button onClick={() => setShowForm(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Nombre *" value={form.nombre} onChange={nombre => setForm({ ...form, nombre })} />
              <Field label="Apellidos" value={form.apellido} onChange={apellido => setForm({ ...form, apellido })} />
              <Field label="Correo *" type="email" value={form.email} onChange={email => setForm({ ...form, email })} />
              <Field label="Teléfono" value={form.telefono} onChange={telefono => setForm({ ...form, telefono })} />
              <div className="sm:col-span-2"><Field label="Empresa" value={form.empresa} onChange={empresa => setForm({ ...form, empresa })} /></div>
              <label className="sm:col-span-2 text-xs font-medium">
                Compartir con
                <select value={form.visibilidad} onChange={e => setForm({ ...form, visibilidad: e.target.value as Scope })} className="mt-1 w-full border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900">
                  <option value="personal">Sólo yo</option>
                  <option value="oficina" disabled={!usuario?.oficina_id}>Mi oficina</option>
                  <option value="grupo" disabled={!groups.length}>Un grupo</option>
                  <option value="empresa">Toda la empresa</option>
                </select>
              </label>
              {form.visibilidad === 'grupo' && (
                <label className="sm:col-span-2 text-xs font-medium">
                  Grupo
                  <select value={form.compartir_grupo_id} onChange={e => setForm({ ...form, compartir_grupo_id: e.target.value })} className="mt-1 w-full border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900">
                    <option value="">Selecciona un grupo</option>
                    {groups.map(group => <option key={group.id} value={group.id}>{group.nombre}</option>)}
                  </select>
                </label>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-xs rounded-lg border">Cancelar</button>
              <button onClick={save} disabled={saving || !form.nombre.trim() || !form.email.trim() || (form.visibilidad === 'grupo' && !form.compartir_grupo_id)} className="px-4 py-2 text-xs rounded-lg bg-accent text-white font-semibold disabled:opacity-40">
                {saving ? 'Guardando...' : 'Guardar contacto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ContactCard({ name, email, detail }: { name: string; email: string; detail: string }) {
  return (
    <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-3 flex gap-3">
      <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center text-accent"><UserRound className="w-4 h-4" /></div>
      <div className="min-w-0">
        <p className="text-sm font-semibold truncate">{name}</p>
        <a href={`mailto:${email}`} className="block text-xs text-accent truncate">{email}</a>
        <p className="text-[10px] text-neutral-500 truncate mt-1">{detail}</p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="text-xs font-medium">
      {label}
      <input type={type} value={value} onChange={e => onChange(e.target.value)} className="mt-1 w-full border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900" />
    </label>
  );
}
