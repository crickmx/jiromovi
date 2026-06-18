export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      esquemas_pago: {
        Row: {
          id: string
          nombre: string
          activo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nombre: string
          activo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          activo?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      oficinas: {
        Row: {
          id: string
          nombre: string
          activa: boolean
          created_at: string
          director: string | null
          gerente: string | null
          telefono: string | null
          email: string | null
          domicilio: string | null
          facebook: string | null
          instagram: string | null
          es_espacio_jiro: boolean
          updated_at: string
          logo_url: string | null
        }
        Insert: {
          id?: string
          nombre: string
          activa?: boolean
          created_at?: string
          director?: string | null
          gerente?: string | null
          telefono?: string | null
          email?: string | null
          domicilio?: string | null
          facebook?: string | null
          instagram?: string | null
          es_espacio_jiro?: boolean
          updated_at?: string
          logo_url?: string | null
        }
        Update: {
          id?: string
          nombre?: string
          activa?: boolean
          created_at?: string
          director?: string | null
          gerente?: string | null
          telefono?: string | null
          email?: string | null
          domicilio?: string | null
          facebook?: string | null
          instagram?: string | null
          es_espacio_jiro?: boolean
          updated_at?: string
          logo_url?: string | null
        }
      }
      usuarios: {
        Row: {
          id: string
          rol: 'Administrador' | 'Gerente' | 'Empleado' | 'Agente'
          nombre: string
          apellidos: string
          puesto: string
          oficina_id: string | null
          fecha_nacimiento: string | null
          fecha_ingreso: string | null
          celular_personal: string
          email_personal: string
          celular_laboral: string
          email_laboral: string
          extension_telefonica: string
          url_web_jiro: string
          url_web_multicotizador: string
          imagen_perfil_url: string
          regimen_fiscal_id: string | null
          banco: string
          clabe: string
          activo: boolean
          created_at: string
          updated_at: string
          mi_logotipo_url: string | null
        }
        Insert: {
          id: string
          rol: 'Administrador' | 'Gerente' | 'Empleado' | 'Agente'
          nombre: string
          apellidos: string
          email_laboral: string
          puesto?: string
          oficina_id?: string | null
          fecha_nacimiento?: string | null
          fecha_ingreso?: string | null
          celular_personal?: string
          email_personal?: string
          celular_laboral?: string
          extension_telefonica?: string
          url_web_jiro?: string
          url_web_multicotizador?: string
          imagen_perfil_url?: string
          regimen_fiscal_id?: string | null
          banco?: string
          clabe?: string
          activo?: boolean
          created_at?: string
          updated_at?: string
          mi_logotipo_url?: string | null
        }
        Update: {
          id?: string
          rol?: 'Administrador' | 'Gerente' | 'Empleado' | 'Agente'
          nombre?: string
          apellidos?: string
          puesto?: string
          oficina_id?: string | null
          fecha_nacimiento?: string | null
          fecha_ingreso?: string | null
          celular_personal?: string
          email_personal?: string
          celular_laboral?: string
          email_laboral?: string
          extension_telefonica?: string
          url_web_jiro?: string
          url_web_multicotizador?: string
          imagen_perfil_url?: string
          regimen_fiscal_id?: string | null
          banco?: string
          clabe?: string
          activo?: boolean
          created_at?: string
          updated_at?: string
          mi_logotipo_url?: string | null
        }
      }
      campos_personalizados: {
        Row: {
          id: string
          nombre_campo: string
          etiqueta: string
          tipo_campo: 'text' | 'number' | 'date' | 'dropdown' | 'textarea' | 'email' | 'tel' | 'url'
          opciones: Json
          orden: number
          activo: boolean
          created_at: string
        }
        Insert: {
          id?: string
          nombre_campo: string
          etiqueta: string
          tipo_campo: 'text' | 'number' | 'date' | 'dropdown' | 'textarea' | 'email' | 'tel' | 'url'
          opciones?: Json
          orden?: number
          activo?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          nombre_campo?: string
          etiqueta?: string
          tipo_campo?: 'text' | 'number' | 'date' | 'dropdown' | 'textarea' | 'email' | 'tel' | 'url'
          opciones?: Json
          orden?: number
          activo?: boolean
          created_at?: string
        }
      }
      valores_campos_personalizados: {
        Row: {
          id: string
          usuario_id: string
          campo_id: string
          valor: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          usuario_id: string
          campo_id: string
          valor?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          usuario_id?: string
          campo_id?: string
          valor?: string
          created_at?: string
          updated_at?: string
        }
      }
      permisos_campos: {
        Row: {
          id: string
          rol: 'Administrador' | 'Gerente' | 'Empleado' | 'Agente'
          nombre_campo: string
          editable: boolean
          visible: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          rol: 'Administrador' | 'Gerente' | 'Empleado' | 'Agente'
          nombre_campo: string
          editable?: boolean
          visible?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          rol?: 'Administrador' | 'Gerente' | 'Empleado' | 'Agente'
          nombre_campo?: string
          editable?: boolean
          visible?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      meetings: {
        Row: {
          id: string
          code: string
          creator_id: string
          title: string
          scheduled_datetime: string
          status: 'scheduled' | 'active' | 'ended' | 'cancelled'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          creator_id: string
          title: string
          scheduled_datetime: string
          status?: 'scheduled' | 'active' | 'ended' | 'cancelled'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          creator_id?: string
          title?: string
          scheduled_datetime?: string
          status?: 'scheduled' | 'active' | 'ended' | 'cancelled'
          created_at?: string
          updated_at?: string
        }
      }
      meeting_participants: {
        Row: {
          id: string
          meeting_id: string
          user_id: string | null
          name: string
          role: 'host' | 'participant'
          joined_at: string
          left_at: string | null
        }
        Insert: {
          id?: string
          meeting_id: string
          user_id?: string | null
          name: string
          role?: 'host' | 'participant'
          joined_at?: string
          left_at?: string | null
        }
        Update: {
          id?: string
          meeting_id?: string
          user_id?: string | null
          name?: string
          role?: 'host' | 'participant'
          joined_at?: string
          left_at?: string | null
        }
      }
      meeting_chat_messages: {
        Row: {
          id: string
          meeting_id: string
          sender_name: string
          sender_id: string | null
          message: string
          created_at: string
        }
        Insert: {
          id?: string
          meeting_id: string
          sender_name: string
          sender_id?: string | null
          message: string
          created_at?: string
        }
        Update: {
          id?: string
          meeting_id?: string
          sender_name?: string
          sender_id?: string | null
          message?: string
          created_at?: string
        }
      }
    }
  }
}
