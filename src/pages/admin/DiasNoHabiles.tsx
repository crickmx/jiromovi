import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { PageHeader } from '@/components/ui/page-header';
import { Calendar, Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { getFestivosDelAno, invalidarCacheDiasHabiles, type FestivoInfo } from '../../lib/diasHabiles';

export default function DiasNoHabiles() {
  const year0 = new Date().getFullYear();
  const [year, setYear] = useState(year0);
  const [festivos, setFestivos] = useState<FestivoInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Form nueva fecha
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [nuevaDesc, setNuevaDesc] = useState('');
  const [agregando, setAgregando] = useState(false);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const cargar = async () => {
    setLoading(true);
    const data = await getFestivosDelAno(year);
    setFestivos(data);
    setLoading(false);
  };

  useEffect(() => { cargar(); }, [year]);

  const agregar = async () => {
    if (!nuevaFecha || !nuevaDesc.trim()) { showToast('Completa la fecha y descripción', 'error'); return; }
    setAgregando(true);
    const { error } = await supabase.from('dias_no_habiles').insert({
      fecha: nuevaFecha,
      descripcion: nuevaDesc.trim(),
      activo: true,
    });
    setAgregando(false);
    if (error) {
      showToast(error.code === '23505' ? 'Esa fecha ya existe' : 'Error: ' + error.message, 'error');
      return;
    }
    invalidarCacheDiasHabiles();
    setNuevaFecha('');
    setNuevaDesc('');
    showToast('Día no hábil agregado');
    cargar();
  };

  const toggleActivo = async (id: string, activo: boolean) => {
    await supabase.from('dias_no_habiles').update({ activo: !activo }).eq('id', id);
    invalidarCacheDiasHabiles();
    cargar();
  };

  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar este día personalizado?')) return;
    await supabase.from('dias_no_habiles').delete().eq('id', id);
    invalidarCacheDiasHabiles();
    cargar();
  };

  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const agrupar = () => {
    const grupos: Record<number, FestivoInfo[]> = {};
    for (const f of festivos) {
      const m = new Date(f.fecha + 'T12:00:00').getMonth();
      if (!grupos[m]) grupos[m] = [];
      grupos[m].push(f);
    }
    return grupos;
  };
  const grupos = agrupar();

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Días No Hábiles"
        description="Festivos oficiales (Art. 74 LFT) y excepciones personalizadas de la empresa"
        icon={Calendar}
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl space-y-6">

          {/* Selector de año */}
          <div className="flex items-center gap-3">
            <button onClick={() => setYear(y => y - 1)} className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-lg font-semibold text-neutral-800 w-16 text-center">{year}</span>
            <button onClick={() => setYear(y => y + 1)} className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Agregar nuevo */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-5">
            <h3 className="text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-500" /> Agregar día no hábil personalizado
            </h3>
            <div className="flex gap-3 flex-wrap">
              <input
                type="date"
                value={nuevaFecha}
                onChange={e => setNuevaFecha(e.target.value)}
                className="px-3 py-2 border border-neutral-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Descripción (ej. Puente vacacional)"
                value={nuevaDesc}
                onChange={e => setNuevaDesc(e.target.value)}
                className="flex-1 min-w-48 px-3 py-2 border border-neutral-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
                onKeyDown={e => e.key === 'Enter' && agregar()}
              />
              <button
                onClick={agregar}
                disabled={agregando}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                {agregando ? 'Agregando…' : 'Agregar'}
              </button>
            </div>
          </div>

          {toast && (
            <div className={`px-4 py-3 rounded-xl text-sm font-medium ${toast.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {toast.msg}
            </div>
          )}

          {/* Lista por mes */}
          {loading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-24 bg-neutral-100 rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(grupos).map(([mIdx, dias]) => (
                <div key={mIdx} className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
                  <div className="px-4 py-2.5 bg-neutral-50 border-b border-neutral-200">
                    <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                      {meses[Number(mIdx)]}
                    </span>
                  </div>
                  <div className="divide-y divide-neutral-100">
                    {dias.map((f, i) => (
                      <div key={i} className={`flex items-center gap-3 px-4 py-3 ${f.tipo === 'personalizado' && !f.activo ? 'opacity-50' : ''}`}>
                        <div className={`w-2 h-2 rounded-full shrink-0 ${f.tipo === 'automatico' ? 'bg-blue-400' : f.activo ? 'bg-amber-400' : 'bg-neutral-300'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-neutral-800 truncate">{f.nombre}</p>
                          <p className="text-xs text-neutral-400">
                            {new Date(f.fecha + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                            {' · '}
                            <span className={f.tipo === 'automatico' ? 'text-blue-500' : 'text-amber-600'}>
                              {f.tipo === 'automatico' ? 'Art. 74 LFT' : 'Personalizado'}
                            </span>
                          </p>
                        </div>
                        {f.tipo === 'personalizado' && f.id && (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => toggleActivo(f.id!, f.activo ?? true)}
                              className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${f.activo ? 'border-green-300 text-green-600 hover:bg-green-50' : 'border-neutral-300 text-neutral-400 hover:bg-neutral-50'}`}
                            >
                              {f.activo ? 'Activo' : 'Inactivo'}
                            </button>
                            <button
                              onClick={() => eliminar(f.id!)}
                              className="p-1 hover:bg-red-50 rounded-lg text-neutral-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {Object.keys(grupos).length === 0 && (
                <div className="text-center py-12 text-neutral-400">
                  <Calendar className="w-10 h-10 mx-auto mb-2 text-neutral-200" />
                  <p className="text-sm">Sin días registrados para {year}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
