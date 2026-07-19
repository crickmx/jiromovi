<?php
/**
 * movi_contacts — autocompletado de Para/CC/CCO contra los contactos/
 * directorio de MOVI, no una libreta de direcciones propia de Roundcube.
 *
 * Esqueleto de la Fase 1. Lógica real en Fase 4:
 *   - Implementar un addressbook driver (extendiendo `rcube_addressbook`)
 *     que, en vez de leer una tabla local, llama a un endpoint interno de
 *     MOVI (usuarios/agentes/CRM/directorio) respetando los permisos del
 *     usuario que inició sesión — no duplica la base de datos de contactos.
 *   - Registrarlo con el hook 'addressbooks_list' / 'addressbook_get'.
 *   - Los resultados deben incluir metadata contextual (nombre, correo,
 *     tipo de contacto, empresa/oficina) como ya hace
 *     `src/components/email/ContactoAutocomplete.tsx` en el módulo actual.
 */
class movi_contacts extends rcube_plugin
{
    public $task = 'mail|settings|addressbook';

    function init()
    {
        // Fase 4:
        // $this->add_hook('addressbooks_list', array($this, 'movi_addressbooks_list'));
        // $this->add_hook('addressbook_get', array($this, 'movi_addressbook_get'));
    }
}
