import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Settings, ArrowLeft, Save, Link as LinkIcon, Check, AlertCircle } from 'lucide-react';

interface GoogleSheetsConfig {
  id: string;
  sheet_url: string;
  sheet_id: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export default function ProduccionConfiguracion() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [config, setConfig] = useState<GoogleSheetsConfig | null>(null);
  const [sheetUrl, setSheetUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (usuario?.rol !== 'Administrador') {
      navigate('/produccion/total');
      return;
    }
    loadConfig();
  }, [usuario, navigate]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('production_google_sheets_config')
        .select('*')
        .eq('activo', true)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setConfig(data);
        setSheetUrl(data.sheet_url);
      }
    } catch (error: any) {
      console.error('Error loading config:', error);
      setMessage({ type: 'error', text: 'Error al cargar la configuración' });
    } finally {
      setLoading(false);
    }
  };

  const extractSheetId = (url: string): string | null => {
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  };

  const handleSave = async () => {
    if (!sheetUrl.trim()) {
      setMessage({ type: 'error', text: 'Por favor, ingresa el link de Google Sheets' });
      return;
    }

    const sheetId = extractSheetId(sheetUrl);
    if (!sheetId) {
      setMessage({ type: 'error', text: 'El link de Google Sheets no es válido. Debe ser un link como: https://docs.google.com/spreadsheets/d/{ID}/edit' });
      return;
    }

    setSaving(true);
    try {
      if (config) {
        await supabase
          .from('production_google_sheets_config')
          .update({ activo: false })
          .eq('id', config.id);
      }

      const { data: newConfig, error } = await supabase
        .from('production_google_sheets_config')
        .insert({
          sheet_url: sheetUrl,
          sheet_id: sheetId,
          configurado_por_user_id: usuario?.id,
          activo: true
        })
        .select()
        .single();

      if (error) throw error;

      setConfig(newConfig);
      setMessage({ type: 'success', text: 'Configuración guardada exitosamente' });
    } catch (error: any) {
      console.error('Error saving config:', error);
      setMessage({ type: 'error', text: 'Error al guardar la configuración: ' + error.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-neutral-600">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate('/produccion/total')}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a Producción
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Configuración de Producción</h1>
              <p className="text-sm text-blue-100">Conecta tu hoja de Google Sheets</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {message && (
            <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              {message.type === 'success' ? (
                <Check className="w-5 h-5 text-green-600 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
                  {message.text}
                </p>
              </div>
              <button
                onClick={() => setMessage(null)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                ×
              </button>
            </div>
          )}

          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 mb-4">
                Conexión a Google Sheets
              </h2>
              <p className="text-sm text-neutral-600 mb-4">
                Ingresa el link de tu hoja de Google Sheets que contiene los datos de producción.
                La hoja debe estar configurada con permisos de "Cualquier persona con el link puede ver".
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h3 className="font-semibold text-blue-900 mb-2 text-sm">Instrucciones:</h3>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>Abre tu hoja de Google Sheets</li>
                  <li>Haz clic en "Compartir" en la esquina superior derecha</li>
                  <li>Selecciona "Cualquier persona con el link puede ver"</li>
                  <li>Copia el link de la hoja</li>
                  <li>Pégalo aquí abajo y guarda</li>
                </ol>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Link de Google Sheets
                  </label>
                  <div className="relative">
                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                    <input
                      type="url"
                      value={sheetUrl}
                      onChange={(e) => setSheetUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      className="w-full pl-10 pr-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  {config && (
                    <p className="mt-2 text-sm text-green-600 flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      Configurado correctamente
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Guardar Configuración
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {config && (
              <div className="border-t border-neutral-200 pt-6">
                <h3 className="font-semibold text-neutral-900 mb-3">Configuración Actual</h3>
                <div className="bg-neutral-50 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Estado:</span>
                    <span className="font-medium text-green-600">Activo</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Sheet ID:</span>
                    <span className="font-mono text-neutral-900">{config.sheet_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Última actualización:</span>
                    <span className="text-neutral-900">
                      {new Date(config.updated_at).toLocaleString('es-MX')}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
        <h3 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Importante
        </h3>
        <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
          <li>Los datos se consultan directamente desde Google Sheets en tiempo real</li>
          <li>Asegúrate de que la hoja tenga las columnas correctas</li>
          <li>Los cambios en la hoja se reflejarán inmediatamente en el sistema</li>
          <li>No es necesario cargar archivos Excel manualmente</li>
        </ul>
      </div>
    </div>
  );
}
