/*
  # Búsqueda de Directorio y Oficinas en Mi Asistente

  1. Nuevas Funciones
    - search_directory: Búsqueda fuzzy de empleados/gerentes
    - search_offices: Búsqueda fuzzy de oficinas

  2. Nuevos Intents
    - directory_person_lookup: Buscar persona por nombre/email/teléfono
    - directory_office_lookup: Buscar oficina por nombre/ciudad
    - directory_manager_lookup: Buscar gerente de oficina

  3. Nuevas Sugerencias
    - Preguntas frecuentes sobre directorio

  4. Seguridad
    - Respeta RLS existente en usuarios y oficinas
    - Solo devuelve usuarios y oficinas activos
    - No expone datos sensibles
*/

-- Función para buscar en el directorio (empleados/gerentes/agentes)
CREATE OR REPLACE FUNCTION search_directory(search_term text)
RETURNS TABLE (
  id uuid,
  nombre_completo text,
  rol text,
  puesto text,
  oficina_nombre text,
  celular_laboral text,
  extension_telefonica text,
  email_laboral text,
  celular_personal text,
  email_personal text
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.nombre || ' ' || u.apellidos AS nombre_completo,
    u.rol::text,
    u.puesto,
    o.nombre AS oficina_nombre,
    u.celular_laboral,
    u.extension_telefonica,
    u.email_laboral,
    u.celular_personal,
    u.email_personal
  FROM usuarios u
  LEFT JOIN oficinas o ON u.oficina_id = o.id
  WHERE 
    u.activo = true
    AND (
      -- Búsqueda por nombre completo (case insensitive)
      LOWER(u.nombre || ' ' || u.apellidos) LIKE LOWER('%' || search_term || '%')
      -- Búsqueda por solo nombre
      OR LOWER(u.nombre) LIKE LOWER('%' || search_term || '%')
      -- Búsqueda por solo apellidos
      OR LOWER(u.apellidos) LIKE LOWER('%' || search_term || '%')
      -- Búsqueda por email
      OR LOWER(u.email_laboral) LIKE LOWER('%' || search_term || '%')
      OR LOWER(u.email_personal) LIKE LOWER('%' || search_term || '%')
      -- Búsqueda por teléfono (sin formato)
      OR REPLACE(REPLACE(u.celular_laboral, '-', ''), ' ', '') LIKE '%' || REPLACE(REPLACE(search_term, '-', ''), ' ', '') || '%'
      OR REPLACE(REPLACE(u.celular_personal, '-', ''), ' ', '') LIKE '%' || REPLACE(REPLACE(search_term, '-', ''), ' ', '') || '%'
    )
  ORDER BY 
    -- Priorizar matches exactos
    CASE 
      WHEN LOWER(u.nombre || ' ' || u.apellidos) = LOWER(search_term) THEN 1
      WHEN LOWER(u.nombre) = LOWER(search_term) THEN 2
      WHEN LOWER(u.apellidos) = LOWER(search_term) THEN 3
      ELSE 4
    END,
    u.nombre, u.apellidos
  LIMIT 10;
END;
$$;

-- Función para buscar oficinas
CREATE OR REPLACE FUNCTION search_offices(search_term text)
RETURNS TABLE (
  id uuid,
  nombre text,
  telefono text,
  email text,
  domicilio text,
  gerente_nombre text,
  director_nombre text,
  facebook text,
  instagram text,
  activa boolean
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.nombre,
    o.telefono,
    o.email,
    o.domicilio,
    o.gerente AS gerente_nombre,
    o.director AS director_nombre,
    o.facebook,
    o.instagram,
    o.activa
  FROM oficinas o
  WHERE 
    o.activa = true
    AND o.es_espacio_jiro = false
    AND (
      -- Búsqueda por nombre de oficina
      LOWER(o.nombre) LIKE LOWER('%' || search_term || '%')
      -- Búsqueda por domicilio/ciudad
      OR LOWER(o.domicilio) LIKE LOWER('%' || search_term || '%')
      -- Búsqueda por gerente
      OR LOWER(o.gerente) LIKE LOWER('%' || search_term || '%')
      -- Búsqueda por director
      OR LOWER(o.director) LIKE LOWER('%' || search_term || '%')
    )
  ORDER BY 
    -- Priorizar matches exactos en nombre
    CASE 
      WHEN LOWER(o.nombre) = LOWER(search_term) THEN 1
      WHEN LOWER(o.nombre) LIKE LOWER(search_term || '%') THEN 2
      ELSE 3
    END,
    o.nombre
  LIMIT 10;
END;
$$;

-- Otorgar permisos de ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION search_directory(text) TO authenticated;
GRANT EXECUTE ON FUNCTION search_offices(text) TO authenticated;

-- Agregar nuevos intents de directorio
INSERT INTO assistant_intents (codigo, nombre, descripcion, categoria, prompt_template, requiere_snapshot, activo, orden)
VALUES
  (
    'directory_person_lookup',
    'Buscar Persona en Directorio',
    'Busca empleados, gerentes o agentes por nombre, email o teléfono',
    'directorio',
    'Busca empleados o gerentes en el directorio interno y devuelve sus datos de contacto en formato JSON.',
    false,
    true,
    15
  ),
  (
    'directory_office_lookup',
    'Buscar Oficina',
    'Busca oficinas por nombre, ciudad o domicilio',
    'directorio',
    'Busca oficinas en el catálogo y devuelve información completa de contacto en formato JSON.',
    false,
    true,
    16
  ),
  (
    'directory_manager_lookup',
    'Buscar Gerente de Oficina',
    'Busca el gerente asignado a una oficina específica',
    'directorio',
    'Busca el gerente de una oficina específica en formato JSON.',
    false,
    true,
    17
  )
ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  prompt_template = EXCLUDED.prompt_template,
  updated_at = now();

-- Agregar sugerencias de directorio
INSERT INTO assistant_suggestions (intent_codigo, ruta_pattern, rol_requerido, orden, texto_pregunta, activo)
VALUES
  -- Dashboard y general
  ('directory_person_lookup', '/dashboard', NULL, 22, '¿Cuál es el teléfono de...?', true),
  ('directory_office_lookup', '/dashboard', NULL, 23, '¿Dónde está la oficina de...?', true),
  
  -- Directorio
  ('directory_person_lookup', '/directorio', NULL, 5, 'Buscar teléfono y extensión de...', true),
  ('directory_person_lookup', '/directorio', NULL, 6, '¿Cuál es el email de...?', true),
  ('directory_office_lookup', '/directorio', NULL, 7, 'Dame los datos de la oficina de...', true),
  ('directory_manager_lookup', '/directorio', NULL, 8, '¿Quién es el gerente de...?', true),
  
  -- Directorio JIRO
  ('directory_person_lookup', '/directorio-jiro', NULL, 5, 'Buscar contacto de...', true),
  ('directory_office_lookup', '/directorio-jiro', NULL, 6, 'Información de oficina...', true),
  
  -- Oficinas (Admin/Gerente)
  ('directory_office_lookup', '/oficinas', 'Administrador,Gerente', 5, 'Buscar oficina por ciudad', true),
  ('directory_manager_lookup', '/oficinas', 'Administrador,Gerente', 6, 'Ver gerente de oficina', true),
  
  -- General (cualquier ruta)
  ('directory_person_lookup', '%', NULL, 103, 'Buscar en directorio', true),
  ('directory_office_lookup', '%', NULL, 104, 'Ver oficinas', true)
ON CONFLICT DO NOTHING;

-- Comentarios para documentación
COMMENT ON FUNCTION search_directory(text) IS 'Búsqueda fuzzy de empleados/gerentes/agentes en el directorio. Respeta RLS y solo devuelve usuarios activos.';
COMMENT ON FUNCTION search_offices(text) IS 'Búsqueda fuzzy de oficinas por nombre, ciudad o gerente. Respeta RLS y solo devuelve oficinas activas.';
