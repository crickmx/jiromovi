<?php
/**
 * movi_signatures — usa la firma configurada en MOVI, no una propia de Roundcube.
 *
 * Esqueleto de la Fase 1. Lógica real en Fase 4:
 *   - En vez de que el usuario edite su firma dentro de Roundcube, este
 *     plugin la resuelve en cada composición llamando al edge function que
 *     YA EXISTE en MOVI (`render-firma`), que aplica la prioridad real
 *     (usuario > rol > oficina > global) sobre `firma_templates`/
 *     `firma_asignaciones`.
 *   - Enganchar 'message_compose' (o 'render_page' en la tarea 'mail') para
 *     inyectar la firma en el HTML del compositor al abrir "Nuevo",
 *     "Responder", "Responder a todos" y "Reenviar" — cuidando no duplicarla
 *     si ya viene incluida en el cuerpo citado.
 *   - No debe exponerse la sección "Firmas" de Ajustes de Roundcube: MOVI
 *     sigue siendo la única fuente de verdad para editar la firma.
 */
class movi_signatures extends rcube_plugin
{
    public $task = 'mail|settings';

    function init()
    {
        // Fase 4:
        // $this->add_hook('message_compose', array($this, 'inject_movi_signature'));
    }
}
