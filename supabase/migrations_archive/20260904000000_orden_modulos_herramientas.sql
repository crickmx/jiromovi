-- Actualiza el orden y configuración de los módulos de la sección Herramientas
INSERT INTO sidebar_item_config (item_path, orden)
VALUES
  ('/mi-crm', 0),
  ('/contactos', 1),
  ('/accesos-nacional', 2),
  ('/espacio-jiro', 3),
  ('/centro-digital', 4),
  ('/vacaciones', 5),
  ('/mi-progreso', 6),
  ('/entrega-polizas', 7),
  ('/lector-qualitas', 8)
ON CONFLICT (item_path) DO UPDATE SET orden = EXCLUDED.orden;
