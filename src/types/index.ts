export interface Usuario {
  id: string;
  nombre: string;
  apellidos: string;
  nombre_completo?: string;
  rol: 'Administrador' | 'Empleado' | 'Gerente';
  email_laboral: string;
  activo: boolean;
  status: 'activo' | 'pendiente_activacion' | 'inactivo';
  imagen_perfil_url?: string;
  puesto?: string;
  oficina_id?: string;
  celular_laboral?: string;
  fecha_nacimiento?: string;
  fecha_ingreso_jiro?: string;
  extension_telefonica?: string;
  equipo_computo_marca?: string;
  equipo_computo_modelo?: string;
  equipo_celular_marca?: string;
  equipo_celular_modelo?: string;
}

export interface Oficina {
  id: string;
  nombre: string;
  activa: boolean;
  domicilio?: string;
  telefono?: string;
  email?: string;
}

export interface RegistroEmpleadoFormData {
  nombre: string;
  apellidos: string;
  puesto: string;
  oficina_id: string;
  fecha_nacimiento: string;
  fecha_ingreso_jiro: string;
  celular_laboral: string;
  email_laboral: string;
  extension_telefonica: string;
  foto_perfil_url?: string;
  equipo_computo_marca: string;
  equipo_computo_modelo: string;
  equipo_celular_marca: string;
  equipo_celular_modelo: string;
}
