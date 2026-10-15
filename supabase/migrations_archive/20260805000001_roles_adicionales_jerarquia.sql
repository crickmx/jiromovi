/*
  # Roles adicionales de la jerarquía de 7 niveles

  Agrega al catálogo `roles` los roles propuestos en el documento de "Jerarquía de
  usuarios" que aún no existían en /configuracion. NO modifica los 4 roles base ya
  sembrados (Administrador, Gerente, Empleado, Agente): el INSERT es idempotente con
  ON CONFLICT (nombre) DO NOTHING, así que volver a correrlo no toca nada existente.

  Cada rol nuevo hereda uno de los 4 comportamientos base (rol_base):
    - Nivel 6 · Dirección          -> Administrador (única base que ve TODAS las oficinas)
    - Nivel 5 · Director Regional  -> Gerente (admin acotado a su ámbito)
    - Nivel 4 · Director de Oficina-> Gerente
    - Nivel 3 · Gerentes           -> Gerente
    - Nivel 2 · Empleados          -> Empleado
    - Nivel 1 · Agente / Vendedor  -> ya existe como "Agente" (base Agente)
    - Nivel 7 · Admin              -> ya existe como "Administrador"

  Se omite "Otros por definir" (nivel 3 y 2): es un marcador de posición, no un rol
  concreto. Los roles nuevos son es_sistema = false (renombrables, recoloreables,
  editables y eliminables desde /configuracion). Crear un rol NO eleva a nadie:
  ninguno queda asignado a un usuario hasta que un Administrador lo asigne.

  Colores tomados por nivel del documento original (pirámide) para agrupar visualmente.
*/

INSERT INTO roles (nombre, descripcion, color, rol_base, es_sistema, activo, orden) VALUES
  -- Nivel 6 · Dirección
  ('Dirección Comercial',        'Dirección. Ve todos los trámites e información de todas las oficinas. Da de alta agentes; crea equipos y tipos de trámites.', '#E0794F', 'Administrador', false, true, 10),
  ('Dirección de Operaciones',   'Dirección. Ve todos los trámites e información de todas las oficinas. Da de alta agentes; crea equipos y tipos de trámites.', '#E0794F', 'Administrador', false, true, 11),
  -- Nivel 5 · Subdirección — Director Regional
  ('Director Regional',          'Subdirección. Ve todos los trámites e información de las oficinas a su cargo. Da de alta agentes; crea equipos y tipos de trámites.', '#9A7FE8', 'Gerente', false, true, 20),
  -- Nivel 4 · Subdirección — Director de Oficina
  ('Director de Oficina',        'Subdirección. Ve todos los trámites de todos los perfiles de la oficina a su cargo. Da de alta agentes; crea equipos y tipos de trámites.', '#6F8FE0', 'Gerente', false, true, 30),
  -- Nivel 3 · Gerente
  ('Gerente Administrativo',     'Gerente. Ve todos los trámites e información de los empleados a su cargo. Acciones exactas por definir con el equipo.', '#4FA8E0', 'Gerente', false, true, 40),
  ('Gerente de Marketing',       'Gerente. Ve todos los trámites e información de los empleados a su cargo. Acciones exactas por definir con el equipo.', '#4FA8E0', 'Gerente', false, true, 41),
  ('Gerente de Tesorería',       'Gerente. Ve todos los trámites e información de los empleados a su cargo. Acciones exactas por definir con el equipo.', '#4FA8E0', 'Gerente', false, true, 42),
  ('Gerente de Mesa de Control', 'Gerente. Ve todos los trámites e información de los empleados a su cargo. Acciones exactas por definir con el equipo.', '#4FA8E0', 'Gerente', false, true, 43),
  ('Gerente Comercial',          'Gerente. Ve trámites e información de sus empleados y de los agentes que ellos atienden. Acciones exactas por definir con el equipo.', '#4FA8E0', 'Gerente', false, true, 44),
  -- Nivel 2 · Empleado
  ('Empleado Administrativo',    'Empleado. Ve sus propios trámites y contactos, más el pool compartido del equipo. Acciones exactas por definir con el equipo.', '#3FBFA0', 'Empleado', false, true, 50),
  ('Empleado de Marketing',      'Empleado. Ve sus propios trámites y contactos, más el pool compartido del equipo. Acciones exactas por definir con el equipo.', '#3FBFA0', 'Empleado', false, true, 51),
  ('Empleado de Tesorería',      'Empleado. Ve sus propios trámites y contactos, más el pool compartido del equipo. Acciones exactas por definir con el equipo.', '#3FBFA0', 'Empleado', false, true, 52),
  ('Empleado de Mesa de Control','Empleado. Ve sus propios trámites y contactos, más el pool compartido del equipo. Acciones exactas por definir con el equipo.', '#3FBFA0', 'Empleado', false, true, 53),
  ('Ejecutivo Comercial',        'Empleado. Ve sus propios trámites/contactos y los trámites de los agentes a su cargo. Puede dar de alta agentes (requiere aprobación del gerente).', '#3FBFA0', 'Empleado', false, true, 54)
ON CONFLICT (nombre) DO NOTHING;
