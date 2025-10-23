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
        }
        Insert: {
          id?: string
          nombre: string
          activa?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          activa?: boolean
          created_at?: string
        }
      }
      usuarios: {
        Row: {
          id: string
          username: string
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
          esquema_pago_id: string | null
          banco: string
          clabe: string
          activo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username: string
          rol: 'Administrador' | 'Gerente' | 'Empleado' | 'Agente'
          nombre: string
          apellidos: string
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
          esquema_pago_id?: string | null
          banco?: string
          clabe?: string
          activo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string
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
          esquema_pago_id?: string | null
          banco?: string
          clabe?: string
          activo?: boolean
          created_at?: string
          updated_at?: string
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
    }
  }
}
