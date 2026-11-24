-- ¿A quién se le avisa? — configurable por notificación
-- ====================================================
--
-- Hoy el destinatario de los avisos de trámite está escrito en el código
-- (`NuevoTramiteModal`): al responsable, o al líder de su equipo, o a los
-- Administradores si no cayó en ninguna regla. No hay forma de decir "esto
-- también le llega al solicitante" sin tocar código.
--
-- La columna `destinatario_tipo` ya existía en esta tabla desde enero… y
-- **nadie la lee**. Es el mismo patrón de configuración sin efecto que ya
-- apareció con los canales. No se reusa porque guarda un solo valor y aquí
-- hacen falta varios a la vez: un aviso puede ir al responsable Y al
-- solicitante.
--
-- La lista de "Destinatarios" que ya tiene la pantalla sigue sirviendo, pero
-- es otra cosa: personas fijas, siempre las mismas, sin importar el trámite.
-- Aquí se eligen por su PAPEL en cada trámite.

ALTER TABLE public.correo_tipos_notificacion
  ADD COLUMN IF NOT EXISTS destinatarios_roles text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.correo_tipos_notificacion.destinatarios_roles IS
  'A quién se le avisa, por su papel en el trámite: solicitante, responsable, lider_equipo, lista_fija. Vacío = el comportamiento de siempre (responsable, o líder, o Admin).';

-- Lo que hace hoy el código, escrito como configuración. Así la migración no
-- cambia el comportamiento de nadie: solo lo vuelve visible y editable.
UPDATE public.correo_tipos_notificacion
SET destinatarios_roles = ARRAY['responsable', 'lider_equipo']
WHERE codigo = 'nuevo_tramite'
  AND destinatarios_roles = '{}';
