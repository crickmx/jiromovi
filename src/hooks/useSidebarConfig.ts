import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { resolveNavOrder, type SidebarConfigRow, type ResolvedNavEntry } from '../lib/workspaceConfig';

export function useSidebarConfig() {
  const [resolved, setResolved] = useState<ResolvedNavEntry[]>(() => resolveNavOrder([]));
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('sidebar_config').select('*');
    setResolved(resolveNavOrder((data ?? []) as SidebarConfigRow[]));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return { resolved, loading, reload: load };
}
