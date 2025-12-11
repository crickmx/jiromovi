import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Settings, ArrowLeft, Save, Link as LinkIcon, Check, AlertCircle, Building } from 'lucide-react';

interface GoogleSheetsConfig {
  id: string;
  sheet_url: string;
  sheet_id: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

interface Oficina {
  id: string;
  nombre: string;
}

interface OfficeMapping {
  id: string;
  oficina_id: string;
  excel_office_name: string;
}

interface OfficeMappingEdit {
  oficina_id: string;
  oficina_nombre: string;
  excel_office_name: string;
}

export default function ProduccionConfiguracion() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [config, setConfig] = useState<GoogleSheetsConfig | null>(null);
  const [sheetUrl, setSheetUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [mappings, setMappings] = useState<OfficeMappingEdit[]>([]);
  const [savingMappings, setSavingMappings] = useState(false);
  const [excelOfficeNames, setExcelOfficeNames] = useState<string[]>([]);

  useEffect(() => {
    if (usuario?.rol !== 'Administrador') {
      navigate('/produccion/total');
      return;
    }
    loadConfig();
    loadOffices();
    loadMappings();
    loadExcelOfficeNames();
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

  const loadOffices = async () => {
    try {
      const { data, error } = await supabase
        .from('oficinas')
        .select('id, nombre')
        .order('nombre');

      if (error) throw error;
      setOficinas(data || []);
    } catch (error: any) {
      console.error('Error loading offices:', error);
    }
  };

  const loadMappings = async () => {
    try {
      const { data, error } = await supabase
        .from('production_office_mapping')
        .select('id, oficina_id, excel_office_name, oficinas(nombre)');

      if (error) throw error;

      const mappingsData: OfficeMappingEdit[] = (data || []).map((m: any) => ({
        oficina_id: m.oficina_id,
        oficina_nombre: m.oficinas?.nombre || '',
        excel_office_name: m.excel_office_name
      }));

      setMappings(mappingsData);
    } catch (error: any) {
      console.error('Error loading mappings:', error);
    }
  };

  const loadExcelOfficeNames = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-production-sheets`;

      const headers = {
        'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(apiUrl, { headers });

      if (!response.ok) {
        console.error('Error fetching production data');
        return;
      }

      const result = await response.json();

      if (result.success && result.records) {
        const uniqueNames = [...new Set(result.records.map((r: any) => r.desp_nombre_raw).filter(Boolean))] as string[];
        setExcelOfficeNames(uniqueNames.sort());
      }
    } catch (error: any) {
      console.error('Error loading Excel office names:', error);
    }
  };

  const handleMappingChange = (oficina_id: string, excel_name: string) => {
    setMappings(prev => {
      const exists = prev.find(m => m.oficina_id === oficina_id);
      if (exists) {
        return prev.map(m =>
          m.oficina_id === oficina_id
            ? { ...m, excel_office_name: excel_name }
            : m
        );
      } else {
        const oficina = oficinas.find(o => o.id === oficina_id);
        return [...prev, {
          oficina_id,
          oficina_nombre: oficina?.nombre || '',
          excel_office_name: excel_name
        }];
      }
    });
  };

  const handleSaveMappings = async () => {
    setSavingMappings(true);
    try {
      await supabase
        .from('production_office_mapping')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      const mappingsToInsert = mappings
        .filter(m => m.excel_office_name.trim() !== '')
        .map(m => ({
          oficina_id: m.oficina_id,
          excel_office_name: m.excel_office_name
        }));

      if (mappingsToInsert.length > 0) {
        const { error } = await supabase
          .from('production_office_mapping')
          .insert(mappingsToInsert);

        if (error) throw error;
      }

      setMessage({ type: 'success', text: 'Mapeo de oficinas guardado exitosamente' });
      loadMappings();
    } catch (error: any) {
      console.error('Error saving mappings:', error);
      setMessage({ type: 'error', text: 'Error al guardar el mapeo: ' + error.message });
    } finally {
      setSavingMappings(false);
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
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <button
          onClick={() => navigate('/produccion/total')}
          className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4" />
          Volver a Producción
        </button>
      </div>

      <div className="bg-white rounded-2xl sm:rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur flex-shrink-0">
              <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white">Configuración de Producción</h1>
              <p className="text-xs sm:text-sm text-blue-100">Conecta tu hoja de Google Sheets</p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {message && (
            <div className={`mb-4 sm:mb-6 p-3 sm:p-4 rounded-lg flex items-start gap-2 sm:gap-3 ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              {message.type === 'success' ? (
                <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-xs sm:text-sm ${message.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                  {message.text}
                </p>
              </div>
              <button
                onClick={() => setMessage(null)}
                className="text-neutral-400 hover:text-neutral-600 text-lg flex-shrink-0"
              >
                ×
              </button>
            </div>
          )}

          <div className="space-y-4 sm:space-y-6">
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-neutral-900 mb-3 sm:mb-4">
                Conexión a Google Sheets
              </h2>
              <p className="text-xs sm:text-sm text-neutral-600 mb-3 sm:mb-4">
                Ingresa el link de tu hoja de Google Sheets que contiene los datos de producción.
                La hoja debe estar configurada con permisos de "Cualquier persona con el link puede ver".
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4">
                <h3 className="font-semibold text-blue-900 mb-2 text-xs sm:text-sm">Instrucciones:</h3>
                <ol className="text-xs sm:text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>Abre tu hoja de Google Sheets</li>
                  <li>Haz clic en "Compartir" en la esquina superior derecha</li>
                  <li>Selecciona "Cualquier persona con el link puede ver"</li>
                  <li>Copia el link de la hoja</li>
                  <li>Pégalo aquí abajo y guarda</li>
                </ol>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-2">
                    Link de Google Sheets
                  </label>
                  <div className="relative">
                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-neutral-400" />
                    <input
                      type="url"
                      value={sheetUrl}
                      onChange={(e) => setSheetUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-3 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  {config && (
                    <p className="mt-2 text-xs sm:text-sm text-green-600 flex items-center gap-2">
                      <Check className="w-3 h-3 sm:w-4 sm:h-4" />
                      Configurado correctamente
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 sm:gap-4">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full sm:w-auto"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        <span className="hidden sm:inline">Guardando...</span>
                        <span className="sm:hidden">...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span className="hidden sm:inline">Guardar Configuración</span>
                        <span className="sm:hidden">Guardar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {config && (
              <div className="border-t border-neutral-200 pt-4 sm:pt-6">
                <h3 className="font-semibold text-neutral-900 mb-3 text-sm sm:text-base">Configuración Actual</h3>
                <div className="bg-neutral-50 rounded-lg p-3 sm:p-4 space-y-2 text-xs sm:text-sm">
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-neutral-600">Estado:</span>
                    <span className="font-medium text-green-600">Activo</span>
                  </div>
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-neutral-600 flex-shrink-0">Sheet ID:</span>
                    <span className="font-mono text-neutral-900 text-right break-all">{config.sheet_id}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2">
                    <span className="text-neutral-600">Última actualización:</span>
                    <span className="text-neutral-900 sm:text-right">
                      {new Date(config.updated_at).toLocaleString('es-MX')}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 sm:mt-6 bg-white rounded-2xl sm:rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
        <div className="bg-gradient-to-r from-green-600 to-green-700 px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur flex-shrink-0">
              <Building className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">Mapeo de Oficinas</h2>
              <p className="text-xs sm:text-sm text-green-100">Relaciona las oficinas del sistema con las del Excel</p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-blue-800">
              Los nombres de las oficinas en el Excel pueden no coincidir exactamente con los nombres en la plataforma.
              Aquí puedes indicar manualmente qué oficina del sistema corresponde a cada oficina del Excel.
            </p>
          </div>

          {excelOfficeNames.length === 0 ? (
            <div className="text-center py-8 text-neutral-500">
              <Building className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Configura primero la conexión a Google Sheets para cargar los nombres de oficinas del Excel</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {oficinas.map((oficina) => {
                  const mapping = mappings.find(m => m.oficina_id === oficina.id);
                  return (
                    <div key={oficina.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <label className="block text-xs font-medium text-neutral-600 mb-1">
                          Oficina en Sistema:
                        </label>
                        <p className="text-sm font-medium text-neutral-900 truncate">
                          {oficina.nombre}
                        </p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <label className="block text-xs font-medium text-neutral-600 mb-1">
                          Oficina en Excel:
                        </label>
                        <select
                          value={mapping?.excel_office_name || ''}
                          onChange={(e) => handleMappingChange(oficina.id, e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        >
                          <option value="">-- Sin mapear --</option>
                          {excelOfficeNames.map((name) => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 sm:mt-6 flex items-center justify-end">
                <button
                  onClick={handleSaveMappings}
                  disabled={savingMappings}
                  className="inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {savingMappings ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Guardar Mapeo</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 sm:mt-6 bg-amber-50 border border-amber-200 rounded-lg p-3 sm:p-4">
        <h3 className="font-semibold text-amber-900 mb-2 flex items-center gap-2 text-sm sm:text-base">
          <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
          Importante
        </h3>
        <ul className="text-xs sm:text-sm text-amber-800 space-y-1 list-disc list-inside">
          <li>Los datos se consultan directamente desde Google Sheets en tiempo real</li>
          <li>Asegúrate de que la hoja tenga las columnas correctas</li>
          <li>Los cambios en la hoja se reflejarán inmediatamente en el sistema</li>
          <li>No es necesario cargar archivos Excel manualmente</li>
        </ul>
      </div>
    </div>
  );
}
