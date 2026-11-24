<?php

/**
 * Atajos discretos para agentes. Roundcube conserva todos sus controles
 * nativos; el plugin sólo escucha teclas cuando el foco no está en un campo.
 */
class movi_productivity extends rcube_plugin
{
    public $task = 'mail';

    #[\Override]
    public function init()
    {
        $this->include_script('movi_productivity.js');
    }
}
