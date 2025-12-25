import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { CRMCampoPersonalizado, CRMEtiqueta, CRMFuenteOrigen } from '../lib/crmTypes';

export default function CRMConfiguracion() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'campos' | 'etiquetas' | 'fuentes'>('campos');
  const [campos, setCampos] = useState<CRMCampoPersonalizado[]>([]);
  const [etiquetas, setEtiquetas] = useState<CRMEtiqueta[]>([]);
  const [fuentes, setFuentes] = useState<CRMFuenteOrigen[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      const [camposData, etiquetasData, fuentesData] = await Promise.all([
        supabase.from('crm_campos_personalizados').select('*').order('orden'),
        supabase.from('crm_etiquetas').select('*').order('nombre'),
        supabase.from('crm_fuentes_origen').select('*').order('nombre'),
      ]);

      setCampos(camposData.data || []);
      setEtiquetas(etiquetasData.data || []);
      setFuentes(fuentesData.data || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const agregarCampo = async () => {
    const nombreCampo = prompt('Nombre del campo (sin espacios):');
    if (!nombreCampo) return;

    const etiqueta = prompt('Etiqueta visible:');
    if (!etiqueta) return;

    const tipoCampo = prompt('Tipo (Texto/Número/Fecha/Selector):');
    if (!tipoCampo || !['Texto', 'Número', 'Fecha', 'Selector'].includes(tipoCampo)) {
      alert('Tipo inválido');
      return;
    }

    try {
      setLoading(true);
      await supabase.from('crm_campos_personalizados').insert({
        nombre_campo: nombreCampo.toLowerCase().replace(/\s+/g, '_'),
        etiqueta,
        tipo_campo: tipoCampo,
        opciones_selector: tipoCampo === 'Selector' ? ['Opción 1', 'Opción 2'] : [],
        activo: true,
        orden: campos.length,
      });
      cargarDatos();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al agregar campo');
    } finally {
      setLoading(false);
    }
  };

  const eliminarCampo = async (id: string) => {
    if (!confirm('¿Eliminar este campo?')) return;
    try {
      await supabase.from('crm_campos_personalizados').delete().eq('id', id);
      cargarDatos();
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const agregarEtiqueta = async () => {
    const nombre = prompt('Nombre de la etiqueta:');
    if (!nombre) return;

    try {
      setLoading(true);
      await supabase.from('crm_etiquetas').insert({
        nombre,
        color: '#6366f1',
        activo: true,
      });
      cargarDatos();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al agregar etiqueta');
    } finally {
      setLoading(false);
    }
  };

  const eliminarEtiqueta = async (id: string) => {
    if (!confirm('¿Eliminar esta etiqueta?')) return;
    try {
      await supabase.from('crm_etiquetas').delete().eq('id', id);
      cargarDatos();
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const agregarFuente = async () => {
    const nombre = prompt('Nombre de la fuente de origen:');
    if (!nombre) return;

    try {
      setLoading(true);
      await supabase.from('crm_fuentes_origen').insert({
        nombre,
        activo: true,
      });
      cargarDatos();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al agregar fuente');
    } finally {
      setLoading(false);
    }
  };

  const eliminarFuente = async (id: string) => {
    if (!confirm('¿Eliminar esta fuente?')) return;
    try {
      await supabase.from('crm_fuentes_origen').delete().eq('id', id);
      cargarDatos();
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <button
          onClick={() => navigate('/mi-crm')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Volver a Mi CRM
        </button>
        <h1 className="text-2xl md:text-3xl font-bold text-primary-600">Configuración del CRM</h1>
        <p className="text-gray-600 mt-1">Personaliza campos, etiquetas y fuentes de origen</p>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="border-b">
          <div className="flex">
            {[
              { key: 'campos', label: 'Campos Personalizados' },
              { key: 'etiquetas', label: 'Etiquetas' },
              { key: 'fuentes', label: 'Fuentes de Origen' },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key as any)}
                className={`px-6 py-3 font-medium text-sm ${
                  tab === t.key
                    ? 'text-primary-600 border-b-2 border-primary-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {tab === 'campos' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-primary-600">Campos Personalizados</h2>
                <button
                  onClick={agregarCampo}
                  disabled={loading}
                  className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Agregar Campo
                </button>
              </div>
              <div className="space-y-3">
                {campos.map((campo) => (
                  <div key={campo.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{campo.etiqueta}</p>
                      <p className="text-sm text-gray-600">
                        {campo.nombre_campo} - {campo.tipo_campo}
                      </p>
                    </div>
                    <button
                      onClick={() => eliminarCampo(campo.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'etiquetas' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-primary-600">Etiquetas de Segmentación</h2>
                <button
                  onClick={agregarEtiqueta}
                  disabled={loading}
                  className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Agregar Etiqueta
                </button>
              </div>
              <div className="flex flex-wrap gap-3">
                {etiquetas.map((etiqueta) => (
                  <div
                    key={etiqueta.id}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-100 text-primary-800 rounded-full"
                  >
                    <span>{etiqueta.nombre}</span>
                    <button
                      onClick={() => eliminarEtiqueta(etiqueta.id)}
                      className="hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'fuentes' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-primary-600">Fuentes de Origen</h2>
                <button
                  onClick={agregarFuente}
                  disabled={loading}
                  className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Agregar Fuente
                </button>
              </div>
              <div className="space-y-3">
                {fuentes.map((fuente) => (
                  <div key={fuente.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <p className="font-medium text-gray-900">{fuente.nombre}</p>
                    <button
                      onClick={() => eliminarFuente(fuente.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
