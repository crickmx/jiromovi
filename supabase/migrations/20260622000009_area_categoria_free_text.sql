/*
  # Liberar area_categoria de tramites_grupos_visualizacion

  El CHECK constraint limita los valores a ('Comercial', 'Operaciones').
  Al crear nuevas áreas en ticket_tipos, el sistema debe poder asignarlas
  a equipos sin cambios de código ni migraciones adicionales.

  Se elimina el CHECK para que area_categoria acepte cualquier texto.
  La integridad se mantiene por convención: el valor debe coincidir con
  un área existente en ticket_tipos.area.
*/

ALTER TABLE tramites_grupos_visualizacion
  DROP CONSTRAINT IF EXISTS tramites_grupos_visualizacion_area_categoria_check;
