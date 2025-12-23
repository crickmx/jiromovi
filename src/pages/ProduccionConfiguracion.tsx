import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Settings, Save, Link as LinkIcon, Check, AlertCircle, Building, Users, UserCheck, UserX, Search, RefreshCw } from 'lucide-react';
import { getUniqueVendorsFromProduction, syncVendorsToCache, createOrUpdateVendorMapping, deleteVendorMapping, type VendorMappingInfo } from '../lib/produccionVendorUtils';
import { SearchableUserSelect } from '../components/SearchableUserSelect';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

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

  // Mapeo de agentes (VendNombre)
  const [vendors, setVendors] = useState<VendorMappingInfo[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [syncingVendors, setSyncingVendors] = useState(false);
  const [savingVendor, setSavingVendor] = useState<string | null>(null);
  // Estados con persistencia
  const [searchVendor, setSearchVendor] = useState<string>(() => {
    return localStorage.getItem('produccion-config-search') || '';
  });

  const [filterMappingStatus, setFilterMappingStatus] = useState<'all' | 'mapped' | 'unmapped'>(() => {
    const saved = localStorage.getItem('produccion-config-filter');
    return (saved as 'all' | 'mapped' | 'unmapped') || 'all';
  });

  const [activeTab, setActiveTab] = useState<string>(() => {
    return localStorage.getItem('produccion-config-tab') || 'config';
  });

  const [usuarios, setUsuarios] = useState<{ id: string; nombre_completo: string; email_laboral: string; oficina_id: string | null; rol?: string }[]>([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [errorUsuarios, setErrorUsuarios] = useState<string | null>(null);

  const [refreshingNames, setRefreshingNames] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [syncingInsurers, setSyncingInsurers] = useState(false);
  const [insurersSyncMessage, setInsurersSyncMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Funciones para manejar cambios con persistencia
  const handleSearchChange = (value: string) => {
    setSearchVendor(value);
    localStorage.setItem('produccion-config-search', value);
  };

  const handleFilterChange = (value: 'all' | 'mapped' | 'unmapped') => {
    setFilterMappingStatus(value);
    localStorage.setItem('produccion-config-filter', value);
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    localStorage.setItem('produccion-config-tab', value);
  };

  useEffect(() => {
    if (usuario?.rol !== 'Administrador') {
      navigate('/produccion/total');
      return;
    }
    loadConfig();
    loadOffices();
    loadMappings();
    loadExcelOfficeNames();
    loadUsuarios();
    loadVendors();
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

  const handleRefreshClientNames = async () => {
    if (!confirm('¿Estás seguro de que deseas actualizar los nombres de clientes desde Google Sheets? Esta operación puede tardar varios minutos.')) {
      return;
    }

    setRefreshingNames(true);
    setRefreshMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No hay sesión activa');

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/refresh-production-client-names`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error al actualizar nombres de clientes');
      }

      setRefreshMessage({
        type: 'success',
        text: `Nombres actualizados: ${result.stats.updated} registros. No encontrados: ${result.stats.not_found}. Sin cambios: ${result.stats.unchanged}.`
      });
    } catch (error: any) {
      console.error('Error refreshing client names:', error);
      setRefreshMessage({
        type: 'error',
        text: error.message || 'Error al actualizar nombres de clientes'
      });
    } finally {
      setRefreshingNames(false);
    }
  };

  const handleSyncInsurers = async () => {
    if (!confirm('¿Estás seguro de que deseas sincronizar las aseguradoras desde Google Sheets? Esto actualizará el catálogo de aseguradoras.')) {
      return;
    }

    setSyncingInsurers(true);
    setInsurersSyncMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No hay sesión activa');

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-insurers-from-sheets`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error al sincronizar aseguradoras');
      }

      setInsurersSyncMessage({
        type: 'success',
        text: `Aseguradoras sincronizadas: ${result.inserted} nuevas, ${result.updated} actualizadas, ${result.deactivated} desactivadas. Total únicas: ${result.total_unique}.`
      });
    } catch (error: any) {
      console.error('Error syncing insurers:', error);
      setInsurersSyncMessage({
        type: 'error',
        text: error.message || 'Error al sincronizar aseguradoras'
      });
    } finally {
      setSyncingInsurers(false);
    }
  };

  const loadUsuarios = async () => {
    console.log('[loadUsuarios] Iniciando carga de usuarios MOVI...');
    setLoadingUsuarios(true);
    setErrorUsuarios(null);

    try {
      // Obtener TODOS los usuarios no eliminados
      // La política RLS ya filtra por estado != 'eliminado'
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nombre_completo, email_laboral, oficina_id, rol, estado')
        .order('nombre_completo');

      if (error) {
        console.error('[loadUsuarios] Error de Supabase:', error);
        throw error;
      }

      console.log('[loadUsuarios] Usuarios cargados exitosamente:', data?.length || 0);

      if (!data || data.length === 0) {
        console.warn('[loadUsuarios] No se encontraron usuarios. Verificar RLS policies.');
        setErrorUsuarios('No se encontraron usuarios disponibles. Verifica los permisos de acceso.');
      }

      setUsuarios(data || []);
    } catch (error: any) {
      console.error('[loadUsuarios] Error al cargar usuarios:', error);
      setErrorUsuarios(`Error al cargar usuarios: ${error.message || 'Error desconocido'}`);
      setUsuarios([]);
    } finally {
      setLoadingUsuarios(false);
    }
  };

  const loadVendors = async () => {
    setLoadingVendors(true);
    try {
      const data = await getUniqueVendorsFromProduction();
      setVendors(data);
    } catch (error: any) {
      console.error('Error loading vendors:', error);
      setMessage({ type: 'error', text: 'Error al cargar vendedores: ' + error.message });
    } finally {
      setLoadingVendors(false);
    }
  };

  const handleSyncVendors = async () => {
    setSyncingVendors(true);
    setMessage({ type: 'info', text: 'Sincronizando vendedores desde Google Sheets...' });

    try {
      const result = await syncVendorsToCache();
      setMessage({
        type: 'success',
        text: `Sincronización exitosa: ${result.synced_count} vendedores actualizados${result.error_count > 0 ? ` (${result.error_count} errores)` : ''}`
      });

      // Recargar la lista de vendedores
      await loadVendors();
    } catch (error: any) {
      console.error('Error syncing vendors:', error);
      setMessage({ type: 'error', text: 'Error al sincronizar vendedores: ' + error.message });
    } finally {
      setSyncingVendors(false);
    }
  };

  const handleVendorMappingChange = useCallback(async (vendNombre: string, userId: string) => {
    if (!usuario) {
      console.error('[handleVendorMappingChange] Usuario no autenticado');
      return;
    }

    console.log('[handleVendorMappingChange] Iniciando cambio:', { vendNombre, userId });
    setSavingVendor(vendNombre);

    try {
      if (userId === '') {
        console.log('[handleVendorMappingChange] Eliminando mapeo...');
        await deleteVendorMapping(vendNombre);
        setMessage({ type: 'success', text: 'Mapeo eliminado exitosamente' });
      } else {
        console.log('[handleVendorMappingChange] Guardando mapeo:', { vendNombre, userId, createdBy: usuario.id });
        await createOrUpdateVendorMapping(vendNombre, userId, usuario.id);
        setMessage({ type: 'success', text: 'Mapeo guardado exitosamente' });
      }

      // Actualizar localmente el vendor para evitar el re-fetch
      setVendors(prevVendors => prevVendors.map(v => {
        if (v.vendor_nombre === vendNombre) {
          const selectedUser = usuarios.find(u => u.id === userId);
          return {
            ...v,
            movi_user_id: userId || null,
            movi_user_name: selectedUser?.nombre_completo || null,
            mapping_source: 'manual' as const
          };
        }
        return v;
      }));

      console.log('[handleVendorMappingChange] Mapeo guardado y actualizado localmente');
    } catch (error: any) {
      console.error('[handleVendorMappingChange] Error:', error);
      setMessage({ type: 'error', text: 'Error al guardar el mapeo: ' + error.message });
      // Si hay error, recargar para mostrar el estado real
      await loadVendors();
    } finally {
      setSavingVendor(null);
    }
  }, [usuario, usuarios]);

  const filteredVendors = useMemo(() => {
    return vendors.filter(v => {
      // Siempre mostrar el vendor que se está guardando
      if (savingVendor === v.vendor_nombre) {
        return true;
      }

      const matchesSearch = searchVendor === '' ||
        v.vendor_nombre.toLowerCase().includes(searchVendor.toLowerCase()) ||
        v.movi_user_name?.toLowerCase().includes(searchVendor.toLowerCase());

      const matchesStatus =
        filterMappingStatus === 'all' ||
        (filterMappingStatus === 'mapped' && v.movi_user_id !== null) ||
        (filterMappingStatus === 'unmapped' && v.movi_user_id === null);

      return matchesSearch && matchesStatus;
    });
  }, [vendors, searchVendor, filterMappingStatus, savingVendor]);

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
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <div className="bg-white rounded-2xl sm:rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur flex-shrink-0">
              <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white">Configuración de Producción</h1>
              <p className="text-xs sm:text-sm text-blue-100">Gestiona la conexión y mapeo de datos de producción</p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {message && (
            <div className={`mb-4 p-3 sm:p-4 rounded-lg flex items-start gap-2 sm:gap-3 ${
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

          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="config" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Configuración</span>
              </TabsTrigger>
              <TabsTrigger value="offices" className="flex items-center gap-2">
                <Building className="w-4 h-4" />
                <span className="hidden sm:inline">Mapeo de Oficinas</span>
              </TabsTrigger>
              <TabsTrigger value="agents" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Mapeo de Agentes</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="config" className="mt-0">
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

                {config && (
                  <div className="border-t border-neutral-200 pt-4 sm:pt-6">
                    <h3 className="font-semibold text-neutral-900 mb-3 text-sm sm:text-base">Actualizar Nombres de Clientes</h3>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-3">
                      <p className="text-xs sm:text-sm text-blue-800">
                        Si agregaste la columna "NombreCompleto" al Excel, usa este botón para actualizar los registros existentes.
                        Los datos se actualizarán desde Google Sheets usando la nueva columna.
                      </p>
                    </div>
                    <button
                      onClick={handleRefreshClientNames}
                      disabled={refreshingNames}
                      className="inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full sm:w-auto"
                    >
                      {refreshingNames ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          <span>Actualizando...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          <span>Actualizar Nombres de Clientes</span>
                        </>
                      )}
                    </button>
                    {refreshMessage && (
                      <div className={`mt-3 p-3 rounded-lg text-xs sm:text-sm ${
                        refreshMessage.type === 'success'
                          ? 'bg-green-50 text-green-800 border border-green-200'
                          : 'bg-red-50 text-red-800 border border-red-200'
                      }`}>
                        {refreshMessage.text}
                      </div>
                    )}
                  </div>
                )}

                {config && (
                  <div className="border-t border-neutral-200 pt-4 sm:pt-6">
                    <h3 className="font-semibold text-neutral-900 mb-3 text-sm sm:text-base">Sincronizar Aseguradoras</h3>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-3">
                      <p className="text-xs sm:text-sm text-blue-800">
                        Extrae las aseguradoras únicas del Google Sheets y actualiza el catálogo.
                        Este catálogo se usa en el registro de pólizas en Trámites.
                      </p>
                    </div>
                    <button
                      onClick={handleSyncInsurers}
                      disabled={syncingInsurers}
                      className="inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full sm:w-auto"
                    >
                      {syncingInsurers ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          <span>Sincronizando...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          <span>Sincronizar Aseguradoras</span>
                        </>
                      )}
                    </button>
                    {insurersSyncMessage && (
                      <div className={`mt-3 p-3 rounded-lg text-xs sm:text-sm ${
                        insurersSyncMessage.type === 'success'
                          ? 'bg-green-50 text-green-800 border border-green-200'
                          : 'bg-red-50 text-red-800 border border-red-200'
                      }`}>
                        {insurersSyncMessage.text}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="offices" className="mt-0">
              <div className="space-y-4 sm:space-y-6">
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
            </TabsContent>

            <TabsContent value="agents" className="mt-0">
              <div className="space-y-4 sm:space-y-6">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div>
                    <h2 className="text-base sm:text-lg font-semibold text-neutral-900">Mapeo de Agentes</h2>
                    <p className="text-xs sm:text-sm text-neutral-600">Relaciona VendNombre del Excel con usuarios MOVI</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSyncVendors}
                      disabled={syncingVendors || loadingVendors}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      title="Sincronizar desde Google Sheets"
                    >
                      <RefreshCw className={`w-4 h-4 ${syncingVendors ? 'animate-spin' : ''}`} />
                      <span className="hidden sm:inline">{syncingVendors ? 'Sincronizando...' : 'Sincronizar'}</span>
                    </button>
                    <button
                      onClick={loadVendors}
                      disabled={loadingVendors || syncingVendors}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      title="Recargar desde cache"
                    >
                      {loadingVendors ? 'Cargando...' : 'Recargar'}
                    </button>
                  </div>
                </div>

                <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                  <p className="text-xs sm:text-sm text-blue-800 mb-2">
                    Cada VendNombre del Google Sheets puede ser asociado a un usuario de la plataforma MOVI.
                    El sistema intenta hacer la asociación automáticamente por coincidencia de nombre, pero puedes ajustar manualmente.
                    Este mismo mapeo se usa también en el módulo de <strong>Comisiones</strong> para relacionar vendedores del Excel con usuarios.
                  </p>
                  <p className="text-xs sm:text-sm text-blue-800 mt-2 pt-2 border-t border-blue-200">
                    <strong>Sincronizar:</strong> Obtiene la lista actualizada de vendedores desde Google Sheets.
                    <strong className="ml-2">Recargar:</strong> Actualiza la vista desde el cache local (más rápido).
                  </p>
                </div>

                {errorUsuarios && (
                  <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-red-900 mb-1">Error al cargar usuarios MOVI</p>
                        <p className="text-xs text-red-800 mb-2">{errorUsuarios}</p>
                        <button
                          onClick={loadUsuarios}
                          className="text-xs font-medium text-red-700 hover:text-red-900 underline"
                        >
                          Intentar de nuevo
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {!errorUsuarios && usuarios.length === 0 && !loadingUsuarios && (
                  <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-yellow-900 mb-1">No hay usuarios disponibles</p>
                        <p className="text-xs text-yellow-800">
                          No se pudieron cargar los usuarios de la plataforma. Esto podría deberse a un problema de permisos o de conexión.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {vendors.length === 0 && !loadingVendors ? (
                  <div className="text-center py-8 text-neutral-500">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm mb-3">No hay vendedores cargados</p>
                    <button
                      onClick={loadVendors}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      Cargar Vendedores
                    </button>
                  </div>
                ) : loadingVendors ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-3"></div>
                    <p className="text-sm text-neutral-600">Cargando vendedores desde Google Sheets...</p>
                  </div>
                ) : (
                  <>
                    <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <UserCheck className="w-4 h-4 text-teal-600" />
                          <span className="text-xs font-medium text-teal-700">Asignados</span>
                        </div>
                        <p className="text-2xl font-bold text-teal-900">
                          {vendors.filter(v => v.movi_user_id !== null).length}
                        </p>
                      </div>
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <UserX className="w-4 h-4 text-orange-600" />
                          <span className="text-xs font-medium text-orange-700">Sin Asignar</span>
                        </div>
                        <p className="text-2xl font-bold text-orange-900">
                          {vendors.filter(v => v.movi_user_id === null).length}
                        </p>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Users className="w-4 h-4 text-blue-600" />
                          <span className="text-xs font-medium text-blue-700">Total</span>
                        </div>
                        <p className="text-2xl font-bold text-blue-900">
                          {vendors.length}
                        </p>
                      </div>
                    </div>

                    <div className="mb-4 flex flex-col sm:flex-row gap-3">
                      <div className="flex-1">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                          <input
                            type="text"
                            value={searchVendor}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            placeholder="Buscar vendedor..."
                            className="w-full pl-9 pr-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                      <select
                        value={filterMappingStatus}
                        onChange={(e) => handleFilterChange(e.target.value as 'all' | 'mapped' | 'unmapped')}
                        className="px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="all">Todos</option>
                        <option value="mapped">Asignados</option>
                        <option value="unmapped">Sin asignar</option>
                      </select>
                    </div>

                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {filteredVendors.map((vendor) => (
                        <div
                          key={vendor.vendor_nombre}
                          className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-neutral-900 truncate">
                                {vendor.vendor_nombre}
                              </p>
                              {vendor.mapping_source === 'auto' && (
                                <span className="inline-flex items-center px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                                  Auto
                                </span>
                              )}
                              {vendor.mapping_source === 'manual' && (
                                <span className="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                                  Manual
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-neutral-500">
                              {vendor.total_records} registro{vendor.total_records !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <SearchableUserSelect
                              users={usuarios}
                              value={vendor.movi_user_id}
                              onChange={(userId) => handleVendorMappingChange(vendor.vendor_nombre, userId)}
                              disabled={savingVendor === vendor.vendor_nombre}
                              loading={loadingUsuarios}
                              placeholder="Buscar por nombre o email..."
                            />
                          </div>
                          {savingVendor === vendor.vendor_nombre && (
                            <div className="flex items-center justify-center">
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {filteredVendors.length === 0 && (
                      <div className="text-center py-8 text-neutral-500">
                        <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No se encontraron vendedores con ese filtro</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-3 sm:p-4">
            <h3 className="font-semibold text-amber-900 mb-2 flex items-center gap-2 text-sm sm:text-base">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              Importante
            </h3>
            <ul className="text-xs sm:text-sm text-amber-800 space-y-1 list-disc list-inside">
              <li>Los datos se consultan directamente desde Google Sheets en tiempo real</li>
              <li>Asegúrate de que la hoja tenga las columnas correctas</li>
              <li>Los cambios en la hoja se reflejarán inmediatamente en el sistema</li>
              <li>No es necesario cargar archivos Excel manualmente</li>
              <li>El mapeo de agentes se usa en ambos módulos: Producción y Comisiones</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
