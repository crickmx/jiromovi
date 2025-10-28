/*
  # Actualizar para soportar estilos de texto individuales

  1. Cambios
    - Agregar columna estilos_texto_individual a publicidad_disenos
    - Agregar columna estilos_texto_default_individual a publicidad_plantillas
    - Estructura JSONB con estilos por campo:
      {
        "nombreCompleto": {"font":"Inter","color":"#ffffff","size":24,"align":"center","bold":false,"italic":false},
        "urlJiro": {"font":"Inter","color":"#ffffff","size":20,"align":"center","bold":false,"italic":false},
        "urlMulticotizador": {"font":"Inter","color":"#ffffff","size":20,"align":"center","bold":false,"italic":false}
      }

  2. Seguridad
    - No cambia permisos RLS existentes
*/

-- Agregar columna para estilos individuales en diseños
ALTER TABLE publicidad_disenos 
ADD COLUMN IF NOT EXISTS estilos_texto_individual JSONB DEFAULT '{
  "nombreCompleto": {"font":"Inter","color":"#ffffff","size":24,"align":"center","bold":false,"italic":false},
  "urlJiro": {"font":"Inter","color":"#ffffff","size":20,"align":"center","bold":false,"italic":false},
  "urlMulticotizador": {"font":"Inter","color":"#ffffff","size":20,"align":"center","bold":false,"italic":false}
}'::jsonb;

-- Agregar columna para estilos individuales en plantillas  
ALTER TABLE publicidad_plantillas 
ADD COLUMN IF NOT EXISTS estilos_texto_default_individual JSONB DEFAULT '{
  "nombreCompleto": {"font":"Inter","color":"#ffffff","size":24,"align":"center","bold":false,"italic":false},
  "urlJiro": {"font":"Inter","color":"#ffffff","size":20,"align":"center","bold":false,"italic":false},
  "urlMulticotizador": {"font":"Inter","color":"#ffffff","size":20,"align":"center","bold":false,"italic":false}
}'::jsonb;

-- Actualizar plantillas existentes
UPDATE publicidad_plantillas
SET estilos_texto_default_individual = '{
  "nombreCompleto": {"font":"Inter","color":"#ffffff","size":24,"align":"center","bold":false,"italic":false},
  "urlJiro": {"font":"Inter","color":"#ffffff","size":20,"align":"center","bold":false,"italic":false},
  "urlMulticotizador": {"font":"Inter","color":"#ffffff","size":20,"align":"center","bold":false,"italic":false}
}'::jsonb
WHERE estilos_texto_default_individual IS NULL;
