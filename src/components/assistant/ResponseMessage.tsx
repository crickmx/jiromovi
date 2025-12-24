import type { StructuredResponse } from '../../lib/assistantTypes';
import { ResponseKPICard } from './ResponseKPICard';
import { ResponseTable } from './ResponseTable';
import { ResponseChart } from './ResponseChart';
import { ResponseActionButtons } from './ResponseActionButtons';
import { ResponsePriorityList } from './ResponsePriorityList';
import { ResponseOutreachPlan } from './ResponseOutreachPlan';
import { ResponseCrossSell } from './ResponseCrossSell';
import { ResponseRenewals } from './ResponseRenewals';
import { ResponseMessageGenerator } from './ResponseMessageGenerator';
import { ResponseTramiteStatus } from './ResponseTramiteStatus';
import { ResponseNavigationHelp } from './ResponseNavigationHelp';

interface ResponseMessageProps {
  response: StructuredResponse;
}

export function ResponseMessage({ response }: ResponseMessageProps) {
  switch (response.type) {
    case 'dashboard_summary':
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {response.kpis.map((kpi, index) => (
              <ResponseKPICard key={index} kpi={kpi} />
            ))}
          </div>
          {response.actions.length > 0 && (
            <ResponseActionButtons actions={response.actions} />
          )}
        </div>
      );

    case 'performance_summary':
      return (
        <div className="space-y-3">
          {response.chart && <ResponseChart chart={response.chart} />}
          {response.table && <ResponseTable table={response.table} />}
          {response.insights && (
            <p className="text-sm text-gray-700">{response.insights}</p>
          )}
          {response.actions.length > 0 && (
            <ResponseActionButtons actions={response.actions} />
          )}
        </div>
      );

    case 'commission_explain':
      return (
        <div className="space-y-3">
          <ResponseTable table={response.table} />
          {response.explanation && (
            <p className="text-sm text-gray-700">{response.explanation}</p>
          )}
          {response.actions.length > 0 && (
            <ResponseActionButtons actions={response.actions} />
          )}
        </div>
      );

    case 'commission_anomaly':
      return (
        <div className="space-y-3">
          <div className="space-y-2">
            {response.anomalies.map((anomaly, index) => (
              <div
                key={index}
                className="p-2 bg-red-50 border border-red-200 rounded text-sm"
              >
                <p className="font-medium">
                  Comisión atípica: ${anomaly.amount.toLocaleString()}
                </p>
                <p className="text-gray-600">Desviación: {anomaly.deviation}%</p>
                <p className="text-gray-700 mt-1">{anomaly.reason}</p>
              </div>
            ))}
          </div>
          {response.actions.length > 0 && (
            <ResponseActionButtons actions={response.actions} />
          )}
        </div>
      );

    case 'priority_list':
      return <ResponsePriorityList items={response.items} />;

    case 'outreach_plan':
      return <ResponseOutreachPlan clients={response.clients} />;

    case 'cross_sell':
      return (
        <div className="space-y-3">
          <ResponseCrossSell opportunities={response.opportunities} />
          {response.actions.length > 0 && (
            <ResponseActionButtons actions={response.actions} />
          )}
        </div>
      );

    case 'renewals_forecast':
      return (
        <div className="space-y-3">
          <ResponseRenewals renewals={response.renewals} />
          {response.actions.length > 0 && (
            <ResponseActionButtons actions={response.actions} />
          )}
        </div>
      );

    case 'message_generator':
      return <ResponseMessageGenerator response={response} />;

    case 'tramite_status':
      return <ResponseTramiteStatus response={response} />;

    case 'team_insights':
      return (
        <div className="space-y-3">
          <ResponseTable table={response.table} />
          {response.chart && <ResponseChart chart={response.chart} />}
          {response.actions.length > 0 && (
            <ResponseActionButtons actions={response.actions} />
          )}
        </div>
      );

    case 'navigation_help':
      return <ResponseNavigationHelp categories={response.categories} />;

    case 'text':
      return (
        <div className="space-y-3">
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{response.text}</p>
          {response.actions && response.actions.length > 0 && (
            <ResponseActionButtons actions={response.actions} />
          )}
        </div>
      );

    default:
      return <p className="text-sm text-gray-700">Respuesta no reconocida</p>;
  }
}
