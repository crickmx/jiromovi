export interface ComunicadoCategoria {
  id: string;
  nombre: string;
  descripcion: string | null;
  fecha_creacion: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ComunicadoPublicacion {
  id: string;
  titulo: string;
  contenido_html: string;
  imagen_principal: string;
  fecha_creacion: string;
  fecha_publicacion: string | null;
  publicado: boolean;
  fijado: boolean;
  creado_por: string;
  categoria_id: string;
  oficina_origen_id: string | null; // NULL = Admin, UUID = Gerente
  created_at: string;
  updated_at: string;

  // Relaciones
  categoria?: ComunicadoCategoria;
  creador?: {
    id: string;
    nombre: string;
    apellidos: string;
    imagen_perfil_url: string | null;
  };
  adjuntos?: ComunicadoAdjunto[];
  visibilidad?: ComunicadoVisibilidad[];
}

export interface ComunicadoAdjunto {
  id: string;
  comunicado_id: string;
  archivo_url: string;
  nombre_archivo: string;
  tamanio_bytes: number | null;
  tipo_mime: string | null;
  created_at: string;
}

export interface ComunicadoVisibilidad {
  id: string;
  comunicado_id: string;
  rol: 'Administrador' | 'Gerente' | 'Empleado' | 'Agente' | null;
  oficina_id: string | null;
  usuario_id: string | null;
  para_todos: boolean;
  created_at: string;
}

export interface ComunicadoFormData {
  titulo: string;
  contenido_html: string;
  imagen_principal: File | string | null;
  categoria_id: string;
  fecha_publicacion: string | null;
  publicar_ahora: boolean;
  fijado: boolean;
  visibilidad_tipo: 'todos' | 'roles' | 'oficinas' | 'usuarios';
  roles_seleccionados: string[];
  oficinas_seleccionadas: string[];
  usuarios_seleccionados: string[];
  adjuntos: File[];
}
