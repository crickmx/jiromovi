import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  resolveWorkspaceItems,
  type SidebarGrupo,
  type SidebarItemConfigRow,
  type WorkspaceDefinition,
  type ResolvedItemGroup,
} from '../lib/workspaceConfig';

export function useSidebarItemsConfig() {
  const [grupos, setGrupos] = useState<SidebarGrupo[]>([]);
  const [itemConfigs, setItemConfigs] = useState<SidebarItemConfigRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data: gruposData }, { data: itemsData }] = await Promise.all([
      supabase.from('sidebar_grupos').select('id, workspace_id, nombre, orden, colapsado_default').order('orden'),
      supabase.from('sidebar_item_config').select('item_path, orden, grupo_id, badge_texto, badge_color'),
    ]);
    setGrupos((gruposData ?? []) as SidebarGrupo[]);
    setItemConfigs((itemsData ?? []) as SidebarItemConfigRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const getResolvedItems = useCallback(
    (workspace: WorkspaceDefinition): ResolvedItemGroup[] => resolveWorkspaceItems(workspace, grupos, itemConfigs),
    [grupos, itemConfigs]
  );

  return { grupos, itemConfigs, loading, reload: load, getResolvedItems };
}
