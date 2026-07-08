import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  resolveWorkspaceItems,
  type SidebarGrupo,
  type SidebarItemConfigRow,
  type SidebarSeparadorRow,
  type WorkspaceDefinition,
  type ResolvedItemGroup,
} from '../lib/workspaceConfig';

export function useSidebarItemsConfig() {
  const [grupos, setGrupos] = useState<SidebarGrupo[]>([]);
  const [itemConfigs, setItemConfigs] = useState<SidebarItemConfigRow[]>([]);
  const [separadores, setSeparadores] = useState<SidebarSeparadorRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data: gruposData }, { data: itemsData }, { data: separadoresData }] = await Promise.all([
      supabase.from('sidebar_grupos').select('id, workspace_id, nombre, orden, colapsado_default').order('orden'),
      supabase.from('sidebar_item_config').select('item_path, orden, grupo_id, badge_texto, badge_color'),
      supabase.from('sidebar_separadores').select('id, workspace_id, grupo_id, orden'),
    ]);
    setGrupos((gruposData ?? []) as SidebarGrupo[]);
    setItemConfigs((itemsData ?? []) as SidebarItemConfigRow[]);
    setSeparadores((separadoresData ?? []) as SidebarSeparadorRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const getResolvedItems = useCallback(
    (workspace: WorkspaceDefinition): ResolvedItemGroup[] => resolveWorkspaceItems(workspace, grupos, itemConfigs, separadores),
    [grupos, itemConfigs, separadores]
  );

  return { grupos, itemConfigs, separadores, loading, reload: load, getResolvedItems };
}
