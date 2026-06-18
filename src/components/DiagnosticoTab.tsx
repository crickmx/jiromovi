import { useState } from 'react';
import { Activity, Wifi, WifiOff, Server, Cpu, HardDrive, Radio, CircleCheck as CheckCircle2, Circle as XCircle, Loader as Loader2, FileText, Clock, Shield } from 'lucide-react';
import * as telefoniaService from '../lib/telefoniaService';
import type {
  DiagnosticConnectionResult,
  PbxInfoResult,
  ApiVersionsResult,
  EndpointProbeResult,
} from '../lib/telefoniaService';

interface DiagnosticReport {
  connection: DiagnosticConnectionResult | null;
  pbxInfo: PbxInfoResult | null;
  apiVersions: ApiVersionsResult | null;
  endpoints: EndpointProbeResult | null;
  generatedAt: string | null;
}

export default function DiagnosticoTab() {
  const [running, setRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [report, setReport] = useState<DiagnosticReport>({
    connection: null,
    pbxInfo: null,
    apiVersions: null,
    endpoints: null,
    generatedAt: null,
  });
  const [error, setError] = useState<string | null>(null);

  async function runFullDiagnostic() {
    setRunning(true);
    setError(null);
    const newReport: DiagnosticReport = {
      connection: null,
      pbxInfo: null,
      apiVersions: null,
      endpoints: null,
      generatedAt: null,
    };

    try {
      setCurrentStep('Probando conexion...');
      newReport.connection = await telefoniaService.diagnoseConnection();
      setReport({ ...newReport });

      setCurrentStep('Obteniendo informacion del PBX...');
      newReport.pbxInfo = await telefoniaService.getPbxInfo();
      setReport({ ...newReport });

      setCurrentStep('Probando versiones de API...');
      newReport.apiVersions = await telefoniaService.probeApiVersions();
      setReport({ ...newReport });

      setCurrentStep('Sondeando endpoints disponibles...');
      newReport.endpoints = await telefoniaService.probeEndpoints();
      setReport({ ...newReport });

      newReport.generatedAt = new Date().toISOString();
      setReport({ ...newReport });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRunning(false);
      setCurrentStep('');
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Diagnostico del PBX</h2>
            <p className="text-sm text-neutral-500 mt-1">
              Validacion de solo lectura del PBX Yeastar. No ejecuta operaciones de escritura.
            </p>
          </div>
          <button
            onClick={runFullDiagnostic}
            disabled={running}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
            {running ? currentStep : 'Ejecutar Diagnostico Completo'}
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
            <XCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg mt-4">
          <Shield className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-700">
            Solo lectura. Este diagnostico NO crea, modifica ni elimina extensiones u otros recursos del PBX.
          </p>
        </div>
      </div>

      {report.connection && <ConnectionSection data={report.connection} />}
      {report.pbxInfo && <PbxInfoSection data={report.pbxInfo} />}
      {report.apiVersions && <ApiVersionsSection data={report.apiVersions} />}
      {report.endpoints && <EndpointsSection data={report.endpoints} />}
      {report.generatedAt && <ReportSummary report={report} />}
    </div>
  );
}

function ConnectionSection({ data }: { data: DiagnosticConnectionResult }) {
  const conn = data.connection;
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        {conn.authenticated ? (
          <Wifi className="w-5 h-5 text-emerald-600" />
        ) : (
          <WifiOff className="w-5 h-5 text-red-500" />
        )}
        <h3 className="text-base font-semibold text-neutral-900">Estado de Conexion</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatusCard
          label="Alcanzable"
          value={conn.reachable}
          detail={conn.reachable ? 'El servidor responde' : 'Sin respuesta'}
        />
        <StatusCard
          label="Autenticado"
          value={conn.authenticated}
          detail={conn.authenticated ? 'Token valido' : 'Fallo de autenticacion'}
        />
        <div className="bg-neutral-50 rounded-lg p-3">
          <p className="text-xs text-neutral-500 mb-1">Ultima prueba</p>
          <p className="text-sm font-medium text-neutral-900">
            {new Date(conn.timestamp).toLocaleString('es-MX')}
          </p>
        </div>
      </div>
    </div>
  );
}

function PbxInfoSection({ data }: { data: PbxInfoResult }) {
  const info = data.pbx_info;
  const systemInfo = info.system_info as any;
  const deviceInfo = info.device_info as any;
  const systemStatus = info.system_status as any;

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Server className="w-5 h-5 text-blue-600" />
        <h3 className="text-base font-semibold text-neutral-900">Informacion del PBX</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <InfoCard
          icon={<Server className="w-4 h-4 text-blue-500" />}
          title="Sistema"
          available={systemInfo?.ok}
          items={systemInfo?.ok ? extractItems(systemInfo.data) : [{ key: 'Estado', value: `HTTP ${systemInfo?.status || '?'}` }]}
        />
        <InfoCard
          icon={<Cpu className="w-4 h-4 text-teal-500" />}
          title="Dispositivo"
          available={deviceInfo?.ok}
          items={deviceInfo?.ok ? extractItems(deviceInfo.data) : [{ key: 'Estado', value: `HTTP ${deviceInfo?.status || '?'}` }]}
        />
        <InfoCard
          icon={<HardDrive className="w-4 h-4 text-purple-500" />}
          title="Estado Actual"
          available={systemStatus?.ok}
          items={systemStatus?.ok ? extractItems(systemStatus.data) : [{ key: 'Estado', value: `HTTP ${systemStatus?.status || '?'}` }]}
        />
      </div>
    </div>
  );
}

function ApiVersionsSection({ data }: { data: ApiVersionsResult }) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Radio className="w-5 h-5 text-teal-600" />
        <h3 className="text-base font-semibold text-neutral-900">Versiones de API Detectadas</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-neutral-600">Version</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600">Login</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600">HTTP Status</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600">List API</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600">Notas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {data.api_versions.map(v => (
              <tr key={v.version} className={v.login_ok ? 'bg-emerald-50/50' : ''}>
                <td className="px-4 py-3 font-mono font-semibold text-neutral-900">{v.version}</td>
                <td className="px-4 py-3">
                  {v.login_ok ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" /> OK
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-red-600">
                      <XCircle className="w-3.5 h-3.5" /> Fallo
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-neutral-600 font-mono">
                  {v.login_status ?? '—'}
                </td>
                <td className="px-4 py-3">
                  {v.list_ok ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" /> OK
                    </span>
                  ) : v.list_status ? (
                    <span className="inline-flex items-center gap-1 text-red-600">
                      <XCircle className="w-3.5 h-3.5" /> {v.list_status}
                    </span>
                  ) : (
                    <span className="text-neutral-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-neutral-500">
                  {v.error || (v.login_ok && v.list_ok ? 'Version funcional' : '')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EndpointsSection({ data }: { data: EndpointProbeResult }) {
  const { endpoints, summary } = data;
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-orange-600" />
          <h3 className="text-base font-semibold text-neutral-900">Endpoints Disponibles</h3>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full font-medium">
            {summary.available} disponibles
          </span>
          <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full font-medium">
            {summary.unavailable} no disponibles
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {endpoints.map(ep => {
          const shortName = ep.endpoint.replace('/api/v2.0.0/', '');
          return (
            <div
              key={ep.endpoint}
              className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
                ep.available
                  ? 'border-emerald-200 bg-emerald-50/50'
                  : 'border-red-200 bg-red-50/50'
              }`}
            >
              <span className="text-sm font-mono text-neutral-800">{shortName}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-neutral-500">{ep.status ?? '?'}</span>
                {ep.available ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReportSummary({ report }: { report: DiagnosticReport }) {
  const conn = report.connection?.connection;
  const versions = report.apiVersions?.api_versions || [];
  const workingVersions = versions.filter(v => v.login_ok && v.list_ok);
  const endpoints = report.endpoints;
  const pbxInfo = report.pbxInfo?.pbx_info;

  const deviceData = (pbxInfo?.device_info as any)?.data;
  const systemData = (pbxInfo?.system_info as any)?.data;

  return (
    <div className="bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-xl p-6 text-white">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-neutral-300" />
        <h3 className="text-base font-semibold">Reporte de Diagnostico</h3>
        <span className="ml-auto text-xs text-neutral-400">
          {new Date(report.generatedAt!).toLocaleString('es-MX')}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Conexion"
          value={conn?.authenticated ? 'Activa' : 'Fallida'}
          ok={!!conn?.authenticated}
        />
        <SummaryCard
          title="Modelo PBX"
          value={deviceData?.product_name || systemData?.model || 'Desconocido'}
          ok={(pbxInfo?.device_info as any)?.ok || (pbxInfo?.system_info as any)?.ok}
        />
        <SummaryCard
          title="API Version"
          value={workingVersions.length > 0 ? workingVersions.map(v => v.version).join(', ') : 'Ninguna'}
          ok={workingVersions.length > 0}
        />
        <SummaryCard
          title="Endpoints"
          value={endpoints ? `${endpoints.summary.available}/${endpoints.summary.total}` : '—'}
          ok={endpoints ? endpoints.summary.available > 0 : false}
        />
      </div>

      {(systemData?.firmware || deviceData?.hardware_version) && (
        <div className="mt-4 pt-4 border-t border-neutral-700 grid grid-cols-2 md:grid-cols-4 gap-3">
          {systemData?.firmware && (
            <div>
              <p className="text-xs text-neutral-400">Firmware</p>
              <p className="text-sm font-medium">{systemData.firmware}</p>
            </div>
          )}
          {systemData?.serial && (
            <div>
              <p className="text-xs text-neutral-400">Serial</p>
              <p className="text-sm font-medium font-mono">{systemData.serial}</p>
            </div>
          )}
          {deviceData?.max_extensions && (
            <div>
              <p className="text-xs text-neutral-400">Max Extensiones</p>
              <p className="text-sm font-medium">{deviceData.max_extensions}</p>
            </div>
          )}
          {deviceData?.max_concurrent_calls && (
            <div>
              <p className="text-xs text-neutral-400">Max Llamadas</p>
              <p className="text-sm font-medium">{deviceData.max_concurrent_calls}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Shared small components ─────────────────────────────────────────────────

function StatusCard({ label, value, detail }: { label: string; value: boolean; detail: string }) {
  return (
    <div className={`rounded-lg p-3 ${value ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
      <div className="flex items-center gap-2 mb-1">
        {value ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-red-500" />}
        <p className="text-xs font-medium text-neutral-600">{label}</p>
      </div>
      <p className={`text-sm font-semibold ${value ? 'text-emerald-700' : 'text-red-700'}`}>{detail}</p>
    </div>
  );
}

function InfoCard({ icon, title, available, items }: {
  icon: React.ReactNode;
  title: string;
  available: boolean;
  items: Array<{ key: string; value: string }>;
}) {
  return (
    <div className={`rounded-lg p-4 border ${available ? 'border-neutral-200 bg-neutral-50' : 'border-red-200 bg-red-50'}`}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="text-sm font-semibold text-neutral-800">{title}</span>
        {!available && <XCircle className="w-3.5 h-3.5 text-red-500 ml-auto" />}
      </div>
      <div className="space-y-1.5">
        {items.map(item => (
          <div key={item.key} className="flex justify-between gap-2">
            <span className="text-xs text-neutral-500 truncate">{item.key}</span>
            <span className="text-xs font-medium text-neutral-800 truncate text-right">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ title, value, ok }: { title: string; value: string; ok: boolean }) {
  return (
    <div className="bg-neutral-800/50 rounded-lg p-3 border border-neutral-700">
      <p className="text-xs text-neutral-400 mb-1">{title}</p>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
        <p className="text-sm font-semibold text-neutral-100 truncate">{value}</p>
      </div>
    </div>
  );
}

function extractItems(data: Record<string, unknown> | null | undefined): Array<{ key: string; value: string }> {
  if (!data) return [{ key: 'Sin datos', value: '—' }];
  return Object.entries(data).slice(0, 5).map(([key, val]) => ({
    key: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    value: String(val ?? '—'),
  }));
}
