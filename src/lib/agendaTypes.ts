export type AgendaLocation = 'in_person' | 'phone' | 'jitsi';

export interface AgendaCalendar {
  id: string;
  user_id: string;
  brand: string | null;
  name: string;
  color: string;
  timezone: string;
  is_active: boolean;
}

export interface AgendaEventType {
  id: string;
  calendar_id: string;
  name: string;
  description: string | null;
  color: string;
  duration_minutes: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  min_notice_minutes: number;
  daily_limit: number | null;
  allowed_locations: AgendaLocation[];
  location_details: Record<string, string>;
  is_active: boolean;
}

export interface AvailabilityRule {
  id?: string;
  calendar_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  is_active?: boolean;
}

export interface PublicEventType extends AgendaEventType {
  calendar_name: string;
  timezone: string;
  organizer_name: string;
}

export interface AgendaSlot {
  start_at: string;
  end_at: string;
}
