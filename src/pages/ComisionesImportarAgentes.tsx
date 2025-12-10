import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Upload, FileSpreadsheet, AlertCircle, CheckCircle, Users, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

interface AgentRow {
  Nombre: string;
  Email: string;
  Oficina: string;
  RegimenFiscal: string;
}

interface ImportResult {
  created: number;
  updated: number;
  errors: string[];
}

export default function ComisionesImportarAgentes() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [validating, setValidating] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [rows, setRows] = useState<AgentRow[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const isAdmin = usuario?.rol === 'Administrador';

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.xlsx')) {
      setValidationError('Por favor selecciona un archivo Excel (.xlsx)');
      return;
    }

    setFile(selectedFile);
    setValidationError(null);
    setResult(null);
    setValidating(true);

    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<AgentRow>(firstSheet);

      const requiredColumns = ['Nombre', 'Email', 'Oficina', 'RegimenFiscal'];
      const missingColumns: string[] = [];

      if (jsonData.length > 0) {
        const firstRow = jsonData[0];
        requiredColumns.forEach(col => {
          if (!(col in firstRow)) {
            missingColumns.push(col);
          }
        });
      }

      if (missingColumns.length > 0) {
        setValidationError(`Faltan las siguientes columnas: ${missingColumns.join(', ')}`);
        setValidating(false);
        return;
      }

      const validRows = jsonData.filter(row =>
        row.Nombre && row.Email && row.Oficina && row.RegimenFiscal
      );

      if (validRows.length === 0) {
        setValidationError('No se encontraron filas válidas en el archivo');
        setValidating(false);
        return;
      }

      setRows(validRows);

    } catch (error) {
      console.error('Error reading Excel:', error);
      setValidationError('Error al leer el archivo. Asegúrate de que sea un archivo Excel válido.');
    } finally {
      setValidating(false);
    }
  };

  const handleImport = async () => {
    setProcessing(true);
    setResult(null);

    try {
      const { data: offices } = await supabase
        .from('commission_offices')
        .select('*');

      const { data: regimes } = await supabase
        .from('commission_fiscal_regimes')
        .select('*');

      if (!offices || !regimes) {
        throw new Error('No se pudieron cargar las oficinas o regímenes fiscales');
      }

      const officesMap = new Map(offices.map(o => [o.name.toLowerCase(), o.id]));
      const regimesMap = new Map(regimes.map(r => [r.name.toLowerCase(), r.id]));

      let created = 0;
      let updated = 0;
      const errors: string[] = [];

      for (const row of rows) {
        try {
          const officeId = officesMap.get(row.Oficina.toLowerCase());
          const regimeId = regimesMap.get(row.RegimenFiscal.toLowerCase());

          if (!officeId) {
            errors.push(`Oficina no encontrada: ${row.Oficina} (${row.Email})`);
            continue;
          }

          if (!regimeId) {
            errors.push(`Régimen fiscal no encontrado: ${row.RegimenFiscal} (${row.Email})`);
            continue;
          }

          const { data: existingAgent } = await supabase
            .from('commission_agents')
            .select('id')
            .eq('email', row.Email)
            .maybeSingle();

          if (existingAgent) {
            const { error: updateError } = await supabase
              .from('commission_agents')
              .update({
                name: row.Nombre,
                office_id: officeId,
                fiscal_regime_id: regimeId
              })
              .eq('id', existingAgent.id);

            if (updateError) {
              errors.push(`Error actualizando agente: ${row.Email} - ${updateError.message}`);
            } else {
              updated++;
            }
          } else {
            const { error: insertError } = await supabase
              .from('commission_agents')
              .insert({
                name: row.Nombre,
                email: row.Email,
                office_id: officeId,
                fiscal_regime_id: regimeId
              });

            if (insertError) {
              errors.push(`Error creando agente: ${row.Email} - ${insertError.message}`);
            } else {
              created++;
            }
          }

        } catch (error: any) {
          errors.push(`Error procesando ${row.Email}: ${error.message}`);
        }
      }

      setResult({ created, updated, errors });

    } catch (error: any) {
      console.error('Error importing agents:', error);
      setValidationError('Error al importar agentes: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-soft p-12 text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">
            Acceso Denegado
          </h2>
          <p className="text-neutral-600 mb-6">
            Solo los administradores pueden acceder a esta sección.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-semibold"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl shadow-soft border border-neutral-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/comisiones')}
              className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-neutral-700" />
            </button>
            <div>
              <h1 className="text-3xl font-display font-bold text-neutral-900 mb-1">
                Importar Agentes
              </h1>
              <p className="text-neutral-600">
                Carga un archivo Excel para crear o actualizar agentes
              </p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">
            Formato del archivo Excel
          </h3>
          <p className="text-sm text-blue-800 mb-2">
            El archivo debe contener las siguientes columnas (obligatorias):
          </p>
          <ul className="text-sm text-blue-800 space-y-1 ml-4">
            <li><strong>Nombre</strong> - Nombre completo del agente</li>
            <li><strong>Email</strong> - Email del agente (único)</li>
            <li><strong>Oficina</strong> - Nombre de la oficina (debe existir)</li>
            <li><strong>RegimenFiscal</strong> - Régimen fiscal (debe existir)</li>
          </ul>
        </div>

        {!file ? (
          <div className="border-2 border-dashed border-neutral-300 rounded-2xl p-12 text-center hover:border-primary-400 transition-colors">
            <label className="cursor-pointer block">
              <input
                type="file"
                accept=".xlsx"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Upload className="w-16 h-16 text-neutral-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-neutral-700 mb-2">
                Haz clic para seleccionar un archivo
              </h3>
              <p className="text-neutral-500">
                o arrastra y suelta aquí un archivo .xlsx
              </p>
            </label>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start space-x-3">
              <CheckCircle className="w-6 h-6 text-green-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-green-900 mb-1">
                  Archivo cargado
                </h4>
                <p className="text-sm text-green-800">{file.name}</p>
                {!validating && rows.length > 0 && (
                  <p className="text-sm text-green-800 mt-1">
                    {rows.length} agentes encontrados
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setFile(null);
                  setRows([]);
                  setValidationError(null);
                  setResult(null);
                }}
                className="text-green-700 hover:text-green-900 font-semibold text-sm"
              >
                Cambiar
              </button>
            </div>

            {validationError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3">
                <AlertCircle className="w-6 h-6 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-red-900 mb-1">
                    Error de validación
                  </h4>
                  <p className="text-sm text-red-800">{validationError}</p>
                </div>
              </div>
            )}

            {validating && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
                <span className="ml-3 text-neutral-700">Validando archivo...</span>
              </div>
            )}

            {result && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <h4 className="font-semibold text-blue-900 mb-3">
                    Resultado de la Importación
                  </h4>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-white rounded-lg p-3">
                      <div className="text-sm text-blue-700 mb-1">Agentes Creados</div>
                      <div className="text-2xl font-bold text-green-700">{result.created}</div>
                    </div>
                    <div className="bg-white rounded-lg p-3">
                      <div className="text-sm text-blue-700 mb-1">Agentes Actualizados</div>
                      <div className="text-2xl font-bold text-blue-700">{result.updated}</div>
                    </div>
                  </div>

                  {result.errors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-3">
                      <div className="font-semibold text-red-900 mb-2">
                        Errores ({result.errors.length})
                      </div>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {result.errors.map((error, index) => (
                          <div key={index} className="text-sm text-red-800">
                            {error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => navigate('/comisiones')}
                  className="w-full px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:shadow-medium transition-all duration-200 font-semibold"
                >
                  Volver a Comisiones
                </button>
              </div>
            )}

            {!validating && !validationError && rows.length > 0 && !result && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-neutral-900 mb-4">
                    Vista Previa
                  </h3>
                  <div className="bg-neutral-50 rounded-xl p-4 max-h-80 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-neutral-200">
                          <th className="text-left py-2 px-3 font-semibold text-neutral-700">Nombre</th>
                          <th className="text-left py-2 px-3 font-semibold text-neutral-700">Email</th>
                          <th className="text-left py-2 px-3 font-semibold text-neutral-700">Oficina</th>
                          <th className="text-left py-2 px-3 font-semibold text-neutral-700">Régimen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 10).map((row, index) => (
                          <tr key={index} className="border-b border-neutral-100">
                            <td className="py-2 px-3 text-neutral-900">{row.Nombre}</td>
                            <td className="py-2 px-3 text-neutral-700">{row.Email}</td>
                            <td className="py-2 px-3 text-neutral-700">{row.Oficina}</td>
                            <td className="py-2 px-3 text-neutral-700">{row.RegimenFiscal}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {rows.length > 10 && (
                      <p className="text-sm text-neutral-600 text-center mt-3">
                        Mostrando 10 de {rows.length} agentes
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleImport}
                  disabled={processing}
                  className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:shadow-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Importando agentes...</span>
                    </>
                  ) : (
                    <>
                      <Users className="w-5 h-5" />
                      <span>Importar {rows.length} Agentes</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
