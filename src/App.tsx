import { useState } from 'react';
import './index.css';
import { LoadingProvider } from './contexts/LoadingContext';
import { LoadingOverlay } from './components/loading/LoadingOverlay';
import { AppLayout } from './components/layout/AppLayout';
import { SmartAnalysisCard } from './components/dashboard/SmartAnalysisCard';
import { ChavaAvatar } from './components/chava/ChavaAvatar';
import { ChavaBrandLogo } from './components/chava/ChavaBrandLogo';
import { ChavaOrbIcon } from './components/chava/ChavaOrbIcon';
import { useLoading } from './contexts/LoadingContext';

function DashboardPage({ onChavaOpen }: { onChavaOpen: () => void }) {
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-bold">Dashboard</h1>
          <p className="text-surface-400 text-sm mt-0.5">Buenos días, Juan. Tienes 3 renovaciones pendientes.</p>
        </div>
        <div className="flex items-center gap-2 bg-surface-900 rounded-xl px-3 py-2 border border-surface-800">
          <ChavaOrbIcon size="sm" animate />
          <div className="text-left">
            <p className="text-white text-xs font-semibold">Chava AI</p>
            <p className="text-surface-500 text-xs">En línea</p>
          </div>
        </div>
      </div>

      {/* Smart Analysis Card — uses ChavaAvatar with new animated orb */}
      <SmartAnalysisCard onStartAnalysis={onChavaOpen} />

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Clientes activos', value: '342', change: '+12' },
          { label: 'Pólizas vigentes', value: '891', change: '+5' },
          { label: 'Renovaciones mes', value: '43', change: '-2' },
          { label: 'Comisión mensual', value: '$48,200', change: '+8%' },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface-900 border border-surface-800 rounded-xl p-4">
            <p className="text-surface-500 text-xs mb-1">{stat.label}</p>
            <p className="text-white text-xl font-bold">{stat.value}</p>
            <p className="text-emerald-400 text-xs mt-0.5">{stat.change} este mes</p>
          </div>
        ))}
      </div>

      {/* Chat preview — shows ChavaAvatar in chat */}
      <div className="bg-surface-900 border border-surface-800 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <ChavaAvatar size="md" animate online />
          <div>
            <p className="text-white font-semibold text-sm">Chava AI</p>
            <p className="text-emerald-400 text-xs">En línea ahora</p>
          </div>
        </div>
        <div className="bg-surface-800/60 rounded-xl p-4 border border-surface-700/50">
          <p className="text-surface-300 text-sm leading-relaxed">
            Hola Juan! Detecté que 23 pólizas vencen en los próximos 30 días. ¿Quieres que prepare un reporte de renovaciones prioritarias?
          </p>
        </div>
        <button
          onClick={onChavaOpen}
          className="mt-3 w-full text-center text-sm text-brand-400 hover:text-brand-300 transition-colors py-2 border border-surface-800 rounded-lg hover:bg-surface-800"
        >
          Responder a Chava...
        </button>
      </div>

      {/* Brand logo showcase */}
      <div className="bg-surface-900 border border-surface-800 rounded-2xl p-5">
        <p className="text-surface-500 text-xs mb-4 uppercase tracking-wider font-medium">Logo / Marca</p>
        <div className="flex flex-wrap gap-6 items-center">
          <ChavaBrandLogo size="sm" showTagline />
          <ChavaBrandLogo size="md" showTagline />
          <ChavaBrandLogo size="lg" showTagline />
        </div>
      </div>
    </div>
  );
}

function LoadingDemo() {
  const { show, hide } = useLoading();
  return (
    <div className="flex gap-3">
      <button
        onClick={() => { show(); setTimeout(hide, 3000); }}
        className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition-colors"
      >
        Simular carga (3s)
      </button>
    </div>
  );
}

function App() {
  const [chavaOpen, setChavaOpen] = useState(false);

  return (
    <LoadingProvider>
      <LoadingOverlay />
      <AppLayout currentPath="/dashboard" onChavaClick={() => setChavaOpen(true)}>
        <DashboardPage onChavaOpen={() => setChavaOpen(true)} />
        <div className="px-6 pb-4">
          <LoadingDemo />
        </div>
      </AppLayout>

      {/* Simple Chava AI modal placeholder */}
      {chavaOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setChavaOpen(false)}
        >
          <div
            className="bg-surface-900 border border-surface-700 rounded-2xl p-8 max-w-sm w-full mx-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <ChavaOrbIcon size="xl" animate className="mx-auto mb-4" />
            <h2 className="text-white font-bold text-xl mb-2">Chava AI</h2>
            <p className="text-surface-400 text-sm mb-6">Tu asistente inteligente para seguros</p>
            <button
              onClick={() => setChavaOpen(false)}
              className="px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </LoadingProvider>
  );
}

export default App;
