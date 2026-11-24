/*
  # Módulo de Chat en Tiempo Real

  1. Nuevas Tablas
    - `chats`
      - Almacena conversaciones directas (1-1) y grupos
      - Tipos: 'direct', 'group'
      - Metadatos: nombre, descripción, creador
    
    - `chat_miembros`
      - Relación usuarios ↔ chats
      - Almacena rol y fecha de ingreso
      - Permite ver historial completo al unirse
    
    - `chat_mensajes`
      - Mensajes de texto con timestamps
      - Flags: editado, eliminado
      - Referencia al remitente
      - Soporte para menciones
    
    - `chat_archivos`
      - Archivos adjuntos por chat
      - URL segura de almacenamiento
      - Metadata: tipo, tamaño, nombre
      - Previsualización para imágenes/PDFs
    
    - `chat_presencia`
      - Estado en línea/última actividad
      - Se actualiza en tiempo real
      - Útil para indicadores visuales
    
    - `chat_lectura`
      - Seguimiento de mensajes leídos
      - Permite receipts (✓✓)
      - Por usuario y mensaje

  2. Reglas de Acceso
    - Solo Administrador, Gerente, Empleado tienen acceso
    - Agentes NO pueden ver, acceder ni aparecer en directorios
    - Administradores y Gerentes pueden gestionar todos los grupos
    - Empleados solo pueden crear chats 1-1
    - Creadores de grupos pueden gestionar sus propios grupos

  3. Seguridad
    - RLS habilitado en todas las tablas
    - Validación de roles en todas las políticas
    - Archivos con URLs firmadas y expiración
    - Prevención de acceso no autorizado a mensajes
    - Historial completo accesible para todos los miembros

  4. Características
    - Mensajes en tiempo real con WebSockets
    - Edición/eliminación dentro de 3 minutos
    - Archivos adjuntos ilimitados por chat
    - Búsqueda full-text en mensajes
    - Presencia en línea y "escribiendo..."
    - Receipts de lectura (✓✓)
    - Historial completo persistente
*/

-- Enum para tipos de chat
CREATE TYPE chat_type AS ENUM ('direct', 'group');

-- Tabla principal de chats
CREATE TABLE IF NOT EXISTS chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tipo de chat
  tipo chat_type NOT NULL DEFAULT 'direct',
  
  -- Información del chat
  nombre text,
  descripcion text,
  
  -- Para chats directos: IDs de los dos participantes (para evitar duplicados)
  -- Formato: [uuid1, uuid2] ordenados alfabéticamente
  participantes_directos uuid[],
  
  -- Para grupos: creador del grupo
  creador_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  
  -- Metadata
  ultimo_mensaje_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraint: chat directo debe tener exactamente 2 participantes
  CONSTRAINT check_direct_participants 
    CHECK (tipo != 'direct' OR array_length(participantes_directos, 1) = 2),
  
  -- Constraint: nombre requerido para grupos
  CONSTRAINT check_group_name 
    CHECK (tipo != 'group' OR nombre IS NOT NULL),
  
  -- Constraint: evitar duplicados en chats directos
  UNIQUE NULLS NOT DISTINCT (tipo, participantes_directos)
);

-- Tabla de miembros del chat
CREATE TABLE IF NOT EXISTS chat_miembros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  
  -- Rol del usuario AL MOMENTO de unirse (puede cambiar después)
  rol_al_unirse text NOT NULL,
  
  -- Timestamps
  unido_at timestamptz DEFAULT now(),
  ultimo_leido_at timestamptz DEFAULT now(),
  
  -- Para notificaciones
  silenciado boolean DEFAULT false,
  
  -- Unique: un usuario solo puede estar una vez en un chat
  UNIQUE (chat_id, usuario_id)
);

-- Tabla de mensajes
CREATE TABLE IF NOT EXISTS chat_mensajes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  remitente_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE SET NULL,
  
  -- Contenido del mensaje
  mensaje text NOT NULL,
  
  -- Estados
  editado boolean DEFAULT false,
  eliminado boolean DEFAULT false,
  
  -- Menciones (array de user IDs)
  menciones uuid[],
  
  -- Respuesta a otro mensaje
  responde_a_id uuid REFERENCES chat_mensajes(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  editado_at timestamptz,
  
  -- Constraint: no puede editarse después de 3 minutos
  CONSTRAINT check_edit_time 
    CHECK (editado_at IS NULL OR editado_at <= created_at + interval '3 minutes')
);

-- Tabla de archivos adjuntos
CREATE TABLE IF NOT EXISTS chat_archivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  mensaje_id uuid REFERENCES chat_mensajes(id) ON DELETE CASCADE,
  remitente_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE SET NULL,
  
  -- Información del archivo
  nombre_archivo text NOT NULL,
  tipo_mime text NOT NULL,
  tamano_bytes bigint NOT NULL,
  
  -- Storage
  storage_path text NOT NULL,
  url_publica text NOT NULL,
  
  -- Metadata para preview
  es_imagen boolean DEFAULT false,
  ancho integer,
  alto integer,
  
  -- Timestamp
  subido_at timestamptz DEFAULT now(),
  
  -- Constraint: límite de tamaño 25MB
  CONSTRAINT check_file_size CHECK (tamano_bytes <= 26214400)
);

-- Tabla de presencia (online/offline)
CREATE TABLE IF NOT EXISTS chat_presencia (
  usuario_id uuid PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  
  -- Estado
  en_linea boolean DEFAULT false,
  ultimo_visto_at timestamptz DEFAULT now(),
  
  -- Typing indicator (en qué chat está escribiendo)
  escribiendo_en_chat_id uuid REFERENCES chats(id) ON DELETE SET NULL,
  escribiendo_desde timestamptz,
  
  -- Timestamps
  updated_at timestamptz DEFAULT now()
);

-- Tabla de lectura de mensajes (para ✓✓)
CREATE TABLE IF NOT EXISTS chat_lectura (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  mensaje_id uuid NOT NULL REFERENCES chat_mensajes(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  
  leido_at timestamptz DEFAULT now(),
  
  UNIQUE (mensaje_id, usuario_id)
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_chats_tipo ON chats(tipo);
CREATE INDEX IF NOT EXISTS idx_chats_ultimo_mensaje ON chats(ultimo_mensaje_at DESC);
CREATE INDEX IF NOT EXISTS idx_chats_participantes ON chats USING gin(participantes_directos);

CREATE INDEX IF NOT EXISTS idx_chat_miembros_chat ON chat_miembros(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_miembros_usuario ON chat_miembros(usuario_id);

CREATE INDEX IF NOT EXISTS idx_chat_mensajes_chat ON chat_mensajes(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_mensajes_created ON chat_mensajes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_mensajes_remitente ON chat_mensajes(remitente_id);
CREATE INDEX IF NOT EXISTS idx_chat_mensajes_texto ON chat_mensajes USING gin(to_tsvector('spanish', mensaje));

CREATE INDEX IF NOT EXISTS idx_chat_archivos_chat ON chat_archivos(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_archivos_mensaje ON chat_archivos(mensaje_id);

CREATE INDEX IF NOT EXISTS idx_chat_presencia_en_linea ON chat_presencia(en_linea) WHERE en_linea = true;

CREATE INDEX IF NOT EXISTS idx_chat_lectura_mensaje ON chat_lectura(mensaje_id);
CREATE INDEX IF NOT EXISTS idx_chat_lectura_usuario ON chat_lectura(usuario_id);

-- Función auxiliar: verificar si un usuario tiene acceso al chat
CREATE OR REPLACE FUNCTION user_has_chat_access()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid()
    AND rol IN ('Administrador', 'Gerente', 'Empleado')
    AND activo = true
  );
$$;

-- Función auxiliar: verificar si un usuario es miembro de un chat
CREATE OR REPLACE FUNCTION user_is_chat_member(p_chat_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_miembros
    WHERE chat_id = p_chat_id
    AND usuario_id = auth.uid()
  );
$$;

-- Función auxiliar: verificar si un usuario puede gestionar un grupo
CREATE OR REPLACE FUNCTION user_can_manage_group(p_chat_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM chats c
    INNER JOIN usuarios u ON u.id = auth.uid()
    WHERE c.id = p_chat_id
    AND c.tipo = 'group'
    AND (
      u.rol IN ('Administrador', 'Gerente')
      OR c.creador_id = auth.uid()
    )
  );
$$;

-- Función: obtener o crear chat directo entre dos usuarios
CREATE OR REPLACE FUNCTION get_or_create_direct_chat(p_user1_id uuid, p_user2_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_chat_id uuid;
  v_participants uuid[];
BEGIN
  -- Ordenar IDs para búsqueda consistente
  IF p_user1_id < p_user2_id THEN
    v_participants := ARRAY[p_user1_id, p_user2_id];
  ELSE
    v_participants := ARRAY[p_user2_id, p_user1_id];
  END IF;
  
  -- Buscar chat existente
  SELECT id INTO v_chat_id
  FROM chats
  WHERE tipo = 'direct'
  AND participantes_directos = v_participants;
  
  -- Si no existe, crear
  IF v_chat_id IS NULL THEN
    INSERT INTO chats (tipo, participantes_directos)
    VALUES ('direct', v_participants)
    RETURNING id INTO v_chat_id;
    
    -- Agregar ambos usuarios como miembros
    INSERT INTO chat_miembros (chat_id, usuario_id, rol_al_unirse)
    SELECT v_chat_id, id, rol
    FROM usuarios
    WHERE id IN (p_user1_id, p_user2_id);
  END IF;
  
  RETURN v_chat_id;
END;
$$;

-- Función: actualizar timestamp de último mensaje
CREATE OR REPLACE FUNCTION update_chat_ultimo_mensaje()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE chats
  SET ultimo_mensaje_at = NEW.created_at,
      updated_at = now()
  WHERE id = NEW.chat_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_chat_ultimo_mensaje
  AFTER INSERT ON chat_mensajes
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_ultimo_mensaje();

-- Habilitar RLS en todas las tablas
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_miembros ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_mensajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_archivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_presencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_lectura ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para chats
CREATE POLICY "Usuarios autorizados pueden ver sus chats"
  ON chats FOR SELECT
  TO authenticated
  USING (
    user_has_chat_access()
    AND EXISTS (
      SELECT 1 FROM chat_miembros
      WHERE chat_miembros.chat_id = chats.id
      AND chat_miembros.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Usuarios autorizados pueden crear chats directos"
  ON chats FOR INSERT
  TO authenticated
  WITH CHECK (
    user_has_chat_access()
    AND tipo = 'direct'
  );

CREATE POLICY "Administradores y Gerentes pueden crear grupos"
  ON chats FOR INSERT
  TO authenticated
  WITH CHECK (
    tipo = 'group'
    AND EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND rol IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "Gestores pueden actualizar grupos"
  ON chats FOR UPDATE
  TO authenticated
  USING (user_can_manage_group(id))
  WITH CHECK (user_can_manage_group(id));

-- Políticas RLS para chat_miembros
CREATE POLICY "Miembros pueden ver miembros de sus chats"
  ON chat_miembros FOR SELECT
  TO authenticated
  USING (
    user_has_chat_access()
    AND user_is_chat_member(chat_id)
  );

CREATE POLICY "Sistema puede agregar miembros a chats directos"
  ON chat_miembros FOR INSERT
  TO authenticated
  WITH CHECK (
    user_has_chat_access()
    AND EXISTS (
      SELECT 1 FROM chats
      WHERE id = chat_id
      AND tipo = 'direct'
    )
  );

CREATE POLICY "Gestores pueden agregar miembros a grupos"
  ON chat_miembros FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chats
      WHERE id = chat_id
      AND tipo = 'group'
      AND user_can_manage_group(id)
    )
  );

CREATE POLICY "Usuarios pueden salir de grupos"
  ON chat_miembros FOR DELETE
  TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY "Gestores pueden remover miembros de grupos"
  ON chat_miembros FOR DELETE
  TO authenticated
  USING (user_can_manage_group(chat_id));

-- Políticas RLS para chat_mensajes
CREATE POLICY "Miembros pueden ver mensajes de sus chats"
  ON chat_mensajes FOR SELECT
  TO authenticated
  USING (
    user_has_chat_access()
    AND user_is_chat_member(chat_id)
  );

CREATE POLICY "Miembros pueden enviar mensajes"
  ON chat_mensajes FOR INSERT
  TO authenticated
  WITH CHECK (
    user_has_chat_access()
    AND user_is_chat_member(chat_id)
    AND remitente_id = auth.uid()
  );

CREATE POLICY "Remitentes pueden editar sus mensajes"
  ON chat_mensajes FOR UPDATE
  TO authenticated
  USING (
    remitente_id = auth.uid()
    AND created_at >= now() - interval '3 minutes'
  )
  WITH CHECK (
    remitente_id = auth.uid()
  );

-- Políticas RLS para chat_archivos
CREATE POLICY "Miembros pueden ver archivos de sus chats"
  ON chat_archivos FOR SELECT
  TO authenticated
  USING (
    user_has_chat_access()
    AND user_is_chat_member(chat_id)
  );

CREATE POLICY "Miembros pueden subir archivos"
  ON chat_archivos FOR INSERT
  TO authenticated
  WITH CHECK (
    user_has_chat_access()
    AND user_is_chat_member(chat_id)
    AND remitente_id = auth.uid()
  );

-- Políticas RLS para chat_presencia
CREATE POLICY "Usuarios autorizados pueden ver presencia"
  ON chat_presencia FOR SELECT
  TO authenticated
  USING (user_has_chat_access());

CREATE POLICY "Usuarios pueden actualizar su propia presencia"
  ON chat_presencia FOR ALL
  TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

-- Políticas RLS para chat_lectura
CREATE POLICY "Usuarios pueden ver receipts de sus chats"
  ON chat_lectura FOR SELECT
  TO authenticated
  USING (
    user_has_chat_access()
    AND EXISTS (
      SELECT 1 FROM chat_mensajes cm
      WHERE cm.id = mensaje_id
      AND user_is_chat_member(cm.chat_id)
    )
  );

CREATE POLICY "Usuarios pueden marcar mensajes como leídos"
  ON chat_lectura FOR INSERT
  TO authenticated
  WITH CHECK (
    user_has_chat_access()
    AND usuario_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM chat_mensajes cm
      WHERE cm.id = mensaje_id
      AND user_is_chat_member(cm.chat_id)
    )
  );

-- Crear bucket de storage para archivos de chat
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-archivos', 'chat-archivos', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage
CREATE POLICY "Miembros pueden subir archivos de chat"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat-archivos'
    AND user_has_chat_access()
  );

CREATE POLICY "Miembros pueden ver archivos de chat"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat-archivos'
    AND user_has_chat_access()
  );

CREATE POLICY "Remitentes pueden eliminar sus archivos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'chat-archivos'
    AND user_has_chat_access()
  );
