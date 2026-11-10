import '@fontsource-variable/manrope';
import '@fontsource-variable/sora';
import '../../src/index.css';
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { UnifiedConversationList } from '../../src/components/contactCenter/UnifiedConversationList';
import type { Buzon, EstadoLista } from '../../src/lib/buzonWhatsApp';
if (new URLSearchParams(location.search).get('dark')) document.documentElement.classList.add('dark');
const now = Date.now();
const convs: any[] = [
  { id: 'wa_movi:1', channel: 'wa_movi', sourceId: '1', contactName: 'José Hernández Martínez de la Garza', contactPhone: '5215512345678', lastMessage: 'Buenas tardes, quisiera cotizar un seguro para mi auto modelo 2024', lastMessageAt: new Date(now - 6e5).toISOString(), unreadCount: 3, status: 'open', isGroup: false, groupName: null, avatarUrl: null },
  { id: 'wa_personal:2', channel: 'wa_personal', sourceId: '2', contactName: 'Ana López', contactPhone: '5533221100', lastMessage: '[image]', lastMessageAt: new Date(now - 36e5).toISOString(), unreadCount: 1, status: 'open', isGroup: false, groupName: null, avatarUrl: null },
  { id: 'wa_movi:3', channel: 'wa_movi', sourceId: '3', contactName: null, contactPhone: '5214421234567', lastMessage: 'Gracias', lastMessageAt: new Date(now - 9e7).toISOString(), unreadCount: 0, status: 'open', isGroup: false, groupName: null, avatarUrl: null },
  { id: 'wa_personal:4', channel: 'wa_personal', sourceId: '4', contactName: 'Archivado', contactPhone: '5500000000', lastMessage: 'viejo', lastMessageAt: new Date(now - 9e8).toISOString(), unreadCount: 0, status: 'archived', isGroup: false, groupName: null, avatarUrl: null },
];
function App() {
  const [buzon, setBuzon] = useState<Buzon>('all');
  const [estado, setEstado] = useState<EstadoLista>('open');
  const [search, setSearch] = useState('');
  const [sel, setSel] = useState<string | null>('wa_movi:1');
  return <div style={{ height: '100vh' }} className="bg-surface-canvas"><div className="h-full w-full md:w-[340px]">
    <UnifiedConversationList conversations={convs} selectedId={sel} onSelect={c => setSel(c.id)} search={search} onSearchChange={setSearch}
      buzon={buzon} onBuzonChange={setBuzon} estado={estado} onEstadoChange={setEstado} loading={false} participantNames={{}} />
  </div></div>;
}
createRoot(document.getElementById('root')!).render(<App />);
