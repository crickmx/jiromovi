export interface ChavaUser {
  id: string;
  auth_user_id: string;
  nombre_completo: string;
  email: string;
  whatsapp: string | null;
  estado: string | null;
  codigo_postal: string | null;
  tipo_usuario: TipoUsuario;
  plataforma_origen: 'movi' | 'seguwallet' | 'externo';
  terminos_aceptados: boolean;
  terminos_version: string | null;
  terminos_fecha: string | null;
  estatus: 'activo' | 'bloqueado' | 'pendiente';
  ultimo_acceso: string | null;
  created_at: string;
}

export type TipoUsuario =
  | 'agente_seguros'
  | 'promotor'
  | 'gerente_oficina'
  | 'estudiante_seguros'
  | 'dueno_negocio'
  | 'particular';

export const TIPO_USUARIO_LABELS: Record<TipoUsuario, string> = {
  agente_seguros: 'Agente de seguros',
  promotor: 'Promotor / Director de agencia',
  gerente_oficina: 'Gerente de oficina',
  estudiante_seguros: 'Estudiante de seguros (Cédula A)',
  dueno_negocio: 'Dueño de negocio / Empresario',
  particular: 'Particular / Persona física',
};

export interface ChavaTerms {
  id: string;
  version: string;
  titulo: string;
  contenido_terminos: string;
  contenido_privacidad: string;
  activo: boolean;
  created_at: string;
}

export interface ChavaConversation {
  id: string;
  chava_user_id: string;
  titulo: string;
  modelo: string | null;
  total_mensajes: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChavaMensaje {
  id: string;
  conversation_id: string;
  rol: 'user' | 'assistant';
  contenido: string;
  fuentes: Fuente[] | null;
  confianza: 'alta' | 'media' | 'baja' | null;
  tokens_entrada: number | null;
  tokens_salida: number | null;
  modelo: string | null;
  tiempo_ms: number | null;
  created_at: string;
}

export interface Fuente {
  tipo: 'conocimiento' | 'ia' | 'internet';
  descripcion: string;
  documento?: string;
  confianza: 'alta' | 'media' | 'baja';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  fuentes?: Fuente[];
  confianza_general?: 'alta' | 'media' | 'baja';
  loading?: boolean;
  created_at: string;
}
