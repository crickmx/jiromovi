/*
  # Link Smart Assistant Intents to Form Slugs

  1. Changes
    - Updates `linked_form_slug` on all cotizacion-type intents to match actual form_type_slug values
    - This allows the smart assistant to find the correct automatic assistant when an intent is detected

  2. Intent → Form Slug Mappings
    - cotizacion_auto → auto_individual
    - cotizacion_gmm → gmm_individual
    - cotizacion_hogar → hogar_casa_habitacion
    - cotizacion_empresarial → empresa_paquete
    - cotizacion_vida → vida_individual (if assistant exists)
    - cotizacion_fianzas → fianza
    - siniestro_auto → auto_individual
*/

UPDATE smart_assistant_intents
SET linked_form_slug = 'auto_individual'
WHERE intent_key = 'cotizacion_auto' AND linked_form_slug IS NULL;

UPDATE smart_assistant_intents
SET linked_form_slug = 'gmm_individual'
WHERE intent_key = 'cotizacion_gmm' AND linked_form_slug IS NULL;

UPDATE smart_assistant_intents
SET linked_form_slug = 'hogar_casa_habitacion'
WHERE intent_key = 'cotizacion_hogar' AND linked_form_slug IS NULL;

UPDATE smart_assistant_intents
SET linked_form_slug = 'empresa_paquete'
WHERE intent_key = 'cotizacion_empresarial' AND linked_form_slug IS NULL;

UPDATE smart_assistant_intents
SET linked_form_slug = 'vida_individual'
WHERE intent_key = 'cotizacion_vida' AND linked_form_slug IS NULL;

UPDATE smart_assistant_intents
SET linked_form_slug = 'fianza'
WHERE intent_key = 'cotizacion_fianzas' AND linked_form_slug IS NULL;

UPDATE smart_assistant_intents
SET linked_form_slug = 'auto_individual'
WHERE intent_key = 'siniestro_auto' AND linked_form_slug IS NULL;
