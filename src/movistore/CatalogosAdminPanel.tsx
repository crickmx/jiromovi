import { useState, useEffect, useRef } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff, X, GripVertical, Image as ImageIcon, Check } from 'lucide-react';
import { supabase, supabaseUrl } from '@/lib/supabase';
import type { StoreProducto } from '@/lib/storeTypes';

interface Catalogo {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  imagen_portada_url: string | null;
  activo: boolean;
}

const toSlug = (s: string) =>
  s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

function getImgUrl(url: string | null) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${supabaseUrl}/storage/v1/object/public/store-productos/${url}`;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

export function CatalogosAdminPanel() {
  const [catalogos, setCatalogos] = useState<Catalogo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Catalogo | null>(null);
  const [productosModal, setProductosModal] = useState<StoreProducto[]>([]);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [ordenSeleccionados, setOrdenSeleccionados] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [subiendoImg, setSubiendoImg] = useState(false);
  const imgInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    nombre: '',
    slug: '',
    descripcion: '',
    imagen_portada_url: '',
    activo: true,
  });
  const [slugManual, setSlugManual] = useState(false);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCargando(true);
    const { data } = await supabase
      .from('store_catalogos')
      .select('*')
      .order('nombre');
    setCatalogos(data ?? []);
    setCargando(false);
  }

  async function abrirModal(cat?: Catalogo) {
    setEditando(cat ?? null);
    setSlugManual(false);
    if (cat) {
      setForm({
        nombre: cat.nombre,
        slug: cat.slug,
        descripcion: cat.descripcion ?? '',
        imagen_portada_url: cat.imagen_portada_url ?? '',
        activo: cat.activo,
      });
      // Cargar productos del catálogo
      const [{ data: todos }, { data: rels }] = await Promise.all([
        supabase.from('store_productos').select('*').eq('activo', true).order('orden'),
        supabase.from('store_catalogo_productos')
          .select('producto_id, orden')
          .eq('catalogo_id', cat.id)
          .order('orden'),
      ]);
      setProductosModal((todos ?? []) as StoreProducto[]);
      const ids = (rels ?? []).sort((a: any, b: any) => a.orden - b.orden).map((r: any) => r.producto_id as string);
      setSeleccionados(new Set(ids));
      setOrdenSeleccionados(ids);
    } else {
      setForm({ nombre: '', slug: '', descripcion: '', imagen_portada_url: '', activo: true });
      const { data: todos } = await supabase.from('store_productos').select('*').eq('activo', true).order('orden');
      setProductosModal((todos ?? []) as StoreProducto[]);
      setSeleccionados(new Set());
      setOrdenSeleccionados([]);
    }
    setModalAbierto(true);
  }

  function cerrarModal() {
    setModalAbierto(false);
    setEditando(null);
  }

  function handleNombre(v: string) {
    setForm(f => ({ ...f, nombre: v, slug: slugManual ? f.slug : toSlug(v) }));
  }

  function toggleProducto(id: string) {
    setSeleccionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setOrdenSeleccionados(o => o.filter(x => x !== id));
      } else {
        next.add(id);
        setOrdenSeleccionados(o => [...o, id]);
      }
      return next;
    });
  }

  function moverProducto(id: string, dir: 'up' | 'down') {
    setOrdenSeleccionados(prev => {
      const idx = prev.indexOf(id);
      if (idx === -1) return prev;
      const next = [...prev];
      const swap = dir === 'up' ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }

  async function subirImagen(file: File) {
    setSubiendoImg(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `catalogos/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('store-productos').upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('store-productos').getPublicUrl(path);
      setForm(f => ({ ...f, imagen_portada_url: publicUrl }));
    } catch (err: any) {
      alert('Error subiendo imagen: ' + err.message);
    } finally {
      setSubiendoImg(false);
    }
  }

  async function guardar() {
    if (!form.nombre.trim() || !form.slug.trim()) return;
    setGuardando(true);
    try {
      let catId = editando?.id;
      if (catId) {
        await supabase.from('store_catalogos').update({
          nombre: form.nombre.trim(),
          slug: form.slug.trim(),
          descripcion: form.descripcion.trim() || null,
          imagen_portada_url: form.imagen_portada_url || null,
          activo: form.activo,
        }).eq('id', catId);
      } else {
        const { data, error } = await supabase.from('store_catalogos').insert({
          nombre: form.nombre.trim(),
          slug: form.slug.trim(),
          descripcion: form.descripcion.trim() || null,
          imagen_portada_url: form.imagen_portada_url || null,
          activo: form.activo,
        }).select().single();
        if (error) throw error;
        catId = (data as any).id;
      }

      // Guardar productos seleccionados con su orden
      await supabase.from('store_catalogo_productos').delete().eq('catalogo_id', catId!);
      if (ordenSeleccionados.length > 0) {
        await supabase.from('store_catalogo_productos').insert(
          ordenSeleccionados.map((pid, i) => ({ catalogo_id: catId!, producto_id: pid, orden: i }))
        );
      }

      cerrarModal();
      cargar();
    } catch (err: any) {
      alert('Error: ' + (err.message || 'desconocido'));
    } finally {
      setGuardando(false);
    }
  }

  async function toggleActivo(cat: Catalogo) {
    await supabase.from('store_catalogos').update({ activo: !cat.activo }).eq('id', cat.id);
    cargar();
  }

  async function eliminar(cat: Catalogo) {
    if (!confirm(`¿Eliminar el catálogo "${cat.nombre}"? Esta acción no se puede deshacer.`)) return;
    await supabase.from('store_catalogos').delete().eq('id', cat.id);
    cargar();
  }

  const productosOrdenados = [
    ...ordenSeleccionados.map(id => productosModal.find(p => p.id === id)).filter(Boolean) as StoreProducto[],
    ...productosModal.filter(p => !seleccionados.has(p.id)),
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Catálogos</h2>
          <p className="text-sm text-gray-500 dark:text-white/50 mt-0.5">
            Agrupaciones de productos para compartir en{' '}
            <a href="https://tienda.movi.digital" target="_blank" rel="noopener" className="underline hover:text-blue-500">
              tienda.movi.digital
            </a>
          </p>
        </div>
        <button
          onClick={() => abrirModal()}
          className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" />
          Nuevo catálogo
        </button>
      </div>

      {cargando ? (
        <div className="py-12 text-center text-gray-400">Cargando...</div>
      ) : catalogos.length === 0 ? (
        <div className="py-12 text-center text-gray-400">No hay catálogos. Crea el primero.</div>
      ) : (
        <div className="space-y-3">
          {catalogos.map(cat => (
            <div
              key={cat.id}
              className="flex items-center gap-4 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-4"
            >
              {cat.imagen_portada_url ? (
                <img
                  src={getImgUrl(cat.imagen_portada_url) ?? ''}
                  alt={cat.nombre}
                  className="w-14 h-14 rounded-lg object-cover shrink-0 bg-gray-100"
                />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-gray-100 dark:bg-white/10 flex items-center justify-center shrink-0">
                  <ImageIcon className="w-6 h-6 text-gray-300" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 dark:text-white truncate">{cat.nombre}</span>
                  {!cat.activo && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-gray-400">Inactivo</span>
                  )}
                </div>
                <a
                  href={`https://tienda.movi.digital/catalogo/${cat.slug}`}
                  target="_blank"
                  rel="noopener"
                  className="text-xs text-blue-500 hover:underline truncate block"
                >
                  tienda.movi.digital/catalogo/{cat.slug}
                </a>
                {cat.descripcion && (
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{cat.descripcion}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => toggleActivo(cat)}
                  title={cat.activo ? 'Desactivar' : 'Activar'}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-gray-700 dark:hover:text-white transition"
                >
                  {cat.activo ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => abrirModal(cat)}
                  title="Editar"
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-gray-700 dark:hover:text-white transition"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => eliminar(cat)}
                  title="Eliminar"
                  className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal crear/editar */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-white/10 shrink-0">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editando ? 'Editar catálogo' : 'Nuevo catálogo'}
              </h3>
              <button onClick={cerrarModal} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-5">
              {/* Nombre y slug */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-white/70 block mb-1">Nombre *</label>
                  <input
                    value={form.nombre}
                    onChange={e => handleNombre(e.target.value)}
                    className="w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Catálogo Verano 2026"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-white/70 block mb-1">
                    Slug (URL)
                    {!slugManual && (
                      <button
                        type="button"
                        onClick={() => setSlugManual(true)}
                        className="ml-2 text-xs text-blue-500 hover:underline"
                      >
                        editar
                      </button>
                    )}
                  </label>
                  <input
                    value={form.slug}
                    onChange={e => { setSlugManual(true); setForm(f => ({ ...f, slug: e.target.value })); }}
                    className="w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    placeholder="catalogo-verano-2026"
                  />
                  <p className="text-xs text-gray-400 mt-1">tienda.movi.digital/catalogo/{form.slug || '...'}</p>
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-white/70 block mb-1">Descripción</label>
                <textarea
                  value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Descripción breve del catálogo..."
                />
              </div>

              {/* Imagen portada */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-white/70 block mb-2">Imagen de portada</label>
                <div className="flex items-start gap-3">
                  {form.imagen_portada_url ? (
                    <div className="relative shrink-0">
                      <img
                        src={getImgUrl(form.imagen_portada_url) ?? ''}
                        alt="portada"
                        className="w-24 h-24 rounded-xl object-cover border border-gray-200 dark:border-white/10"
                      />
                      <button
                        onClick={() => setForm(f => ({ ...f, imagen_portada_url: '' }))}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-xl bg-gray-100 dark:bg-white/5 border-2 border-dashed border-gray-200 dark:border-white/10 flex items-center justify-center shrink-0">
                      <ImageIcon className="w-8 h-8 text-gray-300" />
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-2 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/15 text-gray-700 dark:text-white/70 text-sm font-medium px-3 py-2 rounded-lg transition">
                      {subiendoImg ? 'Subiendo...' : 'Subir imagen'}
                      <input
                        ref={imgInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => { if (e.target.files?.[0]) subirImagen(e.target.files[0]); }}
                      />
                    </label>
                    <p className="text-xs text-gray-400">JPG, PNG o WebP recomendado. Mínimo 800×400px.</p>
                  </div>
                </div>
              </div>

              {/* Activo */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, activo: !f.activo }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.activo ? 'bg-blue-500' : 'bg-gray-200 dark:bg-white/20'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.activo ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <span className="text-sm text-gray-700 dark:text-white/70">
                  {form.activo ? 'Visible en la tienda' : 'Oculto (borrador)'}
                </span>
              </div>

              {/* Selector de productos */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-white/70">
                    Productos ({seleccionados.size} seleccionados)
                  </label>
                  <span className="text-xs text-gray-400">Los marcados aparecen en este catálogo</span>
                </div>
                <div className="border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden divide-y divide-gray-100 dark:divide-white/5 max-h-72 overflow-y-auto">
                  {productosOrdenados.map(p => {
                    const isSelected = seleccionados.has(p.id);
                    const posicion = ordenSeleccionados.indexOf(p.id);
                    return (
                      <div
                        key={p.id}
                        className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${isSelected ? 'bg-blue-50 dark:bg-blue-900/10' : 'bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-white/5'}`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleProducto(p.id)}
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300 dark:border-white/20'}`}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </button>
                        {p.imagen_url ? (
                          <img src={p.imagen_url} alt={p.titulo} className="w-8 h-8 rounded-lg object-cover bg-gray-100 shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/10 flex items-center justify-center shrink-0 text-sm">📦</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{p.titulo}</p>
                          <p className="text-xs text-gray-400">{fmt(p.precio)}</p>
                        </div>
                        {isSelected && (
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => moverProducto(p.id, 'up')}
                              disabled={posicion === 0}
                              className="text-gray-300 hover:text-gray-600 dark:hover:text-white disabled:opacity-20 text-xs leading-none"
                            >▲</button>
                            <button
                              type="button"
                              onClick={() => moverProducto(p.id, 'down')}
                              disabled={posicion === ordenSeleccionados.length - 1}
                              className="text-gray-300 hover:text-gray-600 dark:hover:text-white disabled:opacity-20 text-xs leading-none"
                            >▼</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {productosModal.length === 0 && (
                    <div className="py-6 text-center text-gray-400 text-sm">No hay productos activos en la tienda.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100 dark:border-white/10 shrink-0">
              <button
                onClick={cerrarModal}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/10 transition"
              >
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={guardando || !form.nombre.trim() || !form.slug.trim()}
                className="px-5 py-2 rounded-lg text-sm font-semibold bg-accent text-white hover:opacity-90 transition disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear catálogo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
