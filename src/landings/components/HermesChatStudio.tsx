import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  RotateCw,
  Rocket,
  CheckCircle2,
  Laptop,
  Tablet,
  Smartphone,
  ExternalLink,
  Layers,
  Bot,
  User,
  Maximize2
} from 'lucide-react';
import type { UnifiedLanding, HermesChatMessage } from '../types';
import { hermesLandingService } from '../hermesLandingService';
import MutuusLanding from '../mutuus/MutuusLanding';
import SegurosExpressLanding from '../../seguros-express/SegurosExpressLanding';
import SegurosEducationLanding from '../../seguros-education/SegurosEducationLanding';
import ChavaAgenteLanding from '../../chava-agente/pages/ChavaAgenteLanding';
import { BlockRenderer } from '../blocks/BlockRenderer';

interface HermesChatStudioProps {
  landing: UnifiedLanding;
  onUpdateLanding: (landing: UnifiedLanding) => void;
  onDeploy: () => void;
  onBackToList: () => void;
}

export function HermesChatStudio({
  landing,
  onUpdateLanding,
  onDeploy,
  onBackToList
}: HermesChatStudioProps) {
  const [messages, setMessages] = useState<HermesChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStep, setGeneratingStep] = useState('');
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [viewMode, setViewMode] = useState<'split' | 'chat' | 'preview'>('split');
  const [previewKey, setPreviewKey] = useState(1);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    hermesLandingService.getChats(landing.id).then((msgs) => {
      setMessages(msgs);
    });
  }, [landing.id]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  const handleSendMessage = async (customText?: string) => {
    const text = (customText || inputPrompt).trim();
    if (!text || isGenerating) return;

    const userMsg: HermesChatMessage = {
      id: Date.now().toString(),
      project_id: landing.id,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    hermesLandingService.saveMessage(landing.id, userMsg);
    setInputPrompt('');
    setIsGenerating(true);

    setGeneratingStep('Analizando arquitectura de diseño y layout...');
    await new Promise((r) => setTimeout(r, 400));

    setGeneratingStep('Procesando modificaciones con Hermes AI Copilot...');
    await new Promise((r) => setTimeout(r, 550));

    const result = await hermesLandingService.processDesignInstruction(
      landing.id,
      text,
      landing.designOverrides || {}
    );

    setGeneratingStep('Inyectando cambios en el canvas en tiempo real...');
    await new Promise((r) => setTimeout(r, 350));

    const updatedLanding: UnifiedLanding = {
      ...landing,
      status: 'modified',
      lastUpdated: 'Modificado recién',
      designOverrides: {
        ...(landing.designOverrides || {}),
        ...result.designPatch
      }
    };

    onUpdateLanding(updatedLanding);

    const hermesMsg: HermesChatMessage = {
      id: (Date.now() + 1).toString(),
      project_id: landing.id,
      sender: 'hermes',
      text: result.replyText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actions: result.actions,
      diffPreview: result.diffPreview,
      designPatch: result.designPatch
    };

    setMessages((prev) => [...prev, hermesMsg]);
    hermesLandingService.saveMessage(landing.id, hermesMsg);

    setIsGenerating(false);
    setGeneratingStep('');
    setPreviewKey((k) => k + 1);
  };

  const renderLiveComponent = () => {
    if (landing.customComponent === 'mutuus' || landing.id === 'mutuus') {
      return <MutuusLanding key={previewKey} designOverrides={landing.designOverrides} />;
    }
    if (landing.customComponent === 'seguros-express' || landing.id === 'seguros-express') {
      return <SegurosExpressLanding key={previewKey} />;
    }
    if (landing.customComponent === 'seguros-education' || landing.id === 'seguros-education') {
      return <SegurosEducationLanding key={previewKey} />;
    }
    if (landing.customComponent === 'chava-agente' || landing.id === 'chava-agente') {
      return <ChavaAgenteLanding key={previewKey} />;
    }
    return <BlockRenderer blocks={landing.blocks} landing={landing} key={previewKey} />;
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-100">
      
      {/* Top Header */}
      <header className="h-14 bg-white border-b border-gray-200 px-4 flex items-center justify-between z-20 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToList}
            className="text-xs font-bold text-gray-500 hover:text-gray-900 cursor-pointer"
          >
            ← Directorio
          </button>
          <div className="h-4 w-[1px] bg-gray-200" />
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm text-gray-900">{landing.name}</span>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
              Crick IA Engine
            </span>
          </div>
        </div>

        {/* View & Device Selector */}
        <div className="flex items-center gap-2.5">
          <div className="bg-gray-100 p-1 rounded-xl flex items-center gap-1 border border-gray-200">
            <button
              onClick={() => setViewMode('split')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${viewMode === 'split' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500'}`}
            >
              Split
            </button>
            <button
              onClick={() => setViewMode('chat')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${viewMode === 'chat' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500'}`}
            >
              Chat
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${viewMode === 'preview' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500'}`}
            >
              Canvas
            </button>
          </div>

          {viewMode !== 'chat' && (
            <div className="bg-gray-100 p-1 rounded-xl flex items-center gap-1 border border-gray-200">
              <button
                onClick={() => setDevice('desktop')}
                className={`p-1.5 rounded-lg text-xs ${device === 'desktop' ? 'bg-white text-[#F97316] shadow-xs' : 'text-gray-500'}`}
              >
                <Laptop className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setDevice('tablet')}
                className={`p-1.5 rounded-lg text-xs ${device === 'tablet' ? 'bg-white text-[#F97316] shadow-xs' : 'text-gray-500'}`}
              >
                <Tablet className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setDevice('mobile')}
                className={`p-1.5 rounded-lg text-xs ${device === 'mobile' ? 'bg-white text-[#F97316] shadow-xs' : 'text-gray-500'}`}
              >
                <Smartphone className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button
            onClick={onDeploy}
            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#F97316] to-[#7E3AF2] text-white font-bold text-xs shadow-md active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Rocket className="w-3.5 h-3.5" />
            <span>Publicar</span>
          </button>
        </div>
      </header>

      {/* Main Area */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        
        {/* Left Chat Pane */}
        {(viewMode === 'split' || viewMode === 'chat') && (
          <div className={`flex flex-col h-full min-h-0 bg-white border-r border-gray-200 ${viewMode === 'chat' ? 'w-full' : 'w-full lg:w-[480px] xl:w-[500px]'}`}>
            
            {/* Header info */}
            <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#F97316] to-[#7E3AF2] text-white flex items-center justify-center font-bold text-xs">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900">Hermes Copilot Designer</p>
                  <p className="text-[10px] text-gray-500">Conectado a {landing.slug}</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                Live Sync
              </span>
            </div>

            {/* Messages */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-[#FAFAFA]">
              {messages.map((m) => (
                <div key={m.id} className={`flex gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.sender === 'hermes' && (
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#F97316] to-[#7E3AF2] text-white flex items-center justify-center flex-shrink-0 mt-0.5 text-xs shadow-xs">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div
                    className={`max-w-[88%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                      m.sender === 'user'
                        ? 'bg-gradient-to-r from-[#F97316] to-[#7E3AF2] text-white shadow-xs rounded-tr-xs'
                        : 'bg-white border border-gray-200 text-gray-800 shadow-xs rounded-tl-xs'
                    }`}
                  >
                    <div className="whitespace-pre-line space-y-1.5">{m.text}</div>

                    {m.diffPreview && (
                      <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="font-semibold text-[11px] truncate">{m.diffPreview.details}</span>
                        </div>
                      </div>
                    )}

                    {m.actions && m.actions.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-100 flex flex-wrap gap-1">
                        {m.actions.map((act, i) => (
                          <button
                            key={i}
                            onClick={() => handleSendMessage(act)}
                            className="px-2 py-0.5 rounded-full bg-gray-100 hover:bg-orange-50 hover:text-[#F97316] text-gray-700 text-[10px] font-medium transition cursor-pointer text-left"
                          >
                            ⚡ {act}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {m.sender === 'user' && (
                    <div className="w-7 h-7 rounded-lg bg-gray-800 text-white flex items-center justify-center flex-shrink-0 mt-0.5 text-xs">
                      <User className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              ))}

              {isGenerating && (
                <div className="flex items-center gap-2.5 bg-white p-3 rounded-2xl border border-orange-200 shadow-xs max-w-sm">
                  <div className="w-5 h-5 rounded-lg bg-orange-100 text-[#F97316] flex items-center justify-center animate-spin">
                    <RotateCw className="w-3 h-3" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900">Hermes AI</p>
                    <p className="text-[11px] text-[#F97316]">{generatingStep}</p>
                  </div>
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>

            {/* Quick Pills */}
            <div className="px-3 py-1.5 border-t border-gray-100 bg-white flex items-center gap-1.5 overflow-x-auto text-[10px] flex-shrink-0">
              <span className="text-gray-400 font-bold flex-shrink-0">Sugerencias:</span>
              <button
                onClick={() => handleSendMessage("Rediseñar Hero con badge de Cero Deducible y CTA llamativo")}
                className="px-2 py-0.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 whitespace-nowrap cursor-pointer"
              >
                🎨 Rediseñar Hero
              </button>
              <button
                onClick={() => handleSendMessage("Ajustar precios a $1,199 mensual con 10% de ahorro anual")}
                className="px-2 py-0.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 whitespace-nowrap cursor-pointer"
              >
                💳 Precios
              </button>
              <button
                onClick={() => handleSendMessage("Actualizar listado de hospitales y convenios de pago directo")}
                className="px-2 py-0.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 whitespace-nowrap cursor-pointer"
              >
                🏥 Hospitales
              </button>
            </div>

            {/* Chat Input */}
            <div className="p-3 bg-white border-t border-gray-200 flex-shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputPrompt}
                  onChange={(e) => setInputPrompt(e.target.value)}
                  placeholder={`Indica un cambio de diseño para ${landing.name}...`}
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:bg-white"
                  disabled={isGenerating}
                />
                <button
                  type="submit"
                  disabled={!inputPrompt.trim() || isGenerating}
                  className="p-2.5 rounded-xl bg-gradient-to-r from-[#F97316] to-[#7E3AF2] text-white font-bold transition shadow-sm active:scale-95 disabled:opacity-40 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>

          </div>
        )}

        {/* Right Canvas */}
        {(viewMode === 'split' || viewMode === 'preview') && (
          <div className="flex-1 min-h-0 bg-gray-100 flex flex-col overflow-hidden p-4 items-center justify-center relative">
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
                {renderLiveComponent()}
              </div>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
