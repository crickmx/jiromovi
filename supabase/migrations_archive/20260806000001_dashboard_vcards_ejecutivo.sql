-- Agrega VCards faltantes para el rol Ejecutivo:
--   tramites       → /tramites
--   centro_contacto → /centro-contacto
--
-- Las rutas ya existen en el router. La visibilidad por rol se
-- controla desde Admin › Editor de Dashboard (module_visibility).

INSERT INTO dashboard_vcards
  (card_key, label, descripcion, route, emoji, gradient_from, gradient_to, orden)
VALUES
  ('tramites',
   'Trámites',
   'Solicitudes y aclaraciones',
   '/tramites',
   '📋',
   '#E84F8A', '#8E1A52',
   6),

  ('centro_contacto',
   'Centro de Contacto',
   'Chat, email y llamadas',
   '/centro-contacto',
   '🎯',
   '#4338CA', '#1E1B8C',
   7)

ON CONFLICT (card_key) DO NOTHING;
