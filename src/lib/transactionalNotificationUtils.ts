import { supabase } from './supabase';
import type {
  TransactionalNotificationTemplate,
  NotificationTemplateContext
} from './transactionalNotificationTypes';

export function renderTemplate(
  template: string | null,
  context: NotificationTemplateContext
): string {
  if (!template) return '';

  let result = template;

  for (const key in context) {
    const value = context[key];
    const token = `{{${key}}}`;
    result = result.split(token).join(String(value ?? ''));
  }

  return result;
}

export async function getTemplateByEventKey(
  eventKey: string
): Promise<TransactionalNotificationTemplate | null> {
  const { data, error } = await supabase
    .from('transactional_notification_templates')
    .select('*')
    .eq('event_key', eventKey)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('Error fetching template:', error);
    return null;
  }

  return data;
}

export async function createInAppNotification(params: {
  userId: string;
  title: string;
  body: string;
  linkUrl?: string;
}): Promise<boolean> {
  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id: params.userId,
      title: params.title,
      body: params.body,
      link_url: params.linkUrl || null,
      is_read: false
    });

  if (error) {
    console.error('Error creating in-app notification:', error);
    return false;
  }

  return true;
}

export async function markNotificationAsRead(notificationId: string): Promise<boolean> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }

  return true;
}

export async function getUserNotifications(userId: string, limit: number = 20) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }

  return data || [];
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('Error counting unread notifications:', error);
    return 0;
  }

  return count || 0;
}

export async function markAllNotificationsAsRead(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('Error marking all notifications as read:', error);
    return false;
  }

  return true;
}
