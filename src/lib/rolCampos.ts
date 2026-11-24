// Quién puede ver y quién puede editar cada campo del formulario.
//
// `visible_para_rol` / `editable_para_rol` se configuran por campo en el
// FormBuilder ("Acceso por rol"). El valor es el rol MÍNIMO: 'Empleado'
// significa "Empleado y superiores", y 'todos' —o cualquier valor que no sea
// uno de los roles conocidos— no restringe nada.
//
// Ojo con el glosario del proyecto: aquí se habla del ROL DE SISTEMA
// (`usuarios.rol`), donde "Agente" es un cliente externo y por eso es el nivel
// más bajo. El rol de equipo (`rol_en_equipo`) es otro eje y no entra aquí.

export const ROL_NIVEL: Record<string, number> = {
  Agente: 0,
  Empleado: 1,
  Gerente: 2,
  Administrador: 3,
};

export interface AccesoPorRol {
  visible_para_rol?: string | null;
  editable_para_rol?: string | null;
}

function alcanza(rolUsuario: string | null | undefined, minimo: string | null | undefined): boolean {
  const min = ROL_NIVEL[minimo ?? 'todos'];
  if (min === undefined) return true; // 'todos' o un valor desconocido: sin restricción
  return (ROL_NIVEL[rolUsuario ?? 'Agente'] ?? 0) >= min;
}

export function puedeVerCampo(campo: AccesoPorRol, rolUsuario: string | null | undefined): boolean {
  return alcanza(rolUsuario, campo.visible_para_rol);
}

export function puedeEditarCampo(campo: AccesoPorRol, rolUsuario: string | null | undefined): boolean {
  // Si no lo puede ver, tampoco lo puede editar — aunque la configuración diga
  // lo contrario por descuido.
  return puedeVerCampo(campo, rolUsuario) && alcanza(rolUsuario, campo.editable_para_rol);
}
