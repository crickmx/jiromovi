import { useState, useEffect, useCallback } from 'react';
import {
  Bot, Plus, Pencil, Trash2, Globe, Lock, Save, X, Loader2, Search,
  RefreshCw, Sparkles, CheckCircle2, ClipboardList, AlertCircle,
  MessageCircle, Zap, FileText, Info, ChevronDown, ChevronUp,
  RotateCcw, History, Download, ArrowRight, CheckSquare, XCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CcAssistant {
  id: string;
  nombre: string;
  descripcion: string;
  source: 'manual' | 'form';
  generation_origin: string;
  quote_form_template_id: string | null;
  form_title: string | null;
  form_type_cache: string | null;
  office_id: string | null;
  office_name?: string;
  is_active: boolean;
  is_global: boolean;
  system_prompt: string;
  model: string;
  language: string;
  welcome_message: string;
  consent_message: string;
  completion_message: string;
  transfer_message: string;
  auto_create_tramite: boolean;
  tramite_tipo: string;
  tramite_prioridad: string;
  total_sessions: number;
  completed_sessions: number;
  transferred_sessions: number;
  last_synced_at: string | null;
  field_count: number;
  has_documents: boolean;
  created_at: string;
}

interface CcField {
  id: string;
  assistant_id: string;
  field_key: string;
  label: string;
  field_type: string;
  is_required: boolean;
  options: unknown[];
  menu_options: unknown[];
  capture_order: number;
  prompt_text: string;
  is_document: boolean;
  document_label: string | null;
  accepted_formats: string[];
  confirmation_message: string | null;
  is_synced_from_form: boolean;
  manually_edited: boolean;
  validation_hint: string | null;
}

interface QuoteTemplate {
  id: string;
  title: string;
  form_type: string;
  category: string;
  description: string;
  is_active: boolean;
  is_global: boolean;
  schema_json: { steps?: string[] } | null;
}

interface Oficina {
  id: string;
  nombre: string;
}

interface GenerateResult {
  created: string[];
  already_existed: string[];
  skipped: string[];
  errors: string[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const FIELD_TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Fecha' },
  { value: 'phone', label: 'Teléfono' },
  { value: 'email', label: 'Correo' },
  { value: 'select', label: 'Selección' },
  { value: 'file', label: 'Archivo / Documento' },
  { value: 'boolean', label: 'Sí/No' },
];

const TRAMITE_TYPES = [
  { value: 'formulario_cotizacion', label: 'Cotización' },
  { value: 'cotizacion_emision', label: 'Cotización/Emisión' },
  { value: 'renovaciones', label: 'Renovaciones' },
  { value: 'cobranza', label: 'Cobranza' },
  { value: 'otros_comercial', label: 'Otros' },
];

const BLANK_ASSISTANT: Omit<CcAssistant, 'id' | 'office_name' | 'total_sessions' | 'completed_sessions' | 'transferred_sessions' | 'created_at' | 'last_synced_at' | 'field_count' | 'has_documents' | 'form_title' | 'form_type_cache' | 'generation_origin'> = {
  nombre: '',
  descripcion: '',
  source: 'manual',
  quote_form_template_id: null,
  office_id: null,
  is_active: true,
  is_global: true,
  system_prompt: '',
  model: 'gpt-4o-mini',
  language: 'es',
  welcome_message: 'Hola, soy el asistente virtual de MOVI. Estoy aquí para ayudarte con tu solicitud. ¿Podemos comenzar?',
  consent_message: 'Para continuar, usaremos la información que nos compartas únicamente para atender tu solicitud. ¿Aceptas? (Si/No)',
  completion_message: '¡Listo! Tu trámite fue registrado correctamente. Un ejecutivo comercial dará seguimiento pronto.',
  transfer_message: 'Listo, voy a pasar esta conversación con un ejecutivo comercial para continuar con tu atención.',
  auto_create_tramite: true,
  tramite_tipo: 'formulario_cotizacion',
  tramite_prioridad: 'Media',
};

// Field definitions per form step type — used for auto-generation
const STEP_FIELD_MAP: Record<string, Array<{ key: string; label: string; type: string; required: boolean; prompt: string; options?: string[] }>> = {
  client: [
    { key: 'nombre_cliente', label: 'Nombre completo', type: 'text', required: true, prompt: '¿Cuál es el nombre completo del cliente?' },
    { key: 'telefono', label: 'Teléfono de contacto', type: 'phone', required: true, prompt: '¿Cuál es el teléfono de contacto?' },
    { key: 'correo', label: 'Correo electrónico', type: 'email', required: false, prompt: '¿Cuál es el correo electrónico?' },
  ],
  insured: [
    { key: 'nombre_asegurado', label: 'Nombre del asegurado', type: 'text', required: true, prompt: '¿Cuál es el nombre completo del asegurado?' },
    { key: 'fecha_nacimiento', label: 'Fecha de nacimiento', type: 'date', required: true, prompt: '¿Cuál es la fecha de nacimiento del asegurado? (dd/mm/aaaa)' },
    { key: 'sexo', label: 'Sexo', type: 'select', required: true, prompt: '¿Cuál es el sexo del asegurado?', options: ['Masculino', 'Femenino'] },
    { key: 'estado_civil', label: 'Estado civil', type: 'select', required: false, prompt: '¿Cuál es el estado civil?', options: ['Soltero/a', 'Casado/a', 'Divorciado/a', 'Viudo/a', 'Unión libre'] },
  ],
  medical: [
    { key: 'suma_asegurada', label: 'Suma asegurada deseada', type: 'select', required: true, prompt: '¿Qué suma asegurada necesita?', options: ['$1,000,000', '$2,000,000', '$3,000,000', '$5,000,000', 'Sin límite'] },
    { key: 'padecimientos', label: 'Padecimientos preexistentes', type: 'text', required: false, prompt: '¿El asegurado tiene algún padecimiento preexistente? (o escribe "ninguno")' },
    { key: 'medicamentos', label: 'Medicamentos actuales', type: 'text', required: false, prompt: '¿Toma algún medicamento actualmente? (o escribe "no")' },
  ],
  plan: [
    { key: 'tipo_plan', label: 'Tipo de plan', type: 'select', required: true, prompt: '¿Qué tipo de plan requiere?', options: ['Individual', 'Familiar', 'Colectivo'] },
    { key: 'deducible', label: 'Deducible preferido', type: 'text', required: false, prompt: '¿Tiene alguna preferencia sobre el deducible?' },
    { key: 'cobertura_adicional', label: 'Coberturas adicionales', type: 'text', required: false, prompt: '¿Desea alguna cobertura adicional? (maternidad, dental, etc.)' },
  ],
  payment: [
    { key: 'forma_pago', label: 'Forma de pago', type: 'select', required: false, prompt: '¿Cómo prefiere pagar?', options: ['Anual', 'Semestral', 'Trimestral', 'Mensual'] },
  ],
  risk: [
    { key: 'descripcion_riesgo', label: 'Descripción del riesgo', type: 'text', required: true, prompt: 'Por favor describe el bien o riesgo a asegurar:' },
    { key: 'valor_comercial', label: 'Valor comercial', type: 'number', required: true, prompt: '¿Cuál es el valor comercial del bien a asegurar? (en pesos)' },
    { key: 'ubicacion', label: 'Ubicación / dirección', type: 'text', required: true, prompt: '¿Cuál es la dirección o ubicación del bien?' },
  ],
  vehicle: [
    { key: 'marca_vehiculo', label: 'Marca del vehículo', type: 'text', required: true, prompt: '¿Cuál es la marca del vehículo? (ej. Toyota, Honda...)' },
    { key: 'modelo_vehiculo', label: 'Modelo', type: 'text', required: true, prompt: '¿Cuál es el modelo del vehículo?' },
    { key: 'anio_vehiculo', label: 'Año', type: 'number', required: true, prompt: '¿De qué año es el vehículo?' },
    { key: 'placas', label: 'Placas', type: 'text', required: false, prompt: '¿Cuáles son las placas del vehículo?' },
    { key: 'numero_serie', label: 'Número de serie (VIN)', type: 'text', required: false, prompt: '¿Cuál es el número de serie o VIN del vehículo?' },
    { key: 'uso_vehiculo', label: 'Uso del vehículo', type: 'select', required: true, prompt: '¿Para qué usa el vehículo?', options: ['Particular', 'Comercial', 'Servicio público', 'Reparto'] },
  ],
  property: [
    { key: 'tipo_inmueble', label: 'Tipo de inmueble', type: 'select', required: true, prompt: '¿Qué tipo de inmueble es?', options: ['Casa habitación', 'Departamento', 'Oficina', 'Local comercial', 'Bodega', 'Otro'] },
    { key: 'metros_cuadrados', label: 'Metros cuadrados', type: 'number', required: false, prompt: '¿Cuántos metros cuadrados tiene?' },
    { key: 'anio_construccion', label: 'Año de construcción', type: 'number', required: false, prompt: '¿En qué año fue construido?' },
    { key: 'valor_inmueble', label: 'Valor del inmueble', type: 'number', required: true, prompt: '¿Cuál es el valor aproximado del inmueble? (en pesos)' },
    { key: 'valor_contenidos', label: 'Valor de contenidos', type: 'number', required: false, prompt: '¿Cuál es el valor de los contenidos o mobiliario? (o escribe 0 si no aplica)' },
  ],
  business: [
    { key: 'nombre_empresa', label: 'Nombre de la empresa', type: 'text', required: true, prompt: '¿Cuál es el nombre o razón social de la empresa?' },
    { key: 'giro_negocio', label: 'Giro del negocio', type: 'text', required: true, prompt: '¿Cuál es el giro o actividad principal del negocio?' },
    { key: 'numero_empleados', label: 'Número de empleados', type: 'number', required: false, prompt: '¿Cuántos empleados tiene la empresa?' },
    { key: 'ventas_anuales', label: 'Ventas anuales aproximadas', type: 'number', required: false, prompt: '¿Cuáles son las ventas anuales aproximadas? (en pesos)' },
  ],
  beneficiary: [
    { key: 'nombre_beneficiario', label: 'Nombre del beneficiario', type: 'text', required: false, prompt: '¿Quién será el beneficiario? (nombre completo)' },
    { key: 'parentesco', label: 'Parentesco', type: 'select', required: false, prompt: '¿Qué parentesco tiene con el asegurado?', options: ['Cónyuge', 'Hijo/a', 'Padre/Madre', 'Hermano/a', 'Otro'] },
    { key: 'porcentaje_beneficiario', label: 'Porcentaje', type: 'number', required: false, prompt: '¿Qué porcentaje del beneficio le corresponde?' },
  ],
  attachments: [
    { key: 'identificacion', label: 'Identificación oficial', type: 'file', required: false, prompt: 'Por favor envíanos una foto o PDF de la identificación oficial del asegurado.' },
  ],
  habits: [
    { key: 'fuma', label: '¿Fuma?', type: 'boolean', required: false, prompt: '¿El asegurado fuma actualmente? (Si/No)' },
    { key: 'actividad_fisica', label: 'Actividad física', type: 'text', required: false, prompt: '¿Realiza alguna actividad física de alto riesgo? (o escribe "ninguna")' },
  ],
  review: [],
  additional: [
    { key: 'comentarios', label: 'Comentarios adicionales', type: 'text', required: false, prompt: '¿Hay algún comentario o información adicional que debamos considerar?' },
  ],
};

// Build field list for a form from its steps
function buildFieldsForForm(steps: string[]): Array<{ key: string; label: string; type: string; required: boolean; prompt: string; options?: string[]; isDocument?: boolean }> {
  const seen = new Set<string>();
  const result: Array<{ key: string; label: string; type: string; required: boolean; prompt: string; options?: string[]; isDocument?: boolean }> = [];

  // Always start with client info
  if (!steps.includes('client')) {
    for (const f of (STEP_FIELD_MAP['client'] || [])) {
      if (!seen.has(f.key)) { seen.add(f.key); result.push(f); }
    }
  }

  for (const step of steps) {
    const stepFields = STEP_FIELD_MAP[step] || [];
    for (const f of stepFields) {
      if (!seen.has(f.key)) {
        seen.add(f.key);
        result.push({ ...f, isDocument: f.type === 'file' });
      }
    }
  }

  // Always end with additional comments
  const commentField = { key: 'comentarios', label: 'Comentarios adicionales', type: 'text', required: false, prompt: '¿Hay algún comentario o información adicional que debamos considerar?' };
  if (!seen.has('comentarios')) result.push(commentField);

  return result;
}

// Generate natural prompt for a field
function generatePrompt(label: string, fieldType: string, options?: string[]): string {
  const lower = label.toLowerCase();
  if (lower.includes('nombre')) return `¿Cuál es el ${lower}?`;
  if (lower.includes('fecha')) return `¿Cuál es la ${lower}? (dd/mm/aaaa)`;
  if (lower.includes('correo') || lower.includes('email')) return `¿Cuál es el ${lower}?`;
  if (lower.includes('teléfono') || lower.includes('celular')) return `¿Cuál es el ${lower}?`;
  if (lower.includes('dirección') || lower.includes('ubicación')) return `¿Cuál es la ${lower}?`;
  if (lower.includes('valor') || lower.includes('monto') || lower.includes('precio')) return `¿Cuál es el ${lower}? (en pesos)`;
  if (lower.includes('año')) return `¿En qué ${lower}?`;
  if (lower.includes('descripción') || lower.includes('detalle')) return `Por favor describe ${lower}:`;
  if (fieldType === 'boolean') return `¿${label}? (Si/No)`;
  if (fieldType === 'select' && options && options.length > 0) return `¿Cuál es ${lower}?\n\nOpciones:\n${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`;
  if (fieldType === 'file') return `Por favor envía ${lower} (imagen o PDF):`;
  return `¿Cuál es ${lower}?`;
}

// Build system prompt for a given form
function buildSystemPrompt(formTitle: string, formType: string): string {
  return `Eres un asistente automático de MOVI Digital especializado en capturar información para el formulario "${formTitle}" (tipo: ${formType}).

Tu tarea es:
1. Guiar al usuario paso a paso solicitando únicamente la información definida en el formulario
2. Interpretar respuestas naturales del usuario (aunque no sean exactas)
3. Detectar campos faltantes y solicitarlos amablemente
4. Solicitar documentos requeridos cuando corresponda
5. Mostrar un resumen final y crear el trámite solo cuando todos los campos obligatorios estén completos

Reglas importantes:
- NO inventes datos ni supongas valores
- NO solicites información que no esté definida, salvo comentarios adicionales
- Si el usuario pide hablar con una persona, se molesta, expresa confusión o el flujo no puede continuar, transfiere la conversación a un Ejecutivo Comercial
- Usa lenguaje claro, amable y profesional
- Responde siempre en español

La URL oficial de la plataforma es: https://app.movi.digital`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CentroContactoAsistentes() {
  const { usuario } = useAuth();
  const [assistants, setAssistants] = useState<CcAssistant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSource, setFilterSource] = useState<'all' | 'manual' | 'form'>('all');
  const [selectedAssistant, setSelectedAssistant] = useState<CcAssistant | null>(null);
  const [fields, setFields] = useState<CcField[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [quoteTemplates, setQuoteTemplates] = useState<QuoteTemplate[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editForm, setEditForm] = useState<typeof BLANK_ASSISTANT>(BLANK_ASSISTANT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<'info' | 'messages'>('info');
  const [editingField, setEditingField] = useState<Partial<CcField> | null>(null);
  const [savingField, setSavingField] = useState(false);
  const [importingFromForm, setImportingFromForm] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generatingAssistants, setGeneratingAssistants] = useState(false);
  const [generateResult, setGenerateResult] = useState<GenerateResult | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingOne, setSyncingOne] = useState(false);
  const [showSyncLog, setShowSyncLog] = useState(false);

  const isAdmin = usuario?.rol === 'Administrador';
  const isGerente = usuario?.rol === 'Gerente';
  const canEdit = isAdmin || isGerente;

  const loadAssistants = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('contact_center_assistants')
      .select('*, oficinas(nombre)')
      .order('nombre');
    if (data) {
      setAssistants(data.map(a => ({
        ...a,
        office_name: (a.oficinas as { nombre?: string } | null)?.nombre || null,
      })));
    }
    setLoading(false);
  }, []);

  const loadFields = useCallback(async (assistantId: string) => {
    setLoadingFields(true);
    const { data } = await supabase
      .from('contact_center_assistant_fields')
      .select('*')
      .eq('assistant_id', assistantId)
      .order('capture_order');
    setFields((data || []) as CcField[]);
    setLoadingFields(false);
  }, []);

  useEffect(() => {
    loadAssistants();
    supabase.from('oficinas').select('id, nombre').eq('activa', true).order('nombre').then(({ data }) => {
      if (data) setOficinas(data);
    });
    supabase
      .from('quote_form_templates')
      .select('id, title, form_type, category, description, is_active, is_global, schema_json')
      .order('title')
      .then(({ data }) => {
        if (data) setQuoteTemplates(data as QuoteTemplate[]);
      });
  }, [loadAssistants]);

  useEffect(() => {
    if (selectedAssistant) loadFields(selectedAssistant.id);
  }, [selectedAssistant, loadFields]);

  // ─── Generate assistants from all active forms ─────────────────────────────
  const handleGenerateFromForms = async () => {
    if (!isAdmin) return;
    setGeneratingAssistants(true);
    setGenerateResult(null);

    const result: GenerateResult = { created: [], already_existed: [], skipped: [], errors: [] };
    const activeForms = quoteTemplates.filter(t => t.is_active);

    for (const form of activeForms) {
      try {
        // Check if assistant already exists for this form
        const { data: existing } = await supabase
          .from('contact_center_assistants')
          .select('id, nombre')
          .eq('quote_form_template_id', form.id)
          .maybeSingle();

        if (existing) {
          result.already_existed.push(`${form.title} (ya existe: ${existing.nombre})`);
          continue;
        }

        const steps = (form.schema_json?.steps || []) as string[];
        if (steps.length === 0) {
          result.skipped.push(`${form.title} (sin pasos configurados)`);
          continue;
        }

        const fieldsToCreate = buildFieldsForForm(steps);
        const hasDocuments = fieldsToCreate.some(f => f.type === 'file' || f.isDocument);
        const assistantName = `Asistente ${form.title}`;

        const systemPrompt = buildSystemPrompt(form.title, form.form_type);

        const welcomeMessage = `Hola, soy el asistente automático de MOVI para *${form.title}*. Te ayudaré a capturar la información necesaria para crear tu trámite. ¿Podemos comenzar?`;

        const consentMessage = `Para continuar, usaremos la información que nos compartas únicamente para atender tu solicitud de *${form.title}* y crear el trámite correspondiente en MOVI. Al continuar, confirmas que aceptas nuestro aviso de privacidad. ¿Aceptas? (Si/No)`;

        const completionMessage = `¡Listo! Tu solicitud de *${form.title}* fue registrada correctamente. Un ejecutivo comercial dará seguimiento. Puedes consultar el estado de tu trámite en https://app.movi.digital`;

        const { data: newAssistant, error: createErr } = await supabase
          .from('contact_center_assistants')
          .insert({
            nombre: assistantName,
            descripcion: `Asistente generado automáticamente para capturar información del formulario "${form.title}" y crear trámites desde Centro de Contacto.`,
            source: 'form',
            generation_origin: 'auto_generated',
            quote_form_template_id: form.id,
            form_title: form.title,
            form_type_cache: form.form_type,
            is_active: true,
            is_global: form.is_global !== false,
            system_prompt: systemPrompt,
            model: 'gpt-4o-mini',
            language: 'es',
            welcome_message: welcomeMessage,
            consent_message: consentMessage,
            completion_message: completionMessage,
            transfer_message: 'Listo, voy a pasar esta conversación con un ejecutivo comercial para continuar con tu atención. ¡Gracias por tu paciencia!',
            auto_create_tramite: true,
            tramite_tipo: 'formulario_cotizacion',
            tramite_prioridad: 'Media',
            has_documents: hasDocuments,
            field_count: fieldsToCreate.length,
            last_synced_at: new Date().toISOString(),
            created_by: usuario?.id || null,
          })
          .select()
          .single();

        if (createErr || !newAssistant) {
          result.errors.push(`${form.title}: ${createErr?.message || 'Error desconocido'}`);
          continue;
        }

        // Insert fields
        const fieldInserts = fieldsToCreate.map((f, idx) => ({
          assistant_id: newAssistant.id,
          field_key: f.key,
          label: f.label,
          field_type: f.type === 'file' ? 'file' : f.type,
          is_required: f.required,
          options: f.options || [],
          menu_options: f.options ? f.options.map((o, i) => ({ id: String(i + 1), label: o })) : [],
          capture_order: idx,
          prompt_text: f.prompt || generatePrompt(f.label, f.type, f.options),
          is_document: f.type === 'file',
          document_label: f.type === 'file' ? f.label : null,
          accepted_formats: f.type === 'file' ? ['image', 'pdf'] : [],
          confirmation_message: f.type === 'file' ? `Documento "${f.label}" recibido correctamente.` : null,
          is_synced_from_form: true,
          manually_edited: false,
        }));

        await supabase.from('contact_center_assistant_fields').insert(fieldInserts);

        // Log sync
        await supabase.from('contact_center_assistant_sync_logs').insert({
          assistant_id: newAssistant.id,
          form_id: form.id,
          sync_type: 'initial_generation',
          performed_by: usuario?.id || null,
          summary: {
            form_title: form.title,
            form_type: form.form_type,
            steps,
          },
          fields_added: fieldsToCreate.length,
        });

        result.created.push(assistantName);
      } catch (err) {
        result.errors.push(`${form.title}: ${String(err)}`);
      }
    }

    setGenerateResult(result);
    setGeneratingAssistants(false);
    loadAssistants();
  };

  // ─── Sync single assistant with its form ──────────────────────────────────
  const handleSyncWithForm = async (assistant: CcAssistant) => {
    if (!assistant.quote_form_template_id) return;
    setSyncingOne(true);

    try {
      const { data: form } = await supabase
        .from('quote_form_templates')
        .select('id, title, form_type, schema_json')
        .eq('id', assistant.quote_form_template_id)
        .maybeSingle();

      if (!form) {
        alert('No se encontró el formulario asociado.');
        setSyncingOne(false);
        return;
      }

      const steps = (form.schema_json?.steps || []) as string[];
      const newFields = buildFieldsForForm(steps);

      const { data: existingFields } = await supabase
        .from('contact_center_assistant_fields')
        .select('*')
        .eq('assistant_id', assistant.id);

      const existingKeys = new Set((existingFields || []).map(f => f.field_key));
      let fieldsAdded = 0;
      let fieldsSkipped = 0;

      for (let idx = 0; idx < newFields.length; idx++) {
        const f = newFields[idx];
        if (existingKeys.has(f.key)) {
          // Only update non-manually-edited fields
          const existing = (existingFields || []).find(ef => ef.field_key === f.key);
          if (existing && !existing.manually_edited) {
            await supabase.from('contact_center_assistant_fields').update({
              options: f.options || [],
              menu_options: f.options ? f.options.map((o: string, i: number) => ({ id: String(i + 1), label: o })) : [],
              is_synced_from_form: true,
            }).eq('id', existing.id);
          } else {
            fieldsSkipped++;
          }
        } else {
          // Add new field
          await supabase.from('contact_center_assistant_fields').insert({
            assistant_id: assistant.id,
            field_key: f.key,
            label: f.label,
            field_type: f.type,
            is_required: f.required,
            options: f.options || [],
            menu_options: f.options ? f.options.map((o, i) => ({ id: String(i + 1), label: o })) : [],
            capture_order: (existingFields?.length || 0) + idx,
            prompt_text: f.prompt || generatePrompt(f.label, f.type, f.options),
            is_document: f.type === 'file',
            document_label: f.type === 'file' ? f.label : null,
            accepted_formats: f.type === 'file' ? ['image', 'pdf'] : [],
            confirmation_message: f.type === 'file' ? `Documento "${f.label}" recibido correctamente.` : null,
            is_synced_from_form: true,
            manually_edited: false,
          });
          fieldsAdded++;
        }
      }

      const hasDocuments = newFields.some(f => f.type === 'file');

      await supabase.from('contact_center_assistants').update({
        last_synced_at: new Date().toISOString(),
        form_title: form.title,
        form_type_cache: form.form_type,
        has_documents: hasDocuments,
        field_count: (existingFields?.length || 0) + fieldsAdded,
      }).eq('id', assistant.id);

      await supabase.from('contact_center_assistant_sync_logs').insert({
        assistant_id: assistant.id,
        form_id: form.id,
        sync_type: 'manual_sync',
        performed_by: usuario?.id || null,
        summary: { form_title: form.title, form_type: form.form_type, steps },
        fields_added: fieldsAdded,
        fields_skipped: fieldsSkipped,
      });

      await loadAssistants();
      if (selectedAssistant?.id === assistant.id) {
        await loadFields(assistant.id);
        setSelectedAssistant(prev => prev ? {
          ...prev,
          last_synced_at: new Date().toISOString(),
          field_count: (existingFields?.length || 0) + fieldsAdded,
        } : null);
      }

      alert(`Sincronización completada. ${fieldsAdded} campos nuevos añadidos, ${fieldsSkipped} personalizados preservados.`);
    } catch (err) {
      alert(`Error al sincronizar: ${String(err)}`);
    }

    setSyncingOne(false);
  };

  // ─── Sync all form-linked assistants ──────────────────────────────────────
  const handleSyncAll = async () => {
    if (!isAdmin) return;
    if (!confirm('¿Sincronizar todos los asistentes vinculados a formularios? Los campos personalizados serán preservados.')) return;
    setSyncingAll(true);
    const formLinked = assistants.filter(a => a.source === 'form' && a.quote_form_template_id);
    for (const a of formLinked) {
      await handleSyncWithForm(a);
    }
    setSyncingAll(false);
    alert(`Sincronización completada para ${formLinked.length} asistente(s).`);
  };

  // ─── Import fields from quote form template (manual) ──────────────────────
  const handleImportFromForm = async () => {
    if (!selectedAssistant || !editForm.quote_form_template_id) return;
    setImportingFromForm(true);
    try {
      const { data: tpl } = await supabase
        .from('quote_form_templates')
        .select('schema_json, title, form_type')
        .eq('id', editForm.quote_form_template_id)
        .maybeSingle();

      if (tpl?.schema_json) {
        const steps = ((tpl.schema_json as { steps?: string[] }).steps || []) as string[];
        const newFields = buildFieldsForForm(steps);
        let order = fields.length;

        for (const f of newFields) {
          const existing = fields.find(ef => ef.field_key === f.key);
          if (!existing) {
            await supabase.from('contact_center_assistant_fields').insert({
              assistant_id: selectedAssistant.id,
              field_key: f.key,
              label: f.label,
              field_type: f.type,
              is_required: f.required,
              options: f.options || [],
              menu_options: f.options ? f.options.map((o, i) => ({ id: String(i + 1), label: o })) : [],
              capture_order: order++,
              prompt_text: f.prompt || generatePrompt(f.label, f.type, f.options),
              is_document: f.type === 'file',
              document_label: f.type === 'file' ? f.label : null,
              accepted_formats: f.type === 'file' ? ['image', 'pdf'] : [],
              confirmation_message: f.type === 'file' ? `Documento "${f.label}" recibido correctamente.` : null,
              is_synced_from_form: true,
              manually_edited: false,
            });
          }
        }
        await loadFields(selectedAssistant.id);
      }
    } catch (err) {
      alert('Error al importar: ' + String(err));
    }
    setImportingFromForm(false);
  };

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  const handleNew = () => {
    setEditForm({ ...BLANK_ASSISTANT });
    setEditingId(null);
    setShowForm(true);
    setActiveSection('info');
    setSelectedAssistant(null);
  };

  const handleEdit = (a: CcAssistant) => {
    setEditForm({
      nombre: a.nombre, descripcion: a.descripcion, source: a.source,
      quote_form_template_id: a.quote_form_template_id, office_id: a.office_id,
      is_active: a.is_active, is_global: a.is_global, system_prompt: a.system_prompt,
      model: a.model, language: a.language, welcome_message: a.welcome_message,
      consent_message: a.consent_message, completion_message: a.completion_message,
      transfer_message: a.transfer_message, auto_create_tramite: a.auto_create_tramite,
      tramite_tipo: a.tramite_tipo, tramite_prioridad: a.tramite_prioridad,
    });
    setEditingId(a.id);
    setShowForm(true);
    setSelectedAssistant(a);
    setActiveSection('info');
  };

  const handleSave = async () => {
    if (!editForm.nombre.trim()) return;
    setSaving(true);

    const payload = {
      nombre: editForm.nombre.trim(),
      descripcion: editForm.descripcion,
      source: editForm.source,
      quote_form_template_id: editForm.quote_form_template_id || null,
      office_id: editForm.office_id || null,
      is_active: editForm.is_active,
      is_global: editForm.is_global,
      system_prompt: editForm.system_prompt,
      model: editForm.model,
      language: editForm.language,
      welcome_message: editForm.welcome_message,
      consent_message: editForm.consent_message,
      completion_message: editForm.completion_message,
      transfer_message: editForm.transfer_message,
      auto_create_tramite: editForm.auto_create_tramite,
      tramite_tipo: editForm.tramite_tipo,
      tramite_prioridad: editForm.tramite_prioridad,
    };

    if (editingId) {
      const { data, error } = await supabase
        .from('contact_center_assistants').update(payload).eq('id', editingId).select().single();
      if (!error && data) {
        setSelectedAssistant({ ...selectedAssistant!, ...data, office_name: oficinas.find(o => o.id === data.office_id)?.nombre });
        setShowForm(false);
        loadAssistants();
      } else { alert(error?.message || 'Error al guardar'); }
    } else {
      const { data, error } = await supabase
        .from('contact_center_assistants').insert({ ...payload, created_by: usuario?.id }).select().single();
      if (!error && data) {
        setSelectedAssistant({ ...data, office_name: oficinas.find(o => o.id === data.office_id)?.nombre });
        setEditingId(data.id);
        setShowForm(false);
        loadAssistants();
      } else { alert(error?.message || 'Error al crear'); }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este asistente? Esta acción no se puede deshacer.')) return;
    await supabase.from('contact_center_assistants').delete().eq('id', id);
    if (selectedAssistant?.id === id) setSelectedAssistant(null);
    loadAssistants();
  };

  const handleToggleActive = async (a: CcAssistant) => {
    await supabase.from('contact_center_assistants').update({ is_active: !a.is_active }).eq('id', a.id);
    loadAssistants();
    if (selectedAssistant?.id === a.id) setSelectedAssistant(prev => prev ? { ...prev, is_active: !prev.is_active } : null);
  };

  // ─── Field CRUD ───────────────────────────────────────────────────────────

  const handleSaveField = async () => {
    if (!selectedAssistant || !editingField?.field_key || !editingField?.label) return;
    setSavingField(true);

    const payload = {
      assistant_id: selectedAssistant.id,
      field_key: editingField.field_key,
      label: editingField.label,
      field_type: editingField.field_type || 'text',
      is_required: editingField.is_required !== false,
      options: editingField.options || [],
      menu_options: editingField.menu_options || [],
      capture_order: editingField.capture_order ?? fields.length,
      prompt_text: editingField.prompt_text || generatePrompt(editingField.label, editingField.field_type || 'text'),
      is_document: editingField.field_type === 'file',
      document_label: editingField.field_type === 'file' ? editingField.label : null,
      accepted_formats: editingField.field_type === 'file' ? ['image', 'pdf'] : [],
      confirmation_message: editingField.field_type === 'file' ? `Documento "${editingField.label}" recibido correctamente.` : null,
      manually_edited: true,
    };

    if (editingField.id) {
      await supabase.from('contact_center_assistant_fields').update(payload).eq('id', editingField.id);
    } else {
      await supabase.from('contact_center_assistant_fields').insert(payload);
    }
    setEditingField(null);
    await loadFields(selectedAssistant.id);
    setSavingField(false);
  };

  const handleDeleteField = async (fieldId: string) => {
    if (!confirm('¿Eliminar este campo?')) return;
    await supabase.from('contact_center_assistant_fields').delete().eq('id', fieldId);
    if (selectedAssistant) loadFields(selectedAssistant.id);
  };

  // ─── Filtered list ────────────────────────────────────────────────────────

  const filtered = assistants.filter(a => {
    const matchSearch = !search || a.nombre.toLowerCase().includes(search.toLowerCase()) || a.descripcion?.toLowerCase().includes(search.toLowerCase());
    const matchSource = filterSource === 'all' || a.source === filterSource;
    return matchSearch && matchSource;
  });

  const formLinkedCount = assistants.filter(a => a.source === 'form').length;

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Bot className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">Asistentes Automáticos</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Centro de Contacto — Modo Automático</p>
            </div>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2 flex-wrap">
              {isAdmin && formLinkedCount > 0 && (
                <button
                  onClick={handleSyncAll}
                  disabled={syncingAll}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm transition-colors"
                >
                  {syncingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Sincronizar todos
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => { setGenerateResult(null); setShowGenerateModal(true); }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-sm font-medium transition-colors"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Generar desde formularios
                </button>
              )}
              <button
                onClick={handleNew}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" /> Nuevo
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: list */}
        <div className="w-80 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col">
          <div className="p-3 space-y-2 border-b border-gray-100 dark:border-gray-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar asistente..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-1">
              {(['all', 'form', 'manual'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilterSource(f)}
                  className={`flex-1 text-[11px] py-1 rounded-md font-medium transition-colors ${
                    filterSource === f
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                      : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {f === 'all' ? 'Todos' : f === 'form' ? 'Formulario' : 'Manual'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-emerald-500" /></div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center">
                <Bot className="w-10 h-10 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {assistants.length === 0 ? 'Sin asistentes aún' : 'Sin resultados'}
                </p>
                {assistants.length === 0 && isAdmin && (
                  <button
                    onClick={() => { setGenerateResult(null); setShowGenerateModal(true); }}
                    className="mt-3 text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1 mx-auto"
                  >
                    <Zap className="w-3 h-3" /> Generar desde formularios
                  </button>
                )}
              </div>
            ) : (
              filtered.map(a => (
                <button
                  key={a.id}
                  onClick={() => { setSelectedAssistant(a); setShowForm(false); }}
                  className={`w-full text-left p-3.5 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                    selectedAssistant?.id === a.id ? 'bg-emerald-50 dark:bg-emerald-900/10 border-l-2 border-l-emerald-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${a.is_active ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                      <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{a.nombre}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {a.source === 'form' && <FileText className="w-3 h-3 text-blue-400" title="Basado en formulario" />}
                      {a.has_documents && <ClipboardList className="w-3 h-3 text-amber-400" title="Requiere documentos" />}
                      {a.is_global ? <Globe className="w-3 h-3 text-gray-400" /> : <Lock className="w-3 h-3 text-gray-400" />}
                    </div>
                  </div>
                  {a.form_title && <p className="text-[10px] text-blue-500 dark:text-blue-400 pl-4 truncate">{a.form_title}</p>}
                  <div className="flex items-center gap-3 mt-1 pl-4">
                    <span className="text-[10px] text-gray-400">{a.field_count || 0} campos</span>
                    <span className="text-[10px] text-gray-400">{a.total_sessions || 0} sesiones</span>
                    {a.last_synced_at && (
                      <span className="text-[10px] text-emerald-500">
                        sincronizado
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Stats footer */}
          <div className="p-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-[11px] text-gray-400">
            <span>{assistants.length} asistentes</span>
            <span>{formLinkedCount} de formularios</span>
          </div>
        </div>

        {/* Right: detail */}
        <div className="flex-1 overflow-y-auto">
          {!selectedAssistant && !showForm ? (
            <EmptyState canEdit={canEdit} isAdmin={isAdmin} onNew={handleNew} onGenerate={() => { setGenerateResult(null); setShowGenerateModal(true); }} />
          ) : showForm ? (
            <AssistantForm
              form={editForm}
              isEditing={!!editingId}
              oficinas={oficinas}
              quoteTemplates={quoteTemplates}
              saving={saving}
              activeSection={activeSection}
              setActiveSection={setActiveSection}
              onChange={(field, value) => setEditForm(prev => ({ ...prev, [field]: value }))}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); if (!editingId) setSelectedAssistant(null); }}
            />
          ) : selectedAssistant ? (
            <AssistantDetail
              assistant={selectedAssistant}
              fields={fields}
              loadingFields={loadingFields}
              editingField={editingField}
              savingField={savingField}
              importingFromForm={importingFromForm}
              syncingOne={syncingOne}
              showSyncLog={showSyncLog}
              canEdit={canEdit}
              quoteTemplates={quoteTemplates}
              onEdit={() => handleEdit(selectedAssistant)}
              onDelete={() => handleDelete(selectedAssistant.id)}
              onToggleActive={() => handleToggleActive(selectedAssistant)}
              onAddField={() => setEditingField({ assistant_id: selectedAssistant.id, capture_order: fields.length, is_required: true, field_type: 'text' })}
              onEditField={(f) => setEditingField(f)}
              onDeleteField={handleDeleteField}
              onSaveField={handleSaveField}
              onCancelField={() => setEditingField(null)}
              onImportFromForm={handleImportFromForm}
              onSyncWithForm={() => handleSyncWithForm(selectedAssistant)}
              setEditingField={setEditingField}
              setShowSyncLog={setShowSyncLog}
            />
          ) : null}
        </div>
      </div>

      {/* Generate from forms modal */}
      {showGenerateModal && (
        <GenerateFromFormsModal
          forms={quoteTemplates}
          assistants={assistants}
          generating={generatingAssistants}
          result={generateResult}
          onGenerate={handleGenerateFromForms}
          onClose={() => setShowGenerateModal(false)}
        />
      )}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ canEdit, isAdmin, onNew, onGenerate }: {
  canEdit: boolean; isAdmin: boolean; onNew: () => void; onGenerate: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="w-20 h-20 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-4">
        <Bot className="w-10 h-10 text-emerald-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">Asistentes Automáticos</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-6">
        Configura asistentes de IA para gestionar conversaciones de WhatsApp, capturar datos de cotización y crear trámites automáticamente.
      </p>
      {canEdit && (
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {isAdmin && (
            <button
              onClick={onGenerate}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors shadow-sm"
            >
              <Zap className="w-4 h-4" /> Generar desde formularios
            </button>
          )}
          <button
            onClick={onNew}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Crear manualmente
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Generate From Forms Modal ────────────────────────────────────────────────

function GenerateFromFormsModal({ forms, assistants, generating, result, onGenerate, onClose }: {
  forms: QuoteTemplate[];
  assistants: CcAssistant[];
  generating: boolean;
  result: GenerateResult | null;
  onGenerate: () => void;
  onClose: () => void;
}) {
  const activeForms = forms.filter(f => f.is_active);
  const existingFormIds = new Set(assistants.filter(a => a.quote_form_template_id).map(a => a.quote_form_template_id!));
  const pendingForms = activeForms.filter(f => !existingFormIds.has(f.id));
  const alreadyLinked = activeForms.filter(f => existingFormIds.has(f.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Zap className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Generar asistentes desde formularios</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Se creará un asistente por cada formulario activo sin asistente vinculado</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Result */}
          {result && (
            <div className="space-y-4">
              {result.created.length > 0 && (
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{result.created.length} asistente(s) creado(s)</span>
                  </div>
                  <ul className="space-y-1">
                    {result.created.map((name, i) => (
                      <li key={i} className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                        <CheckSquare className="w-3 h-3" /> {name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.already_existed.length > 0 && (
                <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">{result.already_existed.length} ya existían</span>
                  </div>
                  <ul className="space-y-1">
                    {result.already_existed.map((name, i) => (
                      <li key={i} className="text-xs text-blue-600 dark:text-blue-400">{name}</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.skipped.length > 0 && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">{result.skipped.length} omitido(s)</span>
                  </div>
                  <ul className="space-y-1">
                    {result.skipped.map((name, i) => (
                      <li key={i} className="text-xs text-amber-600 dark:text-amber-400">{name}</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.errors.length > 0 && (
                <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span className="text-sm font-semibold text-red-700 dark:text-red-400">{result.errors.length} error(es)</span>
                  </div>
                  <ul className="space-y-1">
                    {result.errors.map((msg, i) => (
                      <li key={i} className="text-xs text-red-600 dark:text-red-400">{msg}</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.created.length === 0 && result.errors.length === 0 && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400">No se crearon asistentes nuevos. Todos los formularios activos ya tienen asistente vinculado.</p>
                </div>
              )}
            </div>
          )}

          {/* Preview */}
          {!result && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{activeForms.length}</p>
                  <p className="text-[11px] text-gray-500">Formularios activos</p>
                </div>
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10 p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-600">{pendingForms.length}</p>
                  <p className="text-[11px] text-gray-500">Se crearán</p>
                </div>
                <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 p-3 text-center">
                  <p className="text-2xl font-bold text-blue-600">{alreadyLinked.length}</p>
                  <p className="text-[11px] text-gray-500">Ya existentes</p>
                </div>
              </div>

              {pendingForms.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Asistentes que se crearán:</p>
                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden max-h-48 overflow-y-auto">
                    {pendingForms.map(f => (
                      <div key={f.id} className="flex items-center gap-3 px-3 py-2.5">
                        <ArrowRight className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">Asistente {f.title}</p>
                          <p className="text-[10px] text-gray-400">{f.category} — {f.form_type}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {alreadyLinked.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
                    <Info className="w-3 h-3" /> Formularios que ya tienen asistente (se omitirán):
                  </p>
                  <div className="rounded-xl border border-gray-100 dark:border-gray-800 divide-y divide-gray-50 dark:divide-gray-800/50 overflow-hidden max-h-36 overflow-y-auto">
                    {alreadyLinked.map(f => (
                      <div key={f.id} className="flex items-center gap-3 px-3 py-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{f.title}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pendingForms.length === 0 && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-6 text-center">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Todos los formularios activos ya tienen asistente vinculado.</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            {result ? 'Cerrar' : 'Cancelar'}
          </button>
          {!result && pendingForms.length > 0 && (
            <button
              onClick={onGenerate}
              disabled={generating}
              className="flex items-center gap-2 px-5 py-2 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50 transition-colors"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {generating ? 'Generando...' : `Generar ${pendingForms.length} asistente(s)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Assistant Form ───────────────────────────────────────────────────────────

function AssistantForm({ form, isEditing, oficinas, quoteTemplates, saving, activeSection, setActiveSection, onChange, onSave, onCancel }: {
  form: typeof BLANK_ASSISTANT;
  isEditing: boolean;
  oficinas: Oficina[];
  quoteTemplates: QuoteTemplate[];
  saving: boolean;
  activeSection: 'info' | 'messages';
  setActiveSection: (s: 'info' | 'messages') => void;
  onChange: (field: string, value: unknown) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-base font-bold text-gray-900 dark:text-white">
          {isEditing ? 'Editar asistente' : 'Nuevo asistente'}
        </h2>
        <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
        {(['info', 'messages'] as const).map(s => (
          <button
            key={s}
            onClick={() => setActiveSection(s)}
            className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${
              activeSection === s
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {s === 'info' ? 'Configuración' : 'Mensajes'}
          </button>
        ))}
      </div>

      {activeSection === 'info' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Nombre <span className="text-red-500">*</span>
              </label>
              <input type="text" value={form.nombre} onChange={e => onChange('nombre', e.target.value)}
                placeholder="Ej: Asistente Cotización Autos" className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Descripción</label>
              <textarea value={form.descripcion} onChange={e => onChange('descripcion', e.target.value)}
                placeholder="Propósito de este asistente..." rows={2}
                className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Tipo</label>
              <select value={form.source} onChange={e => onChange('source', e.target.value)} className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white">
                <option value="manual">Manual</option>
                <option value="form">Basado en formulario</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Modelo IA</label>
              <select value={form.model} onChange={e => onChange('model', e.target.value)} className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white">
                <option value="gpt-4o-mini">GPT-4o mini (rápido)</option>
                <option value="gpt-4o">GPT-4o (preciso)</option>
              </select>
            </div>
            {form.source === 'form' && (
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Formulario vinculado</label>
                <select value={form.quote_form_template_id || ''} onChange={e => onChange('quote_form_template_id', e.target.value || null)} className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white">
                  <option value="">— Seleccionar —</option>
                  {quoteTemplates.filter(t => t.is_active).map(t => (
                    <option key={t.id} value={t.id}>{t.title} ({t.category})</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Oficina</label>
              <select value={form.office_id || ''} onChange={e => onChange('office_id', e.target.value || null)} className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white" disabled={form.is_global}>
                <option value="">— Todas las oficinas —</option>
                {oficinas.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
              </select>
            </div>
            <div className="flex items-end gap-6 pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => onChange('is_active', e.target.checked)} className="w-4 h-4 rounded" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Activo</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_global} onChange={e => { onChange('is_global', e.target.checked); if (e.target.checked) onChange('office_id', null); }} className="w-4 h-4 rounded" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Global</span>
              </label>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-teal-50 dark:bg-teal-900/10 border border-teal-200 dark:border-teal-800 space-y-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-teal-600" />
              <span className="text-xs font-semibold text-teal-700 dark:text-teal-400">Creación automática de trámite</span>
              <label className="ml-auto flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.auto_create_tramite} onChange={e => onChange('auto_create_tramite', e.target.checked)} className="w-4 h-4 rounded" />
                <span className="text-xs text-teal-700 dark:text-teal-400">Activado</span>
              </label>
            </div>
            {form.auto_create_tramite && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Tipo de trámite</label>
                  <select value={form.tramite_tipo} onChange={e => onChange('tramite_tipo', e.target.value)} className="w-full text-sm rounded-lg border border-teal-200 dark:border-teal-700 bg-white dark:bg-gray-800 px-3 py-1.5">
                    {TRAMITE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Prioridad</label>
                  <select value={form.tramite_prioridad} onChange={e => onChange('tramite_prioridad', e.target.value)} className="w-full text-sm rounded-lg border border-teal-200 dark:border-teal-700 bg-white dark:bg-gray-800 px-3 py-1.5">
                    <option>Alta</option><option>Media</option><option>Baja</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Instrucciones IA (system prompt)</label>
            <textarea value={form.system_prompt} onChange={e => onChange('system_prompt', e.target.value)}
              placeholder="Ej: Eres un asistente de seguros de gastos médicos. Sé amable y conciso." rows={4}
              className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-emerald-500" />
          </div>
        </div>
      )}

      {activeSection === 'messages' && (
        <div className="space-y-4">
          {[
            { key: 'welcome_message', label: 'Bienvenida', hint: 'Primer mensaje que recibe el contacto' },
            { key: 'consent_message', label: 'Consentimiento', hint: 'Se envía antes de capturar datos (deja vacío para omitir)' },
            { key: 'completion_message', label: 'Finalización', hint: 'Al completar y crear el trámite' },
            { key: 'transfer_message', label: 'Transferencia', hint: 'Al pasar a agente humano' },
          ].map(({ key, label, hint }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-0.5">{label}</label>
              <p className="text-[11px] text-gray-400 mb-1.5">{hint}</p>
              <textarea
                value={(form as Record<string, unknown>)[key] as string}
                onChange={e => onChange(key, e.target.value)}
                rows={3}
                className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 mt-8 pt-5 border-t border-gray-200 dark:border-gray-700">
        <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          Cancelar
        </button>
        <button onClick={onSave} disabled={saving || !form.nombre.trim()}
          className="flex items-center gap-2 px-5 py-2 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50 transition-colors">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isEditing ? 'Guardar cambios' : 'Crear asistente'}
        </button>
      </div>
    </div>
  );
}

// ─── Assistant Detail ─────────────────────────────────────────────────────────

function AssistantDetail({
  assistant, fields, loadingFields, editingField, savingField, importingFromForm,
  syncingOne, showSyncLog, canEdit, quoteTemplates,
  onEdit, onDelete, onToggleActive, onAddField, onEditField, onDeleteField,
  onSaveField, onCancelField, onImportFromForm, onSyncWithForm, setEditingField, setShowSyncLog
}: {
  assistant: CcAssistant;
  fields: CcField[];
  loadingFields: boolean;
  editingField: Partial<CcField> | null;
  savingField: boolean;
  importingFromForm: boolean;
  syncingOne: boolean;
  showSyncLog: boolean;
  canEdit: boolean;
  quoteTemplates: QuoteTemplate[];
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  onAddField: () => void;
  onEditField: (f: CcField) => void;
  onDeleteField: (id: string) => void;
  onSaveField: () => void;
  onCancelField: () => void;
  onImportFromForm: () => void;
  onSyncWithForm: () => void;
  setEditingField: (f: Partial<CcField> | null) => void;
  setShowSyncLog: (v: boolean) => void;
}) {
  const [syncLogs, setSyncLogs] = useState<Array<{ id: string; sync_type: string; fields_added: number; fields_skipped: number; created_at: string }>>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const completionRate = assistant.total_sessions > 0
    ? Math.round((assistant.completed_sessions / assistant.total_sessions) * 100)
    : 0;

  const linkedTemplate = quoteTemplates.find(t => t.id === assistant.quote_form_template_id);

  const loadSyncLogs = async () => {
    setLoadingLogs(true);
    const { data } = await supabase
      .from('contact_center_assistant_sync_logs')
      .select('id, sync_type, fields_added, fields_skipped, created_at')
      .eq('assistant_id', assistant.id)
      .order('created_at', { ascending: false })
      .limit(10);
    setSyncLogs(data || []);
    setLoadingLogs(false);
  };

  useEffect(() => {
    if (showSyncLog) loadSyncLogs();
  }, [showSyncLog, assistant.id]);

  const SYNC_TYPE_LABELS: Record<string, string> = {
    initial_generation: 'Generación inicial',
    manual_sync: 'Sincronización manual',
    sync_all: 'Sincronización masiva',
    field_added: 'Campo añadido',
    field_removed: 'Campo eliminado',
    field_changed: 'Campo modificado',
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${assistant.is_active ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
            <Bot className={`w-6 h-6 ${assistant.is_active ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">{assistant.nombre}</h2>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${assistant.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                {assistant.is_active ? 'Activo' : 'Inactivo'}
              </span>
              {assistant.source === 'form' && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  Formulario
                </span>
              )}
              {assistant.generation_origin === 'auto_generated' && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 flex items-center gap-0.5">
                  <Zap className="w-2.5 h-2.5" /> Auto
                </span>
              )}
            </div>
            {assistant.descripcion && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 max-w-sm">{assistant.descripcion}</p>}
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-1.5">
            {assistant.source === 'form' && assistant.quote_form_template_id && (
              <button
                onClick={onSyncWithForm}
                disabled={syncingOne}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-teal-200 dark:border-teal-700 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors"
                title="Sincronizar con formulario"
              >
                {syncingOne ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                Sincronizar
              </button>
            )}
            <button onClick={onToggleActive} className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors ${assistant.is_active ? 'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-900/20'}`}>
              {assistant.is_active ? 'Desactivar' : 'Activar'}
            </button>
            <button onClick={onEdit} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={onDelete} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Form linkage banner */}
      {assistant.source === 'form' && linkedTemplate && (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10">
          <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Vinculado a: {linkedTemplate.title}</p>
            <p className="text-[11px] text-blue-500">{linkedTemplate.category} — {linkedTemplate.form_type}</p>
          </div>
          {assistant.last_synced_at && (
            <p className="text-[10px] text-blue-400 flex-shrink-0">
              Sincronizado: {new Date(assistant.last_synced_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
            </p>
          )}
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Sesiones', value: assistant.total_sessions || 0, icon: MessageCircle, color: 'text-teal-600' },
          { label: 'Completadas', value: assistant.completed_sessions || 0, icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'Transferidas', value: assistant.transferred_sessions || 0, icon: AlertCircle, color: 'text-amber-600' },
        ].map(m => (
          <div key={m.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
            <m.icon className={`w-5 h-5 mx-auto mb-1.5 ${m.color}`} />
            <p className="text-xl font-bold text-gray-900 dark:text-white">{m.value}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">{m.label}</p>
          </div>
        ))}
      </div>

      {assistant.total_sessions > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Tasa de finalización</span>
            <span className="text-xs font-bold text-emerald-600">{completionRate}%</span>
          </div>
          <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${completionRate}%` }} />
          </div>
        </div>
      )}

      {/* Info grid */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-gray-400 uppercase text-[10px]">Modelo</p>
          <p className="text-gray-800 dark:text-gray-200 font-medium mt-0.5">{assistant.model}</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase text-[10px]">Alcance</p>
          <p className="text-gray-800 dark:text-gray-200 font-medium mt-0.5 flex items-center gap-1">
            {assistant.is_global ? <><Globe className="w-3 h-3 text-blue-500" /> Global</> : <><Lock className="w-3 h-3 text-gray-400" /> {assistant.office_name || 'Por oficina'}</>}
          </p>
        </div>
        <div>
          <p className="text-gray-400 uppercase text-[10px]">Trámite</p>
          <p className={`font-medium mt-0.5 ${assistant.auto_create_tramite ? 'text-emerald-600' : 'text-gray-500'}`}>
            {assistant.auto_create_tramite ? `${TRAMITE_TYPES.find(t => t.value === assistant.tramite_tipo)?.label || assistant.tramite_tipo} — ${assistant.tramite_prioridad}` : 'Sin creación automática'}
          </p>
        </div>
        <div>
          <p className="text-gray-400 uppercase text-[10px]">Documentos</p>
          <p className={`font-medium mt-0.5 ${assistant.has_documents ? 'text-amber-600' : 'text-gray-400'}`}>
            {assistant.has_documents ? 'Requiere documentos' : 'Sin documentos'}
          </p>
        </div>
        <div>
          <p className="text-gray-400 uppercase text-[10px]">Origen</p>
          <p className="text-gray-800 dark:text-gray-200 font-medium mt-0.5 flex items-center gap-1">
            {assistant.generation_origin === 'auto_generated' ? <><Zap className="w-3 h-3 text-amber-500" /> Generado auto.</> : 'Manual'}
          </p>
        </div>
        <div>
          <p className="text-gray-400 uppercase text-[10px]">Creado</p>
          <p className="text-gray-800 dark:text-gray-200 font-medium mt-0.5">
            {new Date(assistant.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Fields */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-teal-600" />
            Campos a capturar ({fields.length})
          </h3>
          {canEdit && (
            <div className="flex items-center gap-2">
              {assistant.quote_form_template_id && (
                <button
                  onClick={onImportFromForm}
                  disabled={importingFromForm}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors border border-blue-200 dark:border-blue-800"
                >
                  {importingFromForm ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                  Importar
                </button>
              )}
              <button
                onClick={onAddField}
                className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 hover:bg-teal-100 transition-colors border border-teal-200 dark:border-teal-800"
              >
                <Plus className="w-3 h-3" /> Campo
              </button>
            </div>
          )}
        </div>

        {loadingFields ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-teal-500" /></div>
        ) : fields.length === 0 && !editingField ? (
          <div className="py-8 text-center text-sm text-gray-400">
            <p>Sin campos configurados.</p>
            {canEdit && assistant.quote_form_template_id && (
              <button onClick={onImportFromForm} className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 mx-auto">
                <Download className="w-3 h-3" /> Importar del formulario vinculado
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {fields.map((f, idx) => (
              editingField?.id === f.id ? (
                <FieldForm key={f.id} field={editingField} onChange={v => setEditingField(v)} onSave={onSaveField} onCancel={onCancelField} saving={savingField} />
              ) : (
                <div key={f.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 group">
                  <span className="w-5 h-5 rounded-md bg-gray-100 dark:bg-gray-800 text-[10px] font-bold text-gray-500 flex items-center justify-center flex-shrink-0">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{f.label}</span>
                      {f.is_required && <span className="text-[10px] text-red-500">*oblig.</span>}
                      <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                        {FIELD_TYPES.find(t => t.value === f.field_type)?.label || f.field_type}
                      </span>
                      {f.is_document && <span className="text-[10px] text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">doc</span>}
                      {f.manually_edited && <span className="text-[10px] text-teal-500 bg-teal-50 dark:bg-teal-900/20 px-1.5 py-0.5 rounded">editado</span>}
                    </div>
                    {f.prompt_text && <p className="text-[11px] text-gray-400 truncate mt-0.5">{f.prompt_text}</p>}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => onEditField(f)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => onDeleteField(f.id)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )
            ))}
            {editingField && !editingField.id && (
              <FieldForm field={editingField} onChange={v => setEditingField(v)} onSave={onSaveField} onCancel={onCancelField} saving={savingField} />
            )}
          </div>
        )}
      </div>

      {/* Sync history */}
      {assistant.source === 'form' && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button
            onClick={() => setShowSyncLog(!showSyncLog)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50"
          >
            <span className="flex items-center gap-2">
              <History className="w-4 h-4 text-gray-400" />
              Historial de sincronización
            </span>
            {showSyncLog ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          {showSyncLog && (
            <div className="border-t border-gray-100 dark:border-gray-800">
              {loadingLogs ? (
                <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>
              ) : syncLogs.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">Sin historial de sincronización</p>
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-gray-800">
                  {syncLogs.map(log => (
                    <div key={log.id} className="flex items-center gap-3 px-4 py-2.5">
                      <RefreshCw className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{SYNC_TYPE_LABELS[log.sync_type] || log.sync_type}</p>
                        <p className="text-[10px] text-gray-400">
                          {log.fields_added > 0 ? `+${log.fields_added} campos` : ''}{log.fields_skipped > 0 ? ` · ${log.fields_skipped} preservados` : ''}
                        </p>
                      </div>
                      <p className="text-[10px] text-gray-400 flex-shrink-0">
                        {new Date(log.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Field Form (inline) ──────────────────────────────────────────────────────

function FieldForm({ field, onChange, onSave, onCancel, saving }: {
  field: Partial<CcField>;
  onChange: (f: Partial<CcField>) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="px-4 py-4 bg-teal-50 dark:bg-teal-900/10 border-b border-teal-100 dark:border-teal-900 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">Clave única</label>
          <input type="text" value={field.field_key || ''}
            onChange={e => onChange({ ...field, field_key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
            placeholder="nombre_completo"
            className="w-full text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-gray-900 dark:text-white focus:ring-1 focus:ring-teal-500" />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">Etiqueta</label>
          <input type="text" value={field.label || ''}
            onChange={e => onChange({ ...field, label: e.target.value })}
            placeholder="Nombre completo"
            className="w-full text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-gray-900 dark:text-white focus:ring-1 focus:ring-teal-500" />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">Tipo</label>
          <select value={field.field_type || 'text'} onChange={e => onChange({ ...field, field_type: e.target.value })} className="w-full text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-gray-900 dark:text-white">
            {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={field.is_required !== false} onChange={e => onChange({ ...field, is_required: e.target.checked })} className="w-3.5 h-3.5 rounded border-gray-300 text-teal-600" />
            <span className="text-xs text-gray-700 dark:text-gray-300">Obligatorio</span>
          </label>
        </div>
        <div className="col-span-2">
          <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">Pregunta al contacto</label>
          <input type="text" value={field.prompt_text || ''}
            onChange={e => onChange({ ...field, prompt_text: e.target.value })}
            placeholder="¿Cuál es tu nombre completo?"
            className="w-full text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-gray-900 dark:text-white focus:ring-1 focus:ring-teal-500" />
        </div>
        {(field.field_type === 'select') && (
          <div className="col-span-2">
            <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">Opciones (una por línea)</label>
            <textarea
              value={((field.options || []) as string[]).join('\n')}
              onChange={e => onChange({ ...field, options: e.target.value.split('\n').filter(Boolean) })}
              placeholder="Opción 1&#10;Opción 2&#10;Opción 3"
              rows={3}
              className="w-full text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-gray-900 dark:text-white resize-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
        )}
        {field.field_type === 'file' && (
          <div className="col-span-2">
            <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">Mensaje de confirmación de recepción</label>
            <input type="text" value={field.confirmation_message || ''}
              onChange={e => onChange({ ...field, confirmation_message: e.target.value })}
              placeholder="Documento recibido correctamente."
              className="w-full text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-gray-900 dark:text-white focus:ring-1 focus:ring-teal-500" />
          </div>
        )}
      </div>
      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          Cancelar
        </button>
        <button onClick={onSave} disabled={saving || !field.field_key || !field.label}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-teal-600 hover:bg-teal-700 text-white font-medium disabled:opacity-50 transition-colors">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Guardar
        </button>
      </div>
    </div>
  );
}
