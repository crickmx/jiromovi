import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Upload, FileSpreadsheet, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { groupByWeek } from '../lib/commissionUtils';
import type { WeekSummary } from '../lib/commissionTypes';
import { supabase } from '../lib/supabase';

interface ExcelRow {
  FPago: string;
  EmailAgente?: string;
  Email?: string;
  Ramo: string;
  Aseguradora?: string;
  CiaAbreviacion?: string;
  Importe?: number;
  PrimaNeta?: number;
  PorPart: number;
  Poliza?: string;
  Documento?: string;
  Concepto?: string;
  NombreCompleto?: string;
  NombreAsegurado?: string;
  Asegurado?: string;
  [key: string]: any;
}

export default function ComisionesUpload() {
  const { usuario } = useAuth();
  const navigate = useNavigate();

  // DEPRECATED: Este flujo ya no se usa, redirigir al nuevo flujo basado en nombres
  useEffect(() => {
    console.warn('[ComisionesUpload] DEPRECATED: Redirecting to new flow');
    navigate('/comisiones/upload-nuevo', { replace: true });
  }, [navigate]);

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [rows, setRows] = useState<ExcelRow[]>([]);
  const [weeks, setWeeks] = useState<WeekSummary[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const isAdmin = usuario?.rol === 'Administrador';

  console.log('[ComisionesUpload] Component render. User:', usuario?.email_laboral, 'Role:', usuario?.rol, 'Is admin:', isAdmin);

  // Detectar si el componente se desmonta inesperadamente
  useEffect(() => {
    console.log('[ComisionesUpload] Component mounted');
    return () => {
      console.log('[ComisionesUpload] Component unmounting!');
    };
  }, []);

  // Detectar cambios en el usuario
  useEffect(() => {
    console.log('[ComisionesUpload] Usuario changed:', usuario?.email_laboral, 'Role:', usuario?.rol);
    if (usuario && !isAdmin) {
      console.error('[ComisionesUpload] User is not admin! Redirecting...');
    }
  }, [usuario, isAdmin]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    console.log('[ComisionesUpload] File selected:', selectedFile.name);

    if (!selectedFile.name.endsWith('.xlsx')) {
      setValidationError('Por favor selecciona un archivo Excel (.xlsx)');
      return;
    }

    setFile(selectedFile);
    setValidationError(null);
    setValidating(true);

    try {
      console.log('[ComisionesUpload] Reading file...');
      const data = await selectedFile.arrayBuffer();
      console.log('[ComisionesUpload] File read as array buffer, size:', data.byteLength);

      const workbook = XLSX.read(data, { type: 'array', cellDates: true, dateNF: 'yyyy-mm-dd' });
      console.log('[ComisionesUpload] Workbook parsed. Sheets:', workbook.SheetNames);

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        setValidationError('El archivo no contiene hojas de cálculo');
        setValidating(false);
        return;
      }

      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      console.log('[ComisionesUpload] Reading first sheet:', workbook.SheetNames[0]);

      const jsonData = XLSX.utils.sheet_to_json<ExcelRow>(firstSheet, { raw: false, dateNF: 'yyyy-mm-dd' });
      console.log('[ComisionesUpload] Rows found:', jsonData.length);
      console.log('[ComisionesUpload] First row sample:', jsonData[0]);

      if (jsonData.length === 0) {
        setValidationError('El archivo está vacío');
        setValidating(false);
        return;
      }

      const firstRow = jsonData[0];
      const columns = Object.keys(firstRow);
      console.log('[ComisionesUpload] Columns found:', columns);

      const hasEmail = columns.includes('EmailAgente') || columns.includes('Email');
      const hasAseguradora = columns.includes('Aseguradora') || columns.includes('CiaAbreviacion');
      const hasPoliza = columns.includes('Poliza') || columns.includes('Documento');
      const hasFPago = columns.includes('FPago');
      const hasRamo = columns.includes('Ramo');
      const hasImporte = columns.includes('Importe');
      const hasPorPart = columns.includes('PorPart');

      const missingColumns: string[] = [];
      if (!hasFPago) missingColumns.push('FPago');
      if (!hasEmail) missingColumns.push('Email o EmailAgente');
      if (!hasRamo) missingColumns.push('Ramo');
      if (!hasAseguradora) missingColumns.push('Aseguradora o CiaAbreviacion');
      if (!hasImporte) missingColumns.push('Importe');
      if (!hasPoliza) missingColumns.push('Poliza o Documento');
      if (!hasPorPart) missingColumns.push('PorPart');

      if (missingColumns.length > 0) {
        console.error('[ComisionesUpload] Missing columns:', missingColumns);
        setValidationError(`Faltan las siguientes columnas: ${missingColumns.join(', ')}`);
        setValidating(false);
        return;
      }

      console.log('[ComisionesUpload] Normalizing rows...');
      const normalizedRows = jsonData.map((row, index) => {
        let fpago = row.FPago;

        if (typeof fpago === 'number') {
          const excelEpoch = new Date(1900, 0, 1);
          const daysOffset = fpago - 2;
          const resultDate = new Date(excelEpoch.getTime() + daysOffset * 24 * 60 * 60 * 1000);
          fpago = resultDate.toISOString().split('T')[0];
          console.log(`[ComisionesUpload] Row ${index}: Converted Excel date ${row.FPago} to ${fpago}`);
        } else if (typeof fpago === 'string' && fpago.includes('/')) {
          const parts = fpago.split('/');
          if (parts.length === 3) {
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2];
            fpago = `${year}-${month}-${day}`;
            console.log(`[ComisionesUpload] Row ${index}: Converted date format ${row.FPago} to ${fpago}`);
          }
        }

        return {
          FPago: fpago,
          EmailAgente: row.EmailAgente || row.Email || '',
          Ramo: row.Ramo,
          Aseguradora: row.Aseguradora || row.CiaAbreviacion || '',
          Importe: row.Importe || 0,
          PrimaNeta: row.PrimaNeta || 0,
          PorPart: row.PorPart,
          Poliza: row.Poliza || row.Documento || '',
          Concepto: row.Concepto || '',
          NombreCompleto: row.NombreCompleto || row.NombreAsegurado || row.Asegurado || ''
        };
      });

      const validRows: ExcelRow[] = [];
      const invalidRows: any[] = [];

      normalizedRows.forEach((row, index) => {
        const issues: string[] = [];

        if (!row.FPago) issues.push('FPago vacío');
        if (!row.EmailAgente) issues.push('Email vacío');
        if (!row.Ramo) issues.push('Ramo vacío');
        if (!row.Aseguradora) issues.push('Aseguradora vacía');
        if (!row.Importe) issues.push('Importe vacío');
        if (!row.Poliza) issues.push('Poliza vacía');
        if (row.PorPart === undefined || row.PorPart === null) issues.push('PorPart vacío');

        if (row.FPago) {
          const testDate = new Date(row.FPago);
          if (isNaN(testDate.getTime())) {
            issues.push(`Fecha inválida: ${row.FPago}`);
          }
        }

        if (row.PrimaNeta && isNaN(Number(row.PrimaNeta))) {
          issues.push(`PrimaNeta inválida: ${row.PrimaNeta}`);
        }

        if (row.PorPart !== undefined && row.PorPart !== null && isNaN(Number(row.PorPart))) {
          issues.push(`PorPart inválido: ${row.PorPart}`);
        }

        if (issues.length > 0) {
          console.warn(`[ComisionesUpload] Row ${index + 2} invalid:`, issues.join(', '));
          invalidRows.push({ row: index + 2, issues, data: row });
        } else {
          validRows.push(row);
        }
      });

      if (invalidRows.length > 0) {
        console.warn(`[ComisionesUpload] Found ${invalidRows.length} invalid rows:`, invalidRows);
      }

      console.log('[ComisionesUpload] Valid rows:', validRows.length);

      if (validRows.length === 0) {
        setValidationError('No se encontraron filas válidas en el archivo');
        setValidating(false);
        return;
      }

      setRows(validRows);

      console.log('[ComisionesUpload] Grouping by week...');
      const weekGroups = groupByWeek(validRows, 'FPago');
      console.log('[ComisionesUpload] Weeks found:', weekGroups.length);
      setWeeks(weekGroups);

      console.log('[ComisionesUpload] Validation complete!');
    } catch (error: any) {
      console.error('[ComisionesUpload] Error reading Excel:', error);
      console.error('[ComisionesUpload] Error name:', error?.name);
      console.error('[ComisionesUpload] Error message:', error?.message);
      console.error('[ComisionesUpload] Error stack:', error?.stack);

      let errorMessage = 'Error al leer el archivo. ';

      if (error?.message) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Asegúrate de que sea un archivo Excel válido (.xlsx).';
      }

      setValidationError(errorMessage);
    } finally {
      setValidating(false);
    }
  };

  const toggleWeekSelection = (index: number) => {
    setWeeks(prev => prev.map((week, i) =>
      i === index ? { ...week, selected: !week.selected } : week
    ));
  };

  const handleProcess = async () => {
    const selectedWeeks = weeks.filter(w => w.selected);

    if (selectedWeeks.length === 0) {
      alert('Por favor selecciona al menos una semana para procesar');
      return;
    }

    setProcessing(true);

    try {
      console.log('[ComisionesUpload] Getting authenticated user...');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      console.log('[ComisionesUpload] User authenticated:', user.id);
      console.log('[ComisionesUpload] Preparing to send:', {
        rowsCount: rows.length,
        selectedWeeksCount: selectedWeeks.length,
        fileName: file?.name
      });

      console.log('[ComisionesUpload] Calling edge function...');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-commissions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            rows: rows,
            selectedWeeks: selectedWeeks,
            uploadedByUserId: user.id,
            sourceFile: file?.name
          })
        }
      );

      console.log('[ComisionesUpload] Response status:', response.status);
      console.log('[ComisionesUpload] Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ComisionesUpload] Error response text:', errorText);

        try {
          const error = JSON.parse(errorText);
          throw new Error(error.error || 'Error al procesar comisiones');
        } catch (parseError) {
          throw new Error(`Error del servidor (${response.status}): ${errorText}`);
        }
      }

      const result = await response.json();
      console.log('[ComisionesUpload] Result from edge function:', result);

      if (!result.batchesCreated || result.batchesCreated.length === 0) {
        throw new Error('No se crearon lotes. Es posible que no haya agentes registrados o que las fechas no coincidan.');
      }

      alert(`Lotes creados exitosamente: ${result.batchesCreated.length}${result.totalErrors > 0 ? `\nErrores encontrados: ${result.totalErrors}` : ''}`);
      navigate('/comisiones');

    } catch (error: any) {
      console.error('[ComisionesUpload] FATAL ERROR processing commissions:', error);
      console.error('[ComisionesUpload] Error type:', typeof error);
      console.error('[ComisionesUpload] Error name:', error?.name);
      console.error('[ComisionesUpload] Error message:', error?.message);
      console.error('[ComisionesUpload] Error stack:', error?.stack);

      const errorMessage = error?.message || error?.toString() || 'Error desconocido';
      alert('Error al procesar las comisiones: ' + errorMessage);
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
                Subir Archivo de Comisiones
              </h1>
              <p className="text-neutral-600">
                Sube un archivo Excel con las comisiones a procesar
              </p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">
            Formato del archivo Excel
          </h3>
          <p className="text-sm text-blue-800 mb-2">
            El archivo debe contener las siguientes columnas obligatorias:
          </p>
          <ul className="text-sm text-blue-800 space-y-1 ml-4">
            <li><strong>FPago</strong> - Fecha de pago (formato fecha)</li>
            <li><strong>Email</strong> o <strong>EmailAgente</strong> - Email del agente</li>
            <li><strong>Ramo</strong> - Ramo de seguro</li>
            <li><strong>CiaAbreviacion</strong> o <strong>Aseguradora</strong> - Nombre de la aseguradora</li>
            <li><strong>Importe</strong> - Base de comisión (número). Este es el valor sobre el cual se calcula la comisión.</li>
            <li><strong>PorPart</strong> - Porcentaje de comisión (número, ej: 25 para 25%)</li>
            <li><strong>Documento</strong> o <strong>Poliza</strong> - Número de póliza/documento</li>
          </ul>
          <p className="text-sm font-semibold text-blue-900 mt-4 mb-2">
            Columnas opcionales:
          </p>
          <ul className="text-sm text-blue-800 space-y-1 ml-4">
            <li><strong>PrimaNeta</strong> - Prima neta (solo informativo, no afecta el cálculo)</li>
            <li><strong>NombreCompleto</strong>, <strong>NombreAsegurado</strong> o <strong>Asegurado</strong> - Nombre del asegurado</li>
            <li><strong>Concepto</strong> - Concepto o descripción adicional</li>
          </ul>
          <p className="text-sm font-semibold text-blue-900 mt-4 mb-2">
            Nota importante:
          </p>
          <p className="text-sm text-blue-800">
            La comisión se calcula como: <strong>Comisión = Importe × (PorPart / 100)</strong>.
            El campo PrimaNeta es solo informativo y no se usa en el cálculo.
          </p>
        </div>

        {!file ? (
          <div className="border-2 border-dashed border-neutral-300 rounded-2xl p-12 text-center hover:border-primary-400 transition-colors">
            <label
              htmlFor="file-upload"
              className="cursor-pointer block"
              onClick={(e) => {
                console.log('[ComisionesUpload] Label clicked');
                e.stopPropagation();
              }}
            >
              <input
                id="file-upload"
                type="file"
                accept=".xlsx"
                onChange={(e) => {
                  console.log('[ComisionesUpload] Input onChange triggered');
                  e.stopPropagation();
                  handleFileSelect(e);
                }}
                onClick={(e) => {
                  console.log('[ComisionesUpload] Input clicked');
                  e.stopPropagation();
                }}
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
                    {rows.length} filas válidas encontradas
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setFile(null);
                  setRows([]);
                  setWeeks([]);
                  setValidationError(null);
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

            {!validating && !validationError && weeks.length > 0 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-bold text-neutral-900 mb-4">
                    Selecciona las semanas a procesar
                  </h3>
                  <p className="text-sm text-neutral-600 mb-4">
                    Las filas se han agrupado automáticamente por semana calendario (lunes a domingo).
                    Selecciona las semanas que deseas procesar.
                  </p>
                </div>

                <div className="grid gap-3">
                  {weeks.map((week, index) => (
                    <div
                      key={index}
                      onClick={() => toggleWeekSelection(index)}
                      className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
                        week.selected
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-neutral-200 hover:border-primary-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            week.selected
                              ? 'bg-primary-600 border-primary-600'
                              : 'border-neutral-400'
                          }`}>
                            {week.selected && (
                              <CheckCircle className="w-4 h-4 text-white" />
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-neutral-900">
                              Semana {week.weekNumber}
                            </div>
                            <div className="text-sm text-neutral-600">
                              {week.dateFrom} al {week.dateTo}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary-600">
                            {week.count}
                          </div>
                          <div className="text-xs text-neutral-600">
                            pólizas
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-neutral-200">
                  <button
                    onClick={() => setWeeks(prev => prev.map(w => ({ ...w, selected: !prev.every(w => w.selected) })))}
                    className="text-primary-600 hover:text-primary-700 font-semibold text-sm"
                  >
                    {weeks.every(w => w.selected) ? 'Deseleccionar todas' : 'Seleccionar todas'}
                  </button>
                  <button
                    onClick={handleProcess}
                    disabled={processing || !weeks.some(w => w.selected)}
                    className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:shadow-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Procesando...</span>
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet className="w-5 h-5" />
                        <span>Procesar Comisiones</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
