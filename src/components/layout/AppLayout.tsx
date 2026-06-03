import { cn } from '../../lib/utils';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';

interface AppLayoutProps {
  children: React.ReactNode;
  className?: string;
  currentPath?: string;
  onChavaClick?: () => void;
}

export function AppLayout({ children, className, currentPath, onChavaClick }: AppLayoutProps) {
  return (
    <div className="flex h-screen bg-surface-950 overflow-hidden">
      {/* Desktop sidebar */}
      <Sidebar currentPath={currentPath} onChavaClick={onChavaClick} />

      {/* Main content */}
      <main
        className={cn(
          'flex-1 overflow-y-auto',
          'pb-24 md:pb-0', // space for mobile nav
          className
        )}
      >
        {children}
      </main>

      {/* Mobile bottom nav */}
      <MobileNav currentPath={currentPath} onChavaClick={onChavaClick} />
    </div>
  );
}
