import { useState } from 'react';
import { FileText, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import type { RegimenFiscal, DesgloseFiscal } from '../../lib/commissionFiscalCalculations';

interface PdfFiscalPreviewProps {
  regimen: RegimenFiscal;
  desgloseFiscal: DesgloseFiscal;
}

interface FiscalRow {
  label: string;
  value: number;
  sign: '+' | '-' | '';
  isTotal?: boolean;
}

/**
 * Componente de vista previa del Desglose Fiscal del PDF
 * Muestra exactamente los mismos campos que aparecerán en el PDF generado
 */
export default function PdfFiscalPreview({ regimen, desgloseFiscal }: PdfFiscalPreviewProps) {
  const [showValidation, setShowValidation] = useState(false);

  // Generar las filas según el régimen (replica la lógica de getPdfFiscalRows)
  const getFiscalRows = (): FiscalRow[] => {
    const rows: FiscalRow[] = [];

    switch (regimen) {
      case 'HONORARIOS':
        if (desgloseFiscal.iva > 0) {
          rows.push({ label: 'IVA', value: desgloseFiscal.iva, sign: '+' });
        }
        if (desgloseFiscal.retIsr > 0) {
          rows.push({ label: 'Ret. ISR', value: desgloseFiscal.retIsr, sign: '-' });
        }
        if (desgloseFiscal.retIva > 0) {
          rows.push({ label: 'Ret. IVA', value: desgloseFiscal.retIva, sign: '-' });
        }
        break;

      case 'ASIMILADOS':
        if (desgloseFiscal.retContable > 0) {
          rows.push({ label: 'Ret. Contable', value: desgloseFiscal.retContable, sign: '-' });
        }
        if (desgloseFiscal.costoDispersion > 0) {
          rows.push({ label: 'Costo Dispersión', value: desgloseFiscal.costoDispersion, sign: '-' });
        }
        if (desgloseFiscal.isrTotal > 0) {
          rows.push({ label: 'Ret. ISR', value: desgloseFiscal.isrTotal, sign: '-' });
        }
        if (desgloseFiscal.iva > 0) {
          rows.push({ label: 'IVA', value: desgloseFiscal.iva, sign: '+' });
        }
        if (desgloseFiscal.retIva > 0) {
          rows.push({ label: 'Ret. IVA', value: desgloseFiscal.retIva, sign: '-' });
        }
        break;

      case 'RESICO':
        if (desgloseFiscal.iva > 0) {
          rows.push({ label: 'IVA', value: desgloseFiscal.iva, sign: '+' });
        }
        if (desgloseFiscal.retIsr > 0) {
          rows.push({ label: 'Ret. ISR', value: desgloseFiscal.retIsr, sign: '-' });
        }
        if (desgloseFiscal.retIva > 0) {
          rows.push({ label: 'Ret. IVA', value: desgloseFiscal.retIva, sign: '-' });
        }
        if (desgloseFiscal.retContable > 0) {
          rows.push({ label: 'Ret. Contable', value: desgloseFiscal.retContable, sign: '-' });
        }
        if (desgloseFiscal.costoDispersion > 0) {
          rows.push({ label: 'Costo Dispersión', value: desgloseFiscal.costoDispersion, sign: '-' });
        }
        break;
    }

    // Total siempre se muestra
    rows.push({
      label: 'Total',
      value: desgloseFiscal.totalAPagar,
      sign: '',
      isTotal: true
    });

    return rows;
  };

  const rows = getFiscalRows();

  // Validar que no haya campos prohibidos
  const validateRows = () => {
    const forbiddenKeywords = [
      'base total',
      'prima',
      'vida',
      'sin vida',
      'daños',
      'isr vida',
      'isr daños',
      'comision',
      'gravada',
    ];

    const issues: string[] = [];

    rows.forEach(row => {
      const labelLower = row.label.toLowerCase();
      forbiddenKeywords.forEach(forbidden => {
        if (labelLower.includes(forbidden)) {
          issues.push(`"${row.label}" contiene palabra prohibida: "${forbidden}"`);
        }
      });
    });

    // Validar que Total exista
    if (!rows.some(r => r.isTotal)) {
      issues.push('Falta el campo "Total"');
    }

    return issues;
  };

  const validationIssues = validateRows();
  const isValid = validationIssues.length === 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <FileText className="h-5 w-5" />
          <h3 className="font-semibold">Vista Previa: Cálculo Fiscal (PDF)</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-blue-100 bg-blue-800 px-2 py-1 rounded">
            {regimen}
          </span>
          <button
            onClick={() => setShowValidation(!showValidation)}
            className={`px-2 py-1 rounded text-xs font-medium ${
              isValid
                ? 'bg-green-500 text-white'
                : 'bg-red-500 text-white'
            }`}
          >
            {isValid ? '✓ Válido' : '✗ Con errores'}
          </button>
        </div>
      </div>

      {/* Validation Panel */}
      {showValidation && (
        <div className={`border-b px-4 py-3 ${
          isValid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-start gap-2">
            {isValid ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-900">Validación exitosa</p>
                  <p className="text-xs text-green-700 mt-1">
                    El PDF solo muestra campos permitidos. No contiene variables intermedias.
                  </p>
                </div>
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900">Errores de validación</p>
                  <ul className="mt-2 space-y-1">
                    {validationIssues.map((issue, index) => (
                      <li key={index} className="text-xs text-red-700 flex items-start gap-1">
                        <span className="text-red-500 mt-0.5">•</span>
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* PDF Preview */}
      <div className="p-6 bg-gray-50">
        <div className="bg-white rounded shadow-sm max-w-md mx-auto">
          {/* PDF Title */}
          <div className="border-b border-gray-300 px-4 py-3 bg-gray-100">
            <h4 className="text-sm font-bold text-gray-800 text-center">
              Cálculo Fiscal (Resumen)
            </h4>
          </div>

          {/* PDF Table */}
          <div className="divide-y divide-gray-200">
            {/* Table Header */}
            <div className="grid grid-cols-2 bg-blue-900 text-white text-xs font-semibold">
              <div className="px-4 py-2">Concepto</div>
              <div className="px-4 py-2 text-right">Importe</div>
            </div>

            {/* Table Body */}
            {rows.map((row, index) => (
              <div
                key={index}
                className={`grid grid-cols-2 text-xs ${
                  row.isTotal
                    ? 'bg-green-700 text-white font-bold'
                    : index % 2 === 0
                    ? 'bg-white'
                    : 'bg-gray-50'
                }`}
              >
                <div className={`px-4 py-2 ${row.isTotal ? 'font-bold' : ''}`}>
                  {row.label}
                </div>
                <div className={`px-4 py-2 text-right ${row.isTotal ? 'font-bold' : ''}`}>
                  {row.sign && <span className="mr-1">{row.sign}</span>}
                  {formatCurrency(row.value)}
                </div>
              </div>
            ))}
          </div>

          {/* PDF Footer */}
          <div className="px-4 py-2 bg-gray-100 border-t border-gray-300">
            <p className="text-xs text-gray-600 text-center">
              Régimen fiscal: {regimen}
            </p>
          </div>
        </div>
      </div>

      {/* Info Panel */}
      <div className="bg-blue-50 border-t border-blue-200 px-4 py-3">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs text-blue-900 font-medium">
              Campos permitidos en PDF
            </p>
            <p className="text-xs text-blue-700 mt-1">
              Solo se muestran: Ret. Contable, Costo Dispersión, IVA, Ret. ISR, Ret. IVA, y Total.
              Los cálculos intermedios (Vida, Sin Vida, ISR Vida, ISR Daños, etc.) nunca aparecen en el PDF.
            </p>
          </div>
        </div>
      </div>

      {/* Debug Panel (opcional) */}
      {process.env.NODE_ENV === 'development' && (
        <details className="border-t border-gray-200">
          <summary className="px-4 py-2 bg-gray-100 text-xs text-gray-600 cursor-pointer hover:bg-gray-200">
            Debug: Ver datos completos del cálculo fiscal
          </summary>
          <div className="p-4 bg-gray-50 text-xs">
            <pre className="overflow-auto">
              {JSON.stringify(desgloseFiscal, null, 2)}
            </pre>
          </div>
        </details>
      )}
    </div>
  );
}
