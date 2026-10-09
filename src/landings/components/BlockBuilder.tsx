import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Layers,
  Sparkles,
  Type,
  LayoutGrid,
  Zap,
  Mail,
  HelpCircle,
  Star,
  Image,
  Code2,
  X,
  Laptop,
  Tablet,
  Smartphone,
  Eye,
  Settings,
  Rocket,
  CheckCircle2
} from 'lucide-react';
import type { UnifiedLanding, Block, BlockType } from '../types';
import { BlockRenderer } from '../blocks/BlockRenderer';

interface BlockBuilderProps {
  landing: UnifiedLanding;
  onUpdateBlocks: (blocks: Block[]) => void;
  onDeploy: () => void;
  onBackToList: () => void;
}

const BLOCK_DEFINITIONS: { type: BlockType; label: string; desc: string; icon: React.ElementType; color: string }[] = [
  { type: 'hero', label: 'Hero Principal', desc: 'Encabezado con título, subtítulo, badges y botón CTA', icon: Sparkles, color: '#F97316' },
  { type: 'feature_grid', label: 'Grid de Beneficios', desc: 'Tarjetas con iconos, títulos y descripciones', icon: LayoutGrid, color: '#7E3AF2' },
  { type: 'text_section', label: 'Sección de Texto', desc: 'Texto enriquecido con formato y alineación', icon: Type, color: '#2563EB' },
  { type: 'cta', label: 'Llamada a la Acción (CTA)', desc: 'Banner de alto impacto con botón principal', icon: Zap, color: '#E11D48' },
  { type: 'contact_form', label: 'Formulario de Contacto', desc: 'Captura de prospectos con campos personalizables', icon: Mail, color: '#10B981' },
  { type: 'faq', label: 'Preguntas Frecuentes', desc: 'Acordeón interactivo optimizado para SEO', icon: HelpCircle, color: '#F59E0B' },
  { type: 'testimonials', label: 'Testimonios & Reseñas', desc: 'Comentarios de clientes con calificación de estrellas', icon: Star, color: '#8B5CF6' },
  { type: 'image_text', label: 'Imagen con Texto', desc: 'Distribución en 2 columnas con imagen destacada', icon: Image, color: '#06B6D4' },
];

export function BlockBuilder({ landing, onUpdateBlocks, onDeploy, onBackToList }: BlockBuilderProps) {
  const [selectedBlockIdx, setSelectedBlockIdx] = useState<number>(0);
  const [showLibrary, setShowLibrary] = useState(false);
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [activeTab, setActiveTab] = useState<'editor' | 'canvas'>('editor');

  const blocks = landing.blocks || [];
  const selectedBlock = blocks[selectedBlockIdx];

  const handleAddBlock = (type: BlockType) => {
    let newBlockData: any = {};
    if (type === 'hero') {
      newBlockData = {
        eyebrow: 'Nueva Oferta Exclusiva',
        title: 'Impulsa tu Crecimiento Digital',
        subtitle: 'Soluciones integrales diseñadas para maximizar tus resultados.',
        primaryButtonText: 'Comenzar Ahora',
        primaryButtonUrl: '#contacto',
        align: 'center'
      };
    } else if (type === 'feature_grid') {
      newBlockData = {
        eyebrow: 'Beneficios',
        title: 'Por qué elegirnos',
        subtitle: 'Ventajas competitivas diseñadas a tu medida',
        columns: 3,
        items: [
          { title: 'Atención 24/7', description: 'Soporte continuo y respuesta inmediata.' },
          { title: 'Trámite Digital', description: 'Sin papeleos innecesarios ni demoras.' },
          { title: 'Máxima Cobertura', description: 'Respaldo garantizado a nivel nacional.' }
        ]
      };
    } else if (type === 'cta') {
      newBlockData = {
        eyebrow: 'Garantía Total',
        title: 'Comienza a proteger tu patrimonio hoy',
        subtitle: 'Un asesor especializado te brindará una propuesta personalizada.',
        buttonText: 'Solicitar Asesoría',
        buttonUrl: '#contacto',
        background: 'brand'
      };
    } else if (type === 'faq') {
      newBlockData = {
        eyebrow: 'Resolvemos tus Dudas',
        title: 'Preguntas Frecuentes',
        items: [
          { question: '¿Cómo funciona el proceso de contratación?', answer: 'El proceso es 100% digital en menos de 24 horas.' },
          { question: '¿Cuáles son las formas de pago disponibles?', answer: 'Aceptamos transferencias, tarjetas y domiciliación mensual o anual.' }
        ]
      };
    } else if (type === 'contact_form') {
      newBlockData = {
        eyebrow: 'Cotización Inmediata',
        title: 'Déjanos tus Datos',
        subtitle: 'Te responderemos en menos de 10 minutos.',
        submitButtonText: 'Enviar Solicitud',
        fields: [
          { name: 'nombre', label: 'Nombre Completo', type: 'text', placeholder: 'Tu nombre', required: true },
          { name: 'telefono', label: 'Teléfono / WhatsApp', type: 'tel', placeholder: '10 dígitos', required: true }
        ]
      };
    } else {
      newBlockData = {
        title: 'Sección Informativa',
        body: '<p>Contenido detallado para tus clientes.</p>'
      };
    }

    const newBlock: Block = {
      id: Date.now().toString(),
      type,
      data: newBlockData
    };

    const nextBlocks = [...blocks, newBlock];
    onUpdateBlocks(nextBlocks);
    setSelectedBlockIdx(nextBlocks.length - 1);
    setShowLibrary(false);
  };

  const handleUpdateBlockData = (key: string, value: any) => {
    if (!selectedBlock) return;
    const nextBlocks = [...blocks];
    nextBlocks[selectedBlockIdx] = {
      ...selectedBlock,
      data: {
        ...selectedBlock.data,
        [key]: value
      }
    };
    onUpdateBlocks(nextBlocks);
  };

  const handleDeleteBlock = (idx: number) => {
    const nextBlocks = blocks.filter((_, i) => i !== idx);
    onUpdateBlocks(nextBlocks);
    setSelectedBlockIdx(Math.max(0, idx - 1));
  };

  const handleMoveBlock = (idx: number, dir: -1 | 1) => {
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= blocks.length) return;
    const nextBlocks = [...blocks];
    const [moved] = nextBlocks.splice(idx, 1);
    nextBlocks.splice(targetIdx, 0, moved);
    onUpdateBlocks(nextBlocks);
    setSelectedBlockIdx(targetIdx);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-100">
      
      {/* Top Bar Editor */}
      <header className="h-14 bg-white border-b border-gray-200 px-4 flex items-center justify-between z-20 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToList}
            className="text-xs font-bold text-gray-500 hover:text-gray-900 cursor-pointer"
          >
            ← Directorio
          </button>
          <div className="h-4 w-[1px] bg-gray-200" />
          <span className="font-extrabold text-sm text-gray-900">{landing.name}</span>
          <span className="font-mono text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{landing.slug}</span>
        </div>

        {/* Device Controls */}
        <div className="flex items-center gap-2">
          <div className="bg-gray-100 p-1 rounded-xl flex items-center gap-1 border border-gray-200">
            <button
              onClick={() => setDevice('desktop')}
              className={`p-1.5 rounded-lg text-xs cursor-pointer ${device === 'desktop' ? 'bg-white text-[#F97316] shadow-xs' : 'text-gray-500'}`}
            >
              <Laptop className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setDevice('tablet')}
              className={`p-1.5 rounded-lg text-xs cursor-pointer ${device === 'tablet' ? 'bg-white text-[#F97316] shadow-xs' : 'text-gray-500'}`}
            >
              <Tablet className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setDevice('mobile')}
              className={`p-1.5 rounded-lg text-xs cursor-pointer ${device === 'mobile' ? 'bg-white text-[#F97316] shadow-xs' : 'text-gray-500'}`}
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={onDeploy}
            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#F97316] to-[#7E3AF2] text-white font-bold text-xs shadow-md active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Rocket className="w-3.5 h-3.5" />
            <span>Publicar</span>
          </button>
        </div>
      </header>

      {/* Editor Body: Left Inspector + Right Live Preview */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        
        {/* Left Inspector: Blocks List & Properties */}
        <div className="w-96 bg-white border-r border-gray-200 flex flex-col h-full overflow-hidden flex-shrink-0">
          
          <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
            <span className="font-extrabold text-xs text-gray-800 uppercase tracking-wider">Estructura de Bloques</span>
            <button
              onClick={() => setShowLibrary(true)}
              className="px-2.5 py-1 rounded-lg bg-[#F97316] text-white font-bold text-xs flex items-center gap-1 shadow-xs cursor-pointer hover:bg-orange-600 transition"
            >
              <Plus className="w-3 h-3" />
              <span>Agregar Bloque</span>
            </button>
          </div>

          {/* Block Cards List */}
          <div className="max-h-56 overflow-y-auto p-3 space-y-1.5 border-b border-gray-200 bg-gray-50/50">
            {blocks.map((b, idx) => {
              const isSel = idx === selectedBlockIdx;
              return (
                <div
                  key={b.id || idx}
                  onClick={() => setSelectedBlockIdx(idx)}
                  className={`p-2.5 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-all ${
                    isSel ? 'bg-white border-[#F97316] shadow-xs ring-1 ring-[#F97316]' : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-gray-400 font-bold">{idx + 1}</span>
                    <span className="font-bold text-gray-800 capitalize">{b.type.replace('_', ' ')}</span>
                  </div>

                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleMoveBlock(idx, -1)}
                      disabled={idx === 0}
                      className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20 cursor-pointer"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleMoveBlock(idx, 1)}
                      disabled={idx === blocks.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20 cursor-pointer"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteBlock(idx)}
                      className="p-1 text-gray-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Properties Editor for Selected Block */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {selectedBlock ? (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                  <span className="text-xs font-black text-gray-900 uppercase tracking-wider">
                    Editar: {selectedBlock.type}
                  </span>
                  <span className="text-[10px] font-bold text-[#F97316] bg-orange-50 px-2 py-0.5 rounded">
                    Bloque {selectedBlockIdx + 1}
                  </span>
                </div>

                {/* Common Fields */}
                {'eyebrow' in (selectedBlock.data as any) && (
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Badge Superior (Eyebrow)</label>
                    <input
                      type="text"
                      value={(selectedBlock.data as any).eyebrow || ''}
                      onChange={(e) => handleUpdateBlockData('eyebrow', e.target.value)}
                      className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                    />
                  </div>
                )}

                {'title' in (selectedBlock.data as any) && (
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Título</label>
                    <input
                      type="text"
                      value={(selectedBlock.data as any).title || ''}
                      onChange={(e) => handleUpdateBlockData('title', e.target.value)}
                      className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 font-bold focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                    />
                  </div>
                )}

                {'subtitle' in (selectedBlock.data as any) && (
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Subtítulo</label>
                    <textarea
                      rows={2}
                      value={(selectedBlock.data as any).subtitle || ''}
                      onChange={(e) => handleUpdateBlockData('subtitle', e.target.value)}
                      className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                    />
                  </div>
                )}

                {'primaryButtonText' in (selectedBlock.data as any) && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-700 mb-1">Texto Botón</label>
                      <input
                        type="text"
                        value={(selectedBlock.data as any).primaryButtonText || ''}
                        onChange={(e) => handleUpdateBlockData('primaryButtonText', e.target.value)}
                        className="w-full text-xs border border-gray-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-700 mb-1">URL Botón</label>
                      <input
                        type="text"
                        value={(selectedBlock.data as any).primaryButtonUrl || ''}
                        onChange={(e) => handleUpdateBlockData('primaryButtonUrl', e.target.value)}
                        className="w-full text-xs border border-gray-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                      />
                    </div>
                  </div>
                )}

                {'buttonText' in (selectedBlock.data as any) && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-700 mb-1">Texto Botón</label>
                      <input
                        type="text"
                        value={(selectedBlock.data as any).buttonText || ''}
                        onChange={(e) => handleUpdateBlockData('buttonText', e.target.value)}
                        className="w-full text-xs border border-gray-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-700 mb-1">URL Botón</label>
                      <input
                        type="text"
                        value={(selectedBlock.data as any).buttonUrl || ''}
                        onChange={(e) => handleUpdateBlockData('buttonUrl', e.target.value)}
                        className="w-full text-xs border border-gray-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                      />
                    </div>
                  </div>
                )}

                {'body' in (selectedBlock.data as any) && (
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Contenido (HTML)</label>
                    <textarea
                      rows={5}
                      value={(selectedBlock.data as any).body || ''}
                      onChange={(e) => handleUpdateBlockData('body', e.target.value)}
                      className="w-full font-mono text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-10 text-gray-400 text-xs">
                Selecciona un bloque para editar sus propiedades.
              </div>
            )}
          </div>
        </div>

        {/* Right Live Canvas */}
        <div className="flex-1 bg-gray-100 flex flex-col overflow-hidden p-4 items-center justify-center relative">
          <div
            className={`transition-all duration-300 bg-white shadow-2xl border border-gray-300 flex flex-col overflow-hidden ${
              device === 'desktop'
                ? 'w-full h-full rounded-2xl'
                : device === 'tablet'
                ? 'w-[768px] h-full max-h-[900px] rounded-2xl border-4 border-gray-800'
                : 'w-[390px] h-full max-h-[820px] rounded-[38px] border-8 border-gray-800'
            }`}
          >
            <div className="flex-1 overflow-y-auto">
              <BlockRenderer blocks={blocks} landing={landing} />
            </div>
          </div>
        </div>

      </div>

      {/* Block Library Drawer */}
      {showLibrary && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h3 className="font-black text-lg text-gray-900">Biblioteca de Bloques</h3>
                <p className="text-xs text-gray-500">Selecciona el componente que deseas agregar a la landing</p>
              </div>
              <button
                onClick={() => setShowLibrary(false)}
                className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {BLOCK_DEFINITIONS.map((def) => {
                const Icon = def.icon;
                return (
                  <button
                    key={def.type}
                    onClick={() => handleAddBlock(def.type)}
                    className="p-4 rounded-2xl border border-gray-200 hover:border-[#F97316] hover:bg-orange-50/30 text-left transition-all space-y-2 group cursor-pointer"
                  >
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-white shadow-xs"
                      style={{ backgroundColor: def.color }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <p className="font-bold text-xs text-gray-900 group-hover:text-[#F97316]">{def.label}</p>
                    <p className="text-[10px] text-gray-500 leading-tight">{def.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
