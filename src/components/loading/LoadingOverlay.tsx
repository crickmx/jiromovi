import { useLoading } from '../../contexts/LoadingContext';
import { LoadingOrb } from './LoadingOrb';
import { LoadingFactCard } from './LoadingFactCard';

export function LoadingOverlay() {
  const { isLoading } = useLoading();

  if (!isLoading) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-8"
      style={{ background: 'rgba(9, 15, 26, 0.96)', backdropFilter: 'blur(8px)' }}
    >
      <LoadingOrb size={120} />
      <div className="flex flex-col items-center gap-1">
        <span className="text-white font-semibold text-sm tracking-wide">Cargando</span>
        <div className="flex gap-1 mt-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-brand-400"
              style={{ animation: `lo-dot-bounce 1.2s ease-in-out infinite ${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
      <LoadingFactCard />
      <style>{`
        @keyframes lo-dot-bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
