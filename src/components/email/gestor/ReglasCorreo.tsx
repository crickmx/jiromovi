import { useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, SlidersHorizontal, Pencil } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cnSistema as cn } from '@/lib/utils';
import { BaseModal } from '@/components/BaseModal';
import type { ReglaCorreo } from '@/lib/correo/reglasCorreo';
import { type ImapFolder, etiquetaCarpeta, ordenarCarpetas, rolCarpeta } from './tipos';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  carpetas: ImapFolder[];
  onCambio: () => void;
}

type Form = Omit<ReglaCorreo, 'id' | 'orden'> & { id?: string };
const VACIA: Form = { nombre: '', campo: 'remitente', operador: 'contiene', valor: '', accion: 'mover', carpeta_destino: null, activa: true };

const campo = 'w-full h-10 px-3 rounded-[var(--radius-sm)] border border-soft bg-surface-card text-body-sm text-neutral-800 dark:text-neutral-100 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25';
const etiqueta = 'block text-caption font-semibold text-neutral-600 dark:text-neutral-300 mb-1';

export function describirRegla(r: Pick<ReglaCorreo, 'campo' | 'operador' | 'valor' | 'accion' | 'carpeta_destino'>, carpetas: ImapFolder[]) {
  const op = r.operador === 'es' ? 'es' : r.operador === 'empieza' ? 'empieza con' : 'contiene';
  const destino = carpetas.find(c => c.path === r.carpeta_destino);
  const accion = r.accion === 'mover' ? `mover a ${destino ? etiquetaCarpeta(destino) : r.carpeta_destino}` : 'marcar como leído';
  return `Si el ${r.campo} ${op} «${r.valor}», ${accion}`;
}

export function ReglasCorreo({ isOpen, onClose, carpetas, onCambio }: Props) {
  const [reglas, setReglas] = useState<ReglaCorreo[] | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const destinos = ordenarCarpetas(carpetas).filter(c => rolCarpeta(c) !== 'inbox' && rolCarpeta(c) !== 'drafts' && rolCarpeta(c) !== 'sent');

  const cargar = async () => {
    const { data, error: e } = await supabase.from('correo_reglas').select('*').order('orden').order('created_at');
    if (e) { setError(e.message); setReglas([]); return; }
    setReglas((data || []) as ReglaCorreo[]);
  };
  useEffect(() => { if (isOpen) { setError(''); setForm(null); void cargar(); } }, [isOpen]);

  const guardar = async () => {
    if (!form) return;
    if (!form.valor.trim()) { setError('Escribe el texto a buscar.'); return; }
    if (form.accion === 'mover' && !form.carpeta_destino) { setError('Elige la carpeta destino.'); return; }
    setGuardando(true);
    setError('');
    const fila = {
      nombre: form.nombre.trim() || describirRegla(form, carpetas),
      campo: form.campo, operador: form.operador, valor: form.valor.trim(),
      accion: form.accion, carpeta_destino: form.accion === 'mover' ? form.carpeta_destino : null,
      activa: form.activa,
    };
    const res = form.id
      ? await supabase.from('correo_reglas').update(fila).eq('id', form.id)
      : await supabase.from('correo_reglas').insert({ ...fila, orden: (reglas?.length || 0) });
    setGuardando(false);
    if (res.error) { setError(res.error.message); return; }
    setForm(null);
    await cargar();
    onCambio();
  };

  const alternar = async (r: ReglaCorreo) => {
    const { error: e } = await supabase.from('correo_reglas').update({ activa: !r.activa }).eq('id', r.id);
    if (e) { setError(e.message); return; }
    setReglas(rs => (rs || []).map(x => (x.id === r.id ? { ...x, activa: !x.activa } : x)));
    onCambio();
  };
  const borrar = async (r: ReglaCorreo) => {
    if (!window.confirm(`¿Eliminar la regla «${r.nombre}»?`)) return;
    const { error: e } = await supabase.from('correo_reglas').delete().eq('id', r.id);
    if (e) { setError(e.message); return; }
    setReglas(rs => (rs || []).filter(x => x.id !== r.id));
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Reglas del correo" maxWidth="2xl">
      <div className="space-y-4">
        <p className="text-body-sm text-neutral-600 dark:text-neutral-300">
          Se aplican a tus <strong>Recibidos</strong> cada vez que abres el correo. Si un correo cumple varias, gana la primera de la lista.
        </p>
        {error && <p role="alert" className="text-caption text-red-600 dark:text-red-400">{error}</p>}

        {form ? (
          <div className="rounded-[var(--radius-md)] border border-soft p-4 space-y-3 bg-surface-muted/40">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label>
                <span className={etiqueta}>Si el</span>
                <select value={form.campo} onChange={e => setForm({ ...form, campo: e.target.value as Form['campo'] })} className={campo}>
                  <option value="remitente">Remitente</option>
                  <option value="asunto">Asunto</option>
                </select>
              </label>
              <label>
                <span className={etiqueta}>Condición</span>
                <select value={form.operador} onChange={e => setForm({ ...form, operador: e.target.value as Form['operador'] })} className={campo}>
                  <option value="contiene">contiene</option>
                  <option value="empieza">empieza con</option>
                  <option value="es">es exactamente</option>
                </select>
              </label>
              <label>
                <span className={etiqueta}>Texto</span>
                <input value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} placeholder={form.campo === 'remitente' ? 'p. ej. @gnp.com.mx' : 'p. ej. Boletín'} className={campo} />
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label>
                <span className={etiqueta}>Entonces</span>
                <select value={form.accion} onChange={e => setForm({ ...form, accion: e.target.value as Form['accion'] })} className={campo}>
                  <option value="mover">Mover a una carpeta</option>
                  <option value="marcar_leido">Marcar como leído</option>
                </select>
              </label>
              {form.accion === 'mover' && (
                <label>
                  <span className={etiqueta}>Carpeta</span>
                  <select value={form.carpeta_destino || ''} onChange={e => setForm({ ...form, carpeta_destino: e.target.value || null })} className={campo}>
                    <option value="">Elige una carpeta…</option>
                    {destinos.map(c => <option key={c.path} value={c.path}>{etiquetaCarpeta(c)}</option>)}
                  </select>
                </label>
              )}
            </div>
            <label className="block">
              <span className={etiqueta}>Nombre (opcional)</span>
              <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder={describirRegla(form, carpetas)} className={campo} />
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setForm(null)} className="min-h-[40px] px-4 rounded-[var(--radius-sm)] text-caption font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-surface-muted">Cancelar</button>
              <button type="button" onClick={guardar} disabled={guardando} className="min-h-[40px] px-4 rounded-[var(--radius-sm)] bg-accent text-accent-foreground text-caption font-semibold hover:bg-accent-hover disabled:opacity-60 inline-flex items-center gap-2">
                {guardando && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />} Guardar regla
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setForm({ ...VACIA })} className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-[var(--radius-sm)] bg-accent text-accent-foreground text-caption font-semibold hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
            <Plus className="w-4 h-4" aria-hidden /> Nueva regla
          </button>
        )}

        {reglas === null ? (
          <p className="text-caption text-neutral-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Cargando…</p>
        ) : reglas.length === 0 ? (
          <div className="text-center py-8">
            <SlidersHorizontal className="w-8 h-8 mx-auto text-neutral-300 dark:text-neutral-600 mb-2" aria-hidden />
            <p className="text-body-sm font-semibold text-neutral-700 dark:text-neutral-200">Sin reglas</p>
            <p className="text-caption text-neutral-500 dark:text-neutral-400">Por ejemplo: mueve los boletines a su carpeta, o marca como leídos los avisos automáticos.</p>
          </div>
        ) : (
          <ul className="divide-y divide-[color:var(--border-soft)] rounded-[var(--radius-md)] border border-soft">
            {reglas.map(r => (
              <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input type="checkbox" checked={r.activa} onChange={() => alternar(r)} className="peer sr-only" aria-label={`${r.activa ? 'Desactivar' : 'Activar'} regla ${r.nombre}`} />
                  <span className="w-10 h-6 rounded-full bg-surface-sunken peer-checked:bg-accent transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent" />
                  <span className="absolute left-1 top-1 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
                </label>
                <span className={cn('flex-1 min-w-0', !r.activa && 'opacity-60')}>
                  <span className="block truncate text-body-sm font-semibold text-neutral-800 dark:text-neutral-100">{r.nombre}</span>
                  <span className="block truncate text-caption text-neutral-500 dark:text-neutral-400">{describirRegla(r, carpetas)}</span>
                </span>
                <button type="button" onClick={() => setForm({ ...r })} aria-label={`Editar regla ${r.nombre}`} className="w-9 h-9 flex items-center justify-center rounded-full text-neutral-500 hover:bg-surface-muted"><Pencil className="w-4 h-4" /></button>
                <button type="button" onClick={() => borrar(r)} aria-label={`Eliminar regla ${r.nombre}`} className="w-9 h-9 flex items-center justify-center rounded-full text-neutral-500 hover:text-red-600 hover:bg-surface-muted"><Trash2 className="w-4 h-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </BaseModal>
  );
}
