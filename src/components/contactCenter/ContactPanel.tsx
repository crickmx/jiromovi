import { useState } from 'react';
import { User, Phone, Mail, Tag, ClipboardList, UserPlus, FileText, CreditCard, ExternalLink, ChevronDown, ChevronRight, CheckCircle, Clock, Archive, Building2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { type CCConversation, formatConversationName, formatPhone, CHANNEL_LABELS } from '@/lib/contactCenterTypes';
import { ChannelBadge } from './ChannelBadge';

interface ContactPanelProps {
  conversation: CCConversation;
  onStatusChange?: (id: string, status: CCConversation['status']) => void;
}

type ActionType = 'crm' | 'tramite' | 'quote' | 'note';

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-neutral-100 dark:border-neutral-800 last:border-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
      >
        {title}
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

const STATUS_CONFIG: Record<CCConversation['status'], { label: string; icon: React.FC<{ className?: string }>; color: string }> = {
  open:     { label: 'Abierta',   icon: CheckCircle, color: 'text-emerald-600' },
  pending:  { label: 'Pendiente', icon: Clock,       color: 'text-amber-600' },
  closed:   { label: 'Cerrada',   icon: CheckCircle, color: 'text-neutral-500' },
  archived: { label: 'Archivada', icon: Archive,     color: 'text-neutral-400' },
};

export function ContactPanel({ conversation, onStatusChange }: ContactPanelProps) {
  const [savingStatus, setSavingStatus] = useState(false);
  const name = formatConversationName(conversation);
  const statusConfig = STATUS_CONFIG[conversation.status];

  const changeStatus = async (status: CCConversation['status']) => {
    setSavingStatus(true);
    await supabase.from('cc_conversations').update({ status }).eq('id', conversation.id);
    onStatusChange?.(conversation.id, status);
    setSavingStatus(false);
  };

  const openCRMLink = () => {
    if (conversation.crm_contact_id) {
      window.open(`/mi-crm/${conversation.crm_contact_id}`, '_blank');
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-700">
      {/* Contact summary */}
      <div className="px-4 py-5 border-b border-neutral-100 dark:border-neutral-800 text-center">
        <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center text-xl font-bold text-accent mx-auto mb-2">
          {name.charAt(0).toUpperCase()}
        </div>
        <h3 className="font-semibold text-neutral-800 dark:text-white text-sm mb-1">{name}</h3>
        <ChannelBadge channel={conversation.channel} size="md" />
      </div>

      {/* Status */}
      <Section title="Estado">
        <div className="space-y-1.5">
          {(['open', 'pending', 'closed', 'archived'] as const).map(s => {
            const cfg = STATUS_CONFIG[s];
            const Icon = cfg.icon;
            return (
              <button
                key={s}
                onClick={() => changeStatus(s)}
                disabled={savingStatus || conversation.status === s}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all',
                  conversation.status === s
                    ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200'
                    : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:text-neutral-700 dark:hover:text-neutral-300'
                )}
              >
                <Icon className={cn('w-3.5 h-3.5', conversation.status === s ? cfg.color : 'text-neutral-400')} />
                {cfg.label}
                {conversation.status === s && <span className="ml-auto text-[10px] text-neutral-400">Actual</span>}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Contact info */}
      <Section title="Contacto">
        <div className="space-y-2">
          {conversation.contact_phone && (
            <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
              <Phone className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
              <span>{formatPhone(conversation.contact_phone)}</span>
            </div>
          )}
          {conversation.contact_email && (
            <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
              <Mail className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
              <span className="truncate">{conversation.contact_email}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Canal: {CHANNEL_LABELS[conversation.channel]}</span>
          </div>
          {conversation.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {conversation.tags.map(tag => (
                <span key={tag} className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 rounded text-[10px]">
                  <Tag className="w-2.5 h-2.5 inline mr-0.5" />{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* Quick actions */}
      <Section title="Acciones rapidas">
        <div className="space-y-1.5">
          <ActionButton
            icon={User}
            label={conversation.crm_contact_id ? 'Ver en CRM' : 'Crear contacto CRM'}
            onClick={conversation.crm_contact_id ? openCRMLink : () => {}}
            color="text-blue-600"
          />
          <ActionButton
            icon={ClipboardList}
            label="Crear tramite"
            onClick={() => window.open('/tramites', '_blank')}
            color="text-teal-600"
          />
          <ActionButton
            icon={FileText}
            label="Nueva cotizacion"
            onClick={() => window.open('/formularios-cotizacion', '_blank')}
            color="text-sky-600"
          />
          {conversation.crm_contact_id && (
            <ActionButton
              icon={CreditCard}
              label="Ver polizas"
              onClick={() => window.open(`/mis-polizas`, '_blank')}
              color="text-neutral-600"
            />
          )}
        </div>
      </Section>

      {/* Metadata */}
      <Section title="Informacion" defaultOpen={false}>
        <div className="space-y-2 text-xs text-neutral-500 dark:text-neutral-400">
          <div className="flex justify-between">
            <span>Creada</span>
            <span>{new Date(conversation.created_at).toLocaleDateString('es-MX')}</span>
          </div>
          <div className="flex justify-between">
            <span>Ultimo mensaje</span>
            <span>{conversation.last_message_at ? new Date(conversation.last_message_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</span>
          </div>
          {conversation.unread_count > 0 && (
            <div className="flex justify-between">
              <span>No leidos</span>
              <span className="text-emerald-600 font-medium">{conversation.unread_count}</span>
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick, color }: { icon: React.FC<{ className?: string }>; label: string; onClick: () => void; color: string }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors text-left group"
    >
      <Icon className={cn('w-3.5 h-3.5 flex-shrink-0', color)} />
      <span className="flex-1">{label}</span>
      <ExternalLink className="w-3 h-3 text-neutral-300 dark:text-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}
