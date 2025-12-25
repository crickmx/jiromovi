import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type CampoPersonalizado = Database['public']['Tables']['campos_personalizados']['Row'];
type ValorCampoPersonalizado = Database['public']['Tables']['valores_campos_personalizados']['Row'];

interface CustomFieldsProps {
  usuarioId: string;
  editable?: boolean;
}

export function CustomFields({ usuarioId, editable = false }: CustomFieldsProps) {
  const [campos, setCampos] = useState<CampoPersonalizado[]>([]);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFields();
  }, [usuarioId]);

  const loadFields = async () => {
    try {
      const { data: camposData } = await supabase
        .from('campos_personalizados')
        .select('*')
        .eq('activo', true)
        .eq('visible', true)
        .order('orden');

      if (camposData) {
        setCampos(camposData);

        const { data: valoresData } = await supabase
          .from('valores_campos_personalizados')
          .select('*')
          .eq('usuario_id', usuarioId);

        const valoresMap: Record<string, string> = {};
        valoresData?.forEach((v) => {
          valoresMap[v.campo_id] = v.valor || '';
        });
        setValores(valoresMap);
      }
    } catch (error) {
      console.error('Error cargando campos personalizados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = async (campoId: string, valor: string) => {
    setValores({ ...valores, [campoId]: valor });

    try {
      const { data: existing } = await supabase
        .from('valores_campos_personalizados')
        .select('id')
        .eq('usuario_id', usuarioId)
        .eq('campo_id', campoId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('valores_campos_personalizados')
          .update({ valor, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('valores_campos_personalizados')
          .insert({
            usuario_id: usuarioId,
            campo_id: campoId,
            valor,
          });
      }
    } catch (error) {
      console.error('Error guardando valor de campo personalizado:', error);
    }
  };

  if (loading || campos.length === 0) {
    return null;
  }

  const renderField = (campo: CampoPersonalizado) => {
    const valor = valores[campo.id] || '';
    const isEditable = editable && campo.editable;

    switch (campo.tipo) {
      case 'numero':
        return (
          <input
            type="number"
            value={valor}
            onChange={(e) => handleChange(campo.id, e.target.value)}
            disabled={!isEditable}
            required={campo.requerido}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
          />
        );
      case 'fecha':
        return (
          <input
            type="date"
            value={valor}
            onChange={(e) => handleChange(campo.id, e.target.value)}
            disabled={!isEditable}
            required={campo.requerido}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
          />
        );
      case 'booleano':
        return (
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={valor === 'true'}
              onChange={(e) => handleChange(campo.id, e.target.checked ? 'true' : 'false')}
              disabled={!isEditable}
              className="w-5 h-5 text-primary-600 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <span className="ml-3 text-sm text-slate-600">
              {valor === 'true' ? 'Sí' : 'No'}
            </span>
          </div>
        );
      default:
        return (
          <input
            type="text"
            value={valor}
            onChange={(e) => handleChange(campo.id, e.target.value)}
            disabled={!isEditable}
            required={campo.requerido}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
          />
        );
    }
  };

  return (
    <>
      {campos.map((campo) => (
        <div key={campo.id}>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            {campo.nombre}
            {campo.requerido && <span className="text-red-500 ml-1">*</span>}
          </label>
          {renderField(campo)}
        </div>
      ))}
    </>
  );
}
