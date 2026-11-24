export interface TransactionalNotificationTemplate {
  id: string;
  event_key: string;
  name: string;
  email_subject_template: string | null;
  email_body_template: string | null;
  whatsapp_body_template: string | null;
  inapp_title_template: string | null;
  inapp_body_template: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  link_url: string | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationTemplateContext {
  agent_name?: string;
  office_name?: string;
  week_number?: string | number;
  period_start?: string;
  period_end?: string;
  net_commission_total?: string;
  orden_de_pago_url?: string;
  [key: string]: string | number | undefined;
}

export const AVAILABLE_PLACEHOLDERS = {
  commission_batch_closed_agent: [
    { key: 'agent_name', description: 'Nombre completo del agente' },
    { key: 'office_name', description: 'Nombre de la oficina del agente' },
    { key: 'week_number', description: 'Número de semana del lote' },
    { key: 'period_start', description: 'Fecha de inicio del periodo' },
    { key: 'period_end', description: 'Fecha de fin del periodo' },
    { key: 'net_commission_total', description: 'Total de comisiones netas del agente' },
    { key: 'orden_de_pago_url', description: 'URL para descargar el PDF de Orden de Pago' }
  ]
};
