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
          accent_color: string | null
          ubicacion_lat: number | null
          ubicacion_lng: number | null
          ubicacion_updated_at: string | null
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
          accent_color?: string | null
          ubicacion_lat?: number | null
          ubicacion_lng?: number | null
          ubicacion_updated_at?: string | null
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
          accent_color?: string | null
          ubicacion_lat?: number | null
          ubicacion_lng?: number | null
          ubicacion_updated_at?: string | null
        }
      }
      areas: {
        Row: {
          id: string
          nombre: string
          oficina_id: string | null
          activo: boolean
          detalles: string | null
          disponibilidad_semanal: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nombre: string
          oficina_id?: string | null
          activo?: boolean
          detalles?: string | null
          disponibilidad_semanal?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          oficina_id?: string | null
          activo?: boolean
          detalles?: string | null
          disponibilidad_semanal?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      reservas_espacio: {
        Row: {
          id: string
          area_id: string
          usuario_id: string
          oficina_id: string | null
          fecha: string | null
          hora_inicio: string | null
          hora_fin: string | null
          notas: string | null
          comentarios_gerente: string | null
          comentarios_administrador: string | null
          fecha_inicio: string
          fecha_fin: string
          estado: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          area_id: string
          usuario_id: string
          oficina_id?: string | null
          fecha?: string | null
          hora_inicio?: string | null
          hora_fin?: string | null
          notas?: string | null
          comentarios_gerente?: string | null
          comentarios_administrador?: string | null
          fecha_inicio: string
          fecha_fin: string
          estado?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          area_id?: string
          usuario_id?: string
          oficina_id?: string | null
          fecha?: string | null
          hora_inicio?: string | null
          hora_fin?: string | null
          notas?: string | null
          comentarios_gerente?: string | null
          comentarios_administrador?: string | null
          fecha_inicio?: string
          fecha_fin?: string
          estado?: string
          created_at?: string
          updated_at?: string
        }
      }
      solicitudes_vacaciones: {
        Row: {
          id: string
          usuario_id: string
          fecha_inicio: string
          fecha_fin: string
          dias_solicitados: number
          motivo: string | null
          comentarios_gerente: string | null
          comentarios_administrador: string | null
          estado: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          usuario_id: string
          fecha_inicio: string
          fecha_fin: string
          dias_solicitados?: number
          motivo?: string | null
          comentarios_gerente?: string | null
          comentarios_administrador?: string | null
          estado?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          usuario_id?: string
          fecha_inicio?: string
          fecha_fin?: string
          dias_solicitados?: number
          motivo?: string | null
          comentarios_gerente?: string | null
          comentarios_administrador?: string | null
          estado?: string
          created_at?: string
          updated_at?: string
        }
      }
      campos_personalizados_oficinas: {
        Row: {
          id: string
          nombre_campo: string
          etiqueta: string
          tipo_campo: 'text' | 'number' | 'date' | 'dropdown' | 'textarea' | 'email' | 'tel' | 'url'
          opciones: Json
          orden: number
          activo: boolean
          editable: boolean
          visible: boolean
          requerido: boolean
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
          editable?: boolean
          visible?: boolean
          requerido?: boolean
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
          editable?: boolean
          visible?: boolean
          requerido?: boolean
          created_at?: string
        }
      }
      valores_campos_oficinas: {
        Row: {
          id: string
          oficina_id: string
          campo_id: string
          valor: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          oficina_id: string
          campo_id: string
          valor?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          oficina_id?: string
          campo_id?: string
          valor?: string
          created_at?: string
          updated_at?: string
        }
      }
      roles: {
        Row: {
          id: string
          nombre: string
          descripcion: string | null
          color: string | null
          rol_base: 'Administrador' | 'Gerente' | 'Empleado' | 'Agente'
          es_sistema: boolean
          activo: boolean
          orden: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nombre: string
          descripcion?: string | null
          color?: string | null
          rol_base: 'Administrador' | 'Gerente' | 'Empleado' | 'Agente'
          es_sistema?: boolean
          activo?: boolean
          orden?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          descripcion?: string | null
          color?: string | null
          rol_base?: 'Administrador' | 'Gerente' | 'Empleado' | 'Agente'
          es_sistema?: boolean
          activo?: boolean
          orden?: number
          created_at?: string
          updated_at?: string
        }
      }
      usuarios: {
        Row: {
          id: string
          rol: 'Administrador' | 'Gerente' | 'Empleado' | 'Agente'
          rol_id: string | null
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
          plan_mkt_premium: boolean
          mkt_premium_fecha_inicio: string | null
          mkt_premium_fecha_pago: string | null
          mkt_premium_plan: 'mensual' | 'anual' | null
          mkt_premium_metodo_pago: 'deposito_jiro' | 'bono_anual' | 'comisiones' | null
          nombre_completo?: string | null
          nombre_publico?: string | null
          web_slug?: string | null
          dias_vacaciones_disponibles?: number | null
          equipo_computo?: string | null
          equipo_celular?: string | null
          ubicacion_metodo?: 'manual' | 'oficina' | 'gps' | null
          ubicacion_updated_at?: string | null
        }
        Insert: {
          id: string
          rol: 'Administrador' | 'Gerente' | 'Empleado' | 'Agente'
          rol_id?: string | null
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
          plan_mkt_premium?: boolean
          mkt_premium_fecha_inicio?: string | null
          mkt_premium_fecha_pago?: string | null
          mkt_premium_plan?: 'mensual' | 'anual' | null
          mkt_premium_metodo_pago?: 'deposito_jiro' | 'bono_anual' | 'comisiones' | null
        }
        Update: {
          id?: string
          rol?: 'Administrador' | 'Gerente' | 'Empleado' | 'Agente'
          rol_id?: string | null
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
          plan_mkt_premium?: boolean
          mkt_premium_fecha_inicio?: string | null
          mkt_premium_fecha_pago?: string | null
          mkt_premium_plan?: 'mensual' | 'anual' | null
          mkt_premium_metodo_pago?: 'deposito_jiro' | 'bono_anual' | 'comisiones' | null
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
          editable: boolean
          visible: boolean
          requerido: boolean
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
      education_sesiones_programadas: {
        Row: {
          id: string
          titulo: string
          descripcion: string | null
          fecha: string | null
          hora: string | null
          publicada: boolean
          estatus: string | null
          compania: string | null
          link_acceso: string | null
          clave_acceso: string | null
          minutos_anticipacion: number | null
          duracion_minutos: number | null
          created_at: string
          updated_at: string
          registros?: { count: number }[]
        }
        Insert: {
          id?: string
          titulo: string
          descripcion?: string | null
          fecha?: string | null
          hora?: string | null
          publicada?: boolean
          estatus?: string | null
          compania?: string | null
          link_acceso?: string | null
          clave_acceso?: string | null
          minutos_anticipacion?: number | null
          duracion_minutos?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          titulo?: string
          descripcion?: string | null
          fecha?: string | null
          hora?: string | null
          publicada?: boolean
          estatus?: string | null
          compania?: string | null
          link_acceso?: string | null
          clave_acceso?: string | null
          minutos_anticipacion?: number | null
          duracion_minutos?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      education_sesiones_registro: {
        Row: {
          id: string
          sesion_id: string
          usuario_id: string
          created_at: string
        }
        Insert: {
          id?: string
          sesion_id: string
          usuario_id: string
          created_at?: string
        }
        Update: {
          id?: string
          sesion_id?: string
          usuario_id?: string
          created_at?: string
        }
      }
      contact_center_smart_assistant_config: {
        Row: {
          agent_user_id: string
          smart_assistant_enabled: boolean
          smart_assistant_status: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Insert: {
          agent_user_id: string
          smart_assistant_enabled?: boolean
          smart_assistant_status?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          agent_user_id?: string
          smart_assistant_enabled?: boolean
          smart_assistant_status?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      whatsapp_form_sends_log: {
        Row: {
          id: string
          created_at: string
        }
        Insert: {
          id?: string
          created_at?: string
        }
        Update: {
          id?: string
          created_at?: string
        }
      }
    }
  }
}
