/*
  # Fix Assistant Field Priorities

  Contact fields (nombre, telefono) should be 'optional' with skip_if_contact_has set,
  so they are automatically pre-filled from WhatsApp and never asked again.
  
  Real required fields (marca_vehiculo, modelo_vehiculo, etc.) should be 'required'.
  All others default to 'recommended'.
*/

-- Mark phone/contact fields as optional with skip rules
UPDATE contact_center_assistant_fields
SET 
  priority = 'optional',
  skip_if_contact_has = 'contact_phone'
WHERE field_key IN ('telefono', 'telefono_contacto', 'whatsapp', 'celular', 'phone');

UPDATE contact_center_assistant_fields
SET 
  priority = 'optional',
  skip_if_contact_has = 'contact_name'
WHERE field_key IN ('nombre_cliente', 'nombre', 'nombre_completo', 'nombre_asegurado');

-- Email and ID are optional, not required
UPDATE contact_center_assistant_fields
SET priority = 'optional'
WHERE field_key IN ('correo', 'email', 'identificacion');

-- Comments are optional
UPDATE contact_center_assistant_fields
SET priority = 'optional'
WHERE field_key IN ('comentarios', 'comentarios_adicionales');

-- Vehicle-specific fields are required
UPDATE contact_center_assistant_fields
SET priority = 'required'
WHERE field_key IN ('marca_vehiculo', 'modelo_vehiculo', 'anio_vehiculo', 'uso_vehiculo');

-- Add example values for vehicle fields
UPDATE contact_center_assistant_fields
SET example_value = 'Toyota, Honda, Nissan'
WHERE field_key = 'marca_vehiculo';

UPDATE contact_center_assistant_fields
SET example_value = 'Corolla, Civic, Versa'
WHERE field_key = 'modelo_vehiculo';

UPDATE contact_center_assistant_fields
SET example_value = '2022'
WHERE field_key = 'anio_vehiculo';

UPDATE contact_center_assistant_fields
SET example_value = 'particular, uber, comercial'
WHERE field_key = 'uso_vehiculo';

-- Hogar required fields
UPDATE contact_center_assistant_fields
SET priority = 'required'
WHERE field_key IN ('valor_inmueble', 'ubicacion', 'tipo_construccion', 'ciudad', 'estado');

-- Add fallback messages (human, brief)
UPDATE contact_center_assistant_fields
SET fallback_message = '¿Me pasas la marca? Ej: Toyota, Honda...'
WHERE field_key = 'marca_vehiculo' AND fallback_message IS NULL;

UPDATE contact_center_assistant_fields
SET fallback_message = '¿El modelo del vehículo?'
WHERE field_key = 'modelo_vehiculo' AND fallback_message IS NULL;

-- Enable skip_contact_fields and allow_incomplete on all assistants
UPDATE contact_center_assistants
SET 
  skip_contact_fields = true,
  allow_incomplete_submission = true,
  use_ai_extraction = true,
  max_retries_per_field = 2
WHERE skip_contact_fields IS NULL OR skip_contact_fields = false;
