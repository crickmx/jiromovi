import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface ActiveTerms {
  id: string;
  version: number;
  titulo: string;
  contenido_html: string;
  tipo: 'terminos' | 'privacidad';
}

export interface TermsAcceptanceStatus {
  terminos: { accepted: boolean; terms: ActiveTerms | null };
  privacidad: { accepted: boolean; terms: ActiveTerms | null };
}

export function usePlatformTerms(userId: string | undefined, platform: 'movi' | 'seguwallet' | 'chava') {
  const [status, setStatus] = useState<TermsAcceptanceStatus>({
    terminos: { accepted: true, terms: null },
    privacidad: { accepted: true, terms: null },
  });
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  const needsAcceptance = !status.terminos.accepted || !status.privacidad.accepted;

  const checkAcceptance = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Get active terms
    const { data: activeTerms } = await supabase
      .from('platform_terms')
      .select('*')
      .eq('activo', true);

    if (!activeTerms || activeTerms.length === 0) {
      setStatus({
        terminos: { accepted: true, terms: null },
        privacidad: { accepted: true, terms: null },
      });
      setLoading(false);
      return;
    }

    // Check user acceptances for current active terms
    const { data: acceptances } = await supabase
      .from('platform_terms_acceptance')
      .select('terms_id')
      .eq('usuario_id', userId);

    const acceptedIds = new Set((acceptances || []).map(a => a.terms_id));

    const terminosDoc = activeTerms.find(t => t.tipo === 'terminos') || null;
    const privacidadDoc = activeTerms.find(t => t.tipo === 'privacidad') || null;

    setStatus({
      terminos: {
        accepted: terminosDoc ? acceptedIds.has(terminosDoc.id) : true,
        terms: terminosDoc,
      },
      privacidad: {
        accepted: privacidadDoc ? acceptedIds.has(privacidadDoc.id) : true,
        terms: privacidadDoc,
      },
    });
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    checkAcceptance();
  }, [checkAcceptance]);

  const acceptTerms = useCallback(async () => {
    if (!userId) return false;
    setAccepting(true);

    try {
      // Get user's IP
      let ipAddress = '';
      try {
        const resp = await fetch('https://api.ipify.org?format=json');
        const data = await resp.json();
        ipAddress = data.ip || '';
      } catch { /* ignore */ }

      const userAgent = navigator.userAgent;
      const records: {
        usuario_id: string;
        terms_id: string;
        terms_version: number;
        terms_tipo: string;
        platform: string;
        ip_address: string;
        user_agent: string;
      }[] = [];

      if (!status.terminos.accepted && status.terminos.terms) {
        records.push({
          usuario_id: userId,
          terms_id: status.terminos.terms.id,
          terms_version: status.terminos.terms.version,
          terms_tipo: 'terminos',
          platform,
          ip_address: ipAddress,
          user_agent: userAgent,
        });
      }

      if (!status.privacidad.accepted && status.privacidad.terms) {
        records.push({
          usuario_id: userId,
          terms_id: status.privacidad.terms.id,
          terms_version: status.privacidad.terms.version,
          terms_tipo: 'privacidad',
          platform,
          ip_address: ipAddress,
          user_agent: userAgent,
        });
      }

      if (records.length > 0) {
        const { error } = await supabase
          .from('platform_terms_acceptance')
          .insert(records);

        if (error) {
          console.error('[PlatformTerms] Error accepting:', error);
          setAccepting(false);
          return false;
        }
      }

      // Update status
      setStatus({
        terminos: { ...status.terminos, accepted: true },
        privacidad: { ...status.privacidad, accepted: true },
      });
      setAccepting(false);
      return true;
    } catch (err) {
      console.error('[PlatformTerms] Error:', err);
      setAccepting(false);
      return false;
    }
  }, [userId, platform, status]);

  return {
    status,
    loading,
    needsAcceptance,
    accepting,
    acceptTerms,
    refresh: checkAcceptance,
  };
}
