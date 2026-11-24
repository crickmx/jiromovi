import { supabase } from './supabase';

export function generateMeetingCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 12; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function createMeeting(title: string, scheduledDatetime: Date | null, creatorId: string) {
  let code = generateMeetingCode();
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const { data: existing } = await supabase
      .from('meetings')
      .select('id')
      .eq('code', code)
      .maybeSingle();

    if (!existing) {
      break;
    }

    code = generateMeetingCode();
    attempts++;
  }

  const datetime = scheduledDatetime ? scheduledDatetime.toISOString() : new Date().toISOString();
  const status = scheduledDatetime ? 'scheduled' : 'active';

  const { data, error } = await supabase
    .from('meetings')
    .insert({
      code,
      creator_id: creatorId,
      title,
      scheduled_datetime: datetime,
      status,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export function formatMeetingDateTime(dateTime: string): { date: string; time: string } {
  const dt = new Date(dateTime);

  const date = dt.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const time = dt.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return { date, time };
}

export function getMeetingUrl(code: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/m/${code}`;
}

export function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'scheduled':
      return 'bg-blue-100 text-blue-800';
    case 'active':
      return 'bg-green-100 text-green-800';
    case 'ended':
      return 'bg-gray-100 text-gray-800';
    case 'cancelled':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'scheduled':
      return 'Programada';
    case 'active':
      return 'Activa';
    case 'ended':
      return 'Finalizada';
    case 'cancelled':
      return 'Cancelada';
    default:
      return 'Desconocida';
  }
}
