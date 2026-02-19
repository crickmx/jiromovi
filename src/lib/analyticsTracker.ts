/**
 * Analytics Tracker para Seguros Education
 *
 * Registra eventos de interacción con lecciones On Demand y Aula Virtual
 * para generar métricas útiles en el módulo de Analytics.
 */

import { supabase } from './supabase';

export type EventType =
  // On Demand events
  | 'lesson_view_start'
  | 'lesson_play'
  | 'lesson_pause'
  | 'lesson_complete'
  | 'lesson_progress'
  | 'lesson_download_attachment'
  // Aula Virtual events
  | 'class_open'
  | 'class_join_click'
  | 'class_join_success'
  | 'class_recording_open';

interface TrackEventParams {
  eventType: EventType;
  lessonId?: string;
  classId?: string;
  progressSeconds?: number;
  progressPercent?: number;
  durationSeconds?: number;
  device?: string;
  browser?: string;
  source?: string;
  metadata?: Record<string, any>;
}

class AnalyticsTracker {
  private sessionId: string;
  private userId: string | null = null;
  private lastProgressUpdate: number = 0;
  private progressUpdateInterval: number = 10000; // 10 segundos

  constructor() {
    // Generar o recuperar session_id de sessionStorage
    const existingSession = sessionStorage.getItem('analytics_session_id');
    if (existingSession) {
      this.sessionId = existingSession;
    } else {
      this.sessionId = crypto.randomUUID();
      sessionStorage.setItem('analytics_session_id', this.sessionId);
    }

    // Obtener user_id actual
    this.initializeUser();
  }

  private async initializeUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      this.userId = user.id;
    }
  }

  /**
   * Detecta el dispositivo actual
   */
  private getDevice(): string {
    const ua = navigator.userAgent;
    if (/mobile/i.test(ua)) return 'mobile';
    if (/tablet/i.test(ua)) return 'tablet';
    return 'web';
  }

  /**
   * Detecta el navegador actual
   */
  private getBrowser(): string {
    const ua = navigator.userAgent;
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return 'Unknown';
  }

  /**
   * Registra un evento de analytics
   */
  async trackEvent({
    eventType,
    lessonId,
    classId,
    progressSeconds = 0,
    progressPercent = 0,
    durationSeconds,
    device,
    browser,
    source = 'dashboard',
    metadata = {},
  }: TrackEventParams): Promise<string | null> {
    try {
      // Asegurar que tenemos userId
      if (!this.userId) {
        await this.initializeUser();
      }

      if (!this.userId) {
        console.warn('[AnalyticsTracker] No user authenticated');
        return null;
      }

      // Validar que tenemos lesson_id o class_id
      if (!lessonId && !classId) {
        console.error('[AnalyticsTracker] Must provide lessonId or classId');
        return null;
      }

      // Llamar a la función de Supabase
      const { data, error } = await supabase.rpc('registrar_evento_educacion', {
        p_user_id: this.userId,
        p_lesson_id: lessonId || null,
        p_class_id: classId || null,
        p_session_id: this.sessionId,
        p_event_type: eventType,
        p_progress_seconds: progressSeconds,
        p_progress_percent: progressPercent,
        p_duration_seconds: durationSeconds || null,
        p_device: device || this.getDevice(),
        p_browser: browser || this.getBrowser(),
        p_source: source,
        p_metadata: metadata,
      });

      if (error) {
        console.error('[AnalyticsTracker] Error tracking event:', error);
        return null;
      }

      return data as string;
    } catch (err) {
      console.error('[AnalyticsTracker] Exception tracking event:', err);
      return null;
    }
  }

  /**
   * Track lesson view start
   */
  async trackLessonViewStart(lessonId: string, durationSeconds?: number) {
    return this.trackEvent({
      eventType: 'lesson_view_start',
      lessonId,
      durationSeconds,
    });
  }

  /**
   * Track lesson play
   */
  async trackLessonPlay(lessonId: string, durationSeconds?: number) {
    return this.trackEvent({
      eventType: 'lesson_play',
      lessonId,
      durationSeconds,
    });
  }

  /**
   * Track lesson pause
   */
  async trackLessonPause(lessonId: string, progressSeconds: number, progressPercent: number) {
    return this.trackEvent({
      eventType: 'lesson_pause',
      lessonId,
      progressSeconds,
      progressPercent,
    });
  }

  /**
   * Track lesson progress (throttled - solo cada 10 segundos)
   */
  async trackLessonProgress(
    lessonId: string,
    progressSeconds: number,
    progressPercent: number,
    durationSeconds?: number
  ) {
    const now = Date.now();

    // Throttle: solo enviar cada X segundos
    if (now - this.lastProgressUpdate < this.progressUpdateInterval) {
      return null;
    }

    this.lastProgressUpdate = now;

    return this.trackEvent({
      eventType: 'lesson_progress',
      lessonId,
      progressSeconds,
      progressPercent,
      durationSeconds,
    });
  }

  /**
   * Track lesson complete (>=90%)
   */
  async trackLessonComplete(
    lessonId: string,
    progressSeconds: number,
    progressPercent: number,
    durationSeconds?: number
  ) {
    return this.trackEvent({
      eventType: 'lesson_complete',
      lessonId,
      progressSeconds,
      progressPercent,
      durationSeconds,
    });
  }

  /**
   * Track lesson attachment download
   */
  async trackLessonAttachmentDownload(lessonId: string, attachmentName: string) {
    return this.trackEvent({
      eventType: 'lesson_download_attachment',
      lessonId,
      metadata: { attachmentName },
    });
  }

  /**
   * Track class open (Aula Virtual)
   */
  async trackClassOpen(classId: string, source: string = 'dashboard') {
    return this.trackEvent({
      eventType: 'class_open',
      classId,
      source,
    });
  }

  /**
   * Track class join click
   */
  async trackClassJoinClick(classId: string) {
    return this.trackEvent({
      eventType: 'class_join_click',
      classId,
    });
  }

  /**
   * Track class join success
   */
  async trackClassJoinSuccess(classId: string) {
    return this.trackEvent({
      eventType: 'class_join_success',
      classId,
    });
  }

  /**
   * Track class recording open
   */
  async trackClassRecordingOpen(classId: string) {
    return this.trackEvent({
      eventType: 'class_recording_open',
      classId,
    });
  }

  /**
   * Reset session (útil para logout o nueva sesión)
   */
  resetSession() {
    this.sessionId = crypto.randomUUID();
    sessionStorage.setItem('analytics_session_id', this.sessionId);
    this.lastProgressUpdate = 0;
  }

  /**
   * Get current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }
}

// Singleton instance
export const analyticsTracker = new AnalyticsTracker();
