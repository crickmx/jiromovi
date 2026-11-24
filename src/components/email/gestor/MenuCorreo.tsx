import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList, Plus, Mail, MailOpen, FolderInput, Archive, Trash2, ExternalLink, Reply, ReplyAll, Forward,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { type ImapFolder, etiquetaCarpeta, iconoCarpeta, ordenarCarpetas } from './tipos';

export type AccionCorreo =
  | { tipo: 'crear_tramite' }
  | { tipo: 'agregar_tramite' }
  | { tipo: 'leido'; valor: boolean }
  | { tipo: 'mover'; destino: string }
  | { tipo: 'archivar' }
  | { tipo: 'eliminar' };

interface Props {
  trigger: ReactNode;
  carpetas: ImapFolder[];
  carpetaActual: string;
  puedeArchivar: boolean;
  /** Para un solo correo: si ya está ligado a un trámite. */
  tramite?: { id: string; folio: string } | null;
  /** Estado leído de lo seleccionado (para ofrecer lo contrario). */
  leido?: boolean;
  onAccion: (a: AccionCorreo) => void;
  /** Ocultar acciones que ya están a la vista (en la barra de lectura). */
  sinTramite?: boolean;
  align?: 'start' | 'end';
  /** Responder / a todos / reenviar (en la barra de lectura, cuando no caben como botones). */
  respuestas?: { responder: () => void; todos: () => void; reenviar: () => void };
}

const it = 'min-h-[40px] gap-2.5 cursor-pointer';

export function MenuCorreo(p: Props) {
  const navigate = useNavigate();
  const destinos = ordenarCarpetas(p.carpetas).filter(f => f.path !== p.carpetaActual);
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>{p.trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align={p.align || 'end'} className="w-60">
        {p.respuestas && (
          <>
            <DropdownMenuItem className={it} onSelect={p.respuestas.responder}><Reply className="w-4 h-4" aria-hidden /> Responder</DropdownMenuItem>
            <DropdownMenuItem className={it} onSelect={p.respuestas.todos}><ReplyAll className="w-4 h-4" aria-hidden /> Responder a todos</DropdownMenuItem>
            <DropdownMenuItem className={it} onSelect={p.respuestas.reenviar}><Forward className="w-4 h-4" aria-hidden /> Reenviar</DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {!p.sinTramite && (
          <>
            <DropdownMenuLabel className="movi-eyebrow text-neutral-400 dark:text-neutral-500">Trámites</DropdownMenuLabel>
            {p.tramite ? (
              <DropdownMenuItem className={it} onSelect={() => navigate(`/tramites/${p.tramite!.id}`)}>
                <ExternalLink className="w-4 h-4" aria-hidden /> Ver trámite {p.tramite.folio}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem className={it} onSelect={() => p.onAccion({ tipo: 'crear_tramite' })}>
                <ClipboardList className="w-4 h-4" aria-hidden /> Crear trámite
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className={it} onSelect={() => p.onAccion({ tipo: 'agregar_tramite' })}>
              <Plus className="w-4 h-4" aria-hidden /> Agregar a trámite
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {p.leido !== undefined && (
          <DropdownMenuItem className={it} onSelect={() => p.onAccion({ tipo: 'leido', valor: !p.leido })}>
            {p.leido ? <Mail className="w-4 h-4" aria-hidden /> : <MailOpen className="w-4 h-4" aria-hidden />}
            {p.leido ? 'Marcar como no leído' : 'Marcar como leído'}
          </DropdownMenuItem>
        )}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={it}>
            <FolderInput className="w-4 h-4" aria-hidden /> Mover a…
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-56 max-h-80 overflow-y-auto">
            {destinos.map(f => {
              const Icon = iconoCarpeta(f);
              return (
                <DropdownMenuItem key={f.path} className={it} onSelect={() => p.onAccion({ tipo: 'mover', destino: f.path })}>
                  <Icon className="w-4 h-4" aria-hidden /> {etiquetaCarpeta(f)}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {p.puedeArchivar && (
          <DropdownMenuItem className={it} onSelect={() => p.onAccion({ tipo: 'archivar' })}>
            <Archive className="w-4 h-4" aria-hidden /> Archivar
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem className={`${it} text-red-600 dark:text-red-400 focus:text-red-700 dark:focus:text-red-300`} onSelect={() => p.onAccion({ tipo: 'eliminar' })}>
          <Trash2 className="w-4 h-4" aria-hidden /> Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
