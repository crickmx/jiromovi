/*
  # Agregar Plan MKT Premium a usuarios

  1. Cambios
    - Agregar campo `plan_mkt_premium` a la tabla `usuarios`
    - Este campo controla el acceso a la funcionalidad de personalizar publicidad
    - Solo aplica a usuarios con rol 'Agente'
    - Valor por defecto: false
    - Solo editable por Administradores

  2. Seguridad
    - No se requiere cambio en RLS (se usa lógica de negocio en frontend)
*/

-- Agregar el campo plan_mkt_premium
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS plan_mkt_premium boolean DEFAULT false NOT NULL;

-- Comentario explicativo
COMMENT ON COLUMN usuarios.plan_mkt_premium IS 'Indica si el agente tiene acceso al Plan MKT Premium (personalización de publicidad). Solo aplica a rol Agente.';
