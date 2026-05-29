export interface UnifiedContacto {
  id: string;
  source: 'crm' | 'seguwallet';
  nombre_completo: string;
  email: string | null;
  celular: string | null;
  whatsapp: string | null;
  tipo_contacto: string;
  estatus: string;
  fuente_origen: string | null;
  creado_por: string | null;
  fecha_creacion: string;
  actualizado_en: string | null;
  seguwallet_customer_id: string | null;
  seguwallet_status: 'active' | 'inactive' | 'blocked' | null;
  seguwallet_profile_completed: boolean | null;
  seguwallet_last_login: string | null;
  seguwallet_agent_id: string | null;
  sicas_count: number;
}
