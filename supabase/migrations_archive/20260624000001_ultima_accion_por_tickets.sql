/*
  # Globito animado — "Requiere atención"

  Agrega `ultima_accion_por` a tickets y triggers para actualizarlo automáticamente
  cuando alguien agrega un comentario, sube un archivo o registra actividad en el historial.

  La lógica en el frontend es:
    needsAttention = ultima_accion_por IS NOT NULL AND ultima_accion_por != current_user.id

  "Marcar como leído" = UPDATE tickets SET ultima_accion_por = current_user.id
*/

-- ── 1. Columna ────────────────────────────────────────────────────────────────

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS ultima_accion_por uuid REFERENCES usuarios(id) ON DELETE SET NULL;

-- ── 2. Función compartida por los tres triggers ───────────────────────────────

CREATE OR REPLACE FUNCTION actualizar_ultima_accion_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE tickets
  SET ultima_accion_por = NEW.usuario_id
  WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$;

-- ── 3. Trigger: comentarios ───────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_comentario_ultima_accion ON ticket_comentarios;
CREATE TRIGGER trg_comentario_ultima_accion
  AFTER INSERT ON ticket_comentarios
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_ultima_accion_ticket();

-- ── 4. Trigger: archivos adjuntos ────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_archivo_ultima_accion ON ticket_archivos;
CREATE TRIGGER trg_archivo_ultima_accion
  AFTER INSERT ON ticket_archivos
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_ultima_accion_ticket();

-- ── 5. Trigger: historial (cambios de estatus, reasignaciones, etc.) ─────────

DROP TRIGGER IF EXISTS trg_historial_ultima_accion ON ticket_historial;
CREATE TRIGGER trg_historial_ultima_accion
  AFTER INSERT ON ticket_historial
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_ultima_accion_ticket();
