// Lo que distingue a los triggers de MOVI Store de los de Marketing Admin.
//
// Vive aparte de la pantalla para que la diferencia entre los dos módulos sea
// una lista que se lee de un vistazo, en vez de estar repartida por dentro de
// 400 líneas de formulario. Si mañana hay un tercer módulo con triggers, lo que
// hace falta es otra entrada aquí.

import { supabase } from './supabase';
import { PLACEHOLDERS_TRIGGER_PEDIDO, obtenerMapeoCamposTrigger, guardarMapeoCampoTrigger } from './storeUtils';
import { PLACEHOLDERS_TRIGGER_PREMIUM, obtenerMapeoCamposTriggerPremium, guardarMapeoCampoTriggerPremium } from './mktPremiumTriggers';
import type { ConfigTriggers } from '../components/admin/TriggersPanel';

/** Campos que el motor llena solo; ofrecerlos al admin solo confunde. */
const SISTEMA_KEYS_AUTOMATICOS = [
  'area', 'equipo', 'fecha_creacion', 'fecha_finalizacion', 'creado_por', 'estatus', 'asignado_a',
];

const NOTA_FILTROS =
  'Sin ninguno seleccionado = cualquiera. Puedes marcar varios para que el mismo trigger aplique ' +
  'a todos ellos. Para acciones distintas según lo que lo dispara, sigue haciendo falta un trigger por cada uno.';

const comoOpcion = (v: string) => ({ value: v, label: v });

export const CONFIG_TRIGGERS_STORE: ConfigTriggers = {
  tablaTriggers: 'store_tramite_triggers',
  columnaDisparador: 'estatus_destino_id',
  cargarDisparadores: async () => {
    const { data } = await supabase
      .from('store_estatus_pedidos').select('id, nombre').eq('activo', true).order('orden');
    return (data ?? []) as { id: string; nombre: string }[];
  },
  leerMapeo: obtenerMapeoCamposTrigger,
  guardarMapeo: (m) => guardarMapeoCampoTrigger(m as Parameters<typeof guardarMapeoCampoTrigger>[0]),

  titulo: 'Triggers automáticos',
  descripcion: 'Cuando un pedido cambia a cierto estatus, se crea automáticamente un trámite vinculado.',
  labelDisparador: 'Cuando cambia a estatus',
  placeholderDisparador: 'Selecciona estatus...',
  nombreDisparador: 'Estatus',

  labelMetodo: 'Y el método de pago es',
  // Store guarda la etiqueta misma como valor; se conserva para no migrar las
  // filas que ya existen.
  opcionesMetodo: ['Cargo a Oficina', 'Cargo a Bono de Agente', 'Pago Directo', 'Descuento de Comisiones', 'Cargo a Nómina', 'Otro'].map(comoOpcion),
  labelForma: 'Y la forma de pago es',
  opcionesForma: ['Contado', '2 Parcialidades', '12 Meses'].map(comoOpcion),
  notaFiltros: NOTA_FILTROS,

  placeholders: PLACEHOLDERS_TRIGGER_PEDIDO,
  plantillaPorDefecto: 'Pedido {{folio}} cambió a {{estatus}} — revisar y dar seguimiento.',
  placeholderNombre: 'Ej: Pedido confirmado',
  placeholderPlantilla: 'Ej: Pedido {{folio}} de {{cliente}} por {{monto_total}}',

  adjunto: { value: 'adjunto_oc', label: 'Adjuntar PDF de Orden de Compra' },
  sistemaKeysAutomaticos: SISTEMA_KEYS_AUTOMATICOS,
};

export const CONFIG_TRIGGERS_PREMIUM: ConfigTriggers = {
  tablaTriggers: 'mkt_premium_triggers',
  columnaDisparador: 'evento_id',
  cargarDisparadores: async () => {
    const { data } = await supabase
      .from('mkt_premium_eventos').select('id, nombre').eq('activo', true).order('orden');
    return (data ?? []) as { id: string; nombre: string }[];
  },
  leerMapeo: obtenerMapeoCamposTriggerPremium,
  guardarMapeo: (m) => guardarMapeoCampoTriggerPremium(m as Parameters<typeof guardarMapeoCampoTriggerPremium>[0]),

  titulo: 'Triggers automáticos',
  descripcion: 'Cuando pasa un evento en el Marketing Premium de un agente, se crea automáticamente el trámite que configures aquí.',
  labelDisparador: 'Cuando ocurre el evento',
  placeholderDisparador: 'Selecciona evento...',
  nombreDisparador: 'Evento',

  labelMetodo: 'Y el método de pago es',
  // Aquí sí se guarda una clave corta, no la etiqueta: así nació la tabla.
  opcionesMetodo: [
    { value: 'deposito_jiro', label: 'Depósito a cuenta Jiro' },
    { value: 'bono_anual', label: 'Descuento de bono anual' },
    { value: 'comisiones', label: 'Descuento a comisiones' },
  ],
  // La "forma de pago" de un Premium es el plan: mismo papel que Contado /
  // Parcialidades en un pedido.
  labelForma: 'Y el plan es',
  opcionesForma: [
    { value: 'mensual', label: 'Plan mensual' },
    { value: 'anual', label: 'Plan anual' },
  ],
  notaFiltros: NOTA_FILTROS,

  placeholders: PLACEHOLDERS_TRIGGER_PREMIUM,
  plantillaPorDefecto: 'Marketing Premium — {{evento}} para {{nombre_completo}}.',
  placeholderNombre: 'Ej: Alta de Premium con descuento a comisiones',
  placeholderPlantilla: 'Ej: {{nombre_completo}} — plan {{plan}}',

  adjunto: { value: 'adjunto_comprobante', label: 'Adjuntar comprobante (PDF)' },
  sistemaKeysAutomaticos: SISTEMA_KEYS_AUTOMATICOS,
};
